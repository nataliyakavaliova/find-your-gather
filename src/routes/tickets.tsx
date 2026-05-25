import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, MapPin, CalendarPlus } from "lucide-react";
import { downloadIcs } from "@/lib/ics";

export const Route = createFileRoute("/tickets")({
  component: TicketsPage,
  head: () => ({ meta: [{ title: "Your tickets — Gather" }] }),
});

type Ticket = {
  id: string;
  qr_code: string;
  status: "going" | "waitlist" | "cancelled";
  position: number | null;
  events: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    venue_address: string | null;
    description: string | null;
  } | null;
};

function TicketsPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("id, qr_code, status, position, events(id, title, starts_at, ends_at, venue_address, description)")
        .eq("user_id", user!.id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Ticket[];
    },
  });

  if (!loading && !user) return <Navigate to="/signin" search={{ redirect: "/tickets" }} />;

  const now = Date.now();
  const upcoming = (data ?? []).filter((t) => t.events && new Date(t.events.ends_at).getTime() >= now);
  const past = (data ?? []).filter((t) => t.events && new Date(t.events.ends_at).getTime() < now);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-4xl font-semibold mb-6">Your tickets</h1>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "upcoming" | "past")}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-6">
          <TicketList tickets={upcoming} loading={isLoading} />
        </TabsContent>
        <TabsContent value="past" className="mt-6">
          <TicketList tickets={past} loading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TicketList({ tickets, loading }: { tickets: Ticket[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-4" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 h-40 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!tickets.length) {
    return (
      <div className="text-center py-16">
        <p className="font-display text-xl mb-2">You have no upcoming tickets.</p>
        <p className="text-muted-foreground mb-4">Find an event on Explore.</p>
        <Button asChild><Link to="/">Browse events</Link></Button>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {tickets.map((t) => t.events && <TicketCard key={t.id} ticket={t} />)}
    </div>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const e = ticket.events!;
  const start = new Date(e.starts_at);
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row gap-5">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          {ticket.status === "going" ? (
            <Badge>Going</Badge>
          ) : (
            <Badge variant="secondary">Waitlist{ticket.position ? ` · #${ticket.position}` : ""}</Badge>
          )}
        </div>
        <Link to="/events/$id" params={{ id: e.id }} className="block font-display text-2xl font-semibold hover:text-primary">
          {e.title}
        </Link>
        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />{start.toLocaleString()}</div>
          {e.venue_address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{e.venue_address}</div>}
        </div>
        <div className="pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadIcs({
              uid: ticket.id,
              title: e.title,
              description: e.description,
              location: e.venue_address,
              starts_at: e.starts_at,
              ends_at: e.ends_at,
            })}
          >
            <CalendarPlus className="h-4 w-4 mr-2" /> Add to Calendar
          </Button>
        </div>
      </div>
      {ticket.status === "going" && (
        <div className="flex flex-col items-center justify-center bg-background rounded-lg p-3 border border-border">
          <QRCodeSVG value={ticket.qr_code} size={128} aria-label="Check-in QR code" />
          <p className="text-[10px] text-muted-foreground mt-2 font-mono break-all max-w-[140px] text-center select-all" title="Type this code at check-in if scanning fails">{ticket.qr_code}</p>
        </div>
      )}
    </div>
  );
}
