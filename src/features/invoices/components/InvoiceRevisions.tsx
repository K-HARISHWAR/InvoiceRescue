import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { History as HistoryIcon, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';

interface InvoiceRevisionsProps {
  invoiceId: string;
}

export function InvoiceRevisions({ invoiceId }: InvoiceRevisionsProps) {
  const { business } = useSession();

  const { data: revisions, isLoading } = useQuery({
    queryKey: ['invoice_revisions', invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_revisions')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('revision_number', { ascending: false });
      
      if (error) throw error;
      
      // We also fetch profiles to get names
      const userIds = data.map(r => r.changed_by).filter(Boolean);
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        profiles?.forEach(p => {
          profilesMap[p.id] = p.full_name || 'Unknown User';
        });
      }

      return data.map(r => ({
        ...r,
        user_name: profilesMap[r.changed_by] || 'System'
      }));
    },
    enabled: !!business && !!invoiceId,
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-neutral-500">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        Loading history...
      </div>
    );
  }

  if (!revisions || revisions.length === 0) {
    return (
      <div className="p-8 text-center text-neutral-500 border border-neutral-200 rounded-lg bg-neutral-50">
        <HistoryIcon className="h-8 w-8 mx-auto mb-4 text-neutral-400" />
        No revision history for this invoice yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        {revisions.map((rev) => (
          <div key={rev.id} className="bg-white border border-neutral-200 shadow-sm rounded-lg overflow-hidden">
            <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-200 flex justify-between items-center">
              <div>
                <span className="font-semibold text-neutral-900">Revision {rev.revision_number}</span>
                <span className="text-neutral-500 text-sm ml-2">
                  {format(new Date(rev.created_at), 'dd MMM yyyy • hh:mm a')}
                </span>
              </div>
              <div className="text-sm font-medium text-neutral-700">
                {rev.user_name}
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              {rev.change_reason && (
                <div className="text-sm bg-blue-50 text-blue-800 p-3 rounded border border-blue-100">
                  <span className="font-semibold mr-2">Reason:</span>
                  {rev.change_reason}
                </div>
              )}
              
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Changes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.keys(rev.changed_fields).map((field) => {
                    const before = rev.before_data[field];
                    const after = rev.after_data[field];
                    
                    return (
                      <div key={field} className="text-sm flex flex-col p-2 bg-neutral-50 rounded border border-neutral-100">
                        <span className="font-medium text-neutral-700 capitalize mb-1">{field.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-2 text-neutral-600">
                          <span className="line-through text-red-500 break-all bg-red-50 px-1 rounded">{String(before ?? 'empty')}</span>
                          <ArrowRight className="h-3 w-3 flex-shrink-0" />
                          <span className="text-green-600 font-medium break-all bg-green-50 px-1 rounded">{String(after ?? 'empty')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
