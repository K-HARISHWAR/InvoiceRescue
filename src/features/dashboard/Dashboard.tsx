import PageHeader from "@/components/common/PageHeader"
import MetricCard from "@/components/common/MetricCard"
import { MoneyDisplay } from "@/lib/formatting/MoneyDisplay"
import { StatusBadge } from "@/components/common/StatusBadge"
import { RiskBadge } from "@/components/common/RiskBadge"
import { DateDisplay } from "@/lib/formatting/DateDisplay"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Wallet, AlertCircle, ShieldAlert, CheckCircle2, ArrowRight, Clock, Percent, FileText, TrendingUp, CalendarClock, MessageSquare } from "lucide-react"
import { 
  useDashboardMetrics, 
  useInvoicesRequiringAttention,
  useExpectedCashInflow,
  useCustomerPaymentBehaviour,
  useCollectionSuccess
} from "@/hooks/useDashboard"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import { Link } from "react-router-dom"
import { DailyBriefing } from "@/components/dashboard/DailyBriefing"

export default function Dashboard() {
  const { data: metricsData, isLoading: isMetricsLoading } = useDashboardMetrics();
  const { data: attentionInvoices, isLoading: isAttentionLoading } = useInvoicesRequiringAttention();
  const { data: cashInflow, isLoading: isCashInflowLoading } = useExpectedCashInflow();
  const { data: paymentBehaviour, isLoading: isBehaviourLoading } = useCustomerPaymentBehaviour();
  const { data: collectionSuccess, isLoading: isSuccessLoading } = useCollectionSuccess();

  const metrics = metricsData?.metrics || {
    outstanding: 0,
    overdue: 0,
    atRisk: 0,
    collectedThisMonth: 0,
    averageDaysToPay: 0,
    averageDaysLate: 0,
    onTimePaymentRate: 0,
    openInvoiceCount: 0
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
        
        {/* New Phase 11 Metrics */}
        <MetricCard 
          title="Avg Days to Pay" 
          value={`${metrics.averageDaysToPay || 0} days`} 
          icon={<Clock className="text-blue-500" />}
          loading={isMetricsLoading}
        />
        <MetricCard 
          title="Avg Days Late" 
          value={`${metrics.averageDaysLate || 0} days`} 
          icon={<CalendarClock className="text-amber-500" />}
          loading={isMetricsLoading}
        />
        <MetricCard 
          title="On-Time Rate" 
          value={`${(metrics.onTimePaymentRate || 0).toFixed(1)}%`} 
          icon={<Percent className="text-green-500" />}
          loading={isMetricsLoading}
        />
        <MetricCard 
          title="Open Invoices" 
          value={metrics.openInvoiceCount?.toString() || "0"} 
          icon={<FileText className="text-purple-500" />}
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

      {/* New Phase 11 Charts */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-soft">
          <CardHeader>
            <CardTitle>Expected Cash Inflow</CardTitle>
            <CardDescription>Estimated incoming payments by week (Projected).</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isCashInflowLoading ? (
               <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading projections...</div>
            ) : (!cashInflow || cashInflow.length === 0) ? (
               <div className="h-full flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md m-4">No projected cash inflow available.</div>
            ) : (
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={cashInflow} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                   <XAxis 
                     dataKey="week_start" 
                     axisLine={false} 
                     tickLine={false} 
                     tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                     tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                     dy={10} 
                   />
                   <YAxis 
                     axisLine={false} 
                     tickLine={false} 
                     tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                     tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                   />
                   <Tooltip content={<CustomTooltip />} />
                   <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
                 </LineChart>
               </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-soft">
          <CardHeader>
            <CardTitle>Customer Payment Behaviour</CardTitle>
            <CardDescription>Average days early or late by customer.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {isBehaviourLoading ? (
                <div className="text-sm text-muted-foreground text-center py-8">Loading behaviour data...</div>
              ) : (!paymentBehaviour || paymentBehaviour.length === 0) ? (
                <div className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded-md">Not enough payment history.</div>
              ) : (
                paymentBehaviour?.map((pb, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                    <span className="font-medium text-sm truncate pr-4">{pb.customer_name}</span>
                    <span className={`text-sm font-bold whitespace-nowrap px-2 py-1 rounded-md ${pb.avg_days_late <= 0 ? 'bg-green-100 text-green-700' : pb.avg_days_late <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {pb.avg_days_late > 0 ? `+${pb.avg_days_late} days late` : `${Math.abs(pb.avg_days_late)} days early`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-soft">
          <CardHeader>
            <CardTitle>Collection Success</CardTitle>
            <CardDescription>Invoices paid after specific collection actions.</CardDescription>
          </CardHeader>
          <CardContent>
            {isSuccessLoading ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Loading success data...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full items-center">
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl flex flex-col items-center justify-center text-center">
                   <div className="bg-blue-100 p-3 rounded-full mb-3 text-blue-600">
                     <MessageSquare size={24} />
                   </div>
                   <h4 className="text-3xl font-bold text-blue-900 mb-1">{collectionSuccess?.afterReminder || 0}</h4>
                   <p className="text-sm font-medium text-blue-700">Paid after reminder</p>
                </div>
                <div className="bg-green-50 border border-green-100 p-6 rounded-xl flex flex-col items-center justify-center text-center">
                   <div className="bg-green-100 p-3 rounded-full mb-3 text-green-600">
                     <TrendingUp size={24} />
                   </div>
                   <h4 className="text-3xl font-bold text-green-900 mb-1">{collectionSuccess?.afterPromise || 0}</h4>
                   <p className="text-sm font-medium text-green-700">Paid after promise</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-6 rounded-xl flex flex-col items-center justify-center text-center">
                   <div className="bg-amber-100 p-3 rounded-full mb-3 text-amber-600">
                     <AlertCircle size={24} />
                   </div>
                   <h4 className="text-3xl font-bold text-amber-900 mb-1">{collectionSuccess?.afterEscalation || 0}</h4>
                   <p className="text-sm font-medium text-amber-700">Paid after escalation</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-3 shadow-soft">
          <CardHeader>
            <CardTitle>Collection Pipeline</CardTitle>
            <CardDescription>Number of invoices at each stage.</CardDescription>
          </CardHeader>
          <CardContent className="h-[200px]">
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
      </div>
    </div>
  )
}
