import type { Metadata } from "next";
import { PersonalOpsCommsPageClient } from "@/components/personal-ops/PersonalOpsCommsPageClient";

export const metadata: Metadata = {
  title: "Personal Ops",
  description: "Attention Center and Comms Inbox Board for the first personal-ops dashboard slice.",
};

export default function PersonalOpsCommsPage() {
  return <PersonalOpsCommsPageClient />;
}
