import { useState, useEffect } from 'react';
import { useEntitySettings } from '@/hooks/useEntitySettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

export function EmailTemplateSettings({ entityId }: { entityId: string }) {
  const { templates, isLoading, updateTemplate } = useEntitySettings(entityId);
  const [activeTemplateType, setActiveTemplateType] = useState<string>('friendly');
  
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeTemplate = templates?.find(t => t.template_type === activeTemplateType);

  useEffect(() => {
    if (activeTemplate) {
      setSubject(activeTemplate.subject || '');
      setBody(activeTemplate.body || '');
      setIsDirty(false);
    } else {
      setSubject('');
      setBody('');
      setIsDirty(false);
    }
  }, [activeTemplate, activeTemplateType]);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await updateTemplate.mutateAsync({
        template_type: activeTemplateType,
        subject,
        body
      });
      toast.success('Template saved');
      setIsDirty(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save template');
    } finally {
      setIsSubmitting(false);
    }
  };

  const templateTypes = [
    { id: 'friendly', label: 'Friendly Reminder (Before Due)' },
    { id: 'due', label: 'Due Date Reminder' },
    { id: 'overdue', label: 'First Overdue Reminder' },
    { id: 'promise', label: 'Promise Follow-up' },
    { id: 'escalation', label: 'Escalation Notice' },
  ];

  if (isLoading) {
    return <div className="p-8 text-center text-neutral-500">Loading templates...</div>;
  }

  return (
    <div className="bg-white rounded-lg border max-w-4xl flex overflow-hidden min-h-[600px]">
      {/* Sidebar for Template Types */}
      <div className="w-64 bg-neutral-50 border-r flex-shrink-0">
        <div className="p-4 border-b">
          <h3 className="font-medium text-neutral-900">Email Templates</h3>
        </div>
        <div className="p-2 space-y-1">
          {templateTypes.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTemplateType(t.id)}
              className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                activeTemplateType === t.id 
                  ? 'bg-white shadow-sm border border-neutral-200 font-medium text-primary' 
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        <div className="p-6 flex-1 space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-md p-4 text-sm text-blue-800">
            <p className="font-medium mb-2">Available Tokens:</p>
            <div className="flex flex-wrap gap-2">
              {['customer_name', 'invoice_number', 'outstanding_amount', 'due_date', 'promised_date', 'entity_name'].map(token => (
                <span key={token} className="px-2 py-1 bg-white text-blue-700 rounded shadow-sm text-xs font-mono border border-blue-200">
                  {`{{${token}}}`}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email Subject</Label>
            <Input 
              value={subject} 
              onChange={e => { setSubject(e.target.value); setIsDirty(true); }} 
              placeholder="Subject..."
            />
          </div>

          <div className="space-y-2 flex-1 flex flex-col h-full">
            <Label>Email Body (HTML supported)</Label>
            <textarea
              value={body}
              onChange={e => { setBody(e.target.value); setIsDirty(true); }}
              className="flex-1 w-full min-h-[300px] p-3 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Hi {{customer_name}}, ..."
            />
          </div>
        </div>

        <div className="p-4 border-t bg-neutral-50 flex justify-end">
          <Button onClick={handleSave} disabled={!isDirty || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Template
          </Button>
        </div>
      </div>
    </div>
  );
}
