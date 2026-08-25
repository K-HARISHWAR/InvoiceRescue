import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Mail, Phone, Building2, Edit2, FileText, IndianRupee, PieChart, Activity } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { useCustomer, useCustomers, useCustomerIntelligence } from '@/hooks/useCustomers';
import PageHeader from '@/components/common/PageHeader';
import MetricCard from '@/components/common/MetricCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RiskBadge } from '@/components/common/RiskBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MoneyDisplay } from '@/lib/formatting/MoneyDisplay';
import { addDays, format } from 'date-fns';

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  company_name: z.string().optional(),
  primary_email: z.string().email('Valid email is required').optional().or(z.literal('')),
  phone: z.string().optional(),
  gstin: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function CustomerDetail() {
  const { customerId } = useParams();
  const { data: customer, isLoading, isError } = useCustomer(customerId);
  const { data: intel, isLoading: isIntelLoading } = useCustomerIntelligence(customerId);
  const { updateCustomer } = useCustomers();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema)
  });

  const openEditDialog = () => {
    if (customer) {
      reset({
        name: customer.name,
        company_name: customer.company_name || '',
        primary_email: customer.primary_email || '',
        phone: customer.phone || '',
        gstin: customer.gstin || '',
        notes: customer.notes || '',
      });
      setIsEditDialogOpen(true);
    }
  };

  const onSubmit = async (data: CustomerFormValues) => {
    if (!customer) return;
    try {
      await updateCustomer.mutateAsync({ id: customer.id, updates: data });
      toast.success('Customer updated successfully');
      setIsEditDialogOpen(false);
    } catch (error) {
      toast.error('Failed to update customer');
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-neutral-500">Loading customer...</div>;
  }

  if (isError || !customer) {
    return <div className="p-8 text-center text-red-500">Error loading customer.</div>;
  }

  const invoices = (customer as any).invoices || [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title={customer.name} 
        description={customer.company_name || 'Customer Profile'}
        actions={
          <Button onClick={openEditDialog} variant="outline">
            <Edit2 className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <h3 className="text-lg font-medium text-neutral-900 mb-4">Contact Information</h3>
            <div className="space-y-4">
              {customer.primary_email && (
                <div className="flex items-start">
                  <Mail className="h-5 w-5 text-neutral-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Email</p>
                    <a href={`mailto:${customer.primary_email}`} className="text-sm text-blue-600 hover:underline">{customer.primary_email}</a>
                  </div>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-start">
                  <Phone className="h-5 w-5 text-neutral-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Phone</p>
                    <a href={`tel:${customer.phone}`} className="text-sm text-blue-600 hover:underline">{customer.phone}</a>
                  </div>
                </div>
              )}
              {customer.gstin && (
                <div className="flex items-start">
                  <Building2 className="h-5 w-5 text-neutral-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">GSTIN</p>
                    <p className="text-sm text-neutral-600">{customer.gstin}</p>
                  </div>
                </div>
              )}
            </div>
            
            {customer.notes && (
              <div className="mt-6 pt-6 border-t border-neutral-100">
                <h4 className="text-sm font-medium text-neutral-900 mb-2">Notes</h4>
                <p className="text-sm text-neutral-600 whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <h3 className="text-lg font-medium text-neutral-900 mb-4">Customer Intelligence</h3>
            {isIntelLoading ? (
              <div className="text-sm text-muted-foreground">Loading metrics...</div>
            ) : intel ? (
              <div className="space-y-4">
                 <div className="flex justify-between items-center border-b border-border pb-2">
                   <span className="text-sm text-muted-foreground flex items-center gap-2"><PieChart size={14} /> Total Invoices</span>
                   <span className="text-sm font-medium">{intel.totalInvoices}</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-border pb-2">
                   <span className="text-sm text-muted-foreground flex items-center gap-2"><IndianRupee size={14} /> Total Paid</span>
                   <span className="text-sm font-medium"><MoneyDisplay amount={intel.totalPaid} /></span>
                 </div>
                 <div className="flex justify-between items-center border-b border-border pb-2">
                   <span className="text-sm text-muted-foreground flex items-center gap-2"><Activity size={14} /> On-Time Rate</span>
                   <span className="text-sm font-medium">{intel.onTimeRate.toFixed(1)}%</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-border pb-2">
                   <span className="text-sm text-muted-foreground">Average Days Late</span>
                   <span className="text-sm font-medium">{intel.averageDaysLate} days</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-border pb-2">
                   <span className="text-sm text-muted-foreground">Missed Promises</span>
                   <span className="text-sm font-medium">{intel.missedPromises}</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-border pb-2">
                   <span className="text-sm text-muted-foreground">High Risk Invoices</span>
                   <span className="text-sm font-medium">{intel.currentHighRiskInvoices}</span>
                 </div>
                 <div className="flex flex-col pt-1">
                   <span className="text-sm text-muted-foreground mb-1">Recent Communication</span>
                   {intel.recentCommunication ? (
                     <div className="text-xs bg-muted/50 p-2 rounded-md">
                       <span className="font-medium">{intel.recentCommunication.subject || 'No Subject'}</span>
                       <div className="text-muted-foreground mt-1">{format(new Date(intel.recentCommunication.created_at), 'MMM d, yyyy')}</div>
                     </div>
                   ) : (
                     <span className="text-xs text-muted-foreground">No recent communication</span>
                   )}
                 </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No metrics available.</div>
            )}
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricCard 
              title="Outstanding Amount" 
              value={<MoneyDisplay amount={intel?.openBalance || 0} />} 
              icon={<IndianRupee className="h-4 w-4 text-blue-600" />} 
              loading={isIntelLoading}
            />
            <MetricCard 
              title="Open Invoices" 
              value={invoices.filter((i: any) => ['open', 'partial', 'disputed'].includes(i.payment_status)).length.toString()} 
              icon={<FileText className="h-4 w-4 text-blue-600" />} 
            />
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center">
              <h3 className="text-lg font-medium text-neutral-900">Recent Invoices</h3>
              <Link to={`/app/invoices/new?customer=${customer.id}`}>
                <Button size="sm">Create Invoice</Button>
              </Link>
            </div>
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                No invoices found for this customer.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Expected Payment</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.slice(0, 5).map((invoice: any) => {
                    const invAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: invoice.currency }).format(invoice.total_amount);
                    const expectedDate = invoice.due_date && intel ? format(addDays(new Date(invoice.due_date), intel.averageDaysLate), 'MMM d, yyyy') : 'N/A';
                    
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          <Link to={`/app/invoices/${invoice.id}`} className="text-blue-600 hover:underline flex flex-col">
                            <span>{invoice.invoice_number || 'Draft'}</span>
                            <span className="text-xs text-muted-foreground font-normal">Due {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d') : 'N/A'}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-neutral-600">
                           {invoice.payment_status === 'paid' ? 'Paid' : (
                              <div className="flex flex-col">
                                 <span>{expectedDate}</span>
                                 <span className="text-xs text-muted-foreground">(Est.)</span>
                              </div>
                           )}
                        </TableCell>
                        <TableCell>{invAmount}</TableCell>
                        <TableCell><StatusBadge status={invoice.payment_status} /></TableCell>
                        <TableCell>{invoice.risk_level ? <RiskBadge level={invoice.risk_level} /> : '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {invoices.length > 5 && (
              <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 text-center">
                <Link to={`/app/invoices?customer=${customer.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                  View all {invoices.length} invoices
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer details below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Display Name <span className="text-red-500">*</span></Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company_name">Legal Company Name</Label>
              <Input id="company_name" {...register('company_name')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary_email">Primary Email</Label>
              <Input id="primary_email" type="email" {...register('primary_email')} />
              {errors.primary_email && <p className="text-sm text-red-500 mt-1">{errors.primary_email.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" {...register('phone')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input id="gstin" {...register('gstin')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" {...register('notes')} />
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}