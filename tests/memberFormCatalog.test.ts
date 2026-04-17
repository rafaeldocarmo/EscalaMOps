import { describe, expect, it } from "vitest";
import {
  buildMemberFormCatalog,
  isCustomLevel,
  isCustomShift,
  isPairAllowedInCatalog,
  shiftsAllowedForLevel,
} from "@/lib/memberFormCatalog";

describe("buildMemberFormCatalog", () => {
  it("retorna null sem níveis ou sem turnos", () => {
    expect(
      buildMemberFormCatalog({
        levels: [],
        shifts: [{ id: "s", label: "T1", legacyKind: "T1", sortOrder: 0 }],
        allowedPairs: [],
      }),
    ).toBeNull();
    expect(
      buildMemberFormCatalog({
        levels: [{ id: "l", label: "N1", legacyKind: "N1", sortOrder: 0 }],
        shifts: [],
        allowedPairs: [],
      }),
    ).toBeNull();
  });

  it("monta pares a partir da matriz e resolve turnos por nível (IDs)", () => {
    const c = buildMemberFormCatalog({
      levels: [
        { id: "l1", label: "N1", legacyKind: "N1", sortOrder: 0 },
        { id: "l2", label: "N2", legacyKind: "N2", sortOrder: 1 },
      ],
      shifts: [
        { id: "s1", label: "T1", legacyKind: "T1", sortOrder: 0 },
        { id: "s2", label: "T2", legacyKind: "T2", sortOrder: 1 },
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

  it("inclui níveis e turnos personalizados (legacyKind=null) no catálogo", () => {
    const c = buildMemberFormCatalog({
      levels: [
        { id: "l1", label: "N1", legacyKind: "N1", sortOrder: 0 },
        { id: "l2", label: "Operações", legacyKind: null, sortOrder: 1 },
      ],
      shifts: [
        { id: "s1", label: "T1", legacyKind: "T1", sortOrder: 0 },
        { id: "s2", label: "Extra", legacyKind: null, sortOrder: 1 },
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
    expect(isCustomLevel(c.levels[1]!)).toBe(true);
    expect(isCustomShift(c.shifts[1]!)).toBe(true);
    expect(isCustomLevel(c.levels[0]!)).toBe(false);
    expect(isPairAllowedInCatalog(c, "l2", "s2")).toBe(true);
  });

  it("preserva o label customizado do catálogo", () => {
    const c = buildMemberFormCatalog({
      levels: [
        { id: "l1", label: "Suporte Junior", legacyKind: "N1", sortOrder: 0 },
        { id: "l2", label: "Produção", legacyKind: "PRODUCAO", sortOrder: 1 },
      ],
      shifts: [{ id: "s1", label: "Turno Comercial", legacyKind: "TC", sortOrder: 0 }],
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
