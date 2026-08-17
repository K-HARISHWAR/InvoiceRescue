import PageHeader from "@/components/common/PageHeader"
import MetricCard from "@/components/common/MetricCard"
import { MoneyDisplay } from "@/lib/formatting/MoneyDisplay"
import { StatusBadge } from "@/components/common/StatusBadge"
import { RiskBadge } from "@/components/common/RiskBadge"
import { DateDisplay } from "@/lib/formatting/DateDisplay"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wallet, AlertCircle, ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react"

// MOCK DATA - To be isolated and removed in Phase 4
const MOCK_METRICS = {
  outstanding: 1250000,
  overdue: 345000,
  atRisk: 120000,
  collectedThisMonth: 890000
}

const MOCK_INVOICES = [
  { id: "INV-2024-001", customer: "TechCorp Inc.", amount: 45000, dueDate: "2024-03-15", status: "overdue", risk: "high" },
  { id: "INV-2024-002", customer: "Global Solutions", amount: 120000, dueDate: "2024-03-10", status: "overdue", risk: "critical" },
  { id: "INV-2024-003", customer: "Nexus Industries", amount: 25000, dueDate: "2024-03-20", status: "pending", risk: "low" },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dashboard" 
        description="Overview of your receivables and collection health."
        actions={
          <Button>
            New Invoice
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          title="Total Outstanding" 
          value={<MoneyDisplay amount={MOCK_METRICS.outstanding} />} 
          icon={<Wallet />}
          trend={{ value: "2.5%", isPositive: true }}
        />
        <MetricCard 
          title="Total Overdue" 
          value={<MoneyDisplay amount={MOCK_METRICS.overdue} />} 
          icon={<AlertCircle className="text-destructive" />}
          trend={{ value: "1.2%", isPositive: false }}
        />
        <MetricCard 
          title="At Risk" 
          value={<MoneyDisplay amount={MOCK_METRICS.atRisk} />} 
          icon={<ShieldAlert className="text-orange-500" />}
        />
        <MetricCard 
          title="Collected This Month" 
          value={<MoneyDisplay amount={MOCK_METRICS.collectedThisMonth} />} 
          icon={<CheckCircle2 className="text-success" />}
          trend={{ value: "12%", isPositive: true }}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Invoices Requiring Attention</CardTitle>
              <CardDescription>Highest priority overdue or at-risk invoices.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1">
              View All <ArrowRight size={14} />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {MOCK_INVOICES.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">{inv.customer}</span>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{inv.id}</span>
                      <span>•</span>
                      <span>Due <DateDisplay date={inv.dueDate} /></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold text-foreground"><MoneyDisplay amount={inv.amount} /></div>
                      <div className="flex gap-2 mt-1 justify-end">
                        <StatusBadge status={inv.status as any} />
                        <RiskBadge level={inv.risk as any} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-soft">
          <CardHeader>
            <CardTitle>Receivables Aging</CardTitle>
            <CardDescription>Outstanding balance by days past due.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center border-t border-border bg-muted/20">
            <p className="text-muted-foreground font-medium flex items-center gap-2">
              <AlertCircle size={16} /> Chart Placeholder (Phase 2)
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] flex items-center justify-center border-t border-border bg-muted/20">
            <p className="text-muted-foreground font-medium flex items-center gap-2">
              <AlertCircle size={16} /> Activity Feed Placeholder
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Recommended Collection Actions</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] flex items-center justify-center border-t border-border bg-muted/20">
            <p className="text-muted-foreground font-medium flex items-center gap-2">
              <AlertCircle size={16} /> AI Actions Placeholder
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
