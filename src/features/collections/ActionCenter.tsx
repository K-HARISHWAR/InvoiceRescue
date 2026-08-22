import { useState } from 'react';
import PageHeader from "@/components/common/PageHeader";
import { useSession } from "@/hooks/useSession";
import { useCollectionActions, useTriggerEngine, useDraftAction, useUpdateActionStatus, useSendGmailAction, type CollectionAction } from "@/hooks/useCollectionActions";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/lib/formatting/MoneyDisplay";
import { RiskBadge } from "@/components/common/RiskBadge";
import { Play, Check, X, RefreshCw, Send, Mail } from "lucide-react";

export default function ActionCenter() {
  const { business: currentBusiness } = useSession();
  const { data: actions, isLoading } = useCollectionActions(currentBusiness?.id);
  const { mutate: triggerEngine, isPending: isEngineRunning } = useTriggerEngine(currentBusiness?.id);
  const { data: gmailConnection } = useGmailConnection(currentBusiness?.id);
  
  const [activeTab, setActiveTab] = useState<'needs_review' | 'approved' | 'completed' | 'skipped'>('needs_review');

  const needsReview = actions?.filter(a => a.status === 'recommended' || a.status === 'draft') || [];
  const approved = actions?.filter(a => a.status === 'approved') || [];
  const completed = actions?.filter(a => a.status === 'completed' || a.status === 'sent') || [];
  const skipped = actions?.filter(a => a.status === 'skipped') || [];

  const getActiveList = () => {
    switch(activeTab) {
      case 'needs_review': return needsReview;
      case 'approved': return approved;
      case 'completed': return completed;
      case 'skipped': return skipped;
      default: return [];
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Action Center" 
        description="Review and approve collection actions."
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
      
      {/* Tabs */}
      <div className="flex space-x-2 border-b border-border">
        {(['needs_review', 'approved', 'completed', 'skipped'] as const).map(tab => (
           <button
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
               activeTab === tab 
                 ? 'border-primary text-primary' 
                 : 'border-transparent text-muted-foreground hover:text-foreground'
             }`}
           >
             {tab.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
             {tab === 'needs_review' && needsReview.length > 0 && (
               <span className="ml-2 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">
                 {needsReview.length}
               </span>
             )}
           </button>
        ))}
      </div>

      <div className="space-y-4">
        {isLoading ? (
           <p className="text-muted-foreground text-sm p-4">Loading actions...</p>
        ) : getActiveList().length === 0 ? (
           <div className="p-8 text-center border border-dashed rounded-lg text-muted-foreground">
             No actions in this category.
           </div>
        ) : (
           getActiveList().map(action => (
             <ActionCard 
               key={action.id} 
               action={action} 
               isGmailConnected={!!gmailConnection?.is_connected} 
             />
           ))
        )}
      </div>
    </div>
  );
}

function ActionCard({ action, isGmailConnected }: { action: CollectionAction, isGmailConnected: boolean }) {
  const { mutate: draftAction, isPending: isDrafting } = useDraftAction();
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateActionStatus();
  const { mutate: sendGmail, isPending: isSending } = useSendGmailAction();

  const handleApprove = () => updateStatus({ actionId: action.id, status: 'approved' });
  const handleSkip = () => updateStatus({ actionId: action.id, status: 'skipped' });
  const handleSend = () => sendGmail(action.id);

  const daysOverdue = action.invoices?.due_date 
    ? Math.max(0, Math.floor((new Date().getTime() - new Date(action.invoices.due_date).getTime()) / (1000 * 3600 * 24)))
    : 0;

  return (
    <Card className="shadow-soft transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{action.invoices?.customers?.name || 'Unknown Customer'}</CardTitle>
            <CardDescription className="text-sm font-medium mt-1 text-foreground">
              {action.invoices?.invoice_number}
            </CardDescription>
          </div>
          <div className="text-right">
             <div className="font-semibold text-lg"><MoneyDisplay amount={action.invoices?.outstanding_amount || 0} /></div>
             <div className="text-sm text-muted-foreground mt-1">{daysOverdue} days overdue</div>
             {action.invoices?.risk_level && (
               <div className="mt-1 flex items-center justify-end">
                 <span className="text-xs mr-2 text-muted-foreground">Risk {action.invoices.risk_score || 0}</span>
                 <RiskBadge level={action.invoices.risk_level as any} />
               </div>
             )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 text-sm">
        <div className="mb-3 bg-muted/30 p-3 rounded-md border border-border/50">
          <div className="mb-1">
            <span className="text-muted-foreground">Recommended:</span>{' '}
            <span className="font-medium text-foreground">
              {action.action_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Why:</span> <span className="font-medium">{action.recommended_reason || 'System identified condition.'}</span>
          </div>
        </div>

        {action.draft_subject && (
          <div className="bg-card border border-border p-4 rounded-md mt-4 shadow-sm">
             <div className="font-semibold mb-2 text-foreground pb-2 border-b border-border/50">Subject: {action.draft_subject}</div>
             <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{action.draft_body}</div>
          </div>
        )}
      </CardContent>
      
      {['recommended', 'draft'].includes(action.status) && (
        <CardFooter className="flex justify-between border-t border-border pt-4 bg-muted/10">
          <Button variant="ghost" onClick={handleSkip} disabled={isUpdating || isDrafting} className="text-muted-foreground hover:text-destructive">
            <X size={16} className="mr-2" /> Skip
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => draftAction(action.id)} disabled={isDrafting || isUpdating}>
              <RefreshCw size={16} className={`mr-2 ${isDrafting ? 'animate-spin' : ''}`} /> 
              {action.status === 'draft' ? 'Regenerate Draft' : 'Draft Email'}
            </Button>
            {action.status === 'draft' && (
              <Button onClick={handleApprove} disabled={isUpdating || isDrafting} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Check size={16} className="mr-2" /> Approve
              </Button>
            )}
          </div>
        </CardFooter>
      )}
      
      {action.status === 'approved' && (
        <CardFooter className="flex justify-between items-center border-t border-border pt-4 bg-success/5">
          <div className="text-sm font-medium text-success flex items-center">
            <Check size={16} className="mr-2" /> Approved
          </div>
          {isGmailConnected ? (
            <Button onClick={handleSend} disabled={isSending} className="bg-primary text-primary-foreground">
              {isSending ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
              Send with Gmail
            </Button>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center bg-background/50 px-3 py-1.5 rounded-full border border-border">
              <Mail size={14} className="mr-2" /> Connect Gmail in Settings to send automatically
            </div>
          )}
        </CardFooter>
      )}
      
      {action.status === 'sent' && (
        <CardFooter className="border-t border-border pt-4 bg-primary/5 text-sm font-medium text-primary">
          <Send size={16} className="mr-2" /> Sent successfully
        </CardFooter>
      )}
    </Card>
  );
}