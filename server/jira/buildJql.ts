import { FORNECEDOR_STATUS, ORDER_BY_FIXO } from "@/server/jira/constants";

export interface BuildJqlParams {
  projetos: string[];
  grupos: string[];
  statusConsiderar: string[];
}

export type BuildJqlResult = { success: true; jql: string } | { success: false; error: string };

const quoted = (values: string[]) => values.map((v) => `"${v}"`).join(", ");

/** Port de `_build_jql` (jira_gui.py:476-501). */
export function buildBaseJql({ projetos, grupos, statusConsiderar }: BuildJqlParams): BuildJqlResult {
  if (projetos.length === 0) return { success: false, error: "Selecione ao menos um projeto." };
  if (grupos.length === 0) return { success: false, error: "Selecione ao menos um Grupo Solucionador." };
  if (statusConsiderar.length === 0) return { success: false, error: "Selecione ao menos um status." };

  const parts = [
    `"Grupo Solucionador[Group Picker (single group)]" IN (${quoted(grupos)})`,
    `project IN (${quoted(projetos)})`,
    `status IN (${quoted(statusConsiderar)})`,
  ];

  return { success: true, jql: `${parts.join(" AND ")} ORDER BY ${ORDER_BY_FIXO}` };
}

/** Port de `_incluir_fornecedor` (jira_gui.py:503-505). */
export function incluiFornecedor(statusConsiderar: string[]): boolean {
  return statusConsiderar.includes(FORNECEDOR_STATUS);
}
