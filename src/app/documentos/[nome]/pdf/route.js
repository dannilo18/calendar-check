import { getSession } from "@/lib/session";
import { lastChange, readFile } from "@/lib/files";
import { formatDateTime, isSafeFileName, paramToName } from "@/lib/library";
import { markdownToPdf } from "@/lib/pdf";

// Baixa o documento de decisão como PDF, gerado na hora a partir do
// markdown salvo.
export async function GET(_request, { params }) {
  if (!(await getSession())) return new Response("Não autorizado.", { status: 401 });

  const { nome } = await params;
  const name = paramToName(nome);
  const filePath = `decisoes/${name}.md`;
  if (!isSafeFileName(`${name}.md`)) return new Response("Documento não encontrado.", { status: 404 });

  let pdf;
  try {
    const [file, change] = await Promise.all([readFile(filePath), lastChange(filePath)]);
    if (!file) return new Response("Documento não encontrado.", { status: 404 });
    const subtitle = change?.date
      ? `Última alteração em ${formatDateTime(change.date, { long: true })}${change.author ? ` por ${change.author}` : ""}`
      : undefined;
    pdf = await markdownToPdf(file.buffer.toString("utf8"), name, subtitle);
  } catch (err) {
    console.error(err);
    return new Response("Erro ao gerar o PDF.", { status: 500 });
  }

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${name}.pdf`)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
