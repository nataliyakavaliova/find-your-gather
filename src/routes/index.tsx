import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EventCard, type EventLite } from "@/components/EventCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Search } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Explore,
  head: () => ({
    meta: [
      { title: "Gather — Explore community events" },
      { name: "description", content: "Browse upcoming and past community events on Gather." },
    ],
  }),
});

function Explore() {
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includePast, setIncludePast] = useState(false);

  const { data: events, isLoading } = useQuery({
    queryKey: ["events", { q, loc, from, to, includePast }],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("id, title, starts_at, venue_address, cover_image_url, hosts(name, slug)")
        .eq("status", "published")
        .eq("visibility", "public")
        .eq("hidden", false)
        .order("starts_at", { ascending: true });

      if (!includePast) query = query.gte("starts_at", new Date().toISOString());
      if (from) query = query.gte("starts_at", new Date(from).toISOString());
      if (to) query = query.lte("starts_at", new Date(to).toISOString());
      if (q) query = query.ilike("title", `%${q}%`);
      if (loc) query = query.ilike("venue_address", `%${loc}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as EventLite[];
    },
  });

  return (
    <div>
      <section className="border-b border-border bg-gradient-to-br from-accent/40 via-background to-background">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tight max-w-3xl">
            Find your people. <span className="text-primary italic">Gather</span> in real life.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl">
            Discover free community events hosted by people just like you.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-3 md:grid-cols-4 mb-8">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search events" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Input placeholder="Location" value={loc} onChange={(e) => setLoc(e.target.value)} />
          <div className="flex items-center justify-end gap-2">
            <Label htmlFor="past" className="text-sm">Include past</Label>
            <Switch id="past" checked={includePast} onCheckedChange={setIncludePast} />
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="aspect-[16/9] bg-muted animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : !events?.length ? (
          <div className="text-center py-20">
            <p className="font-display text-2xl mb-2">No events match your filters.</p>
            <p className="text-sm text-muted-foreground">Try clearing the search or date range.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}
      </section>
    </div>
  );
}
