import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Globe, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/events/$id")({
  component: EventPage,
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("events")
      .select("id, title, description, starts_at, ends_at, venue_address, online_url, capacity, cover_image_url, status, host_id, hosts(name, slug, bio, logo_url)")
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
      const { data } = await supabase.from("rsvps").select("*").eq("event_id", id).eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: count } = useQuery({
    queryKey: ["rsvp-count", id],
    queryFn: async () => {
      const { count } = await supabase.from("rsvps").select("*", { count: "exact", head: true }).eq("event_id", id).eq("status", "going");
      return count ?? 0;
    },
  });

  if (!event) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center"><p>Event not found.</p></div>;
  }

  const start = new Date(event.starts_at);
  const ended = new Date(event.ends_at).getTime() < Date.now();

  async function rsvpToEvent() {
    if (!user) {
      navigate({ to: "/signin", search: { redirect: `/events/${id}` } });
      return;
    }
    const { error } = await supabase.from("rsvps").upsert({ event_id: id, user_id: user.id, status: "going" }, { onConflict: "event_id,user_id" });
    if (error) toast.error(error.message); else { toast.success("You're going!"); refetchRsvp(); router.invalidate(); }
  }

  async function cancel() {
    if (!user) return;
    const { error } = await supabase.from("rsvps").update({ status: "cancelled" }).eq("event_id", id).eq("user_id", user.id);
    if (error) toast.error(error.message); else { toast.success("RSVP cancelled"); refetchRsvp(); }
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

      <div className="grid gap-3 mb-8 text-sm">
        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />{start.toLocaleString()}</div>
        {event.venue_address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{event.venue_address}</div>}
        {event.online_url && <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />Online event</div>}
        <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{count ?? 0} going{event.capacity ? ` · ${event.capacity} cap` : ""}</div>
      </div>

      {!ended && (
        rsvp && rsvp.status === "going" ? (
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
