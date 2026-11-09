"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ConflictError, deleteFile, listFiles, writeFile } from "@/lib/files";
import {
  CATEGORIES,
  MAX_UPLOAD_BYTES,
  baseName,
  cleanName,
  contentTypeFor,
  docUrl,
  extensionOf,
  formatBytes,
  isSafeFileName,
} from "@/lib/library";

const MAX_DOC_CHARS = 500_000;
const DOCS = CATEGORIES.decisoes.folder;

function docPath(name) {
  return `${DOCS}/${name}.md`;
}

// ---------------------------------------------------------------------------
// Documentos de decisão (markdown)
// ---------------------------------------------------------------------------

// Cria ou salva um documento. `sha` é a versão que o editor carregou: se
// alguém salvou depois disso, nada é sobrescrito e o texto volta para a tela.
// As páginas do acervo são dinâmicas (dependem da sessão), então não há cache
// para invalidar: quem chama navega ou faz router.refresh().
export async function saveDocumentAction(_prevState, formData) {
  const session = await getSession();
  if (!session) return { error: "Sessão expirada. Faça login novamente." };
  const author = session.user;

  const originalName = formData.get("originalName")?.toString() || null;
  const sha = formData.get("sha")?.toString() || null;
  const rawName = formData.get("name")?.toString() ?? "";
  const content = formData.get("content")?.toString() ?? "";
  const values = { name: rawName, content };

  const name = cleanName(rawName);
  if (!name) return { error: "Informe o título do documento.", field: "name", values };
  // "/documentos/novo" é a rota de criação: um documento com esse nome
  // ficaria inacessível.
  if (name.toLowerCase() === "novo")
    return { error: 'Escolha outro título (“novo” é reservado).', field: "name", values };
  if (content.length > MAX_DOC_CHARS)
    return { error: "Documento grande demais.", field: "content", values };

  const buffer = Buffer.from(`${content.replace(/\r\n/g, "\n").trimEnd()}\n`, "utf8");
  const renamed = originalName && originalName !== name;

  try {
    if (!originalName || renamed) {
      await writeFile(docPath(name), buffer, {
        sha: null,
        message: originalName
          ? `documentos: ${author.name} renomeou "${originalName}" para "${name}"`
          : `documentos: ${author.name} criou "${name}"`,
        author,
      });
    } else {
      await writeFile(docPath(name), buffer, {
        sha,
        message: `documentos: ${author.name} editou "${name}"`,
        author,
      });
    }
  } catch (err) {
    if (err instanceof ConflictError) {
      return !originalName || renamed
        ? { error: `Já existe um documento chamado "${name}".`, field: "name", values }
        : {
            error:
              "Outra pessoa salvou este documento enquanto você editava. Copie o seu texto, recarregue a página e aplique suas mudanças na versão nova.",
            conflict: true,
            values,
          };
    }
    console.error(err);
    return { error: "Erro ao salvar o documento.", values };
  }

  if (renamed) {
    try {
      await deleteFile(docPath(originalName), {
        sha,
        message: `documentos: ${author.name} renomeou "${originalName}" para "${name}"`,
        author,
      });
    } catch (err) {
      console.error(err);
      return {
        success: true,
        name,
        warning: `Salvo como "${name}", mas a versão antiga "${originalName}" foi alterada por outra pessoa e foi mantida.`,
      };
    }
  }

  // Redireciona daqui (e não do cliente): ao renomear, a página de edição
  // atual deixa de existir e não pode ser recarregada.
  redirect(docUrl(name));
}

// ---------------------------------------------------------------------------
// Upload (PDFs e identidade visual)
// ---------------------------------------------------------------------------

// Sem `resolution`, um nome repetido devolve { conflict } para a tela
// perguntar: "overwrite" substitui, "keep-both" acrescenta " (2)", " (3)"...
export async function uploadFileAction(_prevState, formData) {
  const session = await getSession();
  if (!session) return { error: "Sessão expirada. Faça login novamente." };
  const author = session.user;

  const category = formData.get("category")?.toString();
  const config = CATEGORIES[category];
  if (!config || category === "decisoes") return { error: "Categoria inválida." };

  const file = formData.get("file");
  const resolution = formData.get("resolution")?.toString() || null;
  if (!file || typeof file === "string" || file.size === 0)
    return { error: "Selecione um arquivo." };
  if (file.size > MAX_UPLOAD_BYTES)
    return { error: `Arquivo grande demais (máximo ${formatBytes(MAX_UPLOAD_BYTES)}).` };

  const extension = extensionOf(file.name) === "jpeg" ? "jpg" : extensionOf(file.name);
  if (!contentTypeFor(category, `x.${extension}`))
    return { error: `Tipo de arquivo não aceito. Envie ${config.typeLabel}.` };

  const name = cleanName(formData.get("name")?.toString() || baseName(file.name));
  if (!name) return { error: "Informe o nome do arquivo." };

  let existing;
  try {
    existing = await listFiles(config.folder);
  } catch (err) {
    console.error(err);
    return { error: "Erro ao verificar os arquivos existentes." };
  }
  const taken = new Map(existing.map((f) => [f.name.toLowerCase(), f]));

  let fileName = `${name}.${extension}`;
  let sha = null;
  const clash = taken.get(fileName.toLowerCase());
  if (clash) {
    if (!resolution) return { conflict: true, existingName: clash.name };
    if (resolution === "overwrite") {
      fileName = clash.name;
      sha = clash.sha;
    } else {
      let i = 2;
      while (taken.has(`${name} (${i}).${extension}`.toLowerCase())) i++;
      fileName = `${name} (${i}).${extension}`;
    }
  }

  try {
    await writeFile(`${config.folder}/${fileName}`, Buffer.from(await file.arrayBuffer()), {
      sha,
      message: `${category}: ${author.name} ${sha ? "substituiu" : "enviou"} "${fileName}"`,
      author,
    });
  } catch (err) {
    if (err instanceof ConflictError)
      return { error: "Outra pessoa enviou um arquivo com esse nome agora há pouco. Tente de novo." };
    console.error(err);
    return { error: "Erro ao enviar o arquivo." };
  }

  return { success: true, fileName };
}

// ---------------------------------------------------------------------------
// Exclusão (qualquer categoria)
// ---------------------------------------------------------------------------

export async function deleteFileAction(category, fileName, sha) {
  const session = await getSession();
  if (!session) return { error: "Sessão expirada. Faça login novamente." };
  const config = CATEGORIES[category];
  if (!config || !isSafeFileName(fileName))
    return { error: "Arquivo inválido." };

  try {
    await deleteFile(`${config.folder}/${fileName}`, {
      sha: sha || null,
      message: `${category}: ${session.user.name} excluiu "${fileName}"`,
      author: session.user,
    });
  } catch (err) {
    if (err instanceof ConflictError)
      return { error: "O arquivo foi alterado por outra pessoa. Recarregue a página." };
    console.error(err);
    return { error: "Erro ao excluir o arquivo." };
  }

  return { success: true };
}
