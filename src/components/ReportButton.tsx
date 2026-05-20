import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Flag } from "lucide-react";
import { toast } from "sonner";

export function ReportButton({ targetType, targetId, size = "sm" }: { targetType: "event" | "photo"; targetId: string; size?: "sm" | "icon" }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!user) return null;

  async function submit() {
    if (!reason.trim()) { toast.error("Please describe the issue"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      target_type: targetType, target_id: targetId, reporter_id: user!.id, reason: reason.trim(),
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Thanks, this has been flagged for review");
    setOpen(false); setReason("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {size === "icon"
          ? <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"><Flag className="h-3.5 w-3.5" /></Button>
          : <Button variant="ghost" size="sm" className="text-muted-foreground"><Flag className="h-3.5 w-3.5 mr-1" />Report</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Report this {targetType}</DialogTitle></DialogHeader>
        <Textarea placeholder="What's wrong with it?" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
        <DialogFooter>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit report"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
