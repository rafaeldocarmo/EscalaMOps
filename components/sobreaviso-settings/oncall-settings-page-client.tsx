"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import type { OnCallSettingsForTeamData } from "@/server/sobreaviso/getOnCallSettingsForTeam";
import { saveOnCallSettingsForTeam } from "@/server/sobreaviso/saveOnCallSettingsForTeam";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MonthNavigator } from "@/components/schedule/month-navigator";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import {
  previewOnCallSchedule,
  type PreviewOnCallScheduleData,
} from "@/server/sobreaviso/previewOnCallSchedule";
import { getScheduleCalendarDays } from "@/lib/scheduleUtils";
import { ScheduleHeader, STICKY_CELL_BASE, STICKY_COLUMN_WIDTH } from "@/components/schedule/schedule-header";

function RotationIntervalCell({
  days,
  disabled,
  onDec,
  onInc,
}: {
  days: number;
  disabled: boolean;
  onDec: () => void;
  onInc: () => void;
}) {
  const active = days > 0;
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
        {days}
      </div>
      <div className={cn("text-xs", active ? "text-muted-foreground" : "text-muted-foreground/70")}>
        dias
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
          disabled={disabled || days <= 1}
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
          disabled={disabled || days >= 8}
          onClick={onInc}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function OnCallSettingsPageClient({ initialData }: { initialData: OnCallSettingsForTeamData }) {
  const now = new Date();
  const levelOptions = useMemo(
    () => initialData.levels.map((l) => ({ value: l.id, label: l.label })),
    [initialData.levels]
  );

  const [participantTeamLevelIds, setParticipantTeamLevelIds] = useState<string[]>(
    initialData.settings.participantTeamLevelIds ?? []
  );
  const [rotationIntervalDaysByLevel, setRotationIntervalDaysByLevel] = useState<Record<string, number>>(
    initialData.settings.rotationIntervalDaysByLevel ?? {}
  );
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewYear, setPreviewYear] = useState(now.getFullYear());
  const [previewMonth, setPreviewMonth] = useState(now.getMonth() + 1);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewOnCallScheduleData | null>(null);

  // Keep per-level intervals in sync when participant levels change.
  useEffect(() => {
    setRotationIntervalDaysByLevel((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const id of participantTeamLevelIds) {
        const v = next[id];
        if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 8) next[id] = 3;
      }
      for (const k of Object.keys(next)) {
        if (!participantTeamLevelIds.includes(k)) delete next[k];
      }
      return next;
    });
  }, [participantTeamLevelIds]);

  const validationError = useMemo(() => {
    for (const [levelId, v] of Object.entries(rotationIntervalDaysByLevel)) {
      const n = Math.trunc(Number(v));
      if (!Number.isFinite(n) || n <= 0 || n > 8) {
        return "O intervalo de dias deve ser maior que 0 e menor ou igual a 8.";
      }
      if (levelId.trim().length === 0) return "Configuração inválida.";
    }
    return null;
  }, [rotationIntervalDaysByLevel]);

  const onSave = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      const res = await saveOnCallSettingsForTeam({
        participantTeamLevelIds,
        rotationIntervalDaysByLevel,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Configurações de sobreaviso salvas.");
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const loadPreview = useCallback(
    async (y: number, m: number) => {
      setPreviewLoading(true);
      try {
        const result = await previewOnCallSchedule({
          year: y,
          month: m,
          participantTeamLevelIds,
          rotationIntervalDaysByLevel,
        });
        if (result.success) {
          // Backward/refresh safe: older server response may not include `members`.
          const members = "members" in result.data && Array.isArray(result.data.members)
            ? result.data.members
            : [];
          setPreviewData({ ...result.data, members });
        } else {
          toast.error(result.error);
          setPreviewData(null);
        }
      } catch (err) {
        console.error(err);
        toast.error("Erro ao gerar pré-visualização.");
        setPreviewData(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    [participantTeamLevelIds, rotationIntervalDaysByLevel]
  );

  useEffect(() => {
    if (!previewOpen) return;
    void loadPreview(previewYear, previewMonth);
  }, [previewOpen, previewYear, previewMonth, loadPreview]);

  const { goPrev, goNext } = useMonthNavigation({
    year: previewYear,
    month: previewMonth,
    onYearChange: setPreviewYear,
    onMonthChange: setPreviewMonth,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sobreaviso</h1>
        <p className="text-muted-foreground">
          Configure quais níveis participam do sobreaviso e a rotação automática para esta equipe.
        </p>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>Regras de sobreaviso</CardTitle>
              <CardDescription>
                Essas configurações são salvas por equipe e serão usadas futuramente na geração automática da escala.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="default"
              onClick={() => setPreviewOpen(true)}
              disabled={saving}
              className="cursor-pointer"
            >
              <Eye className="mr-2 h-4 w-4" />
              Pré-visualizar sobreaviso
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium text-foreground">Níveis participantes</div>
            <div className="flex flex-wrap items-center gap-2">
              <MultiSelect
                label="Níveis"
                options={levelOptions}
                value={participantTeamLevelIds}
                onChange={setParticipantTeamLevelIds}
                size="default"
                buttonClassName="max-w-none w-full sm:w-auto"
              />
              <span className="text-xs text-muted-foreground">
                Selecionados: {participantTeamLevelIds.length || "Todos"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Apenas os níveis selecionados entram na escala de sobreaviso.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium text-foreground">Intervalo de rotação por nível</div>
            {participantTeamLevelIds.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Selecione pelo menos um nível participante para configurar a rotação.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {initialData.levels
                  .filter((l) => participantTeamLevelIds.includes(l.id))
                  .map((l) => {
                    const days = rotationIntervalDaysByLevel[l.id] ?? 3;
                    return (
                      <div key={l.id} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{l.label}</div>
                            <div className="text-xs text-muted-foreground">Troca a cada {days} dias</div>
                          </div>
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: l.color }}
                            aria-hidden
                          />
                        </div>
                        <RotationIntervalCell
                          days={days}
                          disabled={saving}
                          onDec={() =>
                            setRotationIntervalDaysByLevel((prev) => ({
                              ...prev,
                              [l.id]: Math.max(1, (prev[l.id] ?? 3) - 1),
                            }))
                          }
                          onInc={() =>
                            setRotationIntervalDaysByLevel((prev) => ({
                              ...prev,
                              [l.id]: Math.min(8, (prev[l.id] ?? 3) + 1),
                            }))
                          }
                        />
                      </div>
                    );
                  })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Representa a quantidade de dias para troca do responsável pelo sobreaviso (1 a 8).
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" onClick={onSave} disabled={saving || !!validationError}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização do sobreaviso</DialogTitle>
            <DialogDescription>
              Geração automática simulada em memória com as configurações atuais (não salva no banco).
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end gap-2 pb-2">
            <MonthNavigator
              year={previewYear}
              month={previewMonth}
              onPrevious={goPrev}
              onNext={goNext}
            />
          </div>

          <div className="max-h-[70vh] overflow-auto rounded-lg border border-border/50">
            {previewLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando pré-visualização…
              </div>
            ) : previewData ? (
              <OnCallPreviewTable data={previewData} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum membro elegível para sobreaviso com as configurações atuais.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OnCallPreviewTable({ data }: { data: PreviewOnCallScheduleData }) {
  const calendarDays = useMemo(
    () => getScheduleCalendarDays(data.year, data.month),
    [data.year, data.month]
  );

  const members = useMemo(() => {
    if ("members" in data && Array.isArray(data.members) && data.members.length > 0) return data.members;
    // Fallback for older cached responses: derive member list from segments.
    const byId = new Map<string, { id: string; name: string; teamLevelId: string; levelLabel: string }>();
    for (const s of data.segments) {
      if (!byId.has(s.memberId)) {
        byId.set(s.memberId, {
          id: s.memberId,
          name: s.memberName,
          teamLevelId: s.teamLevelId,
          levelLabel: s.levelLabel,
        });
      }
    }
    return [...byId.values()].sort((a, b) => {
      if (a.levelLabel !== b.levelLabel) return a.levelLabel.localeCompare(b.levelLabel, "pt-BR");
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [data]);

  const onCallByMember = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const m of members) map.set(m.id, new Set());

    for (const seg of data.segments) {
      // seg.endDate is exclusive
      const start = new Date(seg.startDate + "T12:00:00.000Z");
      const end = new Date(seg.endDate + "T12:00:00.000Z");
      let d = new Date(start);
      while (d < end) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        const key = `${y}-${m}-${day}`;
        map.get(seg.memberId)?.add(key);
        d = new Date(d.getTime() + 86400000);
      }
    }
    return map;
  }, [members, data.segments]);

  const memberRows = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.levelLabel !== b.levelLabel) return a.levelLabel.localeCompare(b.levelLabel, "pt-BR");
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [members]);

  return (
    <div className="overflow-x-auto bg-card">
      <table className="w-full border-collapse text-xs">
        <ScheduleHeader calendarDays={calendarDays} />
        <tbody>
          {memberRows.map((m, idx) => {
            const set = onCallByMember.get(m.id) ?? new Set<string>();
            const zebra = idx % 2 === 0;
            return (
              <tr key={m.id} className={zebra ? "bg-background" : "bg-muted/10"}>
                <td
                  className={cn(
                    STICKY_CELL_BASE,
                    STICKY_COLUMN_WIDTH,
                    "px-2 py-2 text-left align-middle"
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{m.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{m.levelLabel}</div>
                  </div>
                </td>
                {calendarDays.map((d) => {
                  const isOnCall = d.isCurrentMonth && set.has(d.dateKey);
                  return (
                    <td
                      key={d.dateKey}
                      className={cn(
                        "min-w-[2.25rem] border-r border-border/60 border-b border-border/60 p-0.5 text-center last:border-r-0",
                        !d.isCurrentMonth && "bg-muted/20"
                      )}
                    >
                      <div
                        className={cn(
                          "mx-auto h-7 w-7 rounded-md border",
                          isOnCall
                            ? "border-sky-400/70 bg-sky-200/70 dark:border-sky-600/70 dark:bg-sky-600/40"
                            : "border-transparent"
                        )}
                        aria-label={isOnCall ? "Sobreaviso" : undefined}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

