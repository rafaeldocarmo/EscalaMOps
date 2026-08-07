"use server";

import { auth } from "@/auth";
import { DEFAULT_FIELDS, FORNECEDOR_RESPONSAVEL_FIELDS } from "@/server/jira/constants";
import { extractFornecedor, flattenIssue, type FlatIssueRow, type JiraRowsResult } from "@/server/jira/jiraFields";
import { fetchIssues } from "@/server/jira/jiraClient";

export interface FetchExtracaoCompletaParams {
  jql: string;
  jiraEmail: string;
  incluirFornecedor: boolean;
}

/** Port de `run_extracao_completa` (jira_extractor.py:800-820). */
export async function fetchExtracaoCompleta({
  jql,
  jiraEmail,
  incluirFornecedor,
}: FetchExtracaoCompletaParams): Promise<JiraRowsResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Sessão expirada. Faça login novamente." };
  if (!jql) return { success: false, error: "Nenhuma JQL informada." };
  if (!jiraEmail) return { success: false, error: "Informe o e-mail da conta Jira." };

  try {
    const fields = DEFAULT_FIELDS;
    const fetchFields = incluirFornecedor ? [...fields, ...FORNECEDOR_RESPONSAVEL_FIELDS] : fields;

    const issues = await fetchIssues(jql, fetchFields, jiraEmail);

    const rows: FlatIssueRow[] = issues.map((issue) => {
      const row = flattenIssue(issue, fields);
      if (incluirFornecedor) {
        row.fornecedor_responsavel = extractFornecedor(issue.fields ?? {});
      }
      return row;
    });

    return { success: true, rows };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro inesperado ao consultar o Jira." };
  }
}
