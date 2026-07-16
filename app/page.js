import { getAuthorities } from "@/lib/data";
import Board from "@/components/Board";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const authorities = await getAuthorities();
  return <Board authorities={authorities} />;
}
