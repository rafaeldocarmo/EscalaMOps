"use client";

import { SwapHistoryList } from "@/components/swaps/SwapHistoryList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SwapListProps {
  memberId: string;
}

export function SwapList({ memberId }: SwapListProps) {
  return (
    <Card className="h-full flex flex-col min-h-0">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-base">Histórico de solicitações</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        <SwapHistoryList memberId={memberId} />
      </CardContent>
    </Card>
  );
}
