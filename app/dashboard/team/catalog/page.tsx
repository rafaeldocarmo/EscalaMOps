import { redirect } from "next/navigation";

/** Compatibilidade: a tela foi para Configurações → Níveis e turnos. */
export default function TeamCatalogLegacyRedirect() {
  redirect("/dashboard/equipes/catalog");
}
