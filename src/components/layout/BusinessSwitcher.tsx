import { useState } from 'react';
import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { cn } from '@/lib/utils';
import { CreateBusinessDialog } from './CreateBusinessDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';

export function BusinessSwitcher() {
  const { business, availableBusinesses, switchBusiness } = useSession();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  if (!business) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <div className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary transition-colors cursor-pointer w-full group outline-none focus:ring-2 focus:ring-primary/20">
            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <Building2 size={16} />
            </div>
            <div className="flex flex-col overflow-hidden flex-1 text-left">
              <span className="text-sm font-medium truncate">{business.name}</span>
              <span className="text-xs text-muted-foreground truncate">{business.country}</span>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[240px]" align="start" side="top" sideOffset={8}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Switch Organisation</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
            {availableBusinesses.map((b) => (
              <DropdownMenuItem
                key={b.id}
                onClick={() => switchBusiness(b.id)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex flex-col overflow-hidden">
                  <span className={cn("text-sm truncate", b.id === business.id && "font-medium")}>
                    {b.name}
                  </span>
                </div>
                {b.id === business.id && <Check className="h-4 w-4 ml-2 text-primary flex-shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => {
              setTimeout(() => setShowCreateDialog(true), 100);
            }}
            className="cursor-pointer text-primary"
          >
            <div className="flex items-center">
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center mr-2">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Create Organisation</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateBusinessDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />
    </>
  );
}
