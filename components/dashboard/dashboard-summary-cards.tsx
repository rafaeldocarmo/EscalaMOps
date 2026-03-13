"use client";

import { useEffect, useState } from "react";
import { getMySchedule } from "@/server/schedule/getMySchedule";
import { getMySwapRequests } from "@/server/swaps/getSwaps";
import { getMyOnCallSchedule } from "@/server/sobreaviso/getMyOnCallSchedule";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CalendarOff, Clock, ArrowLeftRight, ShieldCheck } from "lucide-react";

const PENDING_STATUSES = ["PENDING", "WAITING_SECOND_USER", "SECOND_USER_ACCEPTED"];

interface DashboardSummaryCardsProps {
  memberId: string;
  year: number;
  month: number;
}

export function DashboardSummaryCards({ memberId, year, month }: DashboardSummaryCardsProps) {
  const [workDays, setWorkDays] = useState<number | null>(null);
  const [offDays, setOffDays] = useState<number | null>(null);
  const [nextOffDate, setNextOffDate] = useState<string | null>(null);
  const [pendingSwaps, setPendingSwaps] = useState<number>(0);
  const [onCallDays, setOnCallDays] = useState<number | null>(null);

  useEffect(() => {
    const now = new Date();
    getMySchedule(memberId, year, month).then((data) => {
      if (data?.days) {
        let work = 0;
        let off = 0;
        let nextOff: string | null = null;
        const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
        const minDay = isCurrentMonth ? now.getDate() : 1;
        for (const d of data.days) {
          if (d.status === "WORK") work++;
          else off++;
          if (!nextOff && d.status === "OFF" && d.day >= minDay) {
            nextOff = `${d.day} ${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][month - 1]}`;
          }
        }
        setWorkDays(work);
        setOffDays(off);
        setNextOffDate(nextOff);
      }
    });
    getMySwapRequests().then((list) => {
      const count = list.filter((s) => PENDING_STATUSES.includes(s.status)).length;
      setPendingSwaps(count);
    });
    getMyOnCallSchedule(memberId, year, month).then((periods) => {
      if (periods.length === 0) {
        setOnCallDays(null);
        return;
      }
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      let total = 0;
      for (const p of periods) {
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
      setOnCallDays(total);
    });
  }, [memberId, year, month]);

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
      icon: Clock,
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-600",
    },
    {
      label: "Trocas Pendentes",
      value: pendingSwaps,
      icon: ArrowLeftRight,
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-600",
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
