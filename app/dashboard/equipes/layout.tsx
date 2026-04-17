/**
 * Rotas filhas definem o próprio controle de acesso.
 * - Listagem de equipes (`/dashboard/equipes`): só administrador global.
 * - Catálogo nível/turno (`/dashboard/equipes/catalog`): staff (ADMIN ou ADMIN_TEAM).
 */
export default function EquipesLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}
