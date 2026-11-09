import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { loadCategory } from "@/lib/acervo";
import AppShell from "@/components/AppShell";
import ErrorBox from "@/components/ErrorBox";
import FileManager from "@/components/FileManager";

export const metadata = { title: "Gestão de imagens" };

export default async function GestaoImagensPage() {
  if (!(await getSession())) redirect("/login");
  const { files, error } = await loadCategory("identidade-visual");

  return (
    <AppShell eyebrow="Identidade visual" title="Gestão de imagens">
      {error && <ErrorBox>{error}</ErrorBox>}
      <FileManager category="identidade-visual" files={files} />
    </AppShell>
  );
}
