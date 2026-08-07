import { describe, expect, it } from "vitest";
import { buildBaseJql, incluiFornecedor } from "@/server/jira/buildJql";

describe("buildBaseJql", () => {
  it("monta a JQL combinando grupo, projeto e status com ORDER BY fixo", () => {
    const result = buildBaseJql({
      projetos: ["Central de Incidentes"],
      grupos: ["CLBR-TI-OPS-OGS SOLAR SALESFORCE"],
      statusConsiderar: ["Triagem", "Aberto"],
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.jql).toBe(
      '"Grupo Solucionador[Group Picker (single group)]" IN ("CLBR-TI-OPS-OGS SOLAR SALESFORCE") AND project IN ("Central de Incidentes") AND status IN ("Triagem", "Aberto") ORDER BY cf[10419] ASC'
    );
  });

  it("rejeita quando nenhum projeto foi selecionado", () => {
    const result = buildBaseJql({ projetos: [], grupos: ["g"], statusConsiderar: ["s"] });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");
    expect(result.error).toBe("Selecione ao menos um projeto.");
  });

  it("rejeita quando nenhum grupo foi selecionado", () => {
    const result = buildBaseJql({ projetos: ["p"], grupos: [], statusConsiderar: ["s"] });
    if (result.success) throw new Error("unreachable");
    expect(result.error).toBe("Selecione ao menos um Grupo Solucionador.");
  });

  it("rejeita quando nenhum status foi selecionado", () => {
    const result = buildBaseJql({ projetos: ["p"], grupos: ["g"], statusConsiderar: [] });
    if (result.success) throw new Error("unreachable");
    expect(result.error).toBe("Selecione ao menos um status.");
  });
});

describe("incluiFornecedor", () => {
  it("retorna true quando 'Aguardando Fornecedor' está entre os status considerados", () => {
    expect(incluiFornecedor(["Triagem", "Aguardando Fornecedor"])).toBe(true);
  });

  it("retorna false quando 'Aguardando Fornecedor' não está selecionado", () => {
    expect(incluiFornecedor(["Triagem", "Aberto"])).toBe(false);
  });
});
