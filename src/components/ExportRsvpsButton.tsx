import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download } from "lucide-react";
import { toast } from "sonner";

function csvEscape(v: string) {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "event";
}

export function ExportRsvpsButton({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  async function download() {
    const { data: rsvps, error } = await supabase
      .from("rsvps").select("user_id, status, checked_in_at").eq("event_id", eventId);
    if (error) { toast.error(error.message); return; }
    const ids = Array.from(new Set((rsvps ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] as { id: string; full_name: string | null }[] };
    const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? ""]));

    const header = "name,email,rsvp_status,checked_in_at";
    const rows = (rsvps ?? []).map((r) => [
      csvEscape(nameMap.get(r.user_id) ?? ""),
      "",
      csvEscape(r.status ?? ""),
      csvEscape(fmtDateTime(r.checked_in_at)),
    ].join(","));
    const csv = "\uFEFF" + [header, ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `${slugify(eventTitle)}_rsvps_${date}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  return <Button variant="outline" size="sm" onClick={download}><Download className="h-4 w-4 mr-1" />Export CSV</Button>;
}
