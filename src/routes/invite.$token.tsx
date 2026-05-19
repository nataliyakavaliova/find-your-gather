import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);

  const { data: inv, isLoading } = useQuery({
    queryKey: ["invite", token],
    queryFn: async () => {
      const { data: invitation } = await supabase
        .from("invitations")
        .select("id, host_id, role, expires_at, used_at")
        .eq("token", token)
        .maybeSingle();
      if (!invitation) return null;
      const { data: host } = await supabase.from("hosts").select("name, slug").eq("id", invitation.host_id).maybeSingle();
      return { ...invitation, host };
    },
  });

  const { data: existing } = useQuery({
    queryKey: ["invite-existing", inv?.host_id, user?.id],
    enabled: !!user && !!inv?.host_id,
    queryFn: async () => {
      const { data } = await supabase.from("host_members").select("role").eq("host_id", inv!.host_id).eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/signin", search: { redirect: `/invite/${token}` } });
  }, [loading, user, token, navigate]);

  if (isLoading || !user) return <div className="mx-auto max-w-md px-4 py-20 text-center text-muted-foreground">Loading…</div>;

  if (!inv) return <Message title="Invitation not found" body="This link is invalid." />;
  if (inv.used_at) return <Message title="Invitation already used" body="This link has been used." />;
  if (new Date(inv.expires_at).getTime() < Date.now()) return <Message title="Invitation expired" body="Ask your host for a new one." />;
  if (existing) return <Message title="You're already a member" body={`You already have access to ${inv.host?.name ?? "this host"}.`} cta={{ to: "/my-events", label: "Go to My Events" }} />;

  async function accept() {
    setAccepting(true);
    const { error } = await supabase.rpc("accept_invitation", { _token: token });
    setAccepting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Joined!");
    navigate({ to: "/my-events" });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-semibold mb-2">Join {inv.host?.name}</h1>
      <p className="text-muted-foreground mb-6">You've been invited as a <span className="font-medium text-foreground capitalize">{inv.role}</span>.</p>
      <Button size="lg" onClick={accept} disabled={accepting}>{accepting ? "Joining…" : "Accept invitation"}</Button>
    </div>
  );
}

function Message({ title, body, cta }: { title: string; body: string; cta?: { to: string; label: string } }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-semibold mb-2">{title}</h1>
      <p className="text-muted-foreground mb-6">{body}</p>
      {cta ? <Button asChild><Link to={cta.to}>{cta.label}</Link></Button> : <Button asChild variant="outline"><Link to="/">Home</Link></Button>}
    </div>
  );
}
