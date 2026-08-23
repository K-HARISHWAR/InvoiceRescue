import { Bell, Clock, AlertCircle, ShieldAlert, FileText, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useNotifications, type Notification } from "@/hooks/useNotifications"
import { useNavigate } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

export function NotificationsMenu() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const navigate = useNavigate()

  const getIcon = (type: string) => {
    switch (type) {
      case 'due_soon':
      case 'overdue':
        return <Clock className="h-4 w-4 text-amber-500" />
      case 'promise_missed':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      case 'risk_high':
      case 'risk_critical':
        return <ShieldAlert className="h-4 w-4 text-destructive" />
      case 'payment_recorded':
        return <CheckCircle2 className="h-4 w-4 text-success" />
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getLink = (notification: Notification) => {
    if (notification.entity_type === 'invoice') {
      return `/app/invoices/${notification.entity_id}`
    }
    return '#'
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-destructive animate-pulse"></span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="font-semibold text-sm">Notifications</div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-auto py-1 px-2 text-muted-foreground"
              onClick={() => markAllAsRead()}
            >
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        
        <div className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem 
                key={notification.id} 
                className={cn(
                  "flex items-start gap-3 p-3 cursor-pointer",
                  !notification.read_at && "bg-muted/50 font-medium"
                )}
                onClick={() => {
                  if (!notification.read_at) {
                    markAsRead(notification.id)
                  }
                  navigate(getLink(notification))
                }}
              >
                <div className="mt-0.5 shrink-0">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 space-y-1 overflow-hidden">
                  <p className="text-sm leading-tight text-foreground/90">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!notification.read_at && (
                  <div className="shrink-0">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                  </div>
                )}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
