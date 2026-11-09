import { getSession } from "@/lib/session";
import { readFile } from "@/lib/files";
import { CATEGORIES, contentTypeFor, isSafeFileName, paramToName } from "@/lib/library";

// Serve os arquivos do acervo só para quem está logado. O repositório é
// privado, então o navegador nunca fala com o GitHub direto: tudo passa aqui.
//
//   /arquivos/<categoria>/<arquivo>           → exibe no navegador
//   /arquivos/<categoria>/<arquivo>?baixar=1  → sempre baixa
export async function GET(request, { params }) {
  if (!(await getSession())) return new Response("Não autorizado.", { status: 401 });

  const { caminho } = await params;
  if (!Array.isArray(caminho) || caminho.length !== 2) return notFound();
  const [category, rawName] = caminho;
  const fileName = paramToName(rawName);
  const config = CATEGORIES[category];
  const contentType = contentTypeFor(category, fileName);
  if (!config || !contentType || !isSafeFileName(fileName)) return notFound();

  let file;
  try {
    file = await readFile(`${config.folder}/${fileName}`);
  } catch (err) {
    console.error(err);
    return new Response("Erro ao carregar o arquivo.", { status: 502 });
  }
  if (!file) return notFound();

  const etag = `"${file.sha}"`;
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": "private, no-cache",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  const download = request.nextUrl.searchParams.has("baixar");
  headers["Content-Disposition"] =
    `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(fileName)}`;
  // O CSP com sandbox destas respostas fica em next.config.mjs.

  return new Response(file.buffer, { headers });
}

function notFound() {
  return new Response("Arquivo não encontrado.", { status: 404 });
}
