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

type FilterType = 'all' | 'open' | 'due_soon' | 'overdue' | 'promise_pending' | 'high_risk' | 'paid' | 'disputed';

export default function InvoiceList() {
  const { invoices, isLoading } = useInvoices();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filteredInvoices = invoices.filter(inv => {
    // Search
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      (inv.invoice_number?.toLowerCase() || '').includes(searchLower) ||
      (inv.customer?.name?.toLowerCase() || '').includes(searchLower);
    
    if (!matchesSearch) return false;

    // Filter tabs
    switch (activeFilter) {
      case 'open':
        return inv.payment_status === 'open' || inv.payment_status === 'partial';
      case 'due_soon':
        return inv.collection_stage === 'due_soon';
      case 'overdue':
        return inv.collection_stage === 'overdue' || inv.collection_stage === 'escalated' || inv.collection_stage === 'recovery_ready';
      case 'promise_pending':
        return inv.collection_stage === 'promise_pending';
      case 'high_risk':
        return inv.risk_level === 'high' || inv.risk_level === 'critical';
      case 'paid':
        return inv.payment_status === 'paid';
      case 'disputed':
        return inv.payment_status === 'disputed';
      case 'all':
      default:
        return true;
    }
  });

  const tabs: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'due_soon', label: 'Due Soon' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'promise_pending', label: 'Promise Pending' },
    { id: 'high_risk', label: 'High Risk' },
    { id: 'paid', label: 'Paid' },
    { id: 'disputed', label: 'Disputed' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Invoices" 
        description="Manage your accounts receivable pipeline."
        actions={
          <Link to="/app/invoices/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </Link>
        }
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200 w-full sm:w-80">
          <Search className="h-5 w-5 text-neutral-400 ml-2" />
          <Input 
            placeholder="Search invoices or customers..." 
            className="border-0 focus-visible:ring-0 shadow-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200 overflow-x-auto w-full sm:w-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                activeFilter === tab.id 
                  ? 'bg-white text-neutral-900 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
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
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-neutral-500">
                    No invoices match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((inv) => {
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
                        <StatusBadge status={inv.payment_status} />
                        {inv.collection_stage !== 'monitoring' && inv.collection_stage !== 'closed' && (
                          <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wider font-semibold">
                            {inv.collection_stage.replace('_', ' ')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <RiskBadge riskLevel={inv.risk_level} riskScore={inv.risk_score} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}