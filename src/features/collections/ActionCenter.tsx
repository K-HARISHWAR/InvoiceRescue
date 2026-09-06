import { useState, useMemo } from 'react';
import PageHeader from "@/components/common/PageHeader";
import { useSession } from "@/hooks/useSession";
import { useCollectionActions, useTriggerEngine, useUpdateActionStatus, useAssignAction, useSnoozeAction, type CollectionAction } from "@/hooks/useCollectionActions";
import { useSavedViews } from "@/hooks/useSavedViews";
import { useTeam } from '@/hooks/useTeam';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MoneyDisplay } from "@/lib/formatting/MoneyDisplay";
import { RiskBadge } from "@/components/common/RiskBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActionDetailDrawer } from './ActionDetailDrawer';
import { Play, Check, Clock, ListFilter, UserCheck } from "lucide-react";
import { toast } from 'sonner';

export default function ActionCenter() {
  const { business: currentBusiness } = useSession();
  const { data: actions, isLoading } = useCollectionActions(currentBusiness?.id);
  const { mutate: triggerEngine, isPending: isEngineRunning } = useTriggerEngine(currentBusiness?.id);
  const { data: savedViews } = useSavedViews(currentBusiness?.id, 'action');
  const { data: teamMembers } = useTeam(currentBusiness?.id);
  
  const [activeView, setActiveView] = useState<string>('needs_review');
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [detailActionId, setDetailActionId] = useState<string | null>(null);

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateActionStatus();
  const { mutate: assignAction } = useAssignAction();
  const { mutate: snoozeAction } = useSnoozeAction();

  const handleToggleSelect = (actionId: string, checked: boolean) => {
    const newSet = new Set(selectedActions);
    if (checked) newSet.add(actionId);
    else newSet.delete(actionId);
    setSelectedActions(newSet);
  };

  const handleSelectAll = (checked: boolean, list: CollectionAction[]) => {
    if (checked) {
      setSelectedActions(new Set(list.map(a => a.id)));
    } else {
      setSelectedActions(new Set());
    }
  };

  const filteredActions = useMemo(() => {
    if (!actions) return [];
    
    // Built-in views
    if (activeView === 'needs_review') return actions.filter(a => a.status === 'recommended' || a.status === 'draft');
    if (activeView === 'my_actions') return actions.filter(a => a.status !== 'completed' && a.status !== 'skipped' && a.status !== 'failed' && a.assigned_to === currentBusiness?.id);
    if (activeView === 'approved') return actions.filter(a => a.status === 'approved');
    if (activeView === 'snoozed') return actions.filter(a => a.status === 'snoozed');
    if (activeView === 'completed') return actions.filter(a => a.status === 'completed' || a.status === 'sent');
    
    // Custom saved views (placeholder for actual JSON filter logic)
    const view = savedViews?.find(v => v.id === activeView);
    if (view && view.filters) {
      // In a real app, apply view.filters. For now just return needs review
      return actions.filter(a => a.status === 'recommended' || a.status === 'draft');
    }

    return actions;
  }, [actions, activeView, savedViews, currentBusiness?.id]);

  const handleTabChange = (view: string) => {
    setActiveView(view);
    setSelectedActions(new Set());
  };

  // Bulk actions handlers
  const handleBulkAssign = (userId: string | null) => {
    if (!userId || selectedActions.size === 0) return;
    const promises = Array.from(selectedActions).map(id => assignAction({ actionId: id, assignedTo: userId === 'unassigned' ? null : userId }));
    toast.promise(Promise.all(promises), {
      loading: 'Assigning actions...',
      success: 'Actions assigned successfully',
      error: 'Failed to assign some actions'
    });
    setSelectedActions(new Set());
  };

  const handleBulkSnooze = (days: number) => {
    if (selectedActions.size === 0) return;
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + days);
    
    const promises = Array.from(selectedActions).map(id => snoozeAction({ actionId: id, snoozeUntil: snoozeDate.toISOString() }));
    toast.promise(Promise.all(promises), {
      loading: 'Snoozing actions...',
      success: 'Actions snoozed successfully',
      error: 'Failed to snooze some actions'
    });
    setSelectedActions(new Set());
  };

  const handleBulkMarkReviewed = () => {
    if (selectedActions.size === 0) return;
    const promises = Array.from(selectedActions).map(id => updateStatus({ actionId: id, status: 'approved' }));
    toast.promise(Promise.all(promises), {
      loading: 'Approving actions...',
      success: 'Actions approved successfully',
      error: 'Failed to approve some actions'
    });
    setSelectedActions(new Set());
  };

  const isBulkActive = selectedActions.size > 0;

  const singleSelectedAction = selectedActions.size === 1 
    ? actions?.find(a => a.id === Array.from(selectedActions)[0]) 
    : null;
  const currentAssignValue = singleSelectedAction?.assigned_to || undefined;

  return (
    <div className="space-y-6 pb-24 relative">
      <PageHeader 
        title="Action Center" 
        description="Review, assign, and execute collection workflows."
        actions={
          <div className="flex gap-2">
            <Button 
              onClick={() => triggerEngine()} 
              disabled={isEngineRunning}
              className="flex items-center gap-2"
            >
              <Play size={16} /> {isEngineRunning ? 'Running Engine...' : 'Run Action Engine'}
            </Button>
          </div>
        }
      />
      
      {/* Views & Filters Bar */}
      <div className="flex justify-between items-center bg-muted/20 p-2 rounded-lg border">
        <div className="flex space-x-1">
          <Button variant="ghost" onClick={() => handleTabChange('needs_review')} className={`h-8 ${activeView === 'needs_review' ? 'bg-primary/10 text-primary hover:bg-primary/20 font-medium' : 'text-muted-foreground'}`}>Needs Review</Button>
          <Button variant="ghost" onClick={() => handleTabChange('approved')} className={`h-8 ${activeView === 'approved' ? 'bg-primary/10 text-primary hover:bg-primary/20 font-medium' : 'text-muted-foreground'}`}>Approved</Button>
          <Button variant="ghost" onClick={() => handleTabChange('snoozed')} className={`h-8 ${activeView === 'snoozed' ? 'bg-primary/10 text-primary hover:bg-primary/20 font-medium' : 'text-muted-foreground'}`}>Snoozed</Button>
          <Button variant="ghost" onClick={() => handleTabChange('completed')} className={`h-8 ${activeView === 'completed' ? 'bg-primary/10 text-primary hover:bg-primary/20 font-medium' : 'text-muted-foreground'}`}>Completed</Button>
          
          {savedViews && savedViews.length > 0 && (
            <div className="h-8 w-px bg-border mx-2" />
          )}
          {savedViews?.map(view => (
            <Button key={view.id} variant="ghost" onClick={() => handleTabChange(view.id)} className={`h-8 ${activeView === view.id ? 'bg-primary/10 text-primary hover:bg-primary/20 font-medium' : 'text-muted-foreground'}`}>
              <ListFilter size={14} className="mr-2 opacity-50" /> {view.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
           <p className="text-muted-foreground text-sm p-4">Loading actions...</p>
        ) : filteredActions.length === 0 ? (
           <div className="p-12 text-center border border-dashed rounded-lg bg-muted/10 text-muted-foreground flex flex-col items-center">
             <Check className="h-8 w-8 mb-4 opacity-20 text-success" />
             <p className="font-medium text-foreground">You're all caught up!</p>
             <p className="text-sm mt-1">No actions require your attention in this view.</p>
           </div>
        ) : (
           <>
             <div className="flex items-center gap-3 px-2 py-1">
               <Checkbox 
                 checked={selectedActions.size === filteredActions.length && filteredActions.length > 0} 
                 onCheckedChange={(c) => handleSelectAll(!!c, filteredActions)} 
               />
               <span className="text-sm font-medium text-muted-foreground">Select All ({filteredActions.length})</span>
             </div>
             
             {filteredActions.map(action => (
               <div key={action.id} className="relative group">
                 <div className="absolute left-4 top-5 z-10">
                   <Checkbox 
                     checked={selectedActions.has(action.id)} 
                     onCheckedChange={(c) => handleToggleSelect(action.id, !!c)} 
                   />
                 </div>
                 <ActionCard 
                   action={action} 
                   onClick={() => setDetailActionId(action.id)}
                   teamMembers={teamMembers}
                 />
               </div>
             ))}
           </>
        )}
      </div>

      {/* Bulk Action Sticky Footer */}
      {isBulkActive && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-popover border shadow-lg rounded-full px-4 py-2 flex items-center gap-4 z-40 animate-in slide-in-from-bottom-10">
          <span className="text-sm font-medium px-2 border-r">{selectedActions.size} selected</span>
          
          <Select key={`assign-${Array.from(selectedActions).join(',')}`} defaultValue={currentAssignValue} onValueChange={handleBulkAssign}>
            <SelectTrigger className="h-8 border-none bg-transparent hover:bg-muted w-auto min-w-[120px]">
              <UserCheck size={14} className="mr-2" /> 
              <SelectValue placeholder="Assign">
                {currentAssignValue && currentAssignValue !== 'unassigned'
                  ? (teamMembers?.find((m: any) => m.user_id === currentAssignValue)?.profiles?.full_name || teamMembers?.find((m: any) => m.user_id === currentAssignValue)?.profiles?.email)
                  : "Assign"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned" className="text-muted-foreground italic">Unassigned</SelectItem>
              {teamMembers?.map((member: any) => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.profiles?.full_name || member.profiles?.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select key={`snooze-${Array.from(selectedActions).join(',')}`} onValueChange={(val) => handleBulkSnooze(parseInt(val as string))}>
            <SelectTrigger className="h-8 border-none bg-transparent hover:bg-muted w-auto min-w-[100px]">
              <Clock size={14} className="mr-2" /> <SelectValue placeholder="Snooze" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Tomorrow</SelectItem>
              <SelectItem value="3">3 Days</SelectItem>
              <SelectItem value="7">1 Week</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" variant="default" onClick={handleBulkMarkReviewed} disabled={isUpdating} className="h-8 rounded-full ml-2">
            <Check size={14} className="mr-2" /> Approve All
          </Button>
        </div>
      )}

      {/* Action Detail Drawer */}
      <ActionDetailDrawer 
        action={actions?.find(a => a.id === detailActionId) || null} 
        isOpen={!!detailActionId} 
        onClose={() => setDetailActionId(null)} 
      />
    </div>
  );
}

function ActionCard({ action, onClick, teamMembers }: { action: CollectionAction, onClick: () => void, teamMembers: any[] | undefined }) {
  const daysOverdue = action.invoices?.due_date 
    ? Math.max(0, Math.floor((new Date().getTime() - new Date(action.invoices.due_date).getTime()) / (1000 * 3600 * 24)))
    : 0;

  const assigneeName = action.assigned_to && teamMembers 
    ? (teamMembers.find(m => m.user_id === action.assigned_to)?.profiles?.full_name || teamMembers.find(m => m.user_id === action.assigned_to)?.profiles?.email)
    : null;

  return (
    <Card 
      onClick={onClick}
      className="shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 cursor-pointer pl-10"
    >
      <CardHeader className="py-4">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base font-semibold">{action.invoices?.customers?.name || 'Unknown Customer'}</CardTitle>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md border">
                {action.status.toUpperCase()}
              </span>
              {action.assigned_to && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1">
                  <UserCheck size={12} /> {assigneeName || 'Assigned'}
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <span className="font-medium text-foreground">{action.invoices?.invoice_number}</span>
              <span>•</span>
              <span>
                <span className="text-foreground font-medium">Recommended:</span>{' '}
                {action.action_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </span>
            </div>
          </div>
          <div className="text-right flex items-center gap-6">
            <div className="text-right">
               <div className="font-semibold text-base"><MoneyDisplay amount={action.invoices?.outstanding_amount || 0} /></div>
               <div className="text-xs text-muted-foreground mt-0.5">{daysOverdue} days overdue</div>
            </div>
            {action.invoices?.risk_level && (
               <div className="w-24 text-right">
                 <RiskBadge level={action.invoices.risk_level as any} />
               </div>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}