import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { HostMembers } from "@/components/HostMembers";
import { GalleryModeration } from "@/components/GalleryModeration";
import { ExportRsvpsButton } from "@/components/ExportRsvpsButton";

export const Route = createFileRoute("/dashboard/")({
  component: Dashboard,
  validateSearch: (s: Record<string, unknown>) => ({ host: (s.host as string) || "" }),
});

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { host: selectedHost } = Route.useSearch();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/signin", search: { redirect: "/dashboard" } });
  }, [loading, user, navigate]);

  const { data: memberships } = useQuery({
    queryKey: ["my-hosts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("host_members").select("host_id, role, hosts(id, name, slug)").eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const hostMemberships = (memberships ?? []).filter((m) => m.role === "host");
  const activeHostId = selectedHost || hostMemberships[0]?.host_id || "";

  const { data: events } = useQuery({
    queryKey: ["host-events", activeHostId],
    enabled: !!activeHostId,
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*").eq("host_id", activeHostId).order("starts_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!user) return null;

  if (!hostMemberships.length) {
    if ((memberships ?? []).length) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="font-display text-3xl mb-3">Checker access only</h1>
          <p className="text-muted-foreground mb-6">You can check guests in from My Events.</p>
          <Button asChild><Link to="/my-events">Go to My Events</Link></Button>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl mb-3">You're not hosting yet</h1>
        <p className="text-muted-foreground mb-6">Create a host profile to start publishing events.</p>
        <Button asChild><Link to="/host/new">Become a host</Link></Button>
      </div>
    );
  }

  const now = Date.now();
  const upcoming = (events ?? []).filter((e) => new Date(e.starts_at).getTime() >= now);
  const past = (events ?? []).filter((e) => new Date(e.starts_at).getTime() < now);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl">Dashboard</h1>
        <Button asChild><Link to="/dashboard/events/new" search={{ host: activeHostId }}><Plus className="h-4 w-4 mr-1" />New event</Link></Button>
      </div>

      <div className="flex gap-2 flex-wrap mb-8">
        {hostMemberships.map((m) => (
          <Link
            key={m.host_id}
            to="/dashboard"
            search={{ host: m.host_id }}
            className={`px-3 py-1.5 rounded-full text-sm border ${m.host_id === activeHostId ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            {m.hosts?.name ?? "Host"}
          </Link>
        ))}
        <Link to="/host/new" className="px-3 py-1.5 rounded-full text-sm border border-dashed border-border hover:bg-muted">+ New host</Link>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming"><EventTable events={upcoming} /></TabsContent>
        <TabsContent value="past"><EventTable events={past} /></TabsContent>
        <TabsContent value="members"><HostMembers hostId={activeHostId} isOwnerOrHost /></TabsContent>
      </Tabs>
    </div>
  );
}

function EventTable({ events }: { events: any[] }) {
  if (!events.length) return <p className="text-muted-foreground py-10">No events here.</p>;
  return (
    <div className="divide-y divide-border border border-border rounded-lg overflow-hidden mt-4">
      {events.map((e) => (
        <div key={e.id} className="flex items-center justify-between p-4 bg-card hover:bg-muted/40">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{e.title}</h3>
              <Badge variant={e.status === "published" ? "default" : "secondary"}>{e.status}</Badge>
              {e.visibility === "unlisted" && <Badge variant="outline">unlisted</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{new Date(e.starts_at).toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/events/$id" params={{ id: e.id }}>View</Link></Button>
            <Button asChild size="sm"><Link to="/dashboard/events/$id/edit" params={{ id: e.id }}>Edit</Link></Button>
          </div>
        </div>
      ))}
    </div>
  );
}
