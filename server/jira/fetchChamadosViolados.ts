"use server";

import { auth } from "@/auth";
import { formatBrazilDateTime } from "@/server/jira/brazilTime";
import { FORNECEDOR_RESPONSAVEL_FIELDS, SLA_RESOLUTION_FIELDS } from "@/server/jira/constants";
import { fetchIssues } from "@/server/jira/jiraClient";
import { extractFornecedor, extractValue, type FlatIssueRow, type JiraRowsResult } from "@/server/jira/jiraFields";
import { extractSlaBreach } from "@/server/jira/slaBreach";

export interface FetchChamadosVioladosParams {
  jqlBase: string;
  jiraEmail: string;
  incluirFornecedor: boolean;
}

const stripOrderBy = (jql: string) => jql.replace(/\s+ORDER\s+BY\s+.*$/i, "");

/** Port de `fetch_chamados_violados` (jira_extractor.py:322-363). */
export async function fetchChamadosViolados({
  jqlBase,
  jiraEmail,
  incluirFornecedor,
}: FetchChamadosVioladosParams): Promise<JiraRowsResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Sessão expirada. Faça login novamente." };
  if (!jqlBase) return { success: false, error: "Nenhuma JQL base definida." };
  if (!jiraEmail) return { success: false, error: "Informe o e-mail da conta Jira." };

  try {
    const baseJql = stripOrderBy(jqlBase);
    const jql = `(${baseJql}) AND ("Tempo de Resolução" < 0h OR "Tempo de resolução" < 0h)`;

    const fields = ["summary", "status", "assignee", "reporter", "project", "issuetype", ...SLA_RESOLUTION_FIELDS];
    const fetchFields = incluirFornecedor ? [...fields, ...FORNECEDOR_RESPONSAVEL_FIELDS] : fields;

    const issues = await fetchIssues(jql, fetchFields, jiraEmail);

    const now = new Date();
    const rows: FlatIssueRow[] = issues.map((issue) => {
      const issueFields = issue.fields ?? {};
      const { campo: slaCampo, breachDate } = extractSlaBreach(issueFields);

      const horasEmAtraso = breachDate
        ? Math.round(((now.getTime() - breachDate.getTime()) / 3600000) * 10) / 10
        : null;

      const row: FlatIssueRow = {
        key: issue.key,
        summary: issueFields.summary,
        status: extractValue(issueFields.status, "name"),
        assignee: extractValue(issueFields.assignee, "displayName"),
        reporter: extractValue(issueFields.reporter, "displayName"),
        project: extractValue(issueFields.project, "key"),
        issuetype: extractValue(issueFields.issuetype, "name"),
        sla_campo: slaCampo,
        sla_estourou_em: breachDate ? formatBrazilDateTime(breachDate) : null,
        horas_em_atraso: horasEmAtraso,
      };
      if (incluirFornecedor) {
        row.fornecedor_responsavel = extractFornecedor(issueFields);
      }
      return row;
    });

    rows.sort((a, b) => (Number(b.horas_em_atraso) || 0) - (Number(a.horas_em_atraso) || 0));

    return { success: true, rows };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro inesperado ao consultar o Jira." };
  }
}
