"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "dashboard-sidebar-expanded";

type DashboardSidebarContextValue = {
  desktopExpanded: boolean;
  mobileOpen: boolean;
  toggleSidebar: () => void;
  hasSidebar: boolean;
};

const DashboardSidebarContext = createContext<DashboardSidebarContextValue | null>(
  null
);

export function useDashboardSidebar() {
  const ctx = useContext(DashboardSidebarContext);
  if (!ctx) {
    throw new Error("useDashboardSidebar must be used within DashboardShell");
  }
  return ctx;
}

export function DashboardShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const hasSidebar = sidebar != null;
  const [desktopExpanded, setDesktopExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "false") setDesktopExpanded(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const persistDesktop = useCallback((next: boolean) => {
    setDesktopExpanded(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    if (!hasSidebar) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      persistDesktop(!desktopExpanded);
    } else {
      setMobileOpen((o) => !o);
    }
  }, [hasSidebar, desktopExpanded, persistDesktop]);

  const value = useMemo(
    () => ({
      desktopExpanded,
      mobileOpen,
      toggleSidebar,
      hasSidebar,
    }),
    [desktopExpanded, mobileOpen, toggleSidebar, hasSidebar]
  );

  return (
    <DashboardSidebarContext.Provider value={value}>
      {hasSidebar ? (
        <>
          {/* Mobile backdrop */}
          <div
            className={cn(
              "fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden",
              mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            )}
            aria-hidden={!mobileOpen}
            onClick={() => setMobileOpen(false)}
          />

          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r bg-background/95 backdrop-blur",
              "transition-[transform,width] duration-200 ease-out",
              "max-md:-translate-x-full max-md:shadow-lg",
              mobileOpen && "max-md:translate-x-0",
              "md:translate-x-0",
              !desktopExpanded && "md:w-0 md:overflow-hidden md:border-0 md:shadow-none"
            )}
          >
            <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4">{sidebar}</div>
          </aside>
        </>
      ) : null}

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out",
          hasSidebar && desktopExpanded && "md:pl-64"
        )}
      >
        {children}
      </div>
    </DashboardSidebarContext.Provider>
  );
}
