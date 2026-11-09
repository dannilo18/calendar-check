import "server-only";
import { Marked } from "marked";
import HTMLtoDOCX from "@turbodocx/html-to-docx";

const marked = new Marked({ gfm: true });

// Markdown do documento → arquivo Word (.docx), A4, Calibri 11.
export async function markdownToDocx(markdown, title) {
  const body = marked
    .parse(markdown)
    // Checkbox de lista de tarefas não existe no Word: vira ☐ / ☑.
    .replace(/<input[^>]*checked[^>]*>\s*/g, "☑ ")
    .replace(/<input[^>]*type="checkbox"[^>]*>\s*/g, "☐ ");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title></title></head><body>${body}</body></html>`;
  const result = await HTMLtoDOCX(html, null, {
    title,
    creator: "Agenda Privada",
    lang: "pt-BR",
    font: "Calibri",
    fontSize: 22,
    pageSize: { width: 11906, height: 16838 },
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
  });
  return Buffer.isBuffer(result) ? result : Buffer.from(result);
}
