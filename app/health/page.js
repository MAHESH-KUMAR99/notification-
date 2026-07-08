import { getHealthStatus } from "@/lib/health";
import HealthPageClient from "@/components/HealthPageClient";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const cachedStatus = await getHealthStatus();
  return <HealthPageClient cachedStatus={cachedStatus} />;
}
