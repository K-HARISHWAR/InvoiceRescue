import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';

import { useInvoices } from '@/hooks/useInvoices';
import PageHeader from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RiskBadge } from '@/components/common/RiskBadge';
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

import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, Upload } from 'lucide-react';
import { downloadCSV } from '@/lib/csv';
import { toast } from 'sonner';
import InvoiceImportDialog from './components/InvoiceImportDialog';
import PaymentImportDialog from '@/features/payments/PaymentImportDialog';

type FilterType = 'all' | 'open' | 'due_soon' | 'overdue' | 'promise_pending' | 'high_risk' | 'paid' | 'disputed' | 'overdue_30' | 'critical_large' | 'my_accounts' | 'promises_today';

export default function InvoiceList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showImport, setShowImport] = useState(false);
  const [showPaymentImport, setShowPaymentImport] = useState(false);
  
  const search = searchParams.get('search') || '';
  const activeFilter = (searchParams.get('view') as FilterType) || 'all';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 10;

  const { invoices, totalCount, isLoading, exportInvoices } = useInvoices({
    view: activeFilter,
    search,
    page,
    limit
  });

  const handleExport = async () => {
    try {
      const data = await exportInvoices({
        view: activeFilter,
        search,
      });
      if (!data || data.length === 0) {
        toast.info("No records to export.");
        return;
      }
      const columns = [
        { key: 'invoice_number', label: 'Invoice Number' },
        { key: 'customer_name', label: 'Customer' },
        { key: 'invoice_date', label: 'Issue Date' },
        { key: 'due_date', label: 'Due Date' },
        { key: 'currency', label: 'Currency' },
        { key: 'total_amount', label: 'Total Amount' },
        { key: 'outstanding_amount', label: 'Outstanding Amount' },
        { key: 'payment_status', label: 'Payment Status' },
        { key: 'collection_stage', label: 'Stage' },
        { key: 'risk_level', label: 'Risk' }
      ];
      
      const mappedData = data.map((d: any) => ({
        ...d,
        customer_name: d.customer?.name || ''
      }));
      
      downloadCSV(`Invoices_Export_${new Date().toISOString().split('T')[0]}`, mappedData, columns);
      toast.success("Export successful.");
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchParams(prev => {
      if (val) prev.set('search', val);
      else prev.delete('search');
      prev.set('page', '1');
      return prev;
    });
  };

  const handleFilterChange = (filter: FilterType) => {
    setSearchParams(prev => {
      prev.set('view', filter);
      prev.set('page', '1');
      return prev;
    });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams(prev => {
      prev.set('page', newPage.toString());
      return prev;
    });
  };

  const totalPages = Math.ceil(totalCount / limit);

  const views: { id: FilterType; label: string; group?: string }[] = [
    { id: 'all', label: 'All Invoices' },
    { id: 'open', label: 'Open' },
    { id: 'due_soon', label: 'Due Soon' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'high_risk', label: 'High Risk' },
    // Saved Views
    { id: 'overdue_30', label: 'Overdue >30 Days', group: 'Saved Views' },
    { id: 'critical_large', label: 'Critical >₹1L', group: 'Saved Views' },
    { id: 'promises_today', label: 'Promises Due Today', group: 'Saved Views' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Invoices" 
        description="Manage your accounts receivable pipeline."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import Invoices
            </Button>
            <Button variant="outline" onClick={() => setShowPaymentImport(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import Payments
            </Button>
            <Link to="/app/invoices/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </Link>
          </div>
        }
      />

      <div className="flex flex-col space-y-4">
        <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200 w-full md:w-96">
          <Search className="h-5 w-5 text-neutral-400 ml-2" />
          <Input 
            placeholder="Search invoices or customers..." 
            className="border-0 focus-visible:ring-0 shadow-none"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        
        <div className="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-200 scrollbar-track-transparent">
          <div className="flex gap-2 min-w-max">
            {views.map(view => (
              <button
                key={view.id}
                onClick={() => handleFilterChange(view.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors border ${
                  activeFilter === view.id 
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                    : view.group === 'Saved Views' 
                      ? 'bg-muted/30 text-foreground border-border hover:bg-muted' 
                      : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-neutral-500">
                    Loading invoices...
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-neutral-500">
                    No invoices match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => {
                  const formatMoney = (amount: number) => 
                    new Intl.NumberFormat('en-IN', { style: 'currency', currency: inv.currency }).format(amount);
                  
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        <Link to={`/app/invoices/${inv.id}`} className="text-blue-600 hover:underline">
                          {inv.invoice_number || 'Draft'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {inv.customer?.name || <span className="text-neutral-400 italic">Unknown</span>}
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {new Date(inv.invoice_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(inv.total_amount)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(inv.outstanding_amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.payment_status as any} />
                        {inv.collection_stage !== 'monitoring' && inv.collection_stage !== 'closed' && (
                          <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wider font-semibold">
                            {inv.collection_stage.replace('_', ' ')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {inv.risk_level && <RiskBadge level={inv.risk_level as any} />}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {totalCount === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount} results
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <div className="text-sm font-medium px-4">
            Page {page} of {totalPages || 1}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      <InvoiceImportDialog 
        open={showImport} 
        onOpenChange={setShowImport}
        onSuccess={() => {
          window.location.reload();
        }}
      />
      <PaymentImportDialog 
        open={showPaymentImport} 
        onOpenChange={setShowPaymentImport}
        onSuccess={() => {
          // Handled within
        }}
      />
    </div>
  );
}