import { createFileRoute } from "@tanstack/react-router";
import { AmazonReverseAsinPage } from "@/client/features/amazon-reverse-asin/AmazonReverseAsinPage";

export const Route = createFileRoute("/_project/p/$projectId/amazon-reverse-asin")({
  component: AmazonReverseAsinRoute,
});

function AmazonReverseAsinRoute() {
  const { projectId } = Route.useParams();
  return <AmazonReverseAsinPage projectId={projectId} />;
}
