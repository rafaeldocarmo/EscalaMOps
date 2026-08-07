import { describe, expect, it } from "vitest";
import { extractSlaBreach } from "@/server/jira/slaBreach";

describe("extractSlaBreach", () => {
  it("usa o ongoingCycle quando presente", () => {
    const result = extractSlaBreach({
      customfield_10419: {
        name: "Tempo de Resolução",
        ongoingCycle: { breachTime: { iso8601: "2026-08-10T13:00:00-03:00" }, breached: false },
      },
    });

    expect(result.campo).toBe("Tempo de Resolução");
    expect(result.breached).toBe(false);
    expect(result.breachDate?.toISOString()).toBe("2026-08-10T16:00:00.000Z");
  });

  it("cai para o completedCycles mais recente quando não há ongoingCycle", () => {
    const result = extractSlaBreach({
      customfield_10419: {
        name: "Tempo de Resolução",
        completedCycles: [
          { breachTime: { iso8601: "2026-08-01T10:00:00-03:00" }, breached: true },
          { breachTime: { iso8601: "2026-08-02T10:00:00-03:00" }, breached: true },
        ],
      },
    });

    expect(result.breachDate?.toISOString()).toBe("2026-08-02T13:00:00.000Z");
    expect(result.breached).toBe(true);
  });

  it("tenta o segundo campo de SLA quando o primeiro está ausente", () => {
    const result = extractSlaBreach({
      customfield_10629: {
        name: "Tempo de Resolução INC",
        ongoingCycle: { breachTime: { iso8601: "2026-08-05T09:00:00-03:00" }, breached: false },
      },
    });

    expect(result.campo).toBe("Tempo de Resolução INC");
  });

  it("retorna tudo nulo quando nenhum campo de SLA está preenchido", () => {
    const result = extractSlaBreach({});
    expect(result).toEqual({ campo: null, breachDate: null, breached: null });
  });

  it("ignora um ciclo sem breachTime", () => {
    const result = extractSlaBreach({
      customfield_10419: { name: "x", ongoingCycle: {} },
    });
    expect(result).toEqual({ campo: null, breachDate: null, breached: null });
  });
});
