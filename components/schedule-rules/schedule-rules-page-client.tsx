"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ScheduleRulesData } from "@/server/scheduleRules/getScheduleRulesForTeam";
import { upsertScheduleRule } from "@/server/scheduleRules/upsertScheduleRule";
import { resetScheduleRulesToDefaults } from "@/server/scheduleRules/resetScheduleRulesToDefaults";
import { SchedulePreviewDialog } from "./schedule-preview-dialog";

type RuleKindValue = "WEEKEND_COVERAGE" | "COMPENSATION_PATTERN";

interface WeekendCoverageParams {
  count: number;
}
interface CompensationPatternEntry {
  dayBefore: number;
  dayAfter: number;
}
interface CompensationPatternParams {
  patterns: CompensationPatternEntry[];
}

interface ScheduleRulesPageClientProps {
  initialData: ScheduleRulesData;
}

const WEEKDAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
];

function cellKey(shiftId: string, levelId: string) {
  return `${shiftId}|${levelId}`;
}

function contrastTextColor(hex: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "#0f172a" : "#ffffff";
}

function catalogColor(hex: string | undefined): string {
  return hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#64748b";
}

function shiftCircleLabel(label: string): string {
  const t = label.trim();
  if (t.length <= 4) return t;
  return `${t.slice(0, 3)}…`;
}

function ShiftColumnHeader({
  label,
  color,
  total,
  totalLabel = "Total",
}: {
  label: string;
  color: string;
  total?: number;
  totalLabel?: string;
}) {
  const bg = catalogColor(color);
  return (
    <div className="flex flex-col items-center gap-1 px-1 py-2 text-center">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold leading-none"
        style={{ backgroundColor: bg, color: contrastTextColor(bg) }}
        title={label}
      >
        {shiftCircleLabel(label)}
      </span>
      <span className="line-clamp-2 min-h-9 max-w-[7rem] text-sm font-medium leading-tight text-foreground">
        {label}
      </span>
      {total !== undefined ? (
        <span className="text-xs tabular-nums text-muted-foreground">
          {totalLabel}: {total}
        </span>
      ) : null}
    </div>
  );
}

function LevelRowHeader({ label, color, rowTotal }: { label: string; color: string; rowTotal?: number }) {
  const bar = catalogColor(color);
  return (
    <div className="flex min-h-[4.5rem] items-stretch gap-3">
      <span className="w-1.5 shrink-0 rounded-full" style={{ backgroundColor: bar }} aria-hidden />
      <div className="flex min-w-0 flex-col justify-center py-1">
        <span className="font-semibold text-foreground">{label}</span>
        {rowTotal !== undefined ? (
          <span className="text-xs tabular-nums text-muted-foreground">Total: {rowTotal}</span>
        ) : null}
      </div>
    </div>
  );
}

function WeekendCoverageCell({
  count,
  disabled,
  onDec,
  onInc,
}: {
  count: number;
  disabled: boolean;
  onDec: () => void;
  onInc: () => void;
}) {
  const active = count > 0;
  return (
    <div
      className={cn(
        "rounded-xl border px-2 py-3 text-center transition-colors",
        active
          ? "border-sky-300/90 bg-sky-50/95 shadow-sm dark:border-sky-700/60 dark:bg-sky-950/35"
          : "border-border/50 bg-card",
      )}
    >
      <div
        className={cn(
          "text-3xl font-semibold tabular-nums",
          active ? "text-foreground" : "text-muted-foreground/80",
        )}
      >
        {count}
      </div>
      <div
        className={cn("text-xs", active ? "text-muted-foreground" : "text-muted-foreground/70")}
      >
        pessoas
      </div>
      <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-md border border-border/60">
        <button
          type="button"
          className={cn(
            "h-10 cursor-pointer text-sm font-semibold transition-colors border",
            active
              ? "bg-background text-foreground hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
              : "bg-muted/30 text-muted-foreground/60 hover:bg-muted/50",
          )}
          disabled={disabled || count <= 0}
          onClick={onDec}
        >
          −
        </button>
        <button
          type="button"
          className={cn(
            "h-10 cursor-pointer text-sm font-semibold transition-colors border",
            active
              ? "bg-background text-foreground hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
              : "bg-muted/30 text-muted-foreground/60 hover:bg-muted/50",
          )}
          disabled={disabled}
          onClick={onInc}
        >
          +
        </button>
      </div>
    </div>
  );
}

