import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Calendar, UploadCloud, FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';

import { useCustomers } from '@/hooks/useCustomers';
import { useInvoices } from '@/hooks/useInvoices';
import PageHeader from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InvoiceUpload from './components/InvoiceUpload';

const invoiceSchema = z.object({
  customer_id: z.string().min(1, 'Please select a customer'),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  payment_terms_days: z.coerce.number().min(0).optional(),
  due_date: z.string().optional(),
  currency: z.string().min(3).max(3),
  subtotal: z.coerce.number().min(0),
  tax_amount: z.coerce.number().min(0),
  total_amount: z.coerce.number().min(0),
  notes: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export default function InvoiceForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustomer = searchParams.get('customer');
  const [mode, setMode] = useState<'manual' | 'upload'>('upload');
  
  const { customers, isLoading: isLoadingCustomers } = useCustomers();
  const { createInvoice } = useInvoices();

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer_id: preselectedCustomer || '',
      invoice_number: '',
      invoice_date: format(new Date(), 'yyyy-MM-dd'),
      payment_terms_days: 30,
      due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      currency: 'INR',
      subtotal: 0,
      tax_amount: 0,
      total_amount: 0,
      notes: '',
    }
  });

  const watchInvoiceDate = watch('invoice_date');
  const watchPaymentTerms = watch('payment_terms_days');
  const watchSubtotal = watch('subtotal');
  const watchTax = watch('tax_amount');

  // Auto-calculate due date when invoice date or terms change
  useEffect(() => {
    if (watchInvoiceDate && typeof watchPaymentTerms === 'number') {
      try {
        const date = parseISO(watchInvoiceDate);
        const newDueDate = addDays(date, watchPaymentTerms);
        setValue('due_date', format(newDueDate, 'yyyy-MM-dd'));
      } catch (e) {
        // invalid date, ignore
      }
    }
  }, [watchInvoiceDate, watchPaymentTerms, setValue]);

  // Auto-calculate total
  useEffect(() => {
    setValue('total_amount', (Number(watchSubtotal) || 0) + (Number(watchTax) || 0));
  }, [watchSubtotal, watchTax, setValue]);

  const onSubmit = async (data: InvoiceFormValues) => {
    try {
      // Determine final due date logic (prefer explicit over calculated if provided, though we auto-calc above anyway)
      let finalDueDate = data.due_date;
      if (!finalDueDate && data.payment_terms_days !== undefined) {
        finalDueDate = format(addDays(parseISO(data.invoice_date), data.payment_terms_days), 'yyyy-MM-dd');
      }

      const invoiceRecord = {
        ...data,
        due_date: finalDueDate,
        outstanding_amount: data.total_amount, // initially, outstanding = total
        amount_paid: 0,
        payment_status: 'open' as const,
        collection_stage: 'monitoring' as const,
        source: 'manual',
      };

      const result = await createInvoice.mutateAsync(invoiceRecord);
      toast.success('Invoice created successfully');
      navigate(`/app/invoices/${result.id}`);
    } catch (error) {
      toast.error('Failed to create invoice');
      console.error(error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader 
        title="Create Invoice" 
        description="Manually enter an invoice or upload a document."
        action={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200 w-full sm:w-64 mb-6">
        <button
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'upload' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <UploadCloud className="mr-2 h-4 w-4" />
          Upload
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'manual' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <FileText className="mr-2 h-4 w-4" />
          Manual Entry
        </button>
      </div>

      {mode === 'upload' ? (
        <div className="bg-white p-6 shadow sm:rounded-lg border border-neutral-200">
          <InvoiceUpload />
        </div>
      ) : (
        <div className="bg-white shadow sm:rounded-lg border border-neutral-200 overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <Label htmlFor="customer_id">Customer <span className="text-red-500">*</span></Label>
                  <div className="mt-1">
                    <select
                      id="customer_id"
                      className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 border px-3"
                      disabled={isLoadingCustomers}
                      {...register('customer_id')}
                    >
                      <option value="">Select a customer...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {errors.customer_id && <p className="mt-1 text-sm text-red-600">{errors.customer_id.message as string}</p>}
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <Label htmlFor="invoice_number">Invoice Number <span className="text-red-500">*</span></Label>
                  <div className="mt-1">
                    <Input id="invoice_number" {...register('invoice_number')} />
                    {errors.invoice_number && <p className="mt-1 text-sm text-red-600">{errors.invoice_number.message as string}</p>}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="invoice_date">Invoice Date <span className="text-red-500">*</span></Label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-4 w-4 text-neutral-400" />
                    </div>
                    <Input id="invoice_date" type="date" className="pl-10" {...register('invoice_date')} />
                    {errors.invoice_date && <p className="mt-1 text-sm text-red-600">{errors.invoice_date.message as string}</p>}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="payment_terms_days">Payment Terms (Days)</Label>
                  <div className="mt-1">
                    <Input id="payment_terms_days" type="number" {...register('payment_terms_days')} />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-4 w-4 text-neutral-400" />
                    </div>
                    <Input id="due_date" type="date" className="pl-10" {...register('due_date')} />
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-200 pt-6">
                <h4 className="text-sm font-medium text-neutral-900 mb-4">Financials</h4>
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-4">
                  <div className="sm:col-span-1">
                    <Label htmlFor="currency">Currency</Label>
                    <div className="mt-1">
                      <Input id="currency" {...register('currency')} />
                    </div>
                  </div>

                  <div className="sm:col-span-1">
                    <Label htmlFor="subtotal">Subtotal</Label>
                    <div className="mt-1">
                      <Input id="subtotal" type="number" step="1" {...register('subtotal')} />
                    </div>
                  </div>

                  <div className="sm:col-span-1">
                    <Label htmlFor="tax_amount">Tax Amount</Label>
                    <div className="mt-1">
                      <Input id="tax_amount" type="number" step="1" {...register('tax_amount')} />
                    </div>
                  </div>

                  <div className="sm:col-span-1">
                    <Label htmlFor="total_amount">Total Amount</Label>
                    <div className="mt-1">
                      <Input id="total_amount" type="number" step="1" readOnly className="bg-neutral-50 font-medium" {...register('total_amount')} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-200 pt-6">
                <div className="sm:col-span-6">
                  <Label htmlFor="notes">Notes / Description</Label>
                  <div className="mt-1">
                    <textarea
                      id="notes"
                      rows={3}
                      className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-3"
                      placeholder="Optional notes or line item details..."
                      {...register('notes')}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save Invoice
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
