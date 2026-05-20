import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function GalleryModeration({ hostId }: { hostId: string }) {
  const { user } = useAuth();

  const { data, refetch } = useQuery({
    queryKey: ["gallery-pending", hostId],
    enabled: !!hostId,
    queryFn: async () => {
      const { data: events } = await supabase.from("events").select("id, title").eq("host_id", hostId);
      const eventIds = (events ?? []).map((e) => e.id);
      if (!eventIds.length) return [];
      const eventMap = new Map((events ?? []).map((e) => [e.id, e.title]));
      const { data: photos } = await supabase
        .from("gallery_photos")
        .select("id, photo_url, caption, uploader_id, event_id, created_at")
        .in("event_id", eventIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      const uploaderIds = Array.from(new Set((photos ?? []).map((p) => p.uploader_id)));
      const { data: profs } = uploaderIds.length ? await supabase.from("profiles").select("id, full_name").in("id", uploaderIds) : { data: [] as { id: string; full_name: string | null }[] };
      const profMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return (photos ?? []).map((p) => ({ ...p, event_title: eventMap.get(p.event_id) ?? "", uploader_name: profMap.get(p.uploader_id) ?? "Unknown" }));
    },
  });

  async function review(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("gallery_photos").update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user!.id }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Approved" : "Rejected");
    refetch();
  }

  if (!data?.length) return <p className="text-sm text-muted-foreground py-10">No pending photos.</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2 mt-4">
      {data.map((p) => (
        <div key={p.id} className="rounded-lg border border-border overflow-hidden bg-card flex">
          <img src={p.photo_url} alt="" className="h-40 w-40 object-cover" />
          <div className="p-3 flex-1 flex flex-col">
            <p className="text-xs text-muted-foreground">{p.event_title}</p>
            <p className="text-sm font-medium">{p.uploader_name}</p>
            {p.caption && <p className="text-sm mt-1 text-muted-foreground">{p.caption}</p>}
            <p className="text-xs text-muted-foreground mt-auto">{new Date(p.created_at).toLocaleString()}</p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={() => review(p.id, "approved")}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => review(p.id, "rejected")}>Reject</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
