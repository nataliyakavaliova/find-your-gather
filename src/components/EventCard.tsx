import { Link } from "@tanstack/react-router";
import { Calendar, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type EventLite = {
  id: string;
  title: string;
  starts_at: string;
  venue_address: string | null;
  cover_image_url: string | null;
  hosts?: { name: string; slug: string } | null;
};

export function EventCard({ event }: { event: EventLite }) {
  const start = new Date(event.starts_at);
  const ended = start.getTime() < Date.now();
  return (
    <Link
      to="/events/$id"
      params={{ id: event.id }}
      className="group block overflow-hidden rounded-xl border border-border bg-card hover:shadow-lg transition-shadow"
    >
      <div className="aspect-[16/9] bg-muted overflow-hidden">
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent to-primary/30" />
        )}
      </div>
      <div className="p-5 space-y-2">
        <div className="flex items-center gap-2">
          {ended && <Badge variant="secondary">Ended</Badge>}
          {event.hosts && <span className="text-xs text-muted-foreground">{event.hosts.name}</span>}
        </div>
        <h3 className="font-display text-xl font-semibold leading-tight">{event.title}</h3>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          {event.venue_address && (
            <span className="flex items-center gap-1 truncate"><MapPin className="h-3.5 w-3.5" />{event.venue_address}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
