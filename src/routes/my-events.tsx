import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/my-events")({
  component: MyEventsPage,
});

function MyEventsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [hostFilter, setHostFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/signin", search: { redirect: "/my-events" } });
  }, [loading, user, navigate]);

  const { data: memberships } = useQuery({
    queryKey: ["my-memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("host_members").select("host_id, role, hosts(id, name)").eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const hostIds = useMemo(() => (memberships ?? []).map((m) => m.host_id), [memberships]);
  const roleByHost = useMemo(() => Object.fromEntries((memberships ?? []).map((m) => [m.host_id, m.role])), [memberships]);

  const { data: events } = useQuery({
    queryKey: ["my-events-list", hostIds.join(",")],
    enabled: hostIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, starts_at, ends_at, host_id, hosts(name)")
        .in("host_id", hostIds)
        .order("starts_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!user) return null;
  if (!memberships?.length) {
    return <div className="mx-auto max-w-2xl px-4 py-20 text-center text-muted-foreground">You're not a member of any host yet.</div>;
  }

  const now = Date.now();
  const filtered = (events ?? []).filter((e) => {
    if (hostFilter !== "all" && e.host_id !== hostFilter) return false;
    if (q && !e.title.toLowerCase().includes(q.toLowerCase())) return false;
    const t = new Date(e.starts_at).getTime();
    if (from && t < new Date(from).getTime()) return false;
    if (to && t > new Date(to).getTime() + 86400000) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-semibold mb-6">My events</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={hostFilter} onValueChange={setHostFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Host" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All hosts</SelectItem>
            {memberships.map((m) => (<SelectItem key={m.host_id} value={m.host_id}>{m.hosts?.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </div>

      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
        {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">No events.</p>}
        {filtered.map((e) => {
          const role = roleByHost[e.host_id];
          const past = new Date(e.starts_at).getTime() < now;
          return (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4 bg-card">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{e.title}</h3>
                  <Badge variant="outline" className="capitalize">{role}</Badge>
                  <Badge variant={past ? "secondary" : "default"}>{past ? "Past" : "Upcoming"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{e.hosts?.name} · {new Date(e.starts_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                {role === "host" && (
                  <>
                    <Button asChild size="sm" variant="outline"><Link to="/dashboard/events/$id/edit" params={{ id: e.id }}>Edit</Link></Button>
                    <Button asChild size="sm" variant="outline"><Link to="/dashboard" search={{ host: e.host_id }}>Dashboard</Link></Button>
                  </>
                )}
                <Button asChild size="sm"><Link to="/events/$id/checkin" params={{ id: e.id }}>Check-in</Link></Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
