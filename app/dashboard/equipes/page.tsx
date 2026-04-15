import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTeams } from "@/server/team/getTeams";
import { EquipesPageClient } from "./equipes-page-client";

export default async function EquipesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const teams = await getTeams();

  return <EquipesPageClient teams={teams} />;
}
