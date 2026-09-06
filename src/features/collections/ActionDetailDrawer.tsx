import { useState } from 'react';
import { useAssignAction, useSnoozeAction, useUpdateActionStatus, useSendGmailAction } from '@/hooks/useCollectionActions';
import type { CollectionAction } from '@/hooks/useCollectionActions';
import { useActionComments, useAddActionComment } from '@/hooks/useActionComments';
import { useGmailConnection } from '@/hooks/useGmailConnection';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoneyDisplay } from '@/lib/formatting/MoneyDisplay';
import { RiskBadge } from '@/components/common/RiskBadge';
import { format, addDays } from 'date-fns';
import { Loader2, Send, Check, X, MessageSquare, Clock, UserCheck } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useTeam } from '@/hooks/useTeam';

interface ActionDetailDrawerProps {
  action: CollectionAction | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ActionDetailDrawer({ action, isOpen, onClose }: ActionDetailDrawerProps) {
  const { business: currentBusiness } = useSession();
  const { data: teamMembers } = useTeam(currentBusiness?.id);
  const { data: comments, isLoading: isLoadingComments } = useActionComments(action?.id);
  const { mutate: addComment, isPending: isAddingComment } = useAddActionComment();
  const { mutate: assignAction } = useAssignAction();
  const { mutate: snoozeAction } = useSnoozeAction();
  const { data: gmailConnection } = useGmailConnection(currentBusiness?.id);
  
  const [newComment, setNewComment] = useState('');

  if (!action) return null;

  const handleAddComment = () => {
    if (!newComment.trim() || !currentBusiness?.id) return;
    addComment({ actionId: action.id, businessId: currentBusiness.id, comment: newComment }, {
      onSuccess: () => setNewComment('')
    });
  };

  const handleSnooze = (days: number) => {
    snoozeAction({ actionId: action.id, snoozeUntil: addDays(new Date(), days).toISOString() }, {
      onSuccess: () => onClose()
    });
  };

  const daysOverdue = action.invoices?.due_date 
    ? Math.max(0, Math.floor((new Date().getTime() - new Date(action.invoices.due_date).getTime()) / (1000 * 3600 * 24)))
    : 0;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 bg-background overflow-hidden border-l">
        <SheetHeader className="p-6 border-b bg-muted/20">
          <div className="flex justify-between items-start pr-8">
            <div>
              <SheetTitle className="text-xl">{action.invoices?.customers?.name || 'Unknown Customer'}</SheetTitle>
              <SheetDescription className="text-base font-medium mt-1 text-foreground flex items-center gap-2">
                {action.invoices?.invoice_number}
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full border">
                  {action.status.toUpperCase()}
                </span>
              </SheetDescription>
            </div>
            <div className="text-right">
              <div className="font-semibold text-xl"><MoneyDisplay amount={action.invoices?.outstanding_amount || 0} /></div>
              <div className="text-sm text-muted-foreground mt-1">{daysOverdue} days overdue</div>
              {action.invoices?.risk_level && (
                <div className="mt-1 flex items-center justify-end">
                  <RiskBadge level={action.invoices.risk_level as any} />
                </div>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="overview" className="w-full h-full flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b px-6 h-12 bg-transparent space-x-6">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 data-[state=active]:shadow-none">Overview</TabsTrigger>
              <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 data-[state=active]:shadow-none">Internal Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="p-6 mt-0 space-y-6">
              {/* Context Block */}
              <div className="bg-muted/30 p-4 rounded-lg border">
                <div className="mb-2">
                  <span className="text-muted-foreground text-sm font-medium">Recommended Action:</span>{' '}
                  <span className="font-semibold text-primary">
                    {action.action_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Reason:</span> {action.recommended_reason || 'System identified condition.'}
                </div>
              </div>

              {/* Assignment & Snooze Controls */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <UserCheck size={14} /> Assigned To
                  </label>
                  <Select 
                    value={action.assigned_to || 'unassigned'} 
                    onValueChange={(val) => assignAction({ actionId: action.id, assignedTo: val === 'unassigned' ? null : val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned">
                        {action.assigned_to && action.assigned_to !== 'unassigned'
                          ? (teamMembers?.find((m: any) => m.user_id === action.assigned_to)?.profiles?.full_name || teamMembers?.find((m: any) => m.user_id === action.assigned_to)?.profiles?.email || action.assigned_to)
                          : "Unassigned"}
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
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock size={14} /> Snooze
                  </label>
                  <Select onValueChange={(val) => handleSnooze(parseInt(val as string))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Snooze action..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Tomorrow</SelectItem>
                      <SelectItem value="3">3 Days</SelectItem>
                      <SelectItem value="7">1 Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Draft Content */}
              {action.draft_subject && (
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">AI Draft <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Editable</span></h3>
                  <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-muted/10 border-b flex gap-2">
                      <span className="text-muted-foreground text-sm font-medium w-16">Subject:</span>
                      <Input defaultValue={action.draft_subject} className="h-7 text-sm bg-transparent border-transparent hover:border-input focus-visible:ring-1 focus-visible:bg-background -my-1" />
                    </div>
                    <div className="p-4">
                      <textarea 
                        defaultValue={action.draft_body || ''} 
                        className="w-full min-h-[200px] text-sm leading-relaxed text-foreground bg-transparent border-transparent hover:border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring p-2 -m-2 resize-y"
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="flex-1 flex flex-col mt-0 h-[calc(100vh-140px)]">
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {isLoadingComments ? (
                  <div className="flex justify-center p-4"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : comments?.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg bg-muted/5">
                    <MessageSquare className="mx-auto h-8 w-8 mb-3 opacity-20" />
                    No internal notes yet.<br/><span className="text-xs">These notes are never visible to the customer.</span>
                  </div>
                ) : (
                  comments?.map(comment => (
                    <div key={comment.id} className="bg-muted/20 p-4 rounded-lg border">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">{comment.profiles?.full_name || comment.profiles?.email}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(comment.created_at), 'MMM d, h:mm a')}</span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{comment.comment}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t bg-background">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Add an internal note..." 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  />
                  <Button onClick={handleAddComment} disabled={!newComment.trim() || isAddingComment}>
                    {isAddingComment ? <Loader2 className="animate-spin h-4 w-4" /> : 'Post'}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-muted/10 flex justify-between items-center gap-2">
          <ActionControls action={action} onClose={onClose} isGmailConnected={!!gmailConnection?.is_connected} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ActionControls({ action, onClose, isGmailConnected }: { action: CollectionAction, onClose: () => void, isGmailConnected: boolean }) {
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateActionStatus();
  const { mutate: sendGmail, isPending: isSending } = useSendGmailAction();

  const handleApprove = () => {
    updateStatus({ actionId: action.id, status: 'approved' });
    onClose();
  };
  
  const handleSkip = () => {
    updateStatus({ actionId: action.id, status: 'skipped' });
    onClose();
  };

  const handleSend = () => {
    sendGmail(action.id);
    onClose();
  };

  if (['recommended', 'draft'].includes(action.status)) {
    return (
      <>
        <Button variant="ghost" onClick={handleSkip} disabled={isUpdating} className="text-muted-foreground hover:text-destructive" title="Skip this action. The invoice will remain active.">
          <X size={16} className="mr-2" /> Skip
        </Button>
        <div className="flex gap-2">
          {action.status === 'draft' && (
            <Button onClick={handleApprove} disabled={isUpdating} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Check size={16} className="mr-2" /> Approve
            </Button>
          )}
        </div>
      </>
    );
  }

  if (action.status === 'approved') {
    return (
      <div className="w-full flex justify-between items-center">
        <div className="text-sm font-medium text-success flex items-center">
          <Check size={16} className="mr-2" /> Approved
        </div>
        {isGmailConnected && (
          <Button onClick={handleSend} disabled={isSending} className="bg-primary text-primary-foreground">
            {isSending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
            Send Now
          </Button>
        )}
      </div>
    );
  }

  return null;
}
