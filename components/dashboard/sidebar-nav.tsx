"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Home,
  Users,
  Layers,
  Building2,
  CalendarDays,
  ArrowLeftRight,
  Clock,
  Settings,
  ArrowLeft,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { ViewAsMemberLink } from "@/components/dashboard/view-as-member-link";

const scheduleHref = `/dashboard/schedule/${new Date().getFullYear()}/${new Date().getMonth() + 1}`;

/** Rotas que usam o painel secundário de configurações (equipes / permissões / catálogo de níveis). */
function isSettingsSidebarPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard/equipes") ||
    pathname.startsWith("/dashboard/permissions")
  );
}

function Item({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "text-cyan-700 dark:bg-sky-900/30 dark:text-sky-100"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  // Layout already protects routes, but keep client-side safe defaults.
  const isFullAdmin = session?.user?.role === "ADMIN";
  const isAdminTeam = session?.user?.role === "ADMIN_TEAM";
  const hasMemberView = !!session?.member;
  const showAdminHome = isFullAdmin && hasMemberView;
  const settingsMode =
    (isFullAdmin && isSettingsSidebarPath(pathname)) ||
    (isAdminTeam &&
      (pathname.startsWith("/dashboard/equipes/catalog") ||
        pathname.startsWith("/dashboard/equipes/rules")));

  const mainItems = [
    ...(showAdminHome
      ? [
          {
            href: "/dashboard",
            label: "Home",
            icon: Home,
            active: pathname === "/dashboard",
          },
        ]
      : []),
    {
      href: "/dashboard/team",
      label: "Membros",
      icon: Users,
      active: pathname === "/dashboard/team" || pathname === "/dashboard/team/",
    },
    {
      href: scheduleHref,
      label: "Escala",
      icon: CalendarDays,
      active: pathname.startsWith("/dashboard/schedule"),
    },
    {
      href: "/dashboard/swaps",
      label: "Trocas",
      icon: ArrowLeftRight,
      active: pathname.startsWith("/dashboard/swaps"),
    },
    {
      href: "/dashboard/bank-hours",
      label: "Banco de Horas",
      icon: Clock,
      active: pathname.startsWith("/dashboard/bank-hours"),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      {settingsMode ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <Link
              href="/dashboard/team"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span>Voltar</span>
            </Link>
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Configurações
            </p>
            <nav className="flex flex-col gap-1">
              {isFullAdmin ? (
                <Item
                  href="/dashboard/equipes"
                  label="Equipes"
                  icon={Building2}
                  active={pathname === "/dashboard/equipes" || pathname === "/dashboard/equipes/"}
                />
              ) : null}
              <Item
                href="/dashboard/equipes/catalog"
                label="Níveis e turnos"
                icon={Layers}
                active={pathname.startsWith("/dashboard/equipes/catalog")}
              />
              <Item
                href="/dashboard/equipes/rules"
                label="Regras de escala"
                icon={SlidersHorizontal}
                active={pathname.startsWith("/dashboard/equipes/rules")}
              />
              {isFullAdmin ? (
                <Item
                  href="/dashboard/permissions"
                  label="Permissões"
                  icon={Shield}
                  active={pathname.startsWith("/dashboard/permissions")}
                />
              ) : null}
            </nav>
          </div>
          {status !== "loading" ? (
            <div className="mt-auto border-t border-border/60 pt-3">
              <ViewAsMemberLink hasMemberView={hasMemberView} />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <nav className="flex min-h-0 flex-1 flex-col gap-1">
            {mainItems.map((it) => (
              <Item key={it.href} href={it.href} label={it.label} icon={it.icon} active={it.active} />
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3 border-t border-border/60 pt-3">
            {isFullAdmin || isAdminTeam ? (
              <Link
                href={isFullAdmin ? "/dashboard/equipes" : "/dashboard/equipes/catalog"}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith("/dashboard/equipes") ||
                    pathname.startsWith("/dashboard/permissions")
                    ? "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-100"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span className="truncate">Configurações</span>
              </Link>
            ) : null}
            {status !== "loading" ? (
              <ViewAsMemberLink hasMemberView={hasMemberView} />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

