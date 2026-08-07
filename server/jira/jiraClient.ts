import { log } from "@/lib/log";

const SEARCH_ENDPOINT = "/rest/api/3/search/jql";
const PAGE_SIZE = 100;

export class JiraApiError extends Error {}

export interface JiraIssue {
  key: string;
  fields: Record<string, unknown>;
}

interface JiraSearchResponse {
  issues?: JiraIssue[];
  nextPageToken?: string;
}

function jiraEnv(): { baseUrl: string; apiToken: string } {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/+$/, "");
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !apiToken) {
    throw new JiraApiError(
      "Configuração do Jira ausente. Defina JIRA_BASE_URL e JIRA_API_TOKEN nas variáveis de ambiente."
    );
  }

  return { baseUrl, apiToken };
}

/**
 * Port de `fetch_issues` (jira_extractor.py:119-166). Busca todos os
 * chamados que satisfazem a JQL, paginando via nextPageToken. Em erro 5xx
 * do Jira, espera 5s e tenta a mesma página novamente (igual o app Python).
 *
 * `jiraEmail` é o e-mail da conta Jira dona do `JIRA_API_TOKEN` fixo — o
 * Basic Auth do Jira Cloud exige que os dois sejam da mesma conta, então
 * não pode ser assumido a partir do e-mail de login do EscalaMOps (são
 * contas diferentes). Por isso é informado na tela em vez de fixo no .env.
 */
export async function fetchIssues(jql: string, fields: string[], jiraEmail: string): Promise<JiraIssue[]> {
  const { baseUrl, apiToken } = jiraEnv();
  const authHeader = `Basic ${Buffer.from(`${jiraEmail}:${apiToken}`).toString("base64")}`;

  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  let page = 1;

  for (;;) {
    const body: Record<string, unknown> = { jql, maxResults: PAGE_SIZE, fields };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const response = await fetch(`${baseUrl}${SEARCH_ENDPOINT}`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.status === 401) {
      throw new JiraApiError("Falha de autenticação (401). Verifique o e-mail e o API Token.");
    }
    if (response.status === 400) {
      throw new JiraApiError(`JQL inválida ou requisição incorreta (400): ${await response.text()}`);
    }
    if (response.status >= 500) {
      log({ level: "warn", event: "jira.search.retry", data: { status: response.status, page } });
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }
    if (!response.ok) {
      throw new JiraApiError(`Erro ao consultar o Jira (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as JiraSearchResponse;
    const pageIssues = data.issues ?? [];
    issues.push(...pageIssues);

    nextPageToken = data.nextPageToken;
    if (!nextPageToken || pageIssues.length === 0) break;
    page += 1;
  }

  return issues;
}
