"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TeamListItem } from "@/server/team/getTeams";

export function TeamSwitcher({
  teams,
  selectedTeamId,
  paramName = "teamId",
  placeholder = "Selecione a equipe",
  className,
}: {
  teams: TeamListItem[];
  selectedTeamId: string | null;
  paramName?: string;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedLabel = useMemo(() => {
    if (!selectedTeamId) return null;
    return teams.find((t) => t.id === selectedTeamId)?.name ?? null;
  }, [teams, selectedTeamId]);

  function handleChange(nextId: string) {
    const params = new URLSearchParams(searchParams?.toString());
    params.set(paramName, nextId);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  return (
    <div className={className}>
      <Select value={selectedTeamId ?? undefined} onValueChange={handleChange}>
        <SelectTrigger className="h-11 w-[280px]">
          <SelectValue placeholder={placeholder}>
            {selectedLabel ?? placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {teams.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