function findRule<T>(
  rules: ScheduleRulesData["rules"],
  kind: RuleKindValue,
  shiftId: string,
  levelId: string
): { id: string; params: T; enabled: boolean } | null {
  const found = rules.find(
    (r) =>
      r.kind === kind &&
      r.teamShiftId === shiftId &&
      r.teamLevelId === levelId
  );
  if (!found) return null;
  return { id: found.id, params: found.params as T, enabled: found.enabled };
}

function parseCount(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeCompensationPatterns(
  raw: CompensationPatternEntry[] | undefined,
  n: number,
): CompensationPatternEntry[] {
  const src = Array.isArray(raw) && raw.length ? raw : [];
  const def: CompensationPatternEntry = { dayBefore: 4, dayAfter: 3 };
  const out: CompensationPatternEntry[] = [];
  for (let i = 0; i < n; i++) {
    const p = src[i];
    out.push(
      p && typeof p.dayBefore === "number" && typeof p.dayAfter === "number"
        ? { dayBefore: p.dayBefore, dayAfter: p.dayAfter }
        : { ...def },
    );
  }
  return out;
}

function buildWeekendDraftMap(
  rules: ScheduleRulesData["rules"],
  levels: { id: string }[],
  shifts: { id: string }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of levels) {
    for (const s of shifts) {
      const k = cellKey(s.id, l.id);
      const r = findRule<WeekendCoverageParams>(rules, "WEEKEND_COVERAGE", s.id, l.id);
      out[k] = parseCount(r?.params?.count);
    }
  }
  return out;
}

function weekendMapsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  }
  return true;
}

function compensationPatternsEqual(
  a: CompensationPatternEntry[] | undefined,
  b: CompensationPatternEntry[] | undefined,
): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    const x = aa[i]!;
    const y = bb[i]!;
    if (x.dayBefore !== y.dayBefore) return false;
    if (x.dayAfter !== y.dayAfter) return false;
  }
  return true;
}

function compensationMapsEqual(
  a: Record<string, CompensationPatternEntry[]>,
  b: Record<string, CompensationPatternEntry[]>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (!compensationPatternsEqual(a[k], b[k])) return false;
  }
  return true;
}

