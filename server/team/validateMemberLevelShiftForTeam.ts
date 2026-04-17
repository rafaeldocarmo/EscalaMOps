import { prisma } from "@/lib/prisma";
import { catalogLabelToMemberLevel, catalogLabelToMemberShift } from "@/lib/teamCatalogLabelMapping";
import { Level, Shift } from "@/lib/generated/prisma/enums";

type LevelEnum = (typeof Level)[keyof typeof Level];
type ShiftEnum = (typeof Shift)[keyof typeof Shift];

export type ValidateMemberLevelShiftResult = { ok: true } | { ok: false; error: string };

const CATALOG_REQUIRED_MSG =
  "Cadastre níveis e turnos da equipe em Configurações → Níveis e turnos e defina a matriz de compatibilidade antes de usar essas combinações.";

export type ValidateMemberLevelShiftOptions = {
  /**
   * Quando a combinação enviada é igual à atual do membro, permite salvar (ex.: só nome/telefone)
   * mesmo sem catálogo no banco — migração gradual.
   */
  skipCatalogWhenSameAs?: { level: LevelEnum; shift: ShiftEnum };
};

/**
 * Valida combinação nível+turno para um membro conforme o catálogo da equipe (labels → enum + matriz).
 */
export async function validateMemberLevelShiftForTeam(
  teamId: string | null | undefined,
  level: LevelEnum,
  shift: ShiftEnum,
  opts?: ValidateMemberLevelShiftOptions,
): Promise<ValidateMemberLevelShiftResult> {
  const sameAsSkip =
    opts?.skipCatalogWhenSameAs &&
    opts.skipCatalogWhenSameAs.level === level &&
    opts.skipCatalogWhenSameAs.shift === shift;

  if (!teamId) {
    if (sameAsSkip) return { ok: true };
    return { ok: false, error: CATALOG_REQUIRED_MSG };
  }

  const [levelCount, shiftCount] = await Promise.all([
    prisma.teamLevel.count({ where: { teamId } }),
    prisma.teamShift.count({ where: { teamId } }),
  ]);

  if (levelCount === 0 || shiftCount === 0) {
    if (sameAsSkip) return { ok: true };
    return { ok: false, error: CATALOG_REQUIRED_MSG };
  }

  const levelStr = level as string;
  const shiftStr = shift as string;

  const [teamLevels, teamShifts] = await Promise.all([
    prisma.teamLevel.findMany({
      where: { teamId },
      select: { id: true, label: true },
    }),
    prisma.teamShift.findMany({
      where: { teamId },
      select: { id: true, label: true },
    }),
  ]);

  const teamLevel = teamLevels.find((r) => catalogLabelToMemberLevel(r.label) === levelStr) ?? null;
  const teamShift = teamShifts.find((r) => catalogLabelToMemberShift(r.label) === shiftStr) ?? null;

  if (!teamLevel || !teamShift) {
    return {
      ok: false,
      error:
        "Este nível ou turno não está na configuração da equipe. Ajuste em Níveis e turnos.",
    };
  }

  const allowed = await prisma.teamLevelAllowedShift.findFirst({
    where: {
      teamLevelId: teamLevel.id,
      teamShiftId: teamShift.id,
    },
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
