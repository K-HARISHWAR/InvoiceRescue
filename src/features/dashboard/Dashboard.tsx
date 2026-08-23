import PageHeader from "@/components/common/PageHeader"
import MetricCard from "@/components/common/MetricCard"
import { MoneyDisplay } from "@/lib/formatting/MoneyDisplay"
import { StatusBadge } from "@/components/common/StatusBadge"
import { RiskBadge } from "@/components/common/RiskBadge"
import { DateDisplay } from "@/lib/formatting/DateDisplay"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Wallet, AlertCircle, ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react"
import { useDashboardMetrics, useInvoicesRequiringAttention } from "@/hooks/useDashboard"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import { Link } from "react-router-dom"
import { DailyBriefing } from "@/components/dashboard/DailyBriefing"

export default function Dashboard() {
  const { data: metricsData, isLoading: isMetricsLoading } = useDashboardMetrics();
  const { data: attentionInvoices, isLoading: isAttentionLoading } = useInvoicesRequiringAttention();

  const metrics = metricsData?.metrics || {
    outstanding: 0,
    overdue: 0,
    atRisk: 0,
    collectedThisMonth: 0
  };

  const agingData = [
    { name: 'Not Due', amount: metricsData?.aging.notDue || 0, color: '#10b981' },
    { name: '1-30 Days', amount: metricsData?.aging.days1_30 || 0, color: '#f59e0b' },
    { name: '31-60 Days', amount: metricsData?.aging.days31_60 || 0, color: '#f97316' },
    { name: '61-90 Days', amount: metricsData?.aging.days61_90 || 0, color: '#ef4444' },
    { name: '90+ Days', amount: metricsData?.aging.days90Plus || 0, color: '#991b1b' },
  ];

  const pipelineDataRaw = metricsData?.pipeline || {};
  const pipelineOrder = ['monitoring', 'due_soon', 'overdue', 'promise_pending', 'promise_missed', 'escalated', 'recovery_ready'];
  const pipelineData = pipelineOrder.map(stage => ({
    name: stage.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    count: pipelineDataRaw[stage] || 0
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border p-3 rounded-md shadow-lg">
          <p className="text-sm font-medium mb-1">{label}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value.toLocaleString('en-IN', {
              style: 'currency',
              currency: 'INR'
            })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dashboard" 
        description="Overview of your receivables and collection health."
        actions={
          <Link to="/app/invoices" className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors">
            View Invoices
          </Link>
        }
      />

      <div className="grid gap-6">
        <DailyBriefing />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          title="Total Outstanding" 
          value={<MoneyDisplay amount={metrics.outstanding} />} 
          icon={<Wallet />}
          loading={isMetricsLoading}
        />
        <MetricCard 
          title="Total Overdue" 
          value={<MoneyDisplay amount={metrics.overdue} />} 
          icon={<AlertCircle className="text-destructive" />}
          loading={isMetricsLoading}
        />
        <MetricCard 
          title="At Risk" 
          value={<MoneyDisplay amount={metrics.atRisk} />} 
          icon={<ShieldAlert className="text-orange-500" />}
          loading={isMetricsLoading}
        />
        <MetricCard 
          title="Collected This Month" 
          value={<MoneyDisplay amount={metrics.collectedThisMonth} />} 
          icon={<CheckCircle2 className="text-success" />}
          loading={isMetricsLoading}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Requires Attention</CardTitle>
              <CardDescription>Highest priority overdue or at-risk invoices.</CardDescription>
            </div>
            <Link to="/app/invoices" className="text-sm font-medium hover:bg-muted p-2 rounded-md transition-colors flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isAttentionLoading ? (
                <div className="text-sm text-muted-foreground p-4 text-center">Loading invoices...</div>
              ) : attentionInvoices?.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded-md">No invoices require immediate attention.</div>
              ) : (
                attentionInvoices?.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">{Array.isArray(inv.customers) ? inv.customers[0]?.company_name || inv.customers[0]?.name : (inv.customers as any)?.company_name || (inv.customers as any)?.name || 'Unknown Customer'}</span>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{inv.invoice_number}</span>
                        <span>•</span>
                        <span>Due {inv.due_date ? <DateDisplay date={inv.due_date} /> : 'N/A'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold text-foreground"><MoneyDisplay amount={inv.outstanding_amount} /></div>
                        <div className="flex gap-2 mt-1 justify-end">
                          <StatusBadge status={inv.payment_status as any} />
                          {inv.risk_level && <RiskBadge level={inv.risk_level as any} />}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-soft">
          <CardHeader>
            <CardTitle>Receivables Aging</CardTitle>
            <CardDescription>Outstanding balance by days past due.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
             {isMetricsLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading chart...</div>
             ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingData} margin={{ top: 20, right: 0, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                      dy={10} 
                    />
                    <YAxis 
                      hide 
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.5)' }} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {agingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Collection Pipeline</CardTitle>
            <CardDescription>Number of invoices at each stage.</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
            {isMetricsLoading ? (
               <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading chart...</div>
            ) : (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={pipelineData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                   <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                   <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} width={110} />
                   <Tooltip 
                     cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                     contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '6px' }}
                     itemStyle={{ color: 'hsl(var(--foreground))' }}
                   />
                   <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                 </BarChart>
               </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates across your business.</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center border-t border-border/50 bg-muted/10">
            <p className="text-muted-foreground font-medium flex items-center gap-2 text-sm">
              <AlertCircle size={16} /> Activity feed implementation pending
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
