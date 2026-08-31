import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useDailyBriefing } from "@/hooks/useDailyBriefing"
import { MoneyDisplay } from "@/lib/formatting/MoneyDisplay"
import { useSession } from "@/hooks/useSession"
import { Link } from "react-router-dom"
import { ArrowRight, AlertCircle, Clock, CalendarDays } from "lucide-react"

export function DailyBriefing() {
  const { data: briefing, isLoading } = useDailyBriefing()
  const { primaryEntity } = useSession()

  if (isLoading || !briefing) {
    return (
      <Card className="col-span-full xl:col-span-1 border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="h-6 w-32 bg-muted animate-pulse rounded mb-2"></div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-background rounded border animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const currency = primaryEntity?.currency || 'USD'

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning.'
    if (hour < 18) return 'Good afternoon.'
    return 'Good evening.'
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'missed_promise':
        return <AlertCircle className="h-4 w-4 text-destructive mt-1" />
      case 'overdue':
        return <Clock className="h-4 w-4 text-amber-500 mt-1" />
      case 'due_soon':
        return <CalendarDays className="h-4 w-4 text-emerald-500 mt-1" />
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground mt-1" />
    }
  }

  return (
    <Card className="col-span-full border-primary/20 bg-card shadow-md relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute right-0 top-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-medium tracking-tight text-foreground/80">
          {greeting()}
        </CardTitle>
        <CardDescription className="text-2xl font-semibold text-foreground mt-1">
          <MoneyDisplay amount={briefing.outstandingAmount} currency={currency} /> currently outstanding.
        </CardDescription>
        {briefing.actions.length > 0 && (
          <p className="text-sm font-medium text-muted-foreground mt-2">
            {briefing.actions.length} action{briefing.actions.length === 1 ? '' : 's'} need your attention.
          </p>
        )}
      </CardHeader>
      
      <CardContent>
        {briefing.actions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
            <p>You're all caught up for today!</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {briefing.actions.map((action) => (
              <Link 
                key={action.id} 
                to={`/app/invoices/${action.invoiceId}`}
                className="group flex gap-3 p-4 rounded-xl border bg-background hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="shrink-0">
                  {getIcon(action.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-sm truncate">{action.customerName}</h4>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {action.amount > 0 && (
                    <div className="text-sm font-medium mt-0.5">
                    <MoneyDisplay amount={action.amount} currency={currency} />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
                    {action.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
