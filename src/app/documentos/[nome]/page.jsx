import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Download, Pencil } from "lucide-react";
import { getSession } from "@/lib/session";
import { lastChange, readFile } from "@/lib/files";
import { docUrl, formatDateTime, isSafeFileName, paramToName } from "@/lib/library";
import AppShell from "@/components/AppShell";
import DeleteFileButton from "@/components/DeleteFileButton";
import MarkdownView from "@/components/MarkdownView";

export async function generateMetadata({ params }) {
  const { nome } = await params;
  return { title: paramToName(nome) };
}

export default async function DocumentoPage({ params }) {
  if (!(await getSession())) redirect("/login");

  const { nome } = await params;
  const name = paramToName(nome);
  const fileName = `${name}.md`;
  if (!isSafeFileName(fileName)) notFound();

  const [file, change] = await Promise.all([
    readFile(`decisoes/${fileName}`),
    lastChange(`decisoes/${fileName}`),
  ]);
  if (!file) notFound();

  const date = change?.date ? formatDateTime(change.date, { long: true }) : null;

  return (
    <AppShell eyebrow="Documentos de decisão" title={name}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <Link
          href="/documentos"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors"
        >
          <ArrowLeft size={14} /> Voltar aos documentos
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={docUrl(name, "/editar")}
            prefetch={false}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-dark transition-colors"
          >
            <Pencil size={13} /> Editar
          </Link>
          <a
            href={docUrl(name, "/word")}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-gold hover:text-gold transition-colors"
          >
            <Download size={12} /> Baixar em Word
          </a>
          <a
            href={docUrl(name, "/pdf")}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-gold hover:text-gold transition-colors"
          >
            <Download size={12} /> Baixar em PDF
          </a>
          <DeleteFileButton category="decisoes" fileName={fileName} sha={file.sha} redirectTo="/documentos" />
        </div>
      </div>

      {date && (
        <p className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
          <Clock size={12} /> Última alteração em {date}
          {change.author ? ` por ${change.author}` : ""}
        </p>
      )}

      <article className="bg-white border border-gray-100 rounded-2xl shadow-sm px-6 py-6 sm:px-10 sm:py-8">
        <MarkdownView content={file.buffer.toString("utf8")} />
      </article>
    </AppShell>
  );
}
