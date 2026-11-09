import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { loadCategory } from "@/lib/acervo";
import AppShell from "@/components/AppShell";
import ErrorBox from "@/components/ErrorBox";
import ImageGallery from "@/components/ImageGallery";

export const metadata = { title: "Identidade visual" };

export default async function IdentidadeVisualPage() {
  if (!(await getSession())) redirect("/login");
  const { files, error } = await loadCategory("identidade-visual");

  return (
    <AppShell eyebrow="Documentos" title="Identidade visual">
      {error && <ErrorBox>{error}</ErrorBox>}
      <ImageGallery files={files} />
    </AppShell>
  );
}
