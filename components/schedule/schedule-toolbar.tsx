"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MonthNavigator } from "./month-navigator";

interface ScheduleToolbarProps {
  scheduleId: string;
  year: number;
  month: number;
  onGenerate: () => void;
  onSave: () => void;
  saveLoading?: boolean;
  generateLoading?: boolean;
}

export function ScheduleToolbar({
  scheduleId,
  year,
  month,
  onGenerate,
  onSave,
  saveLoading = false,
  generateLoading = false,
}: ScheduleToolbarProps) {
  const router = useRouter();

  const goPrev = () => {
    if (month === 1) {
      router.push(`/dashboard/schedule/${year - 1}/12`);
    } else {
      router.push(`/dashboard/schedule/${year}/${month - 1}`);
    }
  };
  const goNext = () => {
    if (month === 12) {
      router.push(`/dashboard/schedule/${year + 1}/1`);
    } else {
      router.push(`/dashboard/schedule/${year}/${month + 1}`);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <MonthNavigator year={year} month={month} onPrevious={goPrev} onNext={goNext} />
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerate}
          disabled={generateLoading}
        >
          {generateLoading ? "Gerando…" : "Gerar Escala Automática"}
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saveLoading}
        >
          {saveLoading ? "Salvando…" : "Salvar Alterações"}
        </Button>
      </div>
    </div>
  );
}
