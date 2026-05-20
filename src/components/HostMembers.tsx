import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Copy, Trash2 } from "lucide-react";

type Role = "host" | "checker";

export function HostMembers({ hostId, isOwnerOrHost }: { hostId: string; isOwnerOrHost: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("checker");
  const [link, setLink] = useState<string | null>(null);

  const { data: members } = useQuery({
    queryKey: ["host-members", hostId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("host_members")
        .select("id, role, user_id, created_at")
        .eq("host_id", hostId);
      if (!rows?.length) return [];
      const ids = rows.map((r) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return rows.map((r) => ({ ...r, full_name: map.get(r.user_id) ?? null }));
    },
  });

  const { data: invites, refetch: refetchInvites } = useQuery({
    queryKey: ["host-invites", hostId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invitations")
        .select("id, role, token, expires_at, used_at, created_at")
        .eq("host_id", hostId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function createInvite() {
    if (!user) return;
    const { data, error } = await supabase
      .from("invitations")
      .insert({ host_id: hostId, role, created_by: user.id })
      .select("token")
      .single();
    if (error) { toast.error(error.message); return; }
    const url = `${window.location.origin}/invite/${data.token}`;
    setLink(url);
    refetchInvites();
  }

  async function revoke(id: string) {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refetchInvites();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied link");
  }

  return (
    <div className="space-y-8 mt-4">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg">Members</h3>
          {isOwnerOrHost && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setLink(null); }}>
              <DialogTrigger asChild><Button size="sm">Invite member</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Invite a new member</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-sm mb-1 block">Role</label>
                    <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="host">Host — full access</SelectItem>
                        <SelectItem value="checker">Checker — check-in only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {link && (
                    <div className="space-y-2">
                      <label className="text-sm">Share this link (expires in 7 days)</label>
                      <div className="flex gap-2">
                        <Input readOnly value={link} className="font-mono text-xs" />
                        <Button variant="outline" onClick={() => copy(link)}><Copy className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  {!link ? (
                    <Button onClick={createInvite}>Generate link</Button>
                  ) : (
                    <Button variant="outline" onClick={() => setLink(null)}>Generate another</Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <div className="border border-border rounded-lg divide-y divide-border">
          {(members ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium">{m.full_name ?? "Unnamed"}</div>
                <div className="text-xs text-muted-foreground">Joined {new Date(m.created_at).toLocaleDateString()}</div>
              </div>
              <Badge variant="outline" className="capitalize">{m.role}</Badge>
            </div>
          ))}
          {!members?.length && <p className="p-4 text-sm text-muted-foreground">No members yet.</p>}
        </div>
      </section>

      {isOwnerOrHost && (
        <section>
          <h3 className="font-display text-lg mb-3">Pending invitations</h3>
          <div className="border border-border rounded-lg divide-y divide-border">
            {(invites ?? []).filter((i) => !i.used_at && new Date(i.expires_at).getTime() > Date.now()).map((i) => {
              const url = `${window.location.origin}/invite/${i.token}`;
              return (
                <div key={i.id} className="flex items-center justify-between px-4 py-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><Badge variant="outline" className="capitalize">{i.role}</Badge><span className="text-xs text-muted-foreground">expires {new Date(i.expires_at).toLocaleDateString()}</span></div>
                    <a href={url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground truncate font-mono mt-1 block hover:text-foreground underline">{url}</a>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copy(url)}><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => revoke(i.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
            {!invites?.some((i) => !i.used_at && new Date(i.expires_at).getTime() > Date.now()) && (
              <p className="p-4 text-sm text-muted-foreground">No pending invitations.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
