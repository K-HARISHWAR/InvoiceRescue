import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { recoveryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';
import { generateRecoveryZip } from '@/lib/recovery/packGenerator';

export interface TimelineEvent {
  id: string;
  event_type: 'invoice_issued' | 'communication_sent' | 'communication_received' | 'payment_promise' | 'promise_missed' | 'payment_recorded' | 'collection_action';
  title: string;
  description: string;
  event_date: string;
  amount: number | null;
  source_table: string;
  source_id: string;
}

export function useRecoveryPack(invoiceId?: string) {
  const { session } = useSession();

  const { data: timeline, isLoading: isLoadingTimeline, isError, error } = useQuery({
    queryKey: recoveryKeys.timeline(invoiceId),
    queryFn: async (): Promise<TimelineEvent[]> => {
      if (!invoiceId) return [];
      const { data, error } = await supabase
        .rpc('get_invoice_timeline', { p_invoice_id: invoiceId });
      
      if (error) throw error;
      return data as TimelineEvent[];
    },
    enabled: !!invoiceId,
  });

  const generatePackMutation = useMutation({
    mutationFn: async ({ selectedEvents, invoiceData }: { selectedEvents: TimelineEvent[], invoiceData: any }) => {
      if (!session) throw new Error("Not authenticated");

      // 1. Generate AI Summary via Edge Function
      let aiSummary = "";
      try {
        const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-recovery-data', {
          body: {
            invoice_id: invoiceId,
            timeline_events: selectedEvents
          }
        });

        if (aiError) throw aiError;
        if (!aiData?.success) throw new Error(aiData?.error || "Unknown error generating summary");
        
        aiSummary = aiData.summary;
      } catch (err: unknown) {
        console.warn('AI Edge Function failed, using basic local summary fallback', err);
        aiSummary = `[LOCAL TESTING FALLBACK] - AI Summary could not be generated because the Edge Function is not running.\n\nThis is an organizational summary of verified events for Invoice ${invoiceData.invoice_number} belonging to ${invoiceData.customers?.name || 'Customer'}. The original invoice amount was ${invoiceData.total_amount} ${invoiceData.currency}, with ${invoiceData.outstanding_amount} currently outstanding. \n\nPlease review the attached timeline for a chronological list of events.`;
      }

      // 2. Fetch documents for this invoice from DB
      const { data: documents, error: docsError } = await supabase
        .from('invoice_documents')
        .select('*')
        .eq('invoice_id', invoiceId);

      if (docsError) throw docsError;

      // 3. Download actual files from Storage
      const downloadedFiles = await Promise.all(
        (documents || []).map(async (doc) => {
          const { data: fileData, error: fileError } = await supabase.storage
            .from('documents') // Assuming bucket name is 'documents'
            .download(doc.storage_path);
          
          if (fileError) {
             console.error("Failed to download doc:", doc.storage_path, fileError);
             return null;
          }
          return {
             name: doc.original_file_name || `document_${doc.id}`,
             blob: fileData
          };
        })
      );

      const validFiles = downloadedFiles.filter((f): f is {name: string, blob: Blob} => f !== null);

      // 4. Generate client-side ZIP with PDF
      await generateRecoveryZip(invoiceData, selectedEvents, aiSummary, validFiles);

      // 5. Update collection stage and audit log
      await supabase.from('invoices').update({ collection_stage: 'recovery_ready' }).eq('id', invoiceId);
      
      await supabase.from('audit_logs').insert({
        business_id: invoiceData.business_id,
        actor_user_id: session.user.id,
        event_type: 'recovery_pack_generated',
        entity_type: 'invoice',
        entity_id: invoiceId,
        metadata: { selected_events_count: selectedEvents.length }
      });
    },
    onSuccess: () => {
      toast.success('Recovery Pack generated successfully!');
    },
    onError: (err: Error) => {
      console.error('Error generating pack:', err);
      toast.error(err.message || 'Failed to generate Recovery Pack');
    }
  });

  return {
    timeline,
    isLoadingTimeline,
    isError,
    error,
    generatePack: generatePackMutation.mutateAsync,
    isGenerating: generatePackMutation.isPending
  };
}
