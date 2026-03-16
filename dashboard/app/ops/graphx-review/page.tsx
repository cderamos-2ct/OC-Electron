import type { Metadata } from "next";
import { GraphxReviewPageClient } from "@/components/graphx-review/GraphxReviewPageClient";

export const metadata: Metadata = {
  title: "Graphx Review",
  description: "Seeded first slice for Graphx extracted-value review with read-only source grounding.",
};

export default function GraphxReviewPage() {
  return <GraphxReviewPageClient />;
}
