import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { readFile } from "@/lib/files";
import { docUrl, isSafeFileName, paramToName } from "@/lib/library";
import AppShell from "@/components/AppShell";
import DocumentEditor from "@/components/DocumentEditor";

export const metadata = { title: "Editar documento" };

export default async function EditarDocumentoPage({ params }) {
  if (!(await getSession())) redirect("/login");

  const { nome } = await params;
  const name = paramToName(nome);
  if (!isSafeFileName(`${name}.md`)) notFound();
  const file = await readFile(`decisoes/${name}.md`);
  if (!file) notFound();

  return (
    <AppShell eyebrow="Documentos de decisão" title="Editar documento">
      <Link
        href={docUrl(name)}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors mb-8"
      >
        <ArrowLeft size={14} /> Voltar ao documento
      </Link>
      <DocumentEditor doc={{ name, sha: file.sha, content: file.buffer.toString("utf8") }} />
    </AppShell>
  );
}
