import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Calendar, Loader2, AlertCircle, IndianRupee, Building2, Calculator, Receipt } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';

import { useSession } from '@/hooks/useSession';
import { useCustomers } from '@/hooks/useCustomers';
import { useInvoices, type Invoice } from '@/hooks/useInvoices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';

const invoiceSchema = z.object({
  entity_id: z.string().min(1, 'Issuing entity is required'),
  customer_id: z.string().min(1, 'Please select a customer'),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  due_date: z.string().optional(),
  currency: z.string().min(3).max(3),
  subtotal: z.coerce.number().min(0, 'Subtotal must be positive'),
  tax_amount: z.coerce.number().min(0, 'Tax must be positive'),
  total_amount: z.coerce.number().min(0, 'Total must be positive'),
  payment_terms_days: z.coerce.number().int().optional(),
  reason: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface EditInvoiceDialogProps {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditInvoiceDialog({ invoice, open, onOpenChange }: EditInvoiceDialogProps) {
  const { entities } = useSession();
  const { customers, isLoading: isLoadingCustomers } = useCustomers();
  const { updateInvoice } = useInvoices();
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [pendingData, setPendingData] = useState<InvoiceFormValues | null>(null);
  
  const isDraft = invoice.payment_status === 'draft';
  const isPaidOrVoid = invoice.payment_status === 'paid' || invoice.payment_status === 'void';

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: {
      customer_id: invoice.customer_id,
      entity_id: invoice.entity_id,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      payment_terms_days: invoice.payment_terms_days || undefined,
      due_date: invoice.due_date || '',
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax_amount,
      total_amount: invoice.total_amount,
      reason: '',
    }
  });

  const watchInvoiceDate = watch('invoice_date');
  const watchPaymentTerms = watch('payment_terms_days');
  const watchSubtotal = watch('subtotal');
  const watchTax = watch('tax_amount');
  const watchEntityId = watch('entity_id');
  const watchReason = watch('reason');

  useEffect(() => {
    if (watchEntityId && entities.length > 0) {
      const selectedEntity = entities.find(e => e.id === watchEntityId);
      if (selectedEntity) {
        setValue('currency', selectedEntity.currency);
      }
    }
  }, [watchEntityId, entities, setValue]);

  useEffect(() => {
    const sub = Number(watchSubtotal) || 0;
    const tax = Number(watchTax) || 0;
    setValue('total_amount', sub + tax);
  }, [watchSubtotal, watchTax, setValue]);

  useEffect(() => {
    if (watchInvoiceDate && typeof watchPaymentTerms === 'number') {
      try {
        const date = parseISO(watchInvoiceDate);
        const newDueDate = addDays(date, watchPaymentTerms);
        setValue('due_date', format(newDueDate, 'yyyy-MM-dd'));
      } catch (e) {
        // ignore
      }
    }
  }, [watchInvoiceDate, watchPaymentTerms, setValue]);

  const executeUpdate = async (data: InvoiceFormValues) => {
    try {
      let finalDueDate = data.due_date;
      if (!finalDueDate && data.payment_terms_days !== undefined) {
        finalDueDate = format(addDays(parseISO(data.invoice_date), data.payment_terms_days), 'yyyy-MM-dd');
      }

      await updateInvoice.mutateAsync({
        id: invoice.id,
        expectedVersion: invoice.version,
        reason: isDraft ? undefined : data.reason,
        updates: {
          customer_id: data.customer_id,
          entity_id: data.entity_id,
          invoice_number: data.invoice_number,
          invoice_date: data.invoice_date,
          due_date: finalDueDate,
          payment_terms_days: data.payment_terms_days,
          currency: data.currency,
          subtotal: data.subtotal,
          tax_amount: data.tax_amount,
          total_amount: data.total_amount
        }
      });

      toast.success('Invoice updated successfully');
      setDuplicateWarning(false);
      setPendingData(null);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update invoice');
    }
  };

  const onSubmit = async (data: InvoiceFormValues) => {
    if (!isDraft && (!data.reason || !data.reason.trim())) {
      toast.error('A reason for change is required.');
      return;
    }

    if (data.total_amount < invoice.amount_paid) {
      toast.error(`Total amount cannot be less than the paid amount (${invoice.currency} ${invoice.amount_paid}).`);
      return;
    }

    // Check for duplicate invoice number
    if (data.invoice_number !== invoice.invoice_number || data.entity_id !== invoice.entity_id) {
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('entity_id', data.entity_id)
        .eq('invoice_number', data.invoice_number)
        .neq('id', invoice.id)
        .limit(1);

      if (existing && existing.length > 0) {
        setPendingData(data);
        setDuplicateWarning(true);
        return;
      }
    }

    await executeUpdate(data);
  };

  if (isPaidOrVoid) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Edit Invoice</DialogTitle>
            <DialogDescription>
              This invoice is currently in a "{invoice.payment_status}" state. Financial fields and metadata are locked to preserve audit history. 
              If a correction is needed, you must void this invoice and create a replacement.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-4">
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (duplicateWarning && pendingData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-amber-600">Duplicate Invoice Warning</DialogTitle>
            <DialogDescription>
              An invoice with the number "{pendingData.invoice_number}" already exists for this issuing entity. 
              Are you sure you want to create a duplicate?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDuplicateWarning(false)}>Cancel</Button>
            <Button variant="default" onClick={() => executeUpdate(pendingData)} disabled={updateInvoice.isPending}>
              {updateInvoice.isPending ? 'Saving...' : 'Save Anyway'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-6 border-b border-neutral-100 bg-neutral-50/50 sticky top-0 z-10">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-neutral-500" />
            Edit Invoice
          </DialogTitle>
          <DialogDescription>
            Modify invoice details. Changes to non-draft invoices will be securely recorded in the revision history.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-8">
          {/* Section 1: Core Details */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-neutral-900 flex items-center gap-2 border-b border-neutral-100 pb-2">
              <Building2 className="h-4 w-4 text-neutral-400" />
              Core Details
            </h4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit_entity_id" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Issuing Entity</Label>
                <select
                  id="edit_entity_id"
                  className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  {...register('entity_id')}
                >
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>{e.name} {e.is_primary ? '(Primary)' : ''}</option>
                  ))}
                </select>
                {errors.entity_id && <p className="text-xs text-red-500">{errors.entity_id.message as string}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_customer_id" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Customer</Label>
                <select
                  id="edit_customer_id"
                  className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isLoadingCustomers}
                  {...register('customer_id')}
                >
                  <option value="">Select a customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.customer_id && <p className="text-xs text-red-500">{errors.customer_id.message as string}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Dates & References */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-neutral-900 flex items-center gap-2 border-b border-neutral-100 pb-2">
              <Calendar className="h-4 w-4 text-neutral-400" />
              Dates & References
            </h4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="edit_invoice_number" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Invoice Number</Label>
                <Input id="edit_invoice_number" className="h-10" {...register('invoice_number')} />
                {errors.invoice_number && <p className="text-xs text-red-500">{errors.invoice_number.message as string}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_invoice_date" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Invoice Date</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-neutral-400" />
                  </div>
                  <Input id="edit_invoice_date" type="date" className="pl-10 h-10" {...register('invoice_date')} />
                </div>
                {errors.invoice_date && <p className="text-xs text-red-500">{errors.invoice_date.message as string}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_payment_terms_days" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Terms (Days)</Label>
                <Input id="edit_payment_terms_days" type="number" className="h-10" {...register('payment_terms_days')} />
              </div>

              <div className="space-y-2 sm:col-span-3 md:col-span-1">
                <Label htmlFor="edit_due_date" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Due Date</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-neutral-400" />
                  </div>
                  <Input id="edit_due_date" type="date" className="pl-10 h-10" {...register('due_date')} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Financials */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-neutral-900 flex items-center gap-2 border-b border-neutral-100 pb-2">
              <Calculator className="h-4 w-4 text-neutral-400" />
              Financials
            </h4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-4 bg-neutral-50/50 p-4 rounded-lg border border-neutral-100">
              <div className="space-y-2">
                <Label htmlFor="edit_currency" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Currency</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <IndianRupee className="h-4 w-4 text-neutral-400" />
                  </div>
                  <Input id="edit_currency" className="pl-10 bg-neutral-100 text-neutral-500 cursor-not-allowed h-10" readOnly {...register('currency')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_subtotal" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Subtotal</Label>
                <Input id="edit_subtotal" type="number" step="0.01" className="h-10" {...register('subtotal')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_tax_amount" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Tax</Label>
                <Input id="edit_tax_amount" type="number" step="0.01" className="h-10" {...register('tax_amount')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_total_amount" className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Total</Label>
                <Input id="edit_total_amount" type="number" step="0.01" readOnly className="bg-neutral-100 font-semibold text-lg h-10" {...register('total_amount')} />
              </div>
            </div>
          </div>

          {/* Section 4: Additional Details */}
          <div className="grid grid-cols-1 gap-4">
          </div>

          {/* Section 5: Audit Reason (Only for non-drafts) */}
          {!isDraft && (
            <div className="bg-amber-50/80 p-5 rounded-lg border border-amber-200 shadow-sm mt-8">
              <div className="space-y-3">
                <Label htmlFor="edit_reason" className="text-amber-900 font-semibold flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Reason for Change <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-amber-700/80 leading-relaxed max-w-xl">
                  This invoice is actively being tracked. Any changes made here will be recorded in the revision history. Please provide a clear reason for the audit log.
                </p>
                <Input
                  id="edit_reason"
                  className="bg-white border-amber-300 focus-visible:ring-amber-500 focus-visible:border-amber-500 h-10"
                  placeholder="e.g. Corrected due date per customer request..."
                  {...register('reason')}
                />
                {errors.reason && <p className="text-xs text-red-500">{errors.reason.message as string}</p>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-6 flex justify-end gap-3 border-t border-neutral-100">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="px-6">
              Cancel
            </Button>
            <Button type="submit" className="px-6" disabled={isSubmitting || (!isDraft && (!watchReason || watchReason.trim().length === 0))}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
