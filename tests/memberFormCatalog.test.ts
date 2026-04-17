import { describe, expect, it } from "vitest";
import {
  buildMemberFormCatalog,
  isPairAllowedInCatalog,
  shiftsAllowedForLevel,
} from "@/lib/memberFormCatalog";

describe("buildMemberFormCatalog", () => {
  it("retorna null sem níveis ou sem turnos", () => {
    expect(
      buildMemberFormCatalog({
        levels: [],
        shifts: [{ id: "s", label: "T1", sortOrder: 0 }],
        allowedPairs: [],
      }),
    ).toBeNull();
    expect(
      buildMemberFormCatalog({
        levels: [{ id: "l", label: "N1", sortOrder: 0 }],
        shifts: [],
        allowedPairs: [],
      }),
    ).toBeNull();
  });

  it("monta pares a partir da matriz e resolve turnos por nível", () => {
    const c = buildMemberFormCatalog({
      levels: [
        { id: "l1", label: "N1", sortOrder: 0 },
        { id: "l2", label: "N2", sortOrder: 1 },
      ],
      shifts: [
        { id: "s1", label: "T1", sortOrder: 0 },
        { id: "s2", label: "T2", sortOrder: 1 },
      ],
      allowedPairs: [
        { teamLevelId: "l1", teamShiftId: "s1" },
        { teamLevelId: "l1", teamShiftId: "s2" },
        { teamLevelId: "l2", teamShiftId: "s1" },
      ],
    });
    expect(c).not.toBeNull();
    if (!c) return;
    expect(c.levels).toEqual(["N1", "N2"]);
    expect(c.orderedShifts).toEqual(["T1", "T2"]);
    expect(isPairAllowedInCatalog(c, "N1", "T1")).toBe(true);
    expect(isPairAllowedInCatalog(c, "N1", "T2")).toBe(true);
    expect(isPairAllowedInCatalog(c, "N2", "T2")).toBe(false);
    expect(shiftsAllowedForLevel(c, "N1")).toEqual(["T1", "T2"]);
    expect(shiftsAllowedForLevel(c, "N2")).toEqual(["T1"]);
    expect(c.levelLabels.N1).toBe("N1");
    expect(c.shiftLabels.T1).toBe("T1");
  });

  it("retorna null quando há linhas mas nenhum label corresponde a enum de membro", () => {
    expect(
      buildMemberFormCatalog({
        levels: [{ id: "l1", label: "Nível custom", sortOrder: 0 }],
        shifts: [{ id: "s1", label: "T1", sortOrder: 0 }],
        allowedPairs: [],
      }),
    ).toBeNull();
  });

  it("aceita rótulo de exibição (ex.: Produção) alinhado a LEVEL_OPTIONS", () => {
    const c = buildMemberFormCatalog({
      levels: [
        { id: "l1", label: "N1", sortOrder: 0 },
        { id: "l2", label: "Produção", sortOrder: 1 },
      ],
      shifts: [{ id: "s1", label: "TC", sortOrder: 0 }],
      allowedPairs: [
        { teamLevelId: "l1", teamShiftId: "s1" },
        { teamLevelId: "l2", teamShiftId: "s1" },
      ],
    });
    expect(c).not.toBeNull();
    if (!c) return;
    expect(c.levels).toEqual(["N1", "PRODUCAO"]);
    expect(c.levelLabels.PRODUCAO).toBe("Produção");
    expect(isPairAllowedInCatalog(c, "PRODUCAO", "TC")).toBe(true);
  });
});
