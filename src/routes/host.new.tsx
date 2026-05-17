import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/host/new")({ component: NewHost });

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function NewHost() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/signin", search: { redirect: "/host/new" } });
  }, [loading, user, navigate]);

  useEffect(() => { setSlug(slugify(name)); }, [name]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase.from("hosts").insert({
      owner_id: user.id, name, slug, bio, contact_email: email || user.email,
    }).select().single();
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Host created!"); navigate({ to: "/dashboard", search: { host: data!.id } }); }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-4xl mb-2">Become a host</h1>
      <p className="text-muted-foreground mb-8">Create a host profile to start publishing events.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div><Label>Host name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunday Run Club" /></div>
        <div><Label>URL slug</Label><Input required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
          <p className="text-xs text-muted-foreground mt-1">gather.app/h/{slug || "your-slug"}</p>
        </div>
        <div><Label>Bio</Label><Textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} /></div>
        <div><Label>Contact email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Creating…" : "Create host"}</Button>
      </form>
    </div>
  );
}
