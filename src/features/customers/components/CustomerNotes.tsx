import { useState } from 'react';
import { format } from 'date-fns';
import { useCustomerNotes, type CustomerNote } from '@/hooks/useCustomers';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type Props = {
  customerId: string;
  notes: CustomerNote[];
};

export function CustomerNotes({ customerId, notes }: Props) {
  const { createNote } = useCustomerNotes(customerId);
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    
    setIsSubmitting(true);
    try {
      await createNote.mutateAsync(newNote);
      setNewNote('');
      toast.success('Note added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium mb-4">Internal Team Notes</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea 
            placeholder="Add a note about this customer... (Not visible to the customer)"
            className="min-h-[100px] resize-none"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || !newNote.trim()}>
              Add Note
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {notes.length === 0 ? (
          <div className="py-8 text-center border border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground">No notes added yet.</p>
          </div>
        ) : (
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
            {notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((note) => (
              <div key={note.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-200 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                  <span className="text-xs font-bold">
                    {note.profiles?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border bg-card shadow-sm">
                  <div className="flex items-center justify-between space-x-2 mb-1">
                    <div className="font-bold text-slate-900 text-sm">{note.profiles?.full_name || 'Team Member'}</div>
                    <time className="text-xs text-muted-foreground">{format(new Date(note.created_at), 'MMM d, h:mm a')}</time>
                  </div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{note.note_text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
