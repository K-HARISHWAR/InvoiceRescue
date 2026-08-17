import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'draft'

export function StatusBadge({ status, className }: { status: InvoiceStatus, className?: string }) {
  const styles = {
    paid: "bg-success/15 text-success hover:bg-success/25 border-transparent",
    pending: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-transparent",
    overdue: "bg-destructive/15 text-destructive hover:bg-destructive/25 border-transparent",
    draft: "bg-muted text-muted-foreground hover:bg-muted/80 border-transparent"
  }
  
  return (
    <Badge variant="outline" className={cn("capitalize font-medium", styles[status], className)}>
      {status}
    </Badge>
  )
}
