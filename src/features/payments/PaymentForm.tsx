import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, AlertTriangle } from 'lucide-react';

import { usePayments, type Payment } from '@/hooks/usePayments';
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

interface PaymentFormProps {
  invoiceId: string;
  maxAmount: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  payment?: Payment;
}

export default function PaymentForm({ invoiceId, maxAmount, onSuccess, onCancel, payment }: PaymentFormProps) {
  const { createPayment, editPayment, checkDuplicatePayment } = usePayments(invoiceId);
  const isEdit = !!payment;
  
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);

  const formSchema = useMemo(() => z.object({
    amount: z.coerce.number()
      .positive('Amount must be positive')
      .max(maxAmount + (payment?.amount || 0), "This payment exceeds the invoice's outstanding amount."),
    paid_at: z.string().min(1, 'Payment date is required'),
    payment_reference: z.string().optional(),
    notes: z.string().optional(),
    reason: isEdit ? z.string().min(3, "Reason for editing is required") : z.string().optional(),
  }), [maxAmount, payment, isEdit]);

  type FormValues = z.infer<typeof formSchema>;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      amount: payment ? payment.amount : maxAmount,
      paid_at: payment ? payment.paid_at.substring(0, 10) : format(new Date(), 'yyyy-MM-dd'),
      payment_reference: payment?.payment_reference || '',
      notes: payment?.notes || '',
      reason: '',
    }
  });

  const executeSubmit = async (data: FormValues) => {
    try {
      if (isEdit && payment) {
        await editPayment.mutateAsync({
          id: payment.id,
          updates: {
            amount: data.amount,
            paid_at: data.paid_at,
            payment_reference: data.payment_reference,
            notes: data.notes,
          },
          reason: data.reason || 'Manual correction',
        });
        toast.success('Payment updated successfully');
      } else {
        const { reason, ...paymentData } = data;
        await createPayment.mutateAsync(paymentData);
        toast.success('Payment recorded successfully');
      }
      
      setDuplicateWarning(false);
      setPendingData(null);
      if (onSuccess) onSuccess();
    } catch (error: Error | unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save payment');
      console.error(error);
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!isEdit) {
      const isDuplicate = await checkDuplicatePayment(data.payment_reference || null, data.amount, data.paid_at);
      if (isDuplicate) {
        setPendingData(data);
        setDuplicateWarning(true);
        return;
      }
    }
    
    await executeSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount <span className="text-red-500">*</span></Label>
        <Input id="amount" type="number" step="1" max={maxAmount} {...register('amount')} />
        {errors.amount && <p className="text-sm text-red-500 mt-1">{errors.amount.message as string}</p>}
        <p className="text-xs text-neutral-500 mt-1">Maximum outstanding: {maxAmount}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="paid_at">Payment Date <span className="text-red-500">*</span></Label>
        <Input id="paid_at" type="date" {...register('paid_at')} />
        {errors.paid_at && <p className="text-sm text-red-500 mt-1">{errors.paid_at.message as string}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="payment_reference">Reference (e.g. Check #, Transaction ID)</Label>
        <Input id="payment_reference" {...register('payment_reference')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" {...register('notes')} />
      </div>
      
      {isEdit && (
        <div className="space-y-1.5 pt-2 border-t border-neutral-200 mt-4">
          <Label htmlFor="reason">Reason for Change <span className="text-red-500">*</span></Label>
          <Input id="reason" placeholder="e.g. Corrected amount entered" {...register('reason')} />
          {errors.reason && <p className="text-sm text-red-500 mt-1">{errors.reason.message as string}</p>}
        </div>
      )}
      
      <div className="mt-6 flex justify-end space-x-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isEdit ? 'Save Changes' : 'Record Payment'}
        </Button>
      </div>

      <Dialog open={duplicateWarning} onOpenChange={setDuplicateWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-amber-600 flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Duplicate Payment Warning
            </DialogTitle>
            <DialogDescription>
              A payment for {pendingData?.amount} on {pendingData?.paid_at} already exists. 
              Are you sure you want to record this duplicate payment?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDuplicateWarning(false)}>Cancel</Button>
            <Button variant="default" onClick={() => pendingData && executeSubmit(pendingData)} disabled={createPayment.isPending}>
              {createPayment.isPending ? 'Saving...' : 'Record Anyway'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
