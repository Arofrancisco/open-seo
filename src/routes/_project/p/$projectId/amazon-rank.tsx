import { createFileRoute } from "@tanstack/react-router";
import { AmazonRankTrackingPage } from "@/client/features/amazon-rank/AmazonRankTrackingPage";

export const Route = createFileRoute("/_project/p/$projectId/amazon-rank")({
  component: AmazonRankRoute,
});

function AmazonRankRoute() {
  const { projectId } = Route.useParams();
  return <AmazonRankTrackingPage projectId={projectId} />;
}
