import { AssistantPage } from "@/components/assistant/AssistantPage";
import { buildFinancialContextForAi } from "@/lib/aiAssistantContext";

export const dynamic = "force-dynamic";

export default async function AssistantRoute() {
  await buildFinancialContextForAi();
  return <AssistantPage />;
}
