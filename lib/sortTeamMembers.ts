import type { TeamMemberRow } from "@/types/team";

/**
 * Stable sort for team members by:
 * 1. Nível (level) ascending
 * 2. Turno (shift) ascending
 * 3. Nome (name) alphabetical, locale-aware
 */
export function sortTeamMembers(members: TeamMemberRow[]): TeamMemberRow[] {
  return [...members].sort((a, b) => {
    if (a.level !== b.level) return a.level.localeCompare(b.level);
    if (a.shift !== b.shift) return a.shift.localeCompare(b.shift);
    return a.name.localeCompare(b.name, "pt-BR");
  });
}
