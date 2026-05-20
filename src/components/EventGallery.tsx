import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { ReportButton } from "./ReportButton";

export function EventGallery({ eventId, canUpload }: { eventId: string; canUpload: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: photos, refetch } = useQuery({
    queryKey: ["gallery", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("gallery_photos")
        .select("id, photo_url, caption, uploader_id")
        .eq("event_id", eventId)
        .eq("status", "approved")
        .eq("hidden", false)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function upload() {
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) { toast.error("JPG, PNG or WEBP only"); return; }
    setSubmitting(true);
    const ext = file.name.split(".").pop();
    const path = `${eventId}/${user.id}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("gallery-photos").upload(path, file, { contentType: file.type });
    if (up.error) { setSubmitting(false); toast.error(up.error.message); return; }
    const { data: pub } = supabase.storage.from("gallery-photos").getPublicUrl(path);
    const { error } = await supabase.from("gallery_photos").insert({
      event_id: eventId, uploader_id: user.id, photo_url: pub.publicUrl, caption: caption.trim() || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Your photo was submitted and will appear after host approval");
    setOpen(false); setFile(null); setCaption("");
  }

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl">Gallery</h2>
        {canUpload && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><ImagePlus className="h-4 w-4 mr-1" />Upload photo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Share a photo</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Textarea placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} />
                <p className="text-xs text-muted-foreground">JPG / PNG / WEBP up to 5MB. Photos appear after the host approves them.</p>
              </div>
              <DialogFooter><Button onClick={upload} disabled={!file || submitting}>{submitting ? "Uploading…" : "Submit"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {!photos?.length ? (
        <p className="text-sm text-muted-foreground">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((p) => (
            <figure key={p.id} className="relative group rounded-lg overflow-hidden bg-muted aspect-square">
              <img src={p.photo_url} alt={p.caption ?? ""} className="w-full h-full object-cover" />
              {p.caption && <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs p-2">{p.caption}</figcaption>}
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition"><ReportButton targetType="photo" targetId={p.id} size="icon" /></div>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
