import { Menu } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { NotificationsMenu } from "./NotificationsMenu"
import GlobalSearch from "./GlobalSearch"
import { useSession } from "@/hooks/useSession"

export default function Header() {
  const { user } = useSession();
  
  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.split(/[\s_-]+/).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const fullName = user?.user_metadata?.full_name || user?.email || "User";
  const initials = getInitials(fullName);

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 glass border-b border-white/20 shadow-soft z-20 relative sticky top-0">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden md:flex relative w-64 lg:w-96">
          <GlobalSearch />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <NotificationsMenu />
        
        <Avatar className="h-8 w-8 border border-border cursor-pointer">
          <AvatarImage src={user?.user_metadata?.avatar_url || ""} alt={fullName} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
