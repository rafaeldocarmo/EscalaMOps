"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MyScheduleView } from "@/components/schedule/my-schedule-view";
import { WeeklyScheduleView } from "@/components/schedule/weekly-schedule-view";
import { MonthlyScheduleView } from "@/components/schedule/monthly-schedule-view";

interface DashboardTabsProps {
  memberId: string;
  memberName: string;
}

export function DashboardTabs({ memberId, memberName }: DashboardTabsProps) {
  return (
    <Tabs defaultValue="my" className="w-full">
      <TabsList className="grid w-full grid-cols-3 max-w-lg">
        <TabsTrigger value="my">Minha Escala</TabsTrigger>
        <TabsTrigger value="weekly">Escala Semanal</TabsTrigger>
        <TabsTrigger value="monthly">Escala Mensal</TabsTrigger>
      </TabsList>
      <TabsContent value="my" className="mt-4">
        <MyScheduleView memberId={memberId} />
      </TabsContent>
      <TabsContent value="weekly" className="mt-4">
        <WeeklyScheduleView memberName={memberName} />
      </TabsContent>
      <TabsContent value="monthly" className="mt-4">
        <MonthlyScheduleView />
      </TabsContent>
    </Tabs>
  );
}
