"use client";

import { useMemo } from "react";
import type { MyDashboardData } from "@/server/dashboard/getMyDashboardData";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CalendarOff, CalendarClock, ArrowLeftRight, ShieldCheck, Clock3 } from "lucide-react";

const PENDING_STATUSES = ["PENDING", "WAITING_SECOND_USER", "SECOND_USER_ACCEPTED"];

interface DashboardSummaryCardsProps {
  year: number;
  month: number;
  data: MyDashboardData | null;
  bankHoursBalance?: number | null;
  bankHoursPendingCount?: number | null;
}

export function DashboardSummaryCards({
  year,
  month,
  data,
  bankHoursBalance,
  bankHoursPendingCount,
}: DashboardSummaryCardsProps) {
  const { workDays, offDays, nextOffDate, pendingSwaps, onCallDays } = useMemo(() => {
    const now = new Date();
    const schedule = data?.schedule ?? null;
    const swaps = data?.swaps ?? [];
    const onCallPeriods = data?.onCallPeriods ?? [];

    let work: number | null = null;
    let off: number | null = null;
    let nextOff: string | null = null;
    if (schedule?.days) {
      let w = 0;
      let o = 0;
      const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
      const minDay = isCurrentMonth ? now.getDate() : 1;
      for (const d of schedule.days) {
        if (d.status === "WORK") w++;
        else o++;
        if (!nextOff && d.status === "OFF" && d.day >= minDay) {
          nextOff = `${d.day} ${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][month - 1]}`;
        }
      }
      work = w;
      off = o;
    }

    const pending = swaps.filter((s) => PENDING_STATUSES.includes(s.status)).length;

    let onCall: number | null = null;
    if (onCallPeriods.length > 0) {
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      let total = 0;
      for (const p of onCallPeriods) {
        const start = new Date(p.startDate + "T12:00:00.000Z");
        const end = new Date(p.endDate + "T12:00:00.000Z");
        const clampStart = start < monthStart ? monthStart : start;
        const clampEnd = end > monthEnd ? monthEnd : end;
        let d = new Date(clampStart);
        while (d <= clampEnd) {
          total++;
          d = new Date(d.getTime() + 86400000);
        }
      }
      onCall = total;
    }

    return {
      workDays: work,
      offDays: off,
      nextOffDate: nextOff,
      pendingSwaps: pending,
      onCallDays: onCall,
    };
  }, [data, month, year]);

  const pendingApprovalsTotal =
    (pendingSwaps ?? 0) + (bankHoursPendingCount ?? 0);

  const cards = [
    {
      label: "Dias de Trabalho",
      value: workDays ?? "—",
      icon: Calendar,
      iconBg: "bg-green-500/15",
      iconColor: "text-green-600",
    },
    {
      label: "Dias de Folga",
      value: offDays ?? "—",
      icon: CalendarOff,
      iconBg: "bg-red-500/15",
      iconColor: "text-red-600",
    },
    {
      label: "Próxima Folga",
      value: nextOffDate ?? "—",
      icon: CalendarClock,
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-600",
    },
    {
      label: "Aprovações Pendentes",
      value: pendingApprovalsTotal,
      icon: ArrowLeftRight,
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-600",
    },
    {
      label: "Saldo Banco de Horas",
      value: bankHoursBalance == null ? "—" : Math.round(bankHoursBalance),
      icon: Clock3,
      iconBg: "bg-indigo-500/15",
      iconColor: "text-indigo-600",
    },
    ...(onCallDays != null
      ? [
          {
            label: "Dias de Sobreaviso",
            value: onCallDays,
            icon: ShieldCheck,
            iconBg: "bg-blue-500/15",
            iconColor: "text-blue-600",
          },
        ]
      : []),
  ];

  return (
    <div className={`grid grid-cols-2 gap-4 ${cards.length > 4 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
      {cards.map(({ label, value, icon: Icon, iconBg, iconColor }) => (
        <Card
          key={label}
          className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm"
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg} ${iconColor}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="text-xl font-bold tracking-tight text-foreground">
                  {value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
