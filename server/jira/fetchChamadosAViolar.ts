"use server";

import { auth } from "@/auth";
import { brazilSlaWindow, formatBrazilDateTime, formatBrazilTime } from "@/server/jira/brazilTime";
import { FORNECEDOR_RESPONSAVEL_FIELDS, SLA_RESOLUTION_FIELDS, VIOLAR_STATUSES } from "@/server/jira/constants";
import { fetchIssues } from "@/server/jira/jiraClient";
import { extractFornecedor, extractValue, type FlatIssueRow, type JiraRowsResult } from "@/server/jira/jiraFields";
import { extractSlaBreach } from "@/server/jira/slaBreach";

export interface FetchChamadosAViolarParams {
  jqlBase: string;
  jiraEmail: string;
  daysAhead: 0 | 1;
  incluirFornecedor: boolean;
}

const stripOrderBy = (jql: string) => jql.replace(/\s+ORDER\s+BY\s+.*$/i, "");

/** Port de `fetch_chamados_a_violar` (jira_extractor.py:255-319). */
export async function fetchChamadosAViolar({
  jqlBase,
  jiraEmail,
  daysAhead,
  incluirFornecedor,
}: FetchChamadosAViolarParams): Promise<JiraRowsResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Sessão expirada. Faça login novamente." };
  if (!jqlBase) return { success: false, error: "Nenhuma JQL base definida." };
  if (!jiraEmail) return { success: false, error: "Informe o e-mail da conta Jira." };

  try {
    const baseJql = stripOrderBy(jqlBase);
    const statusList = VIOLAR_STATUSES.map((s) => `"${s}"`).join(", ");
    const jql = `(${baseJql}) AND status IN (${statusList})`;

    const fields = ["summary", "status", "assignee", "reporter", "project", "issuetype", ...SLA_RESOLUTION_FIELDS];
    const fetchFields = incluirFornecedor ? [...fields, ...FORNECEDOR_RESPONSAVEL_FIELDS] : fields;

    const issues = await fetchIssues(jql, fetchFields, jiraEmail);

    const now = new Date();
    const { windowStart, windowEnd } = brazilSlaWindow(now, daysAhead);

    const rows: FlatIssueRow[] = [];
    for (const issue of issues) {
      const issueFields = issue.fields ?? {};
      const { campo: slaCampo, breachDate, breached } = extractSlaBreach(issueFields);

      if (!breachDate) continue;
      if (breached) continue; // já estourou em ciclo anterior, não é "a violar"
      if (breachDate < windowStart || breachDate > windowEnd) continue;

      const horasRestantes = Math.round(((breachDate.getTime() - now.getTime()) / 3600000) * 10) / 10;

      const row: FlatIssueRow = {
        key: issue.key,
        summary: issueFields.summary,
        status: extractValue(issueFields.status, "name"),
        assignee: extractValue(issueFields.assignee, "displayName"),
        reporter: extractValue(issueFields.reporter, "displayName"),
        project: extractValue(issueFields.project, "key"),
        issuetype: extractValue(issueFields.issuetype, "name"),
        sla_campo: slaCampo,
        sla_estoura_em: formatBrazilDateTime(breachDate),
        hora_violacao: formatBrazilTime(breachDate),
        horas_restantes: horasRestantes,
      };
      if (incluirFornecedor) {
        row.fornecedor_responsavel = extractFornecedor(issueFields);
      }
      rows.push(row);
    }

    rows.sort((a, b) => String(a.sla_estoura_em).localeCompare(String(b.sla_estoura_em)));

    return { success: true, rows };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro inesperado ao consultar o Jira." };
  }
}
