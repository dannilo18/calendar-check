import { getSession } from "@/lib/session";
import { readFile } from "@/lib/files";
import { isSafeFileName, paramToName } from "@/lib/library";
import { markdownToDocx } from "@/lib/word";

// Baixa o documento de decisão como Word (.docx), gerado na hora a partir do
// markdown salvo.
export async function GET(_request, { params }) {
  if (!(await getSession())) return new Response("Não autorizado.", { status: 401 });

  const { nome } = await params;
  const name = paramToName(nome);
  if (!isSafeFileName(`${name}.md`)) return new Response("Documento não encontrado.", { status: 404 });

  let docx;
  try {
    const file = await readFile(`decisoes/${name}.md`);
    if (!file) return new Response("Documento não encontrado.", { status: 404 });
    docx = await markdownToDocx(file.buffer.toString("utf8"), name);
  } catch (err) {
    console.error(err);
    return new Response("Erro ao gerar o arquivo Word.", { status: 500 });
  }

  return new Response(docx, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${name}.docx`)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
