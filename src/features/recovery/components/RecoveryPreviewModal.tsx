import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useRecoveryPack } from "@/hooks/useRecoveryPack";
import { Loader2, Archive, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RecoveryPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceData: any;
}

export function RecoveryPreviewModal({ isOpen, onClose, invoiceData }: RecoveryPreviewModalProps) {
  const { timeline, isLoadingTimeline, generatePack, isGenerating, isError, error } = useRecoveryPack(isOpen ? invoiceData?.id : undefined);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());

  // Initialize selected events when timeline loads
  useEffect(() => {
    if (timeline) {
      setSelectedEventIds(new Set(timeline.map(e => e.id)));
    }
  }, [timeline]);

  const toggleEvent = (id: string) => {
    const newSet = new Set(selectedEventIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedEventIds(newSet);
  };

  const handleGenerate = async () => {
    if (!timeline || !invoiceData) return;
    const selectedEvents = timeline.filter(e => selectedEventIds.has(e.id));
    
    await generatePack({
      selectedEvents,
      invoiceData
    });
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            Generate Recovery Pack
          </DialogTitle>
          <DialogDescription>
            Preview the evidence timeline for {invoiceData?.invoice_number}. 
            Uncheck any items you do not want to include in the final AI summary or manifest.
          </DialogDescription>
        </DialogHeader>

        {isLoadingTimeline ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden py-4">
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
               <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
               <p>This action will use AI to summarize the selected events neutrally. It does NOT automatically file a lawsuit or claim.</p>
            </div>
            
            <ScrollArea className="flex-1 border rounded-md p-4">
              <div className="space-y-4">
                {timeline?.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors">
                    <Checkbox 
                      id={`event-${event.id}`}
                      checked={selectedEventIds.has(event.id)}
                      onCheckedChange={() => toggleEvent(event.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label htmlFor={`event-${event.id}`} className="text-sm font-medium cursor-pointer">
                        [{new Date(event.event_date).toLocaleDateString()}] {event.title}
                      </label>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {isError && (
                  <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                    <p className="font-semibold">Failed to load timeline events</p>
                    <p className="text-sm mt-1">{error?.message || "Unknown error occurred while calling get_invoice_timeline"}</p>
                  </div>
                )}
                {(!timeline || timeline.length === 0) && !isError && (
                  <p className="text-muted-foreground text-center p-4">No events found for this invoice.</p>
                )}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground text-right">
              {selectedEventIds.size} of {timeline?.length || 0} events selected
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={isGenerating || selectedEventIds.size === 0}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Pack...
              </>
            ) : (
              'Confirm & Generate'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
