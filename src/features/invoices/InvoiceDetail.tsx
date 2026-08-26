import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, FileText, IndianRupee, MessageSquare, ListTodo, Plus, CheckCircle2, Inbox, Send, Bot } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

import { useInvoice } from '@/hooks/useInvoices';
import { usePayments } from '@/hooks/usePayments';
import { useCommunications } from '@/hooks/useCommunications';
import { useRecoveryPack } from '@/hooks/useRecoveryPack';
import { RiskBadge } from '@/components/common/RiskBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

import PaymentForm from '@/features/payments/PaymentForm';
import InvoiceUpload from './components/InvoiceUpload';
import { RecoveryPreviewModal } from '@/features/recovery/components/RecoveryPreviewModal';
import { Archive } from 'lucide-react';

type Tab = 'overview' | 'timeline' | 'documents' | 'communication' | 'payments' | 'actions';

export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  const { data: invoice, isLoading, isError } = useInvoice(invoiceId);
  const { payments, isLoading: isLoadingPayments } = usePayments(invoiceId);
  const { data: communications, isLoading: isLoadingComms } = useCommunications(invoiceId);
  const { timeline, isLoadingTimeline } = useRecoveryPack(invoiceId);
  
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);

  if (isLoading) return <div className="p-8 text-center text-neutral-500">Loading invoice...</div>;
  if (isError || !invoice) return <div className="p-8 text-center text-red-500">Error loading invoice.</div>;

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: invoice.currency }).format(amount);
  
  const daysOverdue = invoice.due_date ? Math.max(0, differenceInDays(new Date(), new Date(invoice.due_date))) : 0;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <FileText className="h-4 w-4 mr-2" /> },
    { id: 'timeline', label: 'Timeline', icon: <ListTodo className="h-4 w-4 mr-2" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="h-4 w-4 mr-2" /> },
    { id: 'communication', label: 'Communication', icon: <MessageSquare className="h-4 w-4 mr-2" /> },
    { id: 'payments', label: 'Payments', icon: <IndianRupee className="h-4 w-4 mr-2" /> },
    { id: 'actions', label: 'Action Center', icon: <CheckCircle2 className="h-4 w-4 mr-2" /> },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between mb-4">
        <Link to="/app/invoices" className="flex items-center text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Invoices
        </Link>
        <Button 
          variant={(invoice.risk_level === 'high' || invoice.risk_level === 'critical') ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsRecoveryModalOpen(true)}
          className={invoice.risk_level === 'high' || invoice.risk_level === 'critical' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
        >
          <Archive className="mr-2 h-4 w-4" /> Generate Recovery Pack
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-neutral-900">
                {invoice.invoice_number || 'Draft Invoice'}
              </h1>
              <StatusBadge status={invoice.payment_status as any} />
              {invoice.risk_level && <RiskBadge level={invoice.risk_level as any} />}
            </div>
            {invoice.customer && (
              <div className="flex items-center text-neutral-600">
                <Building2 className="h-4 w-4 mr-2 text-neutral-400" />
                <Link to={`/app/customers/${invoice.customer.id}`} className="hover:underline hover:text-blue-600">
                  {invoice.customer.name}
                </Link>
              </div>
            )}
          </div>

          <div className="text-left md:text-right">
            <div className="text-sm text-neutral-500 mb-1">Outstanding Balance</div>
            <div className="text-3xl font-bold text-neutral-900">
              {formatMoney(invoice.outstanding_amount)}
            </div>
            {invoice.outstanding_amount > 0 && (
              <div className="mt-3">
                <Button onClick={() => setIsPaymentDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Record Payment
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex border-b border-neutral-200 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-medium text-neutral-900 mb-4">Invoice Details</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                <div>
                  <dt className="text-sm font-medium text-neutral-500">Invoice Date</dt>
                  <dd className="mt-1 text-sm text-neutral-900">{format(new Date(invoice.invoice_date), 'dd MMM yyyy')}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-neutral-500">Due Date</dt>
                  <dd className="mt-1 text-sm text-neutral-900">
                    {invoice.due_date ? format(new Date(invoice.due_date), 'dd MMM yyyy') : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-neutral-500">Days Overdue</dt>
                  <dd className={`mt-1 text-sm ${daysOverdue > 0 ? 'text-red-600 font-medium' : 'text-neutral-900'}`}>
                    {daysOverdue > 0 ? `${daysOverdue} days` : 'Not overdue'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-neutral-500">Collection Stage</dt>
                  <dd className="mt-1 text-sm text-neutral-900 capitalize">{invoice.collection_stage.replace('_', ' ')}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-medium text-neutral-900 mb-4">Financial Summary</h3>
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-500">Subtotal</dt>
                  <dd className="text-sm text-neutral-900">{formatMoney(invoice.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-500">Tax</dt>
                  <dd className="text-sm text-neutral-900">{formatMoney(invoice.tax_amount)}</dd>
                </div>
                <div className="flex justify-between pt-4 border-t border-neutral-100">
                  <dt className="text-sm font-medium text-neutral-900">Total Amount</dt>
                  <dd className="text-sm font-medium text-neutral-900">{formatMoney(invoice.total_amount)}</dd>
                </div>
                <div className="flex justify-between text-green-600">
                  <dt className="text-sm">Amount Paid</dt>
                  <dd className="text-sm">-{formatMoney(invoice.amount_paid)}</dd>
                </div>
                <div className="flex justify-between pt-4 border-t border-neutral-200">
                  <dt className="text-base font-bold text-neutral-900">Outstanding</dt>
                  <dd className="text-base font-bold text-neutral-900">{formatMoney(invoice.outstanding_amount)}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
              <h3 className="text-lg font-medium text-neutral-900">Payment History</h3>
              {invoice.outstanding_amount > 0 && (
                <Button size="sm" onClick={() => setIsPaymentDialogOpen(true)}>Record Payment</Button>
              )}
            </div>
            {isLoadingPayments ? (
              <div className="p-8 text-center text-neutral-500">Loading payments...</div>
            ) : payments.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">No payments recorded yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-neutral-900">{format(new Date(payment.paid_at), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="font-medium text-green-600">{formatMoney(payment.amount)}</TableCell>
                      <TableCell className="text-neutral-500">{payment.payment_reference || '-'}</TableCell>
                      <TableCell className="text-neutral-500">{payment.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
              <h3 className="text-lg font-medium text-neutral-900 mb-4">Attach Documents</h3>
              <InvoiceUpload invoiceId={invoice.id} />
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
                <h3 className="text-lg font-medium text-neutral-900">Stored Documents</h3>
              </div>
              <div className="p-8 text-center text-neutral-500">
                File listing will be implemented soon. Check the Supabase Storage bucket directly for now.
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'communication' && (
          <div className="space-y-4">
            {isLoadingComms ? (
              <div className="p-8 text-center text-neutral-500">Loading communications...</div>
            ) : !communications || communications.length === 0 ? (
              <div className="bg-white rounded-lg border border-neutral-200 p-8 text-center text-neutral-500">
                No email communications found for this invoice.
              </div>
            ) : (
              communications.map(comm => (
                <div key={comm.id} className="bg-white rounded-lg border border-neutral-200 shadow-sm p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${comm.direction === 'inbound' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                        {comm.direction === 'inbound' ? <Inbox size={16} /> : <Send size={16} />}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-neutral-900">
                          {comm.direction === 'inbound' ? 'Received from' : 'Sent to'}{' '}
                          {comm.direction === 'inbound' ? comm.from_address : comm.to_addresses?.join(', ')}
                        </div>
                        <div className="text-xs text-neutral-500">{format(new Date(comm.sent_at), 'dd MMM yyyy, HH:mm')}</div>
                      </div>
                    </div>
                    {comm.category && (
                      <div className="bg-neutral-100 text-neutral-700 text-xs px-2.5 py-1 rounded-full border border-neutral-200 capitalize">
                        {comm.category.replace('_', ' ')}
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-2 font-medium text-neutral-800 text-sm">{comm.subject}</div>
                  <div className="text-sm text-neutral-600 whitespace-pre-wrap bg-neutral-50 p-4 rounded-md border border-neutral-100 max-h-60 overflow-y-auto">
                    {comm.body_text}
                  </div>
                  
                  {comm.ai_summary && (
                    <div className="mt-3 flex gap-2 items-start bg-blue-50/50 p-3 rounded-md border border-blue-100">
                      <Bot size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-900 font-medium">{comm.ai_summary}</div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <h3 className="text-lg font-medium text-neutral-900 mb-6">Verified Evidence Timeline</h3>
            {isLoadingTimeline ? (
              <div className="text-center text-neutral-500 py-8">Loading timeline...</div>
            ) : (!timeline || timeline.length === 0) ? (
              <div className="text-center text-neutral-500 py-8">No timeline events recorded yet.</div>
            ) : (
              <div className="relative border-l-2 border-neutral-200 ml-4 space-y-8">
                {timeline.map((event, index) => (
                  <div key={event.id || index} className="relative pl-6">
                    <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-blue-500" />
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-1">
                      <div className="font-medium text-neutral-900 capitalize">
                        {event.event_type.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs font-medium text-neutral-500 whitespace-nowrap sm:ml-4">
                        {format(new Date(event.event_date), 'dd MMM yyyy, HH:mm')}
                      </div>
                    </div>
                    <p className="text-sm text-neutral-700 mt-1">{event.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-12 text-center">
            <div className="mx-auto w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-neutral-400" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">Action Center</h3>
            <p className="text-neutral-500 max-w-md mx-auto mb-6">
              View and manage recommended collection actions globally in the main Action Center.
            </p>
            <Link to="/app/actions">
              <Button>Go to Global Action Center</Button>
            </Link>
          </div>
        )}
      </div>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Enter payment details. The invoice balance will update automatically.
            </DialogDescription>
          </DialogHeader>
          <PaymentForm 
            invoiceId={invoice.id} 
            maxAmount={invoice.outstanding_amount} 
            onSuccess={() => setIsPaymentDialogOpen(false)}
            onCancel={() => setIsPaymentDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <RecoveryPreviewModal 
        isOpen={isRecoveryModalOpen} 
        onClose={() => setIsRecoveryModalOpen(false)} 
        invoiceData={invoice} 
      />
    </div>
  );
}