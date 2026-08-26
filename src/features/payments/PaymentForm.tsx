
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

import { usePayments } from '@/hooks/usePayments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  paid_at: z.string().min(1, 'Payment date is required'),
  payment_reference: z.string().optional(),
  notes: z.string().optional(),
});



interface PaymentFormProps {
  invoiceId: string;
  maxAmount: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function PaymentForm({ invoiceId, maxAmount, onSuccess, onCancel }: PaymentFormProps) {
  const { createPayment } = usePayments(invoiceId);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: {
      amount: maxAmount, // default to full payment
      paid_at: format(new Date(), 'yyyy-MM-dd'),
      payment_reference: '',
      notes: '',
    }
  });

  const onSubmit = async (data: z.infer<typeof paymentSchema>) => {
    try {
      await createPayment.mutateAsync(data);
      toast.success('Payment recorded successfully');
      if (onSuccess) onSuccess();
    } catch (error: Error | unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to record payment');
      console.error(error);
    }
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
      <div className="mt-6 flex justify-end space-x-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Record Payment
        </Button>
      </div>
    </form>
  );
}
