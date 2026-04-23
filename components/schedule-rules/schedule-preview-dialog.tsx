"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MonthNavigator } from "@/components/schedule/month-navigator";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import {
  assignmentsToStateMap,
  buildScheduleSections,
  getScheduleCalendarDays,
} from "@/lib/scheduleUtils";
import {
  previewScheduleWithRules,
  type PreviewScheduleData,
} from "@/server/scheduleRules/previewScheduleWithRules";

interface SchedulePreviewDialogProps {
  teamId: string;
  disabled?: boolean;
}

export function SchedulePreviewDialog({ teamId, disabled }: SchedulePreviewDialogProps) {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PreviewScheduleData | null>(null);

  const loadPreview = useCallback(
    async (y: number, m: number) => {
      setLoading(true);
      try {
        const result = await previewScheduleWithRules({ teamId, year: y, month: m });
        if (result.success) {
          setData(result.data);
        } else {
          toast.error(result.error);
          setData(null);
        }
      } catch (err) {
        console.error(err);
        toast.error("Erro ao gerar pré-visualização.");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [teamId]
  );

  useEffect(() => {
    if (!open) return;
    void loadPreview(year, month);
  }, [open, year, month, loadPreview]);

  const { goPrev, goNext } = useMonthNavigation({
    year,
    month,
    onYearChange: setYear,
    onMonthChange: setMonth,
  });

  const sections = useMemo(
    () => (data ? buildScheduleSections(data.members) : []),
    [data]
  );
  const calendarDays = useMemo(
    () => getScheduleCalendarDays(year, month),
    [year, month]
  );
  const stateMap = useMemo(
    () => (data ? assignmentsToStateMap(
      data.assignments.map((a) => ({
        id: `${a.memberId}-${a.date}`,
        scheduleId: "preview",
        memberId: a.memberId,
        date: a.date,
        status: a.status,
      }))
    ) : {}),
    [data]
  );

  const hasContent = data && data.members.length > 0;

  return (
    <>
      <Button
        type="button"
        variant="default"
        className="cursor-pointer"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Eye className="mr-2 h-4 w-4" />
        Pré-visualizar escala
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-6xl lg:max-w-7xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização da escala</DialogTitle>
            <DialogDescription>
              Escala simulada em memória com base nas regras atuais. Nada é salvo no banco.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end gap-2 pb-2">
            <MonthNavigator year={year} month={month} onPrevious={goPrev} onNext={goNext} />
          </div>

          <div className="max-h-[70vh] overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando pré-visualização…
              </div>
            ) : hasContent ? (
              <ScheduleGrid
                sections={sections}
                calendarDays={calendarDays}
                stateMap={stateMap}
                onCellToggle={() => {}}
                locked
              />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum membro participando da escala para esta equipe.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-emerald-300 dark:bg-emerald-600/75" />
              Trabalha
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-rose-100 dark:bg-rose-500/60" />
              Folga
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
