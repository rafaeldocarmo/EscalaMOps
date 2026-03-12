"use client";

import { useEffect, useState } from "react";
import { getMySchedule } from "@/server/schedule/getMySchedule";
import { getMySwapRequests } from "@/server/swaps/getSwaps";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CalendarOff, Clock, ArrowLeftRight } from "lucide-react";

const PENDING_STATUSES = ["PENDING", "WAITING_SECOND_USER", "SECOND_USER_ACCEPTED"];

interface DashboardSummaryCardsProps {
  memberId: string;
}

export function DashboardSummaryCards({ memberId }: DashboardSummaryCardsProps) {
  const [workDays, setWorkDays] = useState<number | null>(null);
  const [offDays, setOffDays] = useState<number | null>(null);
  const [nextOffDate, setNextOffDate] = useState<string | null>(null);
  const [pendingSwaps, setPendingSwaps] = useState<number>(0);

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    getMySchedule(memberId, year, month).then((data) => {
      if (data?.days) {
        let work = 0;
        let off = 0;
        let nextOff: string | null = null;
        const today = now.getDate();
        for (const d of data.days) {
          if (d.status === "WORK") work++;
          else off++;
          if (!nextOff && d.status === "OFF" && d.day >= today) {
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
  }, [memberId]);

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
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
