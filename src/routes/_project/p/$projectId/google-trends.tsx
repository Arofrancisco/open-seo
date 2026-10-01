import { createFileRoute } from "@tanstack/react-router";
import { GoogleTrendsPage } from "@/client/features/google-trends/GoogleTrendsPage";

export const Route = createFileRoute("/_project/p/$projectId/google-trends")({
  component: GoogleTrendsRoute,
});

function GoogleTrendsRoute() {
  const { projectId } = Route.useParams();
  return <GoogleTrendsPage projectId={projectId} />;
}