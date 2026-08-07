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
  Bell,
  SlidersHorizontal,
  Ticket,
} from "lucide-react";
import { ViewAsMemberLink } from "@/components/dashboard/view-as-member-link";

const scheduleHref = `/dashboard/schedule/${new Date().getFullYear()}/${new Date().getMonth() + 1}`;

function isAdminSidebarPath(pathname: string) {
  return (
    pathname === "/dashboard/equipes" ||
    pathname === "/dashboard/equipes/" ||
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
          ? "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-100"
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
  const adminMode = isFullAdmin && isAdminSidebarPath(pathname);

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
    {
      href: "/dashboard/jira",
      label: "Jira",
      icon: Ticket,
      active: pathname.startsWith("/dashboard/jira"),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      {adminMode ? (
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
            Admin
          </p>
          <nav className="flex flex-col gap-1">
            <Item
              href="/dashboard/equipes"
              label="Equipes"
              icon={Building2}
              active={pathname === "/dashboard/equipes" || pathname === "/dashboard/equipes/"}
            />
            <Item
              href="/dashboard/permissions"
              label="Permissões"
              icon={Shield}
              active={pathname.startsWith("/dashboard/permissions")}
            />
          </nav>
        </div>
      ) : (
        <>
          <nav className="flex min-h-0 flex-1 flex-col gap-1">
            {mainItems.map((it) => (
              <Item key={it.href} href={it.href} label={it.label} icon={it.icon} active={it.active} />
            ))}

            {(isFullAdmin || isAdminTeam) && (
              <div className="pt-3">
                <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Configurações
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  <Item
                    href="/dashboard/equipes/catalog"
                    label="Níveis e Turnos"
                    icon={Layers}
                    active={pathname.startsWith("/dashboard/equipes/catalog")}
                  />
                  <Item
                    href="/dashboard/equipes/rules"
                    label="Regras de escala"
                    icon={SlidersHorizontal}
                    active={pathname.startsWith("/dashboard/equipes/rules")}
                  />
                  <Item
                    href="/dashboard/equipes/sobreaviso"
                    label="Sobreaviso"
                    icon={Bell}
                    active={pathname.startsWith("/dashboard/equipes/sobreaviso")}
                  />
                </div>
              </div>
            )}
          </nav>

          {isFullAdmin ? (
            <div className="mt-auto flex flex-col gap-3 border-t border-border/60 pt-3">
              <Link
                href="/dashboard/equipes"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isAdminSidebarPath(pathname)
                    ? "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-100"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span className="truncate">Admin</span>
              </Link>
            </div>
          ) : null}
        </>
      )}

      {status !== "loading" ? (
        <div className="mt-auto border-t border-border/60 pt-3">
          <ViewAsMemberLink hasMemberView={hasMemberView} />
        </div>
      ) : null}
    </div>
  );
}

