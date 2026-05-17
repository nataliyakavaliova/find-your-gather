import { createFileRoute } from "@tanstack/react-router";
import { EventEditor } from "@/components/EventEditor";

export const Route = createFileRoute("/dashboard/events/$id/edit")({
  component: EditEvent,
});

function EditEvent() {
  const { id } = Route.useParams();
  return <EventEditor mode={{ kind: "edit", eventId: id }} />;
}
