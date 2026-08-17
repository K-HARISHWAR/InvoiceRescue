import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export function RiskBadge({ level, className }: { level: RiskLevel, className?: string }) {
  const styles = {
    low: "bg-success/15 text-success hover:bg-success/25 border-transparent",
    medium: "bg-warning/20 text-amber-700 dark:text-warning hover:bg-warning/30 border-transparent",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-400 hover:bg-orange-500/25 border-transparent",
    critical: "bg-destructive/15 text-destructive hover:bg-destructive/25 border-transparent"
  }
  
  return (
    <Badge variant="outline" className={cn("capitalize font-medium", styles[level], className)}>
      {level} Risk
    </Badge>
  )
}
