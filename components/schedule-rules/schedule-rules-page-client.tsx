"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScheduleRulesData } from "@/server/scheduleRules/getScheduleRulesForTeam";
import { upsertScheduleRule } from "@/server/scheduleRules/upsertScheduleRule";
import { deleteScheduleRule } from "@/server/scheduleRules/deleteScheduleRule";
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

export function ScheduleRulesPageClient({ initialData }: ScheduleRulesPageClientProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const refresh = useCallback(() => router.refresh(), [router]);

  const [coverageDialog, setCoverageDialog] = useState<
    | { open: false }
    | { open: true; shiftId: string; shiftLabel: string; levelId: string; levelLabel: string; currentCount: number; existingId: string | null }
  >({ open: false });

  const [compensationDialog, setCompensationDialog] = useState<
    | { open: false }
    | { open: true; shiftId: string; shiftLabel: string; levelId: string; levelLabel: string; patterns: CompensationPatternEntry[]; existingId: string | null }
  >({ open: false });

  const [deleteState, setDeleteState] = useState<{ id: string; label: string } | null>(null);
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

  const openCoverageEditor = useCallback(
    (shiftId: string, shiftLabel: string, levelId: string, levelLabel: string) => {
      const rule = findRule<WeekendCoverageParams>(
        data.rules,
        "WEEKEND_COVERAGE",
        shiftId,
        levelId
      );
      setCoverageDialog({
        open: true,
        shiftId,
        shiftLabel,
        levelId,
        levelLabel,
        currentCount: rule?.params.count ?? 0,
        existingId: rule?.id ?? null,
      });
    },
    [data.rules]
  );

  const openCompensationEditor = useCallback(
    (shiftId: string, shiftLabel: string, levelId: string, levelLabel: string) => {
      const rule = findRule<CompensationPatternParams>(
        data.rules,
        "COMPENSATION_PATTERN",
        shiftId,
        levelId
      );
      const base: CompensationPatternEntry[] = rule?.params.patterns ?? [];
      setCompensationDialog({
        open: true,
        shiftId,
        shiftLabel,
        levelId,
        levelLabel,
        patterns: base.length > 0 ? base.map((p) => ({ ...p })) : [{ dayBefore: 4, dayAfter: 3 }],
        existingId: rule?.id ?? null,
      });
    },
    [data.rules]
  );

  const saveCoverage = useCallback(
    async (input: {
      shiftId: string;
      levelId: string;
      count: number;
      existingId: string | null;
    }) => {
      setSaving(true);
      try {
        const result = await upsertScheduleRule({
          teamId: data.teamId,
          teamShiftId: input.shiftId,
          teamLevelId: input.levelId,
          kind: "WEEKEND_COVERAGE",
          params: { count: input.count },
        });
        if (result.success) {
          toast.success("Cobertura salva.");
          setCoverageDialog({ open: false });
          refresh();
        } else {
          toast.error(result.error);
        }
      } finally {
        setSaving(false);
      }
    },
    [data.teamId, refresh]
  );

  const saveCompensation = useCallback(
    async (input: {
      shiftId: string;
      levelId: string;
      patterns: CompensationPatternEntry[];
    }) => {
      setSaving(true);
      try {
        const result = await upsertScheduleRule({
          teamId: data.teamId,
          teamShiftId: input.shiftId,
          teamLevelId: input.levelId,
          kind: "COMPENSATION_PATTERN",
          params: { patterns: input.patterns },
        });
        if (result.success) {
          toast.success("Padrão de compensação salvo.");
          setCompensationDialog({ open: false });
          refresh();
        } else {
          toast.error(result.error);
        }
      } finally {
        setSaving(false);
      }
    },
    [data.teamId, refresh]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteState) return;
    setSaving(true);
    try {
      const result = await deleteScheduleRule({ id: deleteState.id });
      if (result.success) {
        toast.success("Regra removida.");
        setDeleteState(null);
        refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setSaving(false);
    }
  }, [deleteState, refresh]);

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
        <TabsList>
          <TabsTrigger value="weekend">Cobertura de fim de semana</TabsTrigger>
          <TabsTrigger value="compensation">Compensação de folga</TabsTrigger>
        </TabsList>

        <TabsContent value="weekend" className="mt-4">
          <Card className="rounded-xl border border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-lg font-bold text-foreground">
                Quantas pessoas trabalham no fim de semana
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Cada célula indica quantas pessoas do grupo (turno × nível) entram no rodízio de
                sábado+domingo. Valor 0 significa que o grupo sempre folga no fim de semana.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Turno</TableHead>
                      {levels.map((l) => (
                        <TableHead key={l.id} className="text-center">
                          {l.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.label}</TableCell>
                        {levels.map((l) => {
                          const rule = findRule<WeekendCoverageParams>(
                            data.rules,
                            "WEEKEND_COVERAGE",
                            s.id,
                            l.id
                          );
                          const count = rule?.params.count;
                          return (
                            <TableCell key={cellKey(s.id, l.id)} className="text-center">
                              <button
                                type="button"
                                onClick={() => openCoverageEditor(s.id, s.label, l.id, l.label)}
                                className="inline-flex h-9 min-w-[3rem] items-center justify-center rounded-md border border-border/60 bg-background px-3 text-sm font-medium text-foreground hover:bg-muted cursor-pointer"
                              >
                                {count === undefined ? "—" : count}
                              </button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compensation" className="mt-4">
          <Card className="rounded-xl border border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-lg font-bold text-foreground">
                Dias de compensação
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Quem trabalha no fim de semana ganha 1 folga na semana anterior e 1 na semana
                posterior. Configure quais dias úteis são usados. Para grupos com mais de 1 pessoa,
                cada padrão é usado por uma pessoa diferente (na ordem estável do grupo).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Turno</TableHead>
                      {levels.map((l) => (
                        <TableHead key={l.id} className="text-center">
                          {l.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.label}</TableCell>
                        {levels.map((l) => {
                          const rule = findRule<CompensationPatternParams>(
                            data.rules,
                            "COMPENSATION_PATTERN",
                            s.id,
                            l.id
                          );
                          const patterns = rule?.params.patterns ?? null;
                          const ruleId = rule?.id ?? null;
                          const summary =
                            patterns && patterns.length > 0
                              ? patterns
                                  .map(
                                    (p) =>
                                      `${WEEKDAY_LABELS.find((w) => w.value === p.dayBefore)?.label ?? "?"}→${
                                        WEEKDAY_LABELS.find((w) => w.value === p.dayAfter)?.label ?? "?"
                                      }`
                                  )
                                  .join(", ")
                              : "—";
                          return (
                            <TableCell key={cellKey(s.id, l.id)} className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openCompensationEditor(s.id, s.label, l.id, l.label)
                                  }
                                  className="inline-flex h-9 min-w-[6rem] items-center justify-center rounded-md border border-border/60 bg-background px-3 text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
                                  title="Editar padrão"
                                >
                                  <Pencil className="mr-1 h-3 w-3" />
                                  {summary}
                                </button>
                                {ruleId ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
                                    onClick={() =>
                                      setDeleteState({
                                        id: ruleId,
                                        label: `compensação ${s.label} · ${l.label}`,
                                      })
                                    }
                                    aria-label="Remover"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CoverageDialog
        key={
          coverageDialog.open
            ? `cov-${coverageDialog.shiftId}-${coverageDialog.levelId}-${coverageDialog.currentCount}`
            : "cov-closed"
        }
        state={coverageDialog}
        onClose={() => setCoverageDialog({ open: false })}
        onSave={saveCoverage}
        saving={saving}
      />

      <CompensationDialog
        state={compensationDialog}
        onChangeState={setCompensationDialog}
        onClose={() => setCompensationDialog({ open: false })}
        onSave={saveCompensation}
        saving={saving}
      />

      <AlertDialog open={!!deleteState} onOpenChange={(open) => !open && setDeleteState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover regra</AlertDialogTitle>
            <AlertDialogDescription>
              Ao remover, esse grupo deixa de ter {deleteState?.label ?? "a regra"} configurada e
              passa a usar o default do escopo pai. Você pode recriá-la depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={saving}
            >
              {saving ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CoverageDialog({
  state,
  onClose,
  onSave,
  saving,
}: {
  state:
    | { open: false }
    | { open: true; shiftId: string; shiftLabel: string; levelId: string; levelLabel: string; currentCount: number; existingId: string | null };
  onClose: () => void;
  onSave: (input: { shiftId: string; levelId: string; count: number; existingId: string | null }) => Promise<void>;
  saving: boolean;
}) {
  const [value, setValue] = useState(() =>
    state.open ? String(state.currentCount ?? 0) : "0",
  );

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Cobertura — {state.open ? state.shiftLabel : ""} · {state.open ? state.levelLabel : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="coverage-count">Pessoas no FDS</Label>
          <Input
            id="coverage-count"
            type="number"
            min={0}
            max={20}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Use 0 para que o grupo sempre folgue no fim de semana.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving || !state.open}
            className="cursor-pointer"
            onClick={() => {
              if (!state.open) return;
              const count = parseCount(value);
              void onSave({
                shiftId: state.shiftId,
                levelId: state.levelId,
                count,
                existingId: state.existingId,
              });
            }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type CompensationState =
  | { open: false }
  | {
      open: true;
      shiftId: string;
      shiftLabel: string;
      levelId: string;
      levelLabel: string;
      patterns: CompensationPatternEntry[];
      existingId: string | null;
    };

function CompensationDialog({
  state,
  onChangeState,
  onClose,
  onSave,
  saving,
}: {
  state: CompensationState;
  onChangeState: (updater: (s: CompensationState) => CompensationState) => void;
  onClose: () => void;
  onSave: (input: {
    shiftId: string;
    levelId: string;
    patterns: CompensationPatternEntry[];
  }) => Promise<void>;
  saving: boolean;
}) {
  if (!state.open) {
    return (
      <Dialog open={false} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg" />
      </Dialog>
    );
  }

  const patterns = state.patterns;

  const updatePattern = (index: number, patch: Partial<CompensationPatternEntry>) => {
    onChangeState((s) => {
      if (!s.open) return s;
      const next = s.patterns.map((p, i) => (i === index ? { ...p, ...patch } : p));
      return { ...s, patterns: next };
    });
  };
  const removePattern = (index: number) => {
    onChangeState((s) => {
      if (!s.open) return s;
      if (s.patterns.length <= 1) return s;
      return { ...s, patterns: s.patterns.filter((_, i) => i !== index) };
    });
  };
  const addPattern = () => {
    onChangeState((s) => {
      if (!s.open) return s;
      return {
        ...s,
        patterns: [...s.patterns, { dayBefore: 4, dayAfter: 3 }],
      };
    });
  };

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Compensação — {state.shiftLabel} · {state.levelLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Cada padrão define 1 folga na semana anterior (dayBefore) e 1 na posterior (dayAfter).
            Se houver mais pessoas no grupo que padrões, eles são usados em rodízio (i % N).
          </p>

          <div className="space-y-2">
            {patterns.map((p, i) => (
              <div key={i} className="flex items-end gap-2 rounded-md border border-border/60 px-3 py-2">
                <div className="min-w-[3rem] pb-2 text-xs font-semibold uppercase text-muted-foreground">
                  #{i + 1}
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Antes (semana pré)</Label>
                  <Select
                    value={String(p.dayBefore)}
                    onValueChange={(v) => updatePattern(i, { dayBefore: Number(v) })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAY_LABELS.map((w) => (
                        <SelectItem key={w.value} value={String(w.value)}>
                          {w.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Depois (semana pós)</Label>
                  <Select
                    value={String(p.dayAfter)}
                    onValueChange={(v) => updatePattern(i, { dayAfter: Number(v) })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAY_LABELS.map((w) => (
                        <SelectItem key={w.value} value={String(w.value)}>
                          {w.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive cursor-pointer"
                  onClick={() => removePattern(i)}
                  disabled={patterns.length <= 1}
                  aria-label="Remover padrão"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={addPattern}
          >
            Adicionar padrão
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving}
            className="cursor-pointer"
            onClick={() =>
              void onSave({
                shiftId: state.shiftId,
                levelId: state.levelId,
                patterns,
              })
            }
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
