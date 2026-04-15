import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isFullAdmin } from "@/lib/authz";

export default async function EquipesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isFullAdmin(session)) redirect("/dashboard");

  return <div className="space-y-6">{children}</div>;
}
