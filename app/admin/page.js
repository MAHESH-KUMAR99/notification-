import { cookies } from "next/headers";
import { getAuthorities } from "@/lib/data";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import AdminLogin from "@/components/AdminLogin";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAuthed = verifySessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

  if (!isAuthed) {
    return <AdminLogin />;
  }

  const authorities = await getAuthorities();
  return <AdminPanel initialAuthorities={authorities} />;
}
