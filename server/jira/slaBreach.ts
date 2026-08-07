import { parseISO, isValid } from "date-fns";
import { SLA_RESOLUTION_FIELDS } from "@/server/jira/constants";
import type { JiraFieldMap } from "@/server/jira/jiraFields";

export interface SlaBreachInfo {
  campo: string | null;
  breachDate: Date | null;
  breached: boolean | null;
}

interface SlaCycle {
  breachTime?: { iso8601?: string };
  breached?: boolean;
}

interface SlaFieldValue {
  name?: string;
  ongoingCycle?: SlaCycle;
  completedCycles?: SlaCycle[];
}

/**
 * Port de `extract_sla_breach` (jira_extractor.py:211-243). O ciclo de SLA
 * fica em `ongoingCycle` enquanto está ativo/pausado, e é movido para
 * `completedCycles` quando o Jira finaliza o SLA (às vezes só depois do
 * chamado já estar resolvido há um tempo) — por isso checa os dois, usando
 * o ciclo concluído mais recente quando não há ciclo em andamento.
 */
export function extractSlaBreach(issueFields: JiraFieldMap): SlaBreachInfo {
  for (const fieldId of SLA_RESOLUTION_FIELDS) {
    const slaValue = issueFields[fieldId] as SlaFieldValue | undefined;
    if (!slaValue) continue;

    let cycle = slaValue.ongoingCycle;
    if (!cycle) {
      const completed = slaValue.completedCycles ?? [];
      if (completed.length > 0) cycle = completed[completed.length - 1];
    }
    if (!cycle) continue;

    const breachTimeIso = cycle.breachTime?.iso8601;
    if (!breachTimeIso) continue;

    const breachDate = parseISO(breachTimeIso);
    if (!isValid(breachDate)) continue;

    return {
      campo: slaValue.name ?? fieldId,
      breachDate,
      breached: cycle.breached ?? false,
    };
  }

  return { campo: null, breachDate: null, breached: null };
}
