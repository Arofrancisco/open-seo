import { createFileRoute } from "@tanstack/react-router";
import { AmazonAsinLookupPage } from "@/client/features/amazon-asin/AmazonAsinLookupPage";

export const Route = createFileRoute("/_project/p/$projectId/amazon-asin")({
  component: AmazonAsinRoute,
});

function AmazonAsinRoute() {
  const { projectId } = Route.useParams();
  return <AmazonAsinLookupPage projectId={projectId} />;
}