export function ScheduleRulesPageClient({ initialData }: ScheduleRulesPageClientProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const refresh = useCallback(() => router.refresh(), [router]);

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const levels = useMemo(
    () => [...data.levels].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
    [data.levels]
  );
  const shifts = useMemo(
    () => [...data.shifts].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
    [data.shifts]
  );

  const weekendServerMap = useMemo(
    () => buildWeekendDraftMap(data.rules, levels, shifts),
    [data.rules, levels, shifts],
  );

  const [weekendDraft, setWeekendDraft] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    setWeekendDraft(weekendServerMap);
  }, [weekendServerMap]);

  const weekendEffective = weekendDraft ?? weekendServerMap;

  const isWeekendDirty = useMemo(
    () => !weekendMapsEqual(weekendEffective, weekendServerMap),
    [weekendEffective, weekendServerMap],
  );

  const weekendColumnTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of shifts) {
      let t = 0;
      for (const l of levels) {
        t += weekendEffective[cellKey(s.id, l.id)] ?? 0;
      }
      map.set(s.id, t);
    }
    return map;
  }, [weekendEffective, levels, shifts]);

  const weekendRowTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of levels) {
      let t = 0;
      for (const s of shifts) {
        t += weekendEffective[cellKey(s.id, l.id)] ?? 0;
      }
      map.set(l.id, t);
    }
    return map;
  }, [weekendEffective, levels, shifts]);

  const memberCounts = useMemo(
    () => data.memberCountByLevelShift ?? {},
    [data.memberCountByLevelShift],
  );

  // Na compensação, o número de "pessoas" exibidas segue a regra de cobertura (WEEKEND_COVERAGE)
  // já salva no banco (weekendServerMap). Ainda filtramos por pares que tenham ao menos 1 membro cadastrado.
  const compensationPeopleByCell = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, members] of Object.entries(memberCounts)) {
      if (members <= 0) continue;
      const weekend = weekendServerMap[k] ?? 0;
      if (weekend > 0) out[k] = weekend;
    }
    return out;
  }, [memberCounts, weekendServerMap]);

  const { compLevels, compShifts } = useMemo(() => {
    const levelIds = new Set<string>();
    const shiftIds = new Set<string>();
    for (const [k, c] of Object.entries(compensationPeopleByCell)) {
      if (c <= 0) continue;
      const bar = k.indexOf("|");
      if (bar <= 0) continue;
      const shiftId = k.slice(0, bar);
      const levelId = k.slice(bar + 1);
      if (shiftId && levelId) {
        shiftIds.add(shiftId);
        levelIds.add(levelId);
      }
    }
    return {
      compLevels: levels.filter((l) => levelIds.has(l.id)),
      compShifts: shifts.filter((s) => shiftIds.has(s.id)),
    };
  }, [compensationPeopleByCell, levels, shifts]);

  const compensationServerMap = useMemo(() => {
    const out: Record<string, CompensationPatternEntry[]> = {};
    for (const l of compLevels) {
      for (const s of compShifts) {
        const k = cellKey(s.id, l.id);
        const peopleHere = compensationPeopleByCell[k] ?? 0;
        if (peopleHere <= 0) continue;
        const rule = findRule<CompensationPatternParams>(data.rules, "COMPENSATION_PATTERN", s.id, l.id);
        out[k] = normalizeCompensationPatterns(
          (rule?.params as CompensationPatternParams | undefined)?.patterns,
          peopleHere,
        );
      }
    }
    return out;
  }, [compLevels, compShifts, compensationPeopleByCell, data.rules]);

  const [compensationDraft, setCompensationDraft] = useState<
    Record<string, CompensationPatternEntry[]> | null
  >(null);

  useEffect(() => {
    setCompensationDraft(compensationServerMap);
  }, [compensationServerMap]);

  const compensationEffective = compensationDraft ?? compensationServerMap;

  const isCompensationDirty = useMemo(
    () => !compensationMapsEqual(compensationEffective, compensationServerMap),
    [compensationEffective, compensationServerMap],
  );

  const compColumnPeopleTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of compShifts) {
      let t = 0;
      for (const l of compLevels) {
        t += compensationPeopleByCell[cellKey(s.id, l.id)] ?? 0;
      }
      map.set(s.id, t);
    }
    return map;
  }, [compensationPeopleByCell, compLevels, compShifts]);

  const compRowPeopleTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of compLevels) {
      let t = 0;
      for (const s of compShifts) {
        t += compensationPeopleByCell[cellKey(s.id, l.id)] ?? 0;
      }
      map.set(l.id, t);
    }
    return map;
  }, [compensationPeopleByCell, compLevels, compShifts]);

  const discardCompensationDraft = useCallback(() => {
    setCompensationDraft(compensationServerMap);
  }, [compensationServerMap]);

  const saveWeekendCoverage = useCallback(async () => {
    const toSave = weekendDraft ?? weekendServerMap;
    setSaving(true);
    try {
      for (const l of levels) {
        for (const s of shifts) {
          const k = cellKey(s.id, l.id);
          const next = toSave[k] ?? 0;
          const prev = weekendServerMap[k] ?? 0;
          if (next === prev) continue;
          const result = await upsertScheduleRule({
            teamId: data.teamId,
            teamShiftId: s.id,
            teamLevelId: l.id,
            kind: "WEEKEND_COVERAGE",
            params: { count: next },
          });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
        }
      }
      toast.success("Cobertura de fim de semana salva.");
      refresh();
    } finally {
      setSaving(false);
    }
  }, [data.teamId, weekendDraft, weekendServerMap, levels, shifts, refresh]);

  const discardWeekendDraft = useCallback(() => {
    setWeekendDraft({ ...weekendServerMap });
  }, [weekendServerMap]);

  const adjustWeekendCount = useCallback(
    (shiftId: string, levelId: string, delta: number) => {
      const k = cellKey(shiftId, levelId);
      setWeekendDraft((prev) => {
        const base = { ...(prev ?? weekendServerMap) };
        const cur = base[k] ?? 0;
        base[k] = Math.max(0, cur + delta);
        return base;
      });
    },
    [weekendServerMap],
  );

  const saveCompensation = useCallback(async () => {
    const toSave = compensationDraft ?? compensationServerMap;
    setSaving(true);
    try {
      for (const l of compLevels) {
        for (const s of compShifts) {
          const k = cellKey(s.id, l.id);
          const peopleHere = compensationPeopleByCell[k] ?? 0;
          if (peopleHere <= 0) continue;

          const next = normalizeCompensationPatterns(toSave[k], peopleHere);
          const prev = normalizeCompensationPatterns(compensationServerMap[k], peopleHere);
          if (compensationPatternsEqual(next, prev)) continue;

          const result = await upsertScheduleRule({
            teamId: data.teamId,
            teamShiftId: s.id,
            teamLevelId: l.id,
            kind: "COMPENSATION_PATTERN",
            params: { patterns: next },
          });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
        }
      }
      toast.success("Compensação salva.");
      refresh();
    } finally {
      setSaving(false);
    }
  }, [
    compLevels,
    compShifts,
    compensationDraft,
    compensationPeopleByCell,
    compensationServerMap,
    data.teamId,
    refresh,
  ]);

  const handleReset = useCallback(async () => {
    setResetting(true);
    try {
      const result = await resetScheduleRulesToDefaults({ teamId: data.teamId });
      if (result.success) {
        toast.success(
          `Criadas ${result.data.createdWeekendCoverage} de cobertura e ${result.data.createdCompensation} de compensação.`
        );
        refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setResetting(false);
    }
  }, [data.teamId, refresh]);

  if (levels.length === 0 || shifts.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Regras de escala</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure quantas pessoas de cada grupo (turno × nível) trabalham no fim de semana e
            os dias usados para compensação.
          </p>
        </div>
        <Card className="rounded-xl border border-border/60 shadow-sm">
          <CardContent className="px-4 py-6 text-sm text-muted-foreground">
            Cadastre níveis e turnos da equipe em{" "}
            <a href="/dashboard/equipes/catalog" className="underline">
              Níveis e turnos
            </a>{" "}
            antes de configurar as regras.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Regras de escala</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure quantas pessoas de cada grupo (turno × nível) trabalham no fim de semana e
            os dias usados para compensação.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-0">
          <SchedulePreviewDialog teamId={data.teamId} />
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => void handleReset()}
            disabled={resetting}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {resetting ? "Restaurando…" : "Restaurar padrões"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="weekend">
        <TabsList className="inline-flex h-auto flex-wrap gap-1 rounded-full border border-border/60 bg-muted/40 p-1">
          <TabsTrigger
            value="weekend"
            className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Fim de Semana
          </TabsTrigger>
          <TabsTrigger
            value="compensation"
            className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Compensação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekend" className="mt-4">
          <Card className="rounded-xl border border-border/60 shadow-sm">
            <CardHeader className="space-y-4 border-b border-border/50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">
                    Cobertura de Fim de Semana
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm text-muted-foreground">
                    Ajuste as quantidades com + e −. As alterações só são gravadas quando você clicar em{" "}
                    <span className="font-medium text-foreground">Salvar</span>.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={!isWeekendDirty || saving}
                    onClick={() => discardWeekendDraft()}
                  >
                    Descartar
                  </Button>
                  <Button
                    type="button"
                    className="cursor-pointer"
                    disabled={!isWeekendDirty || saving}
                    onClick={() => void saveWeekendCoverage()}
                  >
                    {saving ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="overflow-x-auto">
                <div
                  className="rounded-xl border border-border/60 bg-background"
                  style={{ minWidth: `${200 + shifts.length * 150}px` }}
                >
                  <div
                    className="grid items-stretch gap-0 border-b border-border/60"
                    style={{
                      gridTemplateColumns: `minmax(160px, 200px) repeat(${shifts.length}, minmax(130px, 1fr))`,
                    }}
                  >
                    <div className="px-3 py-3" />
                    {shifts.map((s) => (
                      <div key={s.id} className="border-l border-border/40 px-1 py-2 first:border-l-0 sm:first:border-l">
                        <ShiftColumnHeader
                          label={s.label}
                          color={s.color}
                          total={weekendColumnTotals.get(s.id) ?? 0}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="divide-y divide-border/60">
                    {levels.map((l) => (
                      <div
                        key={l.id}
                        className="grid items-stretch gap-0"
                        style={{
                          gridTemplateColumns: `minmax(160px, 200px) repeat(${shifts.length}, minmax(130px, 1fr))`,
                        }}
                      >
                        <div className="flex items-center px-3 py-3">
                          <LevelRowHeader
                            label={l.label}
                            color={l.color}
                            rowTotal={weekendRowTotals.get(l.id) ?? 0}
                          />
                        </div>
                        {shifts.map((s) => {
                          const count = weekendEffective[cellKey(s.id, l.id)] ?? 0;
                          const disabled = saving;
                          return (
                            <div
                              key={cellKey(s.id, l.id)}
                              className="border-l border-border/40 p-2 first:border-l-0 sm:first:border-l"
                            >
                              <WeekendCoverageCell
                                count={count}
                                disabled={disabled}
                                onDec={() => adjustWeekendCount(s.id, l.id, -1)}
                                onInc={() => adjustWeekendCount(s.id, l.id, 1)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compensation" className="mt-4">
          <Card className="rounded-xl border border-border/60 shadow-sm">
            <CardHeader className="space-y-4 border-b border-border/50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">Dias de compensação</CardTitle>
                  <CardDescription className="mt-1 text-sm text-muted-foreground">
                    Ajuste os dias de antes/depois. As alterações só são gravadas quando você clicar em{" "}
                    <span className="font-medium text-foreground">Salvar</span>.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={!isCompensationDirty || saving}
                    onClick={() => discardCompensationDraft()}
                  >
                    Descartar
                  </Button>
                  <Button
                    type="button"
                    className="cursor-pointer"
                    disabled={!isCompensationDirty || saving}
                    onClick={() => void saveCompensation()}
                  >
                    {saving ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {compLevels.length === 0 || compShifts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Não há combinação nível × turno com membros. Cadastre membros na equipe; a grade de compensação
                  aparece após o cadastro.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <div
                    className="rounded-xl border border-border/60 bg-background"
                    style={{ minWidth: `${200 + compShifts.length * 200}px` }}
                  >
                    <div
                      className="grid items-stretch gap-0 border-b border-border/60"
                      style={{
                        gridTemplateColumns: `minmax(160px, 200px) repeat(${compShifts.length}, minmax(180px, 1fr))`,
                      }}
                    >
                      <div className="px-3 py-3" />
                      {compShifts.map((s) => (
                        <div
                          key={s.id}
                          className="border-l border-border/40 px-1 py-2 first:border-l-0 sm:first:border-l"
                        >
                          <ShiftColumnHeader
                            label={s.label}
                            color={s.color}
                            total={compColumnPeopleTotals.get(s.id) ?? 0}
                            totalLabel="Pessoas"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="divide-y divide-border/60">
                      {compLevels.map((l) => (
                        <div
                          key={l.id}
                          className="grid items-stretch gap-0"
                          style={{
                            gridTemplateColumns: `minmax(160px, 200px) repeat(${compShifts.length}, minmax(180px, 1fr))`,
                          }}
                        >
                          <div className="flex items-center px-3 py-3">
                            <LevelRowHeader
                              label={l.label}
                              color={l.color}
                              rowTotal={compRowPeopleTotals.get(l.id) ?? 0}
                            />
                          </div>
                          {compShifts.map((s) => {
                            const k = cellKey(s.id, l.id);
                            const peopleHere = compensationPeopleByCell[k] ?? 0;
                            const patterns = normalizeCompensationPatterns(compensationEffective[k], peopleHere);
                            const persisted = compensationServerMap[k] != null;
                            const disabled = saving;
                            if (peopleHere === 0) {
                              return (
                                <div
                                  key={k}
                                  className="border-l border-border/40 p-2 text-center first:border-l-0 sm:first:border-l"
                                >
                                  <span className="text-sm text-muted-foreground">—</span>
                                </div>
                              );
                            }
                            return (
                              <div
                                key={k}
                                className="border-l border-border/40 p-2 first:border-l-0 sm:first:border-l"
                              >
                                <div
                                  className={cn(
                                    "rounded-xl border px-2 py-2",
                                    persisted
                                      ? "border-sky-300/90 bg-sky-50/95 shadow-sm dark:border-sky-700/60 dark:bg-sky-950/35"
                                      : "border-border/50 bg-card",
                                  )}
                                >
                                  <div className="space-y-2">
                                    {patterns.map((p, idx) => (
                                      <div
                                        key={idx}
                                        className="flex flex-wrap items-end gap-2 rounded-lg border border-border/50 bg-background/90 p-2"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                            Antes
                                          </div>
                                          <select
                                            className="mt-0.5 h-9 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-sm shadow-sm"
                                            value={String(p.dayBefore)}
                                            disabled={disabled}
                                            onChange={(e) => {
                                              const v = Number(e.target.value);
                                              setCompensationDraft((prev) => {
                                                const base = { ...(prev ?? compensationServerMap) };
                                                const cur = normalizeCompensationPatterns(base[k], peopleHere);
                                                base[k] = cur.map((row, i) =>
                                                  i === idx ? { ...row, dayBefore: v } : row,
                                                );
                                                return base;
                                              });
                                            }}
                                          >
                                            {WEEKDAY_LABELS.map((w) => (
                                              <option key={w.value} value={w.value}>
                                                {w.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                            Depois
                                          </div>
                                          <select
                                            className="mt-0.5 h-9 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-sm shadow-sm"
                                            value={String(p.dayAfter)}
                                            disabled={disabled}
                                            onChange={(e) => {
                                              const v = Number(e.target.value);
                                              setCompensationDraft((prev) => {
                                                const base = { ...(prev ?? compensationServerMap) };
                                                const cur = normalizeCompensationPatterns(base[k], peopleHere);
                                                base[k] = cur.map((row, i) =>
                                                  i === idx ? { ...row, dayAfter: v } : row,
                                                );
                                                return base;
                                              });
                                            }}
                                          >
                                            {WEEKDAY_LABELS.map((w) => (
                                              <option key={w.value} value={w.value}>
                                                {w.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
