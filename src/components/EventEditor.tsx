import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

type Mode = { kind: "new"; hostId: string } | { kind: "edit"; eventId: string };

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function EventEditor({ mode }: { mode: Mode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(mode.kind === "new");

  const [form, setForm] = useState({
    host_id: mode.kind === "new" ? mode.hostId : "",
    title: "",
    description: "",
    starts_at: "",
    ends_at: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    venue_address: "",
    online_url: "",
    capacity: "",
    cover_image_url: "",
    visibility: "public" as "public" | "unlisted",
    status: "draft" as "draft" | "published",
    is_paid: false,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/signin", search: { redirect: window.location.pathname } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (mode.kind !== "edit") return;
    (async () => {
      const { data } = await supabase.from("events").select("*").eq("id", mode.eventId).single();
      if (data) {
        setForm({
          host_id: data.host_id,
          title: data.title,
          description: data.description ?? "",
          starts_at: toLocalInput(data.starts_at),
          ends_at: toLocalInput(data.ends_at),
          timezone: data.timezone,
          venue_address: data.venue_address ?? "",
          online_url: data.online_url ?? "",
          capacity: data.capacity?.toString() ?? "",
          cover_image_url: data.cover_image_url ?? "",
          visibility: data.visibility,
          status: data.status,
          is_paid: data.is_paid,
        });
        setLoaded(true);
      }
    })();
  }, [mode]);

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function save(nextStatus?: "draft" | "published") {
    setBusy(true);
    const payload = {
      host_id: form.host_id,
      title: form.title,
      description: form.description || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      timezone: form.timezone,
      venue_address: form.venue_address || null,
      online_url: form.online_url || null,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      cover_image_url: form.cover_image_url || null,
      visibility: form.visibility,
      status: nextStatus ?? form.status,
      is_paid: false,
    };
    if (mode.kind === "new") {
      const { data, error } = await supabase.from("events").insert(payload).select().single();
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Event created");
      navigate({ to: "/dashboard/events/$id/edit", params: { id: data!.id } });
    } else {
      const { error } = await supabase.from("events").update(payload).eq("id", mode.eventId);
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Saved");
      update("status", payload.status);
    }
  }

  async function duplicate() {
    if (mode.kind !== "edit") return;
    const { data, error } = await supabase.from("events").insert({
      host_id: form.host_id,
      title: `${form.title} (copy)`,
      description: form.description || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      timezone: form.timezone,
      venue_address: form.venue_address || null,
      online_url: form.online_url || null,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      cover_image_url: form.cover_image_url || null,
      visibility: form.visibility,
      status: "draft",
      is_paid: false,
    }).select().single();
    if (error) return toast.error(error.message);
    toast.success("Duplicated");
    navigate({ to: "/dashboard/events/$id/edit", params: { id: data!.id } });
  }

  if (!loaded) return <div className="mx-auto max-w-3xl px-4 py-20">Loading…</div>;

  return (
    <form className="mx-auto max-w-3xl px-4 py-10 space-y-6" onSubmit={(e: FormEvent) => { e.preventDefault(); save(); }}>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">{mode.kind === "new" ? "New event" : "Edit event"}</h1>
        <Button asChild variant="ghost" size="sm"><Link to="/dashboard">Back</Link></Button>
      </div>

      <div><Label>Title</Label><Input required value={form.title} onChange={(e) => update("title", e.target.value)} /></div>
      <div><Label>Description</Label><Textarea rows={6} value={form.description} onChange={(e) => update("description", e.target.value)} /></div>

      <div className="grid grid-cols-2 gap-4">
        <div><Label>Starts</Label><Input type="datetime-local" required value={form.starts_at} onChange={(e) => update("starts_at", e.target.value)} /></div>
        <div><Label>Ends</Label><Input type="datetime-local" required value={form.ends_at} onChange={(e) => update("ends_at", e.target.value)} /></div>
      </div>
      <div><Label>Timezone</Label><Input value={form.timezone} onChange={(e) => update("timezone", e.target.value)} /></div>

      <div className="grid grid-cols-2 gap-4">
        <div><Label>Venue address</Label><Input value={form.venue_address} onChange={(e) => update("venue_address", e.target.value)} /></div>
        <div><Label>Online URL</Label><Input value={form.online_url} onChange={(e) => update("online_url", e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><Label>Capacity</Label><Input type="number" min={0} value={form.capacity} onChange={(e) => update("capacity", e.target.value)} /></div>
        <div>
          <Label>Cover image</Label>
          <div className="flex items-center gap-3">
            <Input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !user) return;
                setBusy(true);
                const ext = file.name.split(".").pop() || "jpg";
                const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
                const { error } = await supabase.storage.from("event-covers").upload(path, file, { upsert: true });
                if (error) { setBusy(false); return toast.error(error.message); }
                const { data } = supabase.storage.from("event-covers").getPublicUrl(path);
                update("cover_image_url", data.publicUrl);
                setBusy(false);
                toast.success("Image uploaded");
              }}
            />
            {form.cover_image_url && (
              <img src={form.cover_image_url} alt="cover" className="h-12 w-12 rounded object-cover border border-border" />
            )}
          </div>
          <Input className="mt-2" placeholder="…or paste image URL" value={form.cover_image_url} onChange={(e) => update("cover_image_url", e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-6 flex-wrap p-4 rounded-lg bg-muted/40">
        <div className="flex items-center gap-3">
          <Label>Visibility</Label>
          <div className="flex gap-2">
            {(["public", "unlisted"] as const).map((v) => (
              <button key={v} type="button" onClick={() => update("visibility", v)}
                className={`px-3 py-1.5 rounded-md text-sm border ${form.visibility === v ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 opacity-60 cursor-not-allowed">
                <Label htmlFor="paid">Paid</Label>
                <Switch id="paid" checked={false} disabled />
              </div>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex gap-2 flex-wrap pt-4 border-t border-border">
        <Button type="button" variant="outline" disabled={busy} onClick={() => save("draft")}>Save draft</Button>
        {form.status === "published" ? (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => save("draft")}>Unpublish</Button>
        ) : (
          <Button type="button" disabled={busy} onClick={() => save("published")}>Publish</Button>
        )}
        {mode.kind === "edit" && <Button type="button" variant="ghost" onClick={duplicate}>Duplicate</Button>}
      </div>
    </form>
  );
}
