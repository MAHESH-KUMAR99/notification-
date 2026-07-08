import { getAuthorities } from "@/lib/data";
import { getHealthStatus } from "@/lib/health";
import Board from "@/components/Board";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [authorities, healthStatus] = await Promise.all([getAuthorities(), getHealthStatus()]);
  return <Board authorities={authorities} healthStatus={healthStatus} />;
}
