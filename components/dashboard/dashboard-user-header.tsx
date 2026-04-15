"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardSidebar } from "@/components/dashboard/dashboard-shell";
import { cn } from "@/lib/utils";

export function DashboardUserHeader() {
  const { data: session, status } = useSession();
  const { desktopExpanded, mobileOpen, toggleSidebar, hasSidebar } = useDashboardSidebar();
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const { displayName, displayPhone } = useMemo(() => {
    if (!session?.user) {
      return { displayName: "", displayPhone: null as string | null };
    }
    if (session.member) {
      const phone = session.member.phone?.trim();
      return {
        displayName: session.member.name,
        displayPhone: phone && phone.length > 0 ? phone : null,
      };
    }
    if (session.user.role === "ADMIN" || session.user.role === "ADMIN_TEAM") {
      const phone = session.user.phone?.trim();
      return {
        displayName:
          session.user.role === "ADMIN_TEAM" ? "Administrador de equipe" : "Administrador",
        displayPhone: phone && phone.length > 0 ? phone : null,
      };
    }
    return { displayName: "—", displayPhone: null };
  }, [session]);

  const menuLabel = mobileOpen
    ? "Fechar menu"
    : isNarrow
      ? "Abrir menu"
      : desktopExpanded
        ? "Recolher menu"
        : "Abrir menu";

  const menuExpanded = isNarrow ? mobileOpen : desktopExpanded;

  const headerInnerClass = cn(
    "flex h-14 items-center justify-between gap-3 px-4 md:px-6",
    !hasSidebar && "mx-auto w-full max-w-[1400px]"
  );

  if (status === "loading") {
    return (
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className={headerInnerClass}>
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-md bg-muted md:w-9" />
          <div className="h-4 w-44 animate-pulse rounded bg-muted" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className={headerInnerClass}>
        {hasSidebar ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={toggleSidebar}
            aria-expanded={menuExpanded}
            aria-label={menuLabel}
          >
            <span className="md:hidden">
              <Menu className="h-5 w-5" />
            </span>
            <span className="hidden md:inline-flex">
              {desktopExpanded ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeftOpen className="h-5 w-5" />
              )}
            </span>
          </Button>
        ) : (
          <span className="shrink-0 text-lg font-semibold tracking-tight text-foreground">
            Escala
          </span>
        )}
        <div className="min-w-0 flex-1 text-right leading-tight">
          <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {displayPhone ?? ""}
          </p>
        </div>
      </div>
    </header>
  );
}
