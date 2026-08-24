import { useState } from 'react';
import PageHeader from "@/components/common/PageHeader";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MoneyDisplay } from '@/lib/formatting/MoneyDisplay';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle, Archive, CheckCircle2 } from 'lucide-react';
import { RiskBadge } from '@/components/common/RiskBadge';

export default function Recovery() {
  const { business } = useSession();
  const [activeTab, setActiveTab] = useState<'ready' | 'generated' | 'resolved'>('ready');

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['recovery-invoices', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id, 
          invoice_number, 
          outstanding_amount, 
          currency,
          due_date, 
          risk_level, 
          collection_stage, 
          payment_status,
          customers(name, company_name)
        `)
        .eq('business_id', business.id)
        .or('risk_level.in.(high,critical),collection_stage.in.(escalated,recovery_ready)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!business?.id
  });

  const readyForRecovery = invoices?.filter(i => 
    i.payment_status !== 'paid' && 
    i.collection_stage !== 'recovery_ready' &&
    (i.risk_level === 'high' || i.risk_level === 'critical' || i.collection_stage === 'escalated')
  ) || [];

  const packGenerated = invoices?.filter(i => 
    i.payment_status !== 'paid' && 
    i.collection_stage === 'recovery_ready'
  ) || [];

  const resolved = invoices?.filter(i => 
    i.payment_status === 'paid' && 
    (i.collection_stage === 'recovery_ready' || i.collection_stage === 'escalated')
  ) || [];

  const getActiveList = () => {
    switch (activeTab) {
      case 'ready': return readyForRecovery;
      case 'generated': return packGenerated;
      case 'resolved': return resolved;
      default: return [];
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Recovery & Escalation" 
        description="Manage high-risk accounts and generate evidence packs for legal or third-party collection."
      />

      <div className="flex space-x-2 border-b border-border">
        <button
          onClick={() => setActiveTab('ready')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'ready' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Ready for Recovery
            {readyForRecovery.length > 0 && (
              <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded-full text-xs">
                {readyForRecovery.length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('generated')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'generated' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4" /> Pack Generated
            {packGenerated.length > 0 && (
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">
                {packGenerated.length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('resolved')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'resolved' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Resolved
          </div>
        </button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-center p-8">Loading recovery accounts...</div>
      ) : getActiveList().length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-lg text-muted-foreground bg-muted/10">
           No accounts in this category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {getActiveList().map(invoice => (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{(invoice.customers as any)?.company_name || (invoice.customers as any)?.name}</CardTitle>
                    <div className="text-sm font-medium text-muted-foreground mt-1">
                      {invoice.invoice_number}
                    </div>
                  </div>
                  {invoice.risk_level && <RiskBadge level={invoice.risk_level as any} />}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Outstanding</div>
                    <div className="text-xl font-bold text-destructive">
                      <MoneyDisplay amount={invoice.outstanding_amount} currency={invoice.currency} />
                    </div>
                  </div>
                  <Link to={`/app/invoices/${invoice.id}`}>
                    <div className="flex items-center text-sm font-medium text-primary hover:underline">
                      View details <ArrowRight className="ml-1 h-4 w-4" />
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}