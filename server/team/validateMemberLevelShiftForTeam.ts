import { prisma } from "@/lib/prisma";

export type ValidateMemberLevelShiftResult =
  | { ok: true }
  | { ok: false; error: string };

const CATALOG_REQUIRED_MSG =
  "Cadastre níveis e turnos da equipe em Configurações → Níveis e turnos e defina a matriz de compatibilidade antes de usar essas combinações.";

/**
 * Valida que o par (teamLevelId, teamShiftId) pertence à equipe e está permitido
 * pela matriz de compatibilidade.
 */
export async function validateMemberLevelShiftForTeam(
  teamId: string | null | undefined,
  teamLevelId: string,
  teamShiftId: string,
): Promise<ValidateMemberLevelShiftResult> {
  if (!teamId) {
    return { ok: false, error: CATALOG_REQUIRED_MSG };
  }

  const [teamLevel, teamShift] = await Promise.all([
    prisma.teamLevel.findFirst({
      where: { id: teamLevelId, teamId },
      select: { id: true },
    }),
    prisma.teamShift.findFirst({
      where: { id: teamShiftId, teamId },
      select: { id: true },
    }),
  ]);

  if (!teamLevel || !teamShift) {
    return {
      ok: false,
      error: "Nível ou turno não pertencem à equipe. Atualize a seleção e tente novamente.",
    };
  }

  const allowed = await prisma.teamLevelAllowedShift.findFirst({
    where: { teamLevelId: teamLevel.id, teamShiftId: teamShift.id },
    select: { teamLevelId: true },
  });

  if (!allowed) {
    return {
      ok: false,
      error:
        "Esta combinação de nível e turno não é permitida para a equipe. Ajuste a matriz em Níveis e turnos.",
    };
  }

  return { ok: true };
}
