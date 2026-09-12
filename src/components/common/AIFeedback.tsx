import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface AIFeedbackProps {
  feature: 'invoice_extraction' | 'email_classification' | 'promise_detection' | 'draft_generation';
  entityType: 'invoice' | 'communication' | 'collection_action';
  entityId: string;
  aiRunId?: string;
  className?: string;
}

export function AIFeedback({ feature, entityType, entityId, aiRunId, className = '' }: AIFeedbackProps) {
  const { business } = useSession();
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction, setCorrection] = useState('');

  const submitFeedback = async (rating: number) => {
    if (!business) return;
    
    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('ai_feedback').insert({
        business_id: business.id,
        user_id: user.id,
        feature,
        entity_type: entityType,
        entity_id: entityId,
        ai_run_id: aiRunId || null,
        rating,
        correction: correction || null
      });

      if (error) throw error;
      
      setSubmitted(rating);
      if (rating === -1) {
        setShowCorrection(true);
      } else {
        toast.success("Thank you for your feedback!");
      }
    } catch (err: any) {
      toast.error("Failed to submit feedback");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitCorrection = async () => {
    if (!business || !correction.trim()) return;
    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      
      // Update the existing feedback record for this user and entity
      const { error } = await supabase.from('ai_feedback')
        .update({ correction })
        .eq('entity_id', entityId)
        .eq('user_id', user?.id)
        .eq('feature', feature)
        .eq('rating', -1);

      if (error) throw error;
      
      setShowCorrection(false);
      toast.success("Correction saved. This will help improve the AI.");
    } catch (err: any) {
      toast.error("Failed to save correction");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted === 1) {
    return (
      <div className={`flex items-center text-xs text-green-600 font-medium ${className}`}>
        <ThumbsUp className="w-3 h-3 mr-1.5" /> AI output marked as correct
      </div>
    );
  }

  if (submitted === -1 && !showCorrection) {
    return (
      <div className={`flex items-center text-xs text-neutral-500 font-medium ${className}`}>
        <ThumbsDown className="w-3 h-3 mr-1.5" /> Thanks for your feedback
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {submitted === null ? (
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Rate AI Output:</span>
          <div className="flex gap-1">
            <button 
              onClick={() => submitFeedback(1)}
              disabled={isSubmitting}
              className="p-1.5 rounded text-neutral-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
              title="Correct"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button 
              onClick={() => submitFeedback(-1)}
              disabled={isSubmitting}
              className="p-1.5 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Incorrect"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : showCorrection ? (
        <div className="flex flex-col gap-2 mt-2 bg-neutral-50 p-3 rounded border border-neutral-200">
          <label className="text-xs font-medium text-neutral-700">What went wrong? (Optional)</label>
          <textarea 
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="e.g. The amount was extracted as 100 instead of 1000..."
            className="text-sm p-2 border border-neutral-300 rounded focus:ring-1 focus:ring-blue-500 outline-none w-full"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowCorrection(false)}>Skip</Button>
            <Button size="sm" onClick={submitCorrection} disabled={isSubmitting || !correction.trim()}>
              {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Submit
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
