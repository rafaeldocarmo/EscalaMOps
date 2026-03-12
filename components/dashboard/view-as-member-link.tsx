"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface ViewAsMemberLinkProps {
  hasMemberView: boolean;
}

export function ViewAsMemberLink({ hasMemberView }: ViewAsMemberLinkProps) {
  const router = useRouter();
  const { update: updateSession } = useSession();

  if (hasMemberView) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-sm text-muted-foreground hover:text-foreground font-medium h-auto py-0"
        onClick={async () => {
          await updateSession({ member: null });
          router.push("/dashboard/team");
          router.refresh();
        }}
      >
        Sair da visão membro
      </Button>
    );
  }

  return (
    <Link
      href="/celular"
      className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
    >
      Visualizar como membro
    </Link>
  );
}
