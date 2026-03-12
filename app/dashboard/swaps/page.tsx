import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function SwapsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.member) {
    if (session.user.role === "ADMIN") {
      redirect("/admin/swaps");
    }
    redirect("/celular");
  }
  redirect("/dashboard?openSwaps=1");
}
