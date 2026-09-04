import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Building2, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { useCustomers, type Customer } from '@/hooks/useCustomers';
import { type Invoice } from '@/hooks/useInvoices';
import PageHeader from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Archive, Merge } from 'lucide-react';
import { MoneyDisplay } from '@/lib/formatting/MoneyDisplay';

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  company_name: z.string().optional(),
  primary_email: z.string().email('Valid email is required').optional().or(z.literal('')),
  phone: z.string().optional(),
  gstin: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function CustomerList() {
  const { customers, isLoading, createCustomer, archiveCustomer, mergeCustomers } = useCustomers();
  const [search, setSearch] = useState('');
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [targetMergeId, setTargetMergeId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', company_name: '', primary_email: '', phone: '', gstin: '', notes: '' }
  });

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      await createCustomer.mutateAsync(data);
      toast.success('Customer created successfully');
      setIsNewDialogOpen(false);
      reset();
    } catch (error) {
      toast.error('Failed to create customer');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedCustomerIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Are you sure you want to archive this customer?')) return;
    try {
      await archiveCustomer.mutateAsync(id);
      toast.success('Customer archived');
      setSelectedCustomerIds(prev => prev.filter(x => x !== id));
    } catch (e: any) {
      toast.error('Failed to archive customer');
    }
  };

  const handleMerge = async () => {
    if (!targetMergeId || selectedCustomerIds.length !== 2) return;
    const sourceId = selectedCustomerIds.find(id => id !== targetMergeId);
    if (!sourceId) return;

    try {
      await mergeCustomers.mutateAsync({ targetId: targetMergeId, sourceId });
      toast.success('Customers merged successfully');
      setIsMergeDialogOpen(false);
      setSelectedCustomerIds([]);
      setTargetMergeId(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to merge customers');
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.company_name && c.company_name.toLowerCase().includes(search.toLowerCase())) ||
    (c.primary_email && c.primary_email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Customers" 
        description="Manage your clients and view their performance."
        actions={
          <div className="flex gap-2">
            {selectedCustomerIds.length === 2 && (
              <Button onClick={() => setIsMergeDialogOpen(true)} variant="secondary">
                <Merge className="mr-2 h-4 w-4" />
                Merge
              </Button>
            )}
            <Button onClick={() => setIsNewDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Customer
            </Button>
          </div>
        }
      />

      <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
        <Search className="h-5 w-5 text-neutral-400 ml-2" />
        <Input 
          placeholder="Search customers..." 
          className="border-0 focus-visible:ring-0 shadow-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center w-[120px]">Open Invoices</TableHead>
              <TableHead className="text-right w-[150px]">Outstanding</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-neutral-500">
                  Loading customers...
                </TableCell>
              </TableRow>
            ) : filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-neutral-500">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => {
                const invoices: Invoice[] = (customer as Customer & { invoices: Invoice[] }).invoices || [];
                const openInvoices = invoices.filter(i => ['open', 'partial', 'disputed'].includes(i.payment_status));
                const outstanding = openInvoices.reduce((sum, i) => sum + Number(i.outstanding_amount), 0);

                return (
                  <TableRow key={customer.id} className={selectedCustomerIds.includes(customer.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedCustomerIds.includes(customer.id)}
                        onCheckedChange={() => toggleSelection(customer.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link to={`/app/customers/${customer.id}`} className="text-blue-600 hover:underline flex items-center">
                        <Building2 className="mr-2 h-4 w-4 text-neutral-400" />
                        {customer.name}
                      </Link>
                      {customer.company_name && (
                        <div className="text-xs text-neutral-500 mt-0.5">{customer.company_name}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.primary_email ? (
                        <div className="flex items-center text-sm">
                          <Mail className="mr-2 h-3 w-3 text-neutral-400" />
                          {customer.primary_email}
                        </div>
                      ) : (
                        <span className="text-neutral-400 text-xs italic">Not provided</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {openInvoices.length}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex justify-end pr-2">
                        <MoneyDisplay amount={outstanding} currency={invoices[0]?.currency || 'INR'} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-neutral-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleArchive(customer.id)} className="text-destructive">
                            <Archive className="mr-2 h-4 w-4" /> Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
            <DialogDescription>
              Add a new customer to your workspace. You can add more details later.
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
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsNewDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Customer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Customers</DialogTitle>
            <DialogDescription>
              Select the primary customer that will survive the merge. The other will be archived, and all its records will be moved to the primary customer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {selectedCustomerIds.map(id => {
              const cust = customers.find(c => c.id === id);
              if (!cust) return null;
              return (
                <div 
                  key={id} 
                  className={`p-3 border rounded-md cursor-pointer flex justify-between items-center ${targetMergeId === id ? 'border-primary bg-primary/5' : ''}`}
                  onClick={() => setTargetMergeId(id)}
                >
                  <div>
                    <div className="font-medium">{cust.name}</div>
                    <div className="text-xs text-muted-foreground">{cust.primary_email || 'No email'}</div>
                  </div>
                  {targetMergeId === id && <div className="text-xs font-bold text-primary">Target</div>}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="default" 
              onClick={handleMerge}
              disabled={!targetMergeId || mergeCustomers.isPending}
            >
              {mergeCustomers.isPending ? 'Merging...' : 'Merge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}