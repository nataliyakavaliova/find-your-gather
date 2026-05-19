import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/events/$id/checkin")({
  component: CheckinPage,
});

type Recent = { rsvp_id: string; name: string | null; email: string | null; at: string };

function CheckinPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [recent, setRecent] = useState<Recent[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/signin", search: { redirect: `/events/${id}/checkin` } });
  }, [loading, user, navigate, id]);

  const { data: event } = useQuery({
    queryKey: ["event-checkin", id],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, title, capacity, host_id").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: allowed } = useQuery({
    queryKey: ["checkin-allowed", id, user?.id, event?.host_id],
    enabled: !!user && !!event?.host_id,
    queryFn: async () => {
      const { data } = await supabase.from("host_members").select("role").eq("host_id", event!.host_id).eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: counts, refetch: refetchCounts } = useQuery({
    queryKey: ["checkin-counts", id],
    queryFn: async () => {
      const [going, checked] = await Promise.all([
        supabase.from("rsvps").select("*", { count: "exact", head: true }).eq("event_id", id).eq("status", "going"),
        supabase.from("rsvps").select("*", { count: "exact", head: true }).eq("event_id", id).eq("status", "going").not("checked_in_at", "is", null),
      ]);
      return { going: going.count ?? 0, checked: checked.count ?? 0 };
    },
    refetchInterval: 5000,
  });

  if (!user) return null;
  if (event && allowed === null) {
    return <div className="mx-auto max-w-2xl px-4 py-20 text-center text-muted-foreground">You don't have access to check in for this event.</div>;
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const value = code.trim();
    if (!value) return;
    setCode("");
    inputRef.current?.focus();
    const { data, error } = await supabase.rpc("check_in_rsvp", { _event_id: id, _qr: value });
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    if (!r?.ok) {
      if (r?.code === "not_found") toast.error("Code not recognized");
      else if (r?.code === "wrong_status") toast.error(`This RSVP is ${r.status}, not eligible for check-in`);
      else if (r?.code === "already") toast.warning(`Already checked in at ${new Date(r.checked_in_at).toLocaleTimeString()}`);
      return;
    }
    toast.success(`✓ ${r.name ?? "Guest"} checked in`);
    setRecent((prev) => [{ rsvp_id: r.rsvp_id, name: r.name, email: null, at: r.checked_in_at }, ...prev].slice(0, 10));
    refetchCounts();
  }

  async function undo(rsvp_id: string) {
    const { error } = await supabase.rpc("undo_check_in", { _rsvp_id: rsvp_id });
    if (error) { toast.error(error.message); return; }
    toast.success("Check-in undone");
    setRecent((prev) => prev.filter((r) => r.rsvp_id !== rsvp_id));
    refetchCounts();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/events/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">← Back to event</Link>
      <h1 className="font-display text-3xl font-semibold mt-3 mb-2">{event?.title ?? "Check-in"}</h1>
      <p className="text-muted-foreground mb-8">
        Checked in: <span className="font-medium text-foreground">{counts?.checked ?? 0}</span> / {counts?.going ?? 0} going
      </p>

      <form onSubmit={submit} className="flex gap-2 mb-8">
        <Input
          ref={inputRef}
          autoFocus
          placeholder="Enter ticket code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="text-lg h-12"
        />
        <Button type="submit" size="lg">Check in</Button>
      </form>

      <h2 className="font-display text-lg mb-3">Recent check-ins</h2>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">No check-ins yet this session.</p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg">
          {recent.map((r, i) => (
            <li key={r.rsvp_id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium">{r.name ?? "Guest"}</div>
                <div className="text-xs text-muted-foreground">{new Date(r.at).toLocaleTimeString()}</div>
              </div>
              {i === 0 && <Button variant="outline" size="sm" onClick={() => undo(r.rsvp_id)}>Undo</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
