import { format, parseISO } from "date-fns"

export function DateDisplay({ 
  date, 
  formatStr = "MMM d, yyyy" 
}: { 
  date?: string | Date | null, 
  formatStr?: string 
}) {
  if (!date) return <span>-</span>
  
  try {
    const parsedDate = typeof date === "string" ? parseISO(date) : date
    return <span>{format(parsedDate, formatStr)}</span>
  } catch (e) {
    return <span>Invalid Date</span>
  }
}
