"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TeamListItem } from "@/server/team/getTeams";
import { setSelectedTeam } from "@/server/team/setSelectedTeam";
import { SELECTED_TEAM_CHANGED_EVENT } from "@/lib/teamSelectionEvents";
import { cn } from "@/lib/utils";

export function TeamTitleDropdown({
  teams,
  selectedTeamId,
  readOnly = false,
}: {
  teams: TeamListItem[];
  selectedTeamId: string | null;
  /** ADMIN_TEAM não pode trocar de equipe; equipe vem só da conta. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function handleChange(nextId: string) {
    if (readOnly) return;
    startTransition(async () => {
      await setSelectedTeam(nextId);

      // Remove any legacy per-page ?teamId= param while keeping other params.
      const params = new URLSearchParams(searchParams?.toString());
      params.delete("teamId");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
      router.refresh();
      // Próximo tick: garante que o cookie da server action já esteja aplicado antes do refetch.
      queueMicrotask(() => {
        window.dispatchEvent(
          new CustomEvent(SELECTED_TEAM_CHANGED_EVENT, { detail: { teamId: nextId } })
        );
      });
    });
  }

  return (
    <Select
      value={selectedTeamId ?? undefined}
      onValueChange={handleChange}
      disabled={pending || teams.length === 0 || readOnly}
    >
      <SelectTrigger
        size="default"
        className={cn(
          "h-auto min-h-10 w-full gap-2 rounded-lg border border-border/60 bg-muted/70 px-3 py-2.5",
          "text-left text-sm font-bold text-foreground shadow-sm",
          "hover:bg-muted/90 focus-visible:border-border focus-visible:ring-2 focus-visible:ring-ring/25",
          "data-[state=open]:border-border data-[state=open]:bg-muted/80",
          "[&>svg:last-child]:size-4 [&>svg:last-child]:shrink-0 [&>svg:last-child]:text-muted-foreground",
          "data-[state=open]:[&>svg:last-child]:rotate-180 [&>svg:last-child]:transition-transform [&>svg:last-child]:duration-200"
        )}
        aria-label="Selecionar equipe"
      >
        <Users className="size-4 shrink-0 text-foreground/85" aria-hidden />
        <SelectValue className="min-w-0 flex-1 truncate text-left" placeholder="Equipe" />
      </SelectTrigger>
      <SelectContent
        align="start"
        position="popper"
        className={cn(
          "max-h-[min(320px,var(--radix-select-content-available-height))] rounded-lg border border-border/60 bg-background p-1 shadow-md",
          "data-[side=bottom]:translate-y-1"
        )}
      >
        {teams.map((t) => (
          <SelectItem
            key={t.id}
            value={t.id}
            className={cn(
              "cursor-pointer rounded-md py-2.5 pr-3 pl-3 text-sm font-medium",
              "text-foreground outline-none",
              "focus:bg-muted/80 focus:text-foreground",
              "data-[highlighted]:bg-muted/70 data-[highlighted]:text-foreground",
              "data-[state=checked]:bg-sky-100 data-[state=checked]:text-blue-700",
              "data-[state=checked]:focus:bg-sky-100 data-[state=checked]:data-[highlighted]:bg-sky-100",
              "dark:data-[state=checked]:bg-blue-950/45 dark:data-[state=checked]:text-blue-300",
              "[&>span:first-child]:hidden"
            )}
          >
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

