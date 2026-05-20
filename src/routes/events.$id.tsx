import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Globe, Users, Ticket as TicketIcon } from "lucide-react";
import { toast } from "sonner";
import { EventGallery } from "@/components/EventGallery";
import { EventFeedback } from "@/components/EventFeedback";
import { ReportButton } from "@/components/ReportButton";

export const Route = createFileRoute("/events/$id")({
  component: EventPage,
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("events")
      .select("id, title, description, starts_at, ends_at, venue_address, online_url, capacity, cover_image_url, status, host_id, hidden, hosts(name, slug, bio, logo_url)")
      .eq("id", params.id)
      .maybeSingle();
    return { event: data };
  },
  head: ({ loaderData }) => {
    const e = loaderData?.event;
    const title = e ? `${e.title} — Gather` : "Event — Gather";
    const desc = e?.description?.slice(0, 160) ?? "Join this event on Gather.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(e?.cover_image_url ? [{ property: "og:image", content: e.cover_image_url }] : []),
      ],
    };
  },
});

function EventPage() {
  const { event } = Route.useLoaderData();
  const { id } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();
  const navigate = useNavigate();

  const { data: rsvp, refetch: refetchRsvp } = useQuery({
    queryKey: ["rsvp", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("rsvps")
        .select("id, status, position, qr_code")
        .eq("event_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: counts, refetch: refetchCounts } = useQuery({
    queryKey: ["rsvp-counts", id],
    queryFn: async () => {
      const [going, waitlist] = await Promise.all([
        supabase.from("rsvps").select("*", { count: "exact", head: true }).eq("event_id", id).eq("status", "going"),
        supabase.from("rsvps").select("*", { count: "exact", head: true }).eq("event_id", id).eq("status", "waitlist"),
      ]);
      return { going: going.count ?? 0, waitlist: waitlist.count ?? 0 };
    },
  });

  const { data: isHostMember } = useQuery({
    queryKey: ["is-host-member", event?.host_id, user?.id],
    enabled: !!user && !!event?.host_id,
    queryFn: async () => {
      const { data } = await supabase.from("host_members").select("role").eq("host_id", event!.host_id).eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });

  if (!event) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center"><p>Event not found.</p></div>;
  }

  if (event.hidden && !isHostMember) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center"><h1 className="font-display text-2xl mb-2">Content unavailable</h1><p className="text-muted-foreground">This content has been hidden by moderators.</p></div>;
  }

  const start = new Date(event.starts_at);
  const ended = new Date(event.ends_at).getTime() < Date.now();
  const active = rsvp && rsvp.status !== "cancelled";
  const wasGoing = rsvp?.status === "going";

  async function rsvpToEvent() {
    if (!user) {
      navigate({ to: "/signin", search: { redirect: `/events/${id}` } });
      return;
    }
    const { data, error } = await supabase.rpc("rsvp_to_event", { _event_id: id });
    if (error) { toast.error(error.message); return; }
    const r = data as { status: string; position: number | null } | null;
    if (r?.status === "waitlist") {
      toast.success(`You're on the waitlist (position #${r.position ?? "?"})`);
    } else {
      toast.success("You're going!");
    }
    refetchRsvp(); refetchCounts(); router.invalidate();
  }

  async function cancel() {
    if (!user) return;
    const { error } = await supabase.rpc("cancel_rsvp", { _event_id: id });
    if (error) toast.error(error.message);
    else { toast.success("RSVP cancelled"); refetchRsvp(); refetchCounts(); }
  }

  return (
    <article className="mx-auto max-w-4xl px-4 py-10">
      <div className="aspect-[21/9] rounded-2xl overflow-hidden mb-8 bg-muted">
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover" />
        ) : <div className="w-full h-full bg-gradient-to-br from-accent to-primary/30" />}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {ended && <Badge variant="secondary">Ended</Badge>}
        {event.hosts && (
          <Link to="/h/$slug" params={{ slug: event.hosts.slug }} className="text-sm text-muted-foreground hover:text-primary">
            by {event.hosts.name}
          </Link>
        )}
      </div>

      <h1 className="font-display text-4xl md:text-5xl font-semibold mb-6">{event.title}</h1>

      {active && (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>
            {rsvp!.status === "going"
              ? "You're confirmed for this event."
              : `You're on the waitlist (position #${rsvp!.position ?? "?"}). We'll bump you up if a spot opens.`}
          </span>
          <Link to="/tickets" className="inline-flex items-center gap-1 text-primary font-medium hover:underline">
            <TicketIcon className="h-4 w-4" /> View your ticket
          </Link>
        </div>
      )}

      <div className="grid gap-3 mb-8 text-sm">
        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />{start.toLocaleString()}</div>
        {event.venue_address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{event.venue_address}</div>}
        {event.online_url && <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />Online event</div>}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          {counts?.going ?? 0} going{event.capacity ? ` / ${event.capacity} capacity` : ""}
          {(counts?.waitlist ?? 0) > 0 && <span className="text-muted-foreground">· {counts!.waitlist} on waitlist</span>}
        </div>
      </div>

      {!ended && (
        active ? (
          <Button variant="outline" onClick={cancel}>Cancel RSVP</Button>
        ) : (
          <Button size="lg" onClick={rsvpToEvent}>RSVP — it's free</Button>
        )
      )}

      {event.description && (
        <div className="mt-10 prose prose-stone max-w-none whitespace-pre-wrap">{event.description}</div>
      )}
    </article>
  );
}
