import "server-only";
import { lastChanges, listFiles } from "./files";
import { CATEGORIES, extensionOf, formatDateTime } from "./library";

// Lista uma categoria em ordem alfabética, só com as extensões aceitas.
// Com `withChanges`, cada arquivo traz `changed` ("10 de nov. de 2026, 14:30")
// e `changedBy` da última alteração. Em caso de falha devolve { error } para a
// página mostrar um aviso.
export async function loadCategory(category, { withChanges = false } = {}) {
  const config = CATEGORIES[category];
  try {
    let files = (await listFiles(config.folder))
      .filter((f) => config.extensions[extensionOf(f.name)])
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true, sensitivity: "base" }));
    if (withChanges) {
      const changes = await lastChanges(files.map((f) => f.path));
      files = files.map((f) => {
        const c = changes.get(f.path);
        return { ...f, changed: c ? formatDateTime(c.date) : null, changedBy: c?.author ?? null };
      });
    }
    return { files, error: null };
  } catch (err) {
    console.error(err);
    return { files: [], error: "Não foi possível carregar os arquivos. Tente novamente em instantes." };
  }
}
