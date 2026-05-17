import { createFileRoute } from "@tanstack/react-router";
import { EventEditor } from "@/components/EventEditor";

export const Route = createFileRoute("/dashboard/events/new")({
  component: NewEvent,
  validateSearch: (s: Record<string, unknown>) => ({ host: (s.host as string) || "" }),
});

function NewEvent() {
  const { host } = Route.useSearch();
  if (!host) return <div className="mx-auto max-w-2xl px-4 py-20 text-center text-muted-foreground">Pick a host from the dashboard first.</div>;
  return <EventEditor mode={{ kind: "new", hostId: host }} />;
}
