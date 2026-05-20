import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";

function maskName(name: string | null) {
  if (!name) return "Anonymous";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function EventFeedback({ eventId, ended, canSubmit }: { eventId: string; ended: boolean; canSubmit: boolean }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: mine, refetch: refetchMine } = useQuery({
    queryKey: ["feedback-mine", eventId, user?.id],
    enabled: !!user && ended,
    queryFn: async () => {
      const { data } = await supabase.from("feedback").select("id, rating, comment").eq("event_id", eventId).eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: all, refetch: refetchAll } = useQuery({
    queryKey: ["feedback-all", eventId],
    enabled: ended,
    queryFn: async () => {
      const { data: rows } = await supabase.from("feedback").select("id, rating, comment, user_id, created_at").eq("event_id", eventId).order("created_at", { ascending: false });
      const ids = (rows ?? []).map((r) => r.user_id);
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] as { id: string; full_name: string | null }[] };
      const map = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return (rows ?? []).map((r) => ({ ...r, name: maskName(map.get(r.user_id) ?? null) }));
    },
  });

  if (!ended) return null;

  async function submit() {
    if (!user || rating < 1) { toast.error("Pick a rating"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("feedback").insert({ event_id: eventId, user_id: user.id, rating, comment: comment.trim() || null });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Thanks for your feedback!");
    refetchMine(); refetchAll();
  }

  const avg = all && all.length ? all.reduce((s, r) => s + r.rating, 0) / all.length : 0;

  return (
    <section className="mt-12 space-y-8">
      <div>
        <h2 className="font-display text-2xl mb-3">Feedback</h2>
        {all && all.length > 0 ? (
          <p className="text-sm text-muted-foreground">{avg.toFixed(1)} ★ from {all.length} attendee{all.length === 1 ? "" : "s"}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No feedback yet.</p>
        )}
      </div>

      {canSubmit && (
        mine ? (
          <div className="rounded-lg border border-border p-4 bg-card">
            <p className="text-sm font-medium mb-2">Thanks for your feedback!</p>
            <Stars value={mine.rating} />
            {mine.comment && <p className="text-sm mt-2 text-muted-foreground">{mine.comment}</p>}
          </div>
        ) : (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium mb-2">Leave feedback</p>
            <Stars value={rating} onChange={setRating} />
            <Textarea className="mt-3" rows={3} placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button className="mt-3" onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</Button>
          </div>
        )
      )}

      {!!all?.length && (
        <ul className="space-y-3">
          {all.slice(0, 10).map((f) => (
            <li key={f.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">{f.name}</span><Stars value={f.rating} /></div>
              {f.comment && <p className="text-sm text-muted-foreground mt-1">{f.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} className={onChange ? "cursor-pointer" : "cursor-default"}>
          <Star className={`h-5 w-5 ${n <= value ? "fill-primary text-primary" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}
