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
        shifts: [{ id: "s", label: "T1", color: "#3b82f6", sortOrder: 0 }],
        allowedPairs: [],
      }),
    ).toBeNull();
    expect(
      buildMemberFormCatalog({
        levels: [{ id: "l", label: "N1", color: "#22c55e", sortOrder: 0 }],
        shifts: [],
        allowedPairs: [],
      }),
    ).toBeNull();
  });

  it("monta pares a partir da matriz e resolve turnos por nível (IDs)", () => {
    const c = buildMemberFormCatalog({
      levels: [
        { id: "l1", label: "N1", color: "#22c55e", sortOrder: 0 },
        { id: "l2", label: "N2", color: "#16a34a", sortOrder: 1 },
      ],
      shifts: [
        { id: "s1", label: "T1", color: "#0ea5e9", sortOrder: 0 },
        { id: "s2", label: "T2", color: "#3b82f6", sortOrder: 1 },
      ],
      allowedPairs: [
        { teamLevelId: "l1", teamShiftId: "s1" },
        { teamLevelId: "l1", teamShiftId: "s2" },
        { teamLevelId: "l2", teamShiftId: "s1" },
      ],
    });
    expect(c).not.toBeNull();
    if (!c) return;
    expect(c.levels.map((l) => l.id)).toEqual(["l1", "l2"]);
    expect(c.shifts.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(isPairAllowedInCatalog(c, "l1", "s1")).toBe(true);
    expect(isPairAllowedInCatalog(c, "l1", "s2")).toBe(true);
    expect(isPairAllowedInCatalog(c, "l2", "s2")).toBe(false);
    expect(shiftsAllowedForLevel(c, "l1").map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(shiftsAllowedForLevel(c, "l2").map((s) => s.id)).toEqual(["s1"]);
  });

  it("inclui todos os níveis e turnos do catálogo", () => {
    const c = buildMemberFormCatalog({
      levels: [
        { id: "l1", label: "N1", color: "#22c55e", sortOrder: 0 },
        { id: "l2", label: "Operações", color: "#f59e0b", sortOrder: 1 },
      ],
      shifts: [
        { id: "s1", label: "T1", color: "#0ea5e9", sortOrder: 0 },
        { id: "s2", label: "Extra", color: "#a855f7", sortOrder: 1 },
      ],
      allowedPairs: [
        { teamLevelId: "l1", teamShiftId: "s1" },
        { teamLevelId: "l2", teamShiftId: "s2" },
      ],
    });
    expect(c).not.toBeNull();
    if (!c) return;
    expect(c.levels).toHaveLength(2);
    expect(c.shifts).toHaveLength(2);
    expect(isPairAllowedInCatalog(c, "l2", "s2")).toBe(true);
  });

  it("preserva o label customizado do catálogo", () => {
    const c = buildMemberFormCatalog({
      levels: [
        { id: "l1", label: "Suporte Junior", color: "#22c55e", sortOrder: 0 },
        { id: "l2", label: "Produção", color: "#14b8a6", sortOrder: 1 },
      ],
      shifts: [{ id: "s1", label: "Turno Comercial", color: "#64748b", sortOrder: 0 }],
      allowedPairs: [
        { teamLevelId: "l1", teamShiftId: "s1" },
        { teamLevelId: "l2", teamShiftId: "s1" },
      ],
    });
    expect(c).not.toBeNull();
    if (!c) return;
    expect(c.levels[0]!.label).toBe("Suporte Junior");
    expect(c.levels[1]!.label).toBe("Produção");
    expect(c.shifts[0]!.label).toBe("Turno Comercial");
    expect(isPairAllowedInCatalog(c, "l2", "s1")).toBe(true);
  });
});
