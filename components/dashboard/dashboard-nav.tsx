"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewAsMemberLink } from "@/components/dashboard/view-as-member-link";

const scheduleHref = `/dashboard/schedule/${new Date().getFullYear()}/${new Date().getMonth() + 1}`;

function NavLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`text-sm font-medium text-foreground hover:underline underline-offset-4 ${active ? "underline" : ""}`}
    >
      {children}
    </Link>
  );
}

export function DashboardNav({ hasMemberView }: { hasMemberView: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4">
      <NavLink href="/dashboard/team" active={pathname.startsWith("/dashboard/team")}>
        Membro
      </NavLink>
      <NavLink href="/dashboard/equipes" active={pathname.startsWith("/dashboard/equipes")}>
        Configurações
      </NavLink>
      <NavLink href={scheduleHref} active={pathname.startsWith("/dashboard/schedule")}>
        Escala
      </NavLink>
      <NavLink href="/dashboard/swaps" active={pathname.startsWith("/dashboard/swaps")}>
        Aprovações
      </NavLink>
      <NavLink href="/dashboard/bank-hours" active={pathname.startsWith("/dashboard/bank-hours")}>
        Banco de Horas
      </NavLink>
      <ViewAsMemberLink hasMemberView={hasMemberView} />
    </nav>
  );
}
