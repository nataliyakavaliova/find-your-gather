import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { EventCard, type EventLite } from "@/components/EventCard";

export const Route = createFileRoute("/h/$slug")({
  component: HostPage,
  loader: async ({ params }) => {
    const { data: host } = await supabase.from("hosts").select("*").eq("slug", params.slug).maybeSingle();
    if (!host) return { host: null, events: [] };
    const { data: events } = await supabase
      .from("events")
      .select("id, title, starts_at, venue_address, cover_image_url")
      .eq("host_id", host.id)
      .eq("status", "published")
      .eq("hidden", false)
      .order("starts_at", { ascending: false });
    return { host, events: (events ?? []) as EventLite[] };
  },
  head: ({ loaderData, params }) => {
    const h = loaderData?.host;
    const title = h ? `${h.name} — Gather` : "Host — Gather";
    const desc = (h?.bio?.slice(0, 160) ?? `Events hosted by ${h?.name ?? "this host"} on Gather.`).replace(/\s+/g, " ").trim();
    const url = `https://find-your-gather.lovable.app/h/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        ...(h?.logo_url
          ? [
              { property: "og:image", content: h.logo_url },
              { name: "twitter:image", content: h.logo_url },
            ]
          : []),
      ],
    };
  },
});

function HostPage() {
  const { host, events } = Route.useLoaderData();
  if (!host) return <div className="mx-auto max-w-3xl px-4 py-20 text-center">Host not found.</div>;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center gap-5 mb-10">
        <div className="h-20 w-20 rounded-full bg-accent overflow-hidden">
          {host.logo_url && <img src={host.logo_url} alt={host.name} className="w-full h-full object-cover" />}
        </div>
        <div>
          <h1 className="font-display text-4xl font-semibold">{host.name}</h1>
          {host.bio && <p className="text-muted-foreground mt-2 max-w-2xl">{host.bio}</p>}
        </div>
      </div>
      <h2 className="font-display text-2xl mb-4">Events</h2>
      {events.length === 0 ? (
        <p className="text-muted-foreground">No published events yet.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((e: EventLite) => <EventCard key={e.id} event={{ ...e, hosts: { name: host.name, slug: host.slug } }} />)}
        </div>
      )}
    </div>
  );
}
