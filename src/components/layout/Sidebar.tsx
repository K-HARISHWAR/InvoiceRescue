import { NavLink } from "react-router-dom"
import { LayoutDashboard, FileText, Users, Activity, ShieldAlert, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { BusinessSwitcher } from "./BusinessSwitcher"

const navItems = [
  { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { name: "Invoices", href: "/app/invoices", icon: FileText },
  { name: "Customers", href: "/app/customers", icon: Users },
  { name: "Action Center", href: "/app/actions", icon: Activity },
  { name: "Recovery", href: "/app/recovery", icon: ShieldAlert },
  { name: "Settings", href: "/app/settings", icon: Settings },
]

export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <span className="text-xl font-bold tracking-tight text-primary">InvoiceRescue</span>
      </div>
      
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
              )
            }
          >
            <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <BusinessSwitcher />
      </div>
    </aside>
  )
}
