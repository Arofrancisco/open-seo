import { createFileRoute } from "@tanstack/react-router";
import { ProductOpportunityPage } from "@/client/features/product-opportunity/ProductOpportunityPage";

export const Route = createFileRoute("/_project/p/$projectId/product-opportunity")({
  component: ProductOpportunityRoute,
});

function ProductOpportunityRoute() {
  const { projectId } = Route.useParams();
  return <ProductOpportunityPage projectId={projectId} />;
}
