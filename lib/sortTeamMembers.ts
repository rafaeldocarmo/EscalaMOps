import type { TeamMemberRow } from "@/types/team";

/**
 * Stable sort for team members by:
 * 1. Label do nível (conforme catálogo) — alfabético, pt-BR
 * 2. Label do turno (conforme catálogo) — alfabético, pt-BR
 * 3. Nome — alfabético, pt-BR
 *
 * A ordem primária vinda do servidor já respeita sortOrder; este sort é uma rede
 * de segurança para consumidores client-side que filtram/embaralham a lista.
 */
export function sortTeamMembers(members: TeamMemberRow[]): TeamMemberRow[] {
  return [...members].sort((a, b) => {
    const levelCmp = a.levelLabel.localeCompare(b.levelLabel, "pt-BR");
    if (levelCmp !== 0) return levelCmp;
    const shiftCmp = a.shiftLabel.localeCompare(b.shiftLabel, "pt-BR");
    if (shiftCmp !== 0) return shiftCmp;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}
