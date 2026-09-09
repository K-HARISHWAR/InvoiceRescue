import { NavLink } from "react-router-dom"
import { LayoutDashboard, FileText, Users, Activity, ShieldAlert, Settings, History } from "lucide-react"
import { cn } from "@/lib/utils"
import { BusinessSwitcher } from "./BusinessSwitcher"

const navItems = [
  { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { name: "Invoices", href: "/app/invoices", icon: FileText },
  { name: "Customers", href: "/app/customers", icon: Users },
  { name: "Action Center", href: "/app/actions", icon: Activity },
  { name: "Recovery", href: "/app/recovery", icon: ShieldAlert },
  { name: "Team", href: "/app/team", icon: Users },
  { name: "Activity", href: "/app/activity", icon: History },
  { name: "Settings", href: "/app/settings", icon: Settings },
]

export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 flex-col glass border-r border-white/20 z-10">
      <div className="h-16 flex items-center px-6 border-b border-white/20">
        <span className="text-xl font-bold tracking-tight text-primary">InvoiceRescue</span>
      </div>
      
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-soft" 
                  : "text-muted-foreground hover:bg-white/50 hover:text-foreground hover:shadow-soft"
              )
            }
          >
            <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/20">
        <BusinessSwitcher />
      </div>
    </aside>
  )
}
