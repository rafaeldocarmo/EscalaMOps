import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { JiraExtractionPanel } from "@/components/jira/JiraExtractionPanel";

export default async function JiraExtractionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">Extração de chamados Jira</h1>
        <p className="text-sm text-muted-foreground">
          Busca chamados do Jira em tempo real e exporta em CSV ou Excel.
        </p>
      </div>
      <JiraExtractionPanel />
    </div>
  );
}
