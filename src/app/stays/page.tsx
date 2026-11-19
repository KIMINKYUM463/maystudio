import type { Metadata } from "next";
import { StayIdeasPage } from "@/components/dashboard/StayIdeasPage";

export const metadata: Metadata = { title: "숙소 추천 · MayAIStudio" };

export default function StaysPage() {
  return <StayIdeasPage />;
}
