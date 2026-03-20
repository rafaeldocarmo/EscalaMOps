"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MyScheduleView } from "@/components/schedule/my-schedule-view";
import { WeeklyScheduleView } from "@/components/schedule/weekly-schedule-view";
import { MonthlyScheduleView } from "@/components/schedule/monthly-schedule-view";
import { DashboardSummaryCards } from "@/components/dashboard/dashboard-summary-cards";
import { DashboardSwapBadge } from "@/components/dashboard/dashboard-swap-badge";
import { getMyDashboardData, type MyDashboardData } from "@/server/dashboard/getMyDashboardData";
import type { SwapRequestStatus } from "@/types/swaps";
import { getMyBankHourBalance } from "@/server/bank-hours/getMyBankHourBalance";
import { getMyBankHourPendingCount } from "@/server/bank-hours/getMyBankHourPendingCount";

interface DashboardTabsProps {
  memberId: string;
  memberName: string;
}

export function DashboardTabs({ memberId, memberName }: DashboardTabsProps) {
  const [value, setValue] = useState("my");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [myData, setMyData] = useState<MyDashboardData | null>(null);
  const [bankHoursBalance, setBankHoursBalance] = useState<number | null>(null);
  const [bankHoursPendingCount, setBankHoursPendingCount] = useState<number | null>(null);

  useEffect(() => {
    if (value !== "my") return;
    getMyDashboardData(memberId, year, month).then(setMyData);
  }, [memberId, month, value, year]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const b = await getMyBankHourBalance();
      if (cancelled) return;
      setBankHoursBalance(b);
    };
    if (value === "my") load();
    return () => {
      cancelled = true;
    };
  }, [memberId, value]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const c = await getMyBankHourPendingCount();
      if (cancelled) return;
      setBankHoursPendingCount(c);
    };
    if (value === "my") load();
    return () => {
      cancelled = true;
    };
  }, [memberId, value]);

  const pendingCount = useMemo(() => {
    if (!myData) return null;
    const pendingStatuses = new Set<SwapRequestStatus>([
      "PENDING",
      "WAITING_SECOND_USER",
      "SECOND_USER_ACCEPTED",
    ]);
    return myData.swaps.filter((s) => pendingStatuses.has(s.status)).length;
  }, [myData]);

  return (
    <Tabs value={value} onValueChange={setValue} className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <DashboardSwapBadge count={pendingCount} />
        </div>
        <TabsList className="inline-flex h-10 shrink-0 items-center justify-start rounded-lg bg-transparent p-0 gap-0">
          <TabsTrigger
            value="my"
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-sm cursor-pointer"
          >
            Minha Escala
          </TabsTrigger>
          <TabsTrigger
            value="weekly"
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-sm cursor-pointer"
          >
            Escala Semanal
          </TabsTrigger>
          <TabsTrigger
            value="monthly"
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-sm cursor-pointer"
          >
            Escala Mensal
          </TabsTrigger>
        </TabsList>
      </div>

      {value === "my" && (
        <DashboardSummaryCards
          year={year}
          month={month}
          data={myData}
          bankHoursBalance={bankHoursBalance}
          bankHoursPendingCount={bankHoursPendingCount}
        />
      )}

      <TabsContent value="my" className="mt-0">
        <MyScheduleView
          memberId={memberId}
          year={year}
          month={month}
          onYearChange={setYear}
          onMonthChange={setMonth}
          dashboardData={myData}
        />
      </TabsContent>
      <TabsContent value="weekly" className="mt-0">
        <WeeklyScheduleView memberName={memberName} />
      </TabsContent>
      <TabsContent value="monthly" className="mt-0">
        <MonthlyScheduleView />
      </TabsContent>
    </Tabs>
  );
}
