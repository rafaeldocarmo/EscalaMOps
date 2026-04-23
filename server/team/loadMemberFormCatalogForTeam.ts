import { prisma } from "@/lib/prisma";
import { buildMemberFormCatalog, type MemberFormCatalog } from "@/lib/memberFormCatalog";

/**
 * Carrega níveis/turnos/matriz do banco e monta o catálogo do formulário.
 * Sem checagem de permissão — usar só quando o `teamId` já estiver autorizado no fluxo.
 */
export async function loadMemberFormCatalogForTeam(teamId: string): Promise<MemberFormCatalog | null> {
  const [levels, shifts, allowedPairs] = await Promise.all([
    prisma.teamLevel.findMany({
      where: { teamId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, color: true, sortOrder: true },
    }),
    prisma.teamShift.findMany({
      where: { teamId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, color: true, sortOrder: true },
    }),
    prisma.teamLevelAllowedShift.findMany({
      where: { teamLevel: { teamId } },
      select: { teamLevelId: true, teamShiftId: true },
    }),
  ]);

  return buildMemberFormCatalog({ levels, shifts, allowedPairs });
}
