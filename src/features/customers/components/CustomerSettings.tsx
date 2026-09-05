import { useState } from 'react';
import { useCustomers, type Customer } from '@/hooks/useCustomers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type Props = {
  customer: Customer;
};

export function CustomerSettings({ customer }: Props) {
  const { updateCustomer } = useCustomers();
  const [formData, setFormData] = useState({
    default_payment_terms_days: customer.default_payment_terms_days?.toString() || '',
    preferred_currency: customer.preferred_currency || '',
    collection_notes: customer.collection_notes || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updates = {
        default_payment_terms_days: formData.default_payment_terms_days ? parseInt(formData.default_payment_terms_days) : null,
        preferred_currency: formData.preferred_currency || null,
        collection_notes: formData.collection_notes || null,
      };
      await updateCustomer.mutateAsync({ id: customer.id, updates });
      toast.success('Settings updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h3 className="text-lg font-medium mb-4">Customer Settings</h3>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="payment_terms">Default Payment Terms (Days)</Label>
            <Input 
              id="payment_terms" 
              type="number" 
              placeholder="e.g. 30"
              value={formData.default_payment_terms_days}
              onChange={(e) => setFormData({ ...formData, default_payment_terms_days: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Automatically applied to new invoices.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Preferred Currency</Label>
            <Select 
              value={formData.preferred_currency || ''} 
              onValueChange={(val) => setFormData(prev => ({ ...prev, preferred_currency: val || '' }))}
            >
              <SelectTrigger id="currency" className="w-full">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                <SelectItem value="USD">USD - US Dollar</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
                <SelectItem value="GBP">GBP - British Pound</SelectItem>
                <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                <SelectItem value="SGD">SGD - Singapore Dollar</SelectItem>
                <SelectItem value="AED">AED - UAE Dirham</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="collection_notes">Collection Strategy Notes</Label>
          <Input 
            id="collection_notes" 
            placeholder="Special instructions for the collections agent..."
            value={formData.collection_notes}
            onChange={(e) => setFormData({ ...formData, collection_notes: e.target.value })}
          />
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Settings'}
        </Button>
      </form>
    </div>
  );
}
