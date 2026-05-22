import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/moderation")({
  component: ModerationPage,
});

type ReportRow = {
  id: string;
  target_type: "event" | "photo";
  target_id: string;
  reason: string;
  reporter_id: string;
  status: string;
  created_at: string;
  reviewed_at?: string | null;
};

async function enrich(rows: ReportRow[]) {
  const reporterIds = Array.from(new Set(rows.map((r) => r.reporter_id)));
  const { data: profs } = reporterIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", reporterIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));
  const photoIds = rows.filter((r) => r.target_type === "photo").map((r) => r.target_id);
  const eventIds = rows.filter((r) => r.target_type === "event").map((r) => r.target_id);
  const { data: photos } = photoIds.length
    ? await supabase.from("gallery_photos").select("id, event_id, caption").in("id", photoIds)
    : { data: [] };
  const { data: events } = eventIds.length
    ? await supabase.from("events").select("id, title").in("id", eventIds)
    : { data: [] };
  const photoMap = new Map((photos ?? []).map((p) => [p.id, p]));
  const eventMap = new Map((events ?? []).map((e) => [e.id, e]));
  return rows.map((r) => ({
    ...r,
    reporter_name: nameMap.get(r.reporter_id) ?? "Unknown",
    label:
      r.target_type === "event"
        ? eventMap.get(r.target_id)?.title ?? "Event"
        : `Photo: ${photoMap.get(r.target_id)?.caption ?? "(no caption)"}`,
    event_id:
      r.target_type === "event" ? r.target_id : photoMap.get(r.target_id)?.event_id ?? "",
  }));
}

function ModerationPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/signin", search: { redirect: "/moderation" } });
  }, [loading, user, navigate]);

  const { data: openReports, refetch } = useQuery({
    queryKey: ["reports-open", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("id, target_type, target_id, reason, reporter_id, status, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      return enrich((data ?? []) as ReportRow[]);
    },
  });

  const { data: myReports } = useQuery({
    queryKey: ["reports-mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("id, target_type, target_id, reason, reporter_id, status, created_at, reviewed_at")
        .eq("reporter_id", user!.id)
        .order("created_at", { ascending: false });
      return enrich((data ?? []) as ReportRow[]);
    },
  });

  async function hide(r: { id: string; target_type: "event" | "photo"; target_id: string }) {
    const table = r.target_type === "event" ? "events" : "gallery_photos";
    const { error: e1 } = await supabase.from(table).update({ hidden: true }).eq("id", r.target_id);
    if (e1) { toast.error(e1.message); return; }
    const { error: e2 } = await supabase.from("reports").update({ status: "hidden", reviewed_at: new Date().toISOString(), reviewed_by: user!.id }).eq("id", r.id);
    if (e2) { toast.error(e2.message); return; }
    toast.success("Item hidden");
    refetch();
  }

  async function dismiss(id: string) {
    const { error } = await supabase.from("reports").update({ status: "dismissed", reviewed_at: new Date().toISOString(), reviewed_by: user!.id }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Dismissed");
    refetch();
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl mb-6">Moderation</h1>
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open reports {openReports?.length ? `(${openReports.length})` : ""}</TabsTrigger>
          <TabsTrigger value="mine">My reports {myReports?.length ? `(${myReports.length})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          {!openReports?.length ? (
            <p className="text-muted-foreground">No open reports.</p>
          ) : (
            <div className="space-y-3">
              {openReports.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-4 bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="capitalize">{r.target_type}</Badge>
                    {r.event_id && <Link to="/events/$id" params={{ id: r.event_id }} className="text-sm text-primary hover:underline">{r.label}</Link>}
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm">{r.reason}</p>
                  <p className="text-xs text-muted-foreground mt-1">Reported by {r.reporter_name}</p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="destructive" onClick={() => hide(r)}>Hide item</Button>
                    <Button size="sm" variant="outline" onClick={() => dismiss(r.id)}>Dismiss</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          {!myReports?.length ? (
            <p className="text-muted-foreground">You haven't submitted any reports yet.</p>
          ) : (
            <div className="space-y-3">
              {myReports.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-4 bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="capitalize">{r.target_type}</Badge>
                    <Badge variant={r.status === "open" ? "default" : "secondary"} className="capitalize">{r.status}</Badge>
                    {r.event_id && <Link to="/events/$id" params={{ id: r.event_id }} className="text-sm text-primary hover:underline">{r.label}</Link>}
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm">{r.reason}</p>
                  {r.reviewed_at && <p className="text-xs text-muted-foreground mt-1">Reviewed {new Date(r.reviewed_at).toLocaleString()}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
