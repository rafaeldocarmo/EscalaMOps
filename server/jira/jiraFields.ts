import { FORNECEDOR_RESPONSAVEL_FIELDS } from "@/server/jira/constants";
import type { JiraIssue } from "@/server/jira/jiraClient";

export type JiraFieldMap = Record<string, unknown>;
export type FlatIssueRow = Record<string, unknown>;

/** Formato de retorno compartilhado pelas 3 buscas de `server/jira/fetch*.ts`. */
export type JiraRowsResult = { success: true; rows: FlatIssueRow[] } | { success: false; error: string };

/** Port de `_extract` (jira_extractor.py:169-173): lê um valor legível de campos aninhados. */
export function extractValue(fieldValue: unknown, key = "displayName"): unknown {
  if (fieldValue && typeof fieldValue === "object" && !Array.isArray(fieldValue)) {
    const dict = fieldValue as JiraFieldMap;
    return dict[key] ?? dict.name ?? dict.value ?? null;
  }
  return fieldValue ?? null;
}

/** Port de `flatten_issue` (jira_extractor.py:176-196). */
export function flattenIssue(issue: JiraIssue, fields: string[]): FlatIssueRow {
  const row: FlatIssueRow = { key: issue.key };
  const issueFields = issue.fields ?? {};

  for (const field of fields) {
    const value = issueFields[field];
    switch (field) {
      case "assignee":
      case "reporter":
        row[field] = extractValue(value, "displayName");
        break;
      case "status":
      case "priority":
      case "issuetype":
        row[field] = extractValue(value, "name");
        break;
      case "project":
        row[field] = extractValue(value, "key");
        break;
      default:
        row[field] = value;
    }
  }

  return row;
}

/** Port de `extract_fornecedor` (jira_extractor.py:246-252). */
export function extractFornecedor(issueFields: JiraFieldMap): string | null {
  for (const fieldId of FORNECEDOR_RESPONSAVEL_FIELDS) {
    const value = issueFields[fieldId];
    if (value) {
      return (extractValue(value, "value") as string | null) ?? null;
    }
  }
  return null;
}
