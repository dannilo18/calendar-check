import "server-only";
import pdfmake from "pdfmake";
import vfsFonts from "pdfmake/build/vfs_fonts";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

// Markdown do documento → PDF (A4), gerado no servidor com pdfmake. As fontes
// (Roboto) vêm embutidas no pacote, então funciona também na Vercel.

const PRIMARY = "#1a2744";
const GOLD = "#c5973a";
const GRAY = "#6b7280";
const LINE = "#e5e7eb";
const CONTENT_WIDTH = 595.28 - 2 * 56; // A4 menos as margens

for (const [name, data] of Object.entries(vfsFonts)) {
  pdfmake.sharedVirtualfs.writeFileSync(name, data, "base64");
}
pdfmake.setFonts({
  Roboto: {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf",
  },
});
// O documento nunca precisa buscar nada fora (nem disco, nem internet).
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => false);

// ---------------------------------------------------------------------------
// Trechos de texto (negrito, itálico, sublinhado, links...)
// ---------------------------------------------------------------------------

function inline(nodes, marks = {}, state = { underline: false }) {
  const out = [];
  for (const node of nodes ?? []) {
    switch (node.type) {
      case "text":
        out.push(run(node.value, marks, state));
        break;
      case "strong":
        out.push(...inline(node.children, { ...marks, bold: true }, state));
        break;
      case "emphasis":
        out.push(...inline(node.children, { ...marks, italics: true }, state));
        break;
      case "delete":
        out.push(...inline(node.children, { ...marks, strike: true }, state));
        break;
      case "link":
        out.push(...inline(node.children, { ...marks, link: node.url }, state));
        break;
      case "inlineCode":
        out.push({ ...run(node.value, marks, state), background: "#f3f4f6", color: PRIMARY });
        break;
      case "break":
        out.push("\n");
        break;
      case "html":
        // O editor grava sublinhado como <u>…</u>; outras tags são ignoradas.
        if (/^<u>$/i.test(node.value)) state.underline = true;
        else if (/^<\/u>$/i.test(node.value)) state.underline = false;
        else out.push(run(node.value.replace(/<[^>]+>/g, ""), marks, state));
        break;
      case "image":
        if (node.alt) out.push(run(`[imagem: ${node.alt}]`, { ...marks, italics: true }, state));
        break;
      default:
        if (node.children) out.push(...inline(node.children, marks, state));
        else if (node.value) out.push(run(node.value, marks, state));
    }
  }
  return out;
}

function run(text, marks, state) {
  const r = { text };
  if (marks.bold) r.bold = true;
  if (marks.italics) r.italics = true;
  const decoration = [];
  if (state.underline || marks.link) decoration.push("underline");
  if (marks.strike) decoration.push("lineThrough");
  if (decoration.length) r.decoration = decoration.length === 1 ? decoration[0] : decoration;
  if (marks.link) {
    r.link = marks.link;
    r.color = "#a87d2a";
  }
  return r;
}

// ---------------------------------------------------------------------------
// Blocos (títulos, parágrafos, listas, tabelas...)
// ---------------------------------------------------------------------------

function blocks(nodes) {
  return (nodes ?? []).map(block).filter(Boolean);
}

function block(node) {
  switch (node.type) {
    case "heading":
      return { text: inline(node.children), style: `h${Math.min(node.depth, 4)}` };
    case "paragraph":
      return { text: inline(node.children), margin: [0, 0, 0, 8] };
    case "list":
      return list(node);
    case "blockquote":
      return {
        table: { widths: ["*"], body: [[{ stack: blocks(node.children), italics: true, color: GRAY }]] },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: (i) => (i === 0 ? 3 : 0),
          vLineColor: () => GOLD,
          paddingLeft: () => 12,
          paddingTop: () => 4,
          paddingBottom: () => 0,
        },
        margin: [0, 2, 0, 10],
      };
    case "code":
      return {
        table: { widths: ["*"], body: [[{ text: node.value, fontSize: 9, preserveLeadingSpaces: true }]] },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          fillColor: () => "#f3f4f6",
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 2, 0, 10],
      };
    case "thematicBreak":
      return {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.8, lineColor: LINE }],
        margin: [0, 8, 0, 14],
      };
    case "table":
      return table(node);
    case "html": {
      const text = node.value.replace(/<[^>]+>/g, "").trim();
      return text ? { text, margin: [0, 0, 0, 8] } : null;
    }
    default:
      return null;
  }
}

function listItemContent(item) {
  const content = blocks(item.children);
  // Parágrafos dentro de item não precisam do espaço de parágrafo solto.
  // Listas aninhadas também ficam coladas.
  for (const c of content) {
    if (c.text && c.margin) c.margin = [0, 0, 0, 2];
    else if (c.ul || c.ol || c.stack) c.margin = [0, 0, 0, 2];
  }
  return content.length === 1 ? content[0] : { stack: content };
}

function checkbox(checked) {
  const box = [{ type: "rect", x: 0, y: 2.5, w: 9, h: 9, r: 1.5, lineWidth: 0.9, lineColor: GRAY }];
  if (checked) {
    box.push({
      type: "polyline",
      lineWidth: 1.4,
      lineColor: PRIMARY,
      points: [
        { x: 2, y: 7 },
        { x: 4, y: 9.5 },
        { x: 7.5, y: 4.5 },
      ],
    });
  }
  return { canvas: box, width: 14 };
}

function list(node) {
  const isTask = node.children.some((item) => typeof item.checked === "boolean");
  if (isTask) {
    return {
      stack: node.children.map((item) => ({
        columns: [checkbox(item.checked), { ...wrap(listItemContent(item)), width: "*" }],
        columnGap: 4,
        margin: [0, 0, 0, 3],
      })),
      margin: [0, 0, 0, 8],
    };
  }
  const items = node.children.map(listItemContent);
  return node.ordered
    ? { ol: items, start: node.start ?? 1, margin: [0, 0, 0, 8] }
    : { ul: items, margin: [0, 0, 0, 8] };
}

function wrap(content) {
  return content.stack || content.text !== undefined ? content : { stack: [content] };
}

function table(node) {
  const columns = Math.max(...node.children.map((row) => row.children.length));
  const body = node.children.map((row, r) => {
    const cells = row.children.map((cell, c) => ({
      text: inline(cell.children),
      bold: r === 0,
      color: r === 0 ? PRIMARY : undefined,
      fillColor: r === 0 ? "#f1f2f5" : undefined,
      alignment: node.align?.[c] ?? "left",
    }));
    while (cells.length < columns) cells.push({ text: "" });
    return cells;
  });
  return {
    table: { headerRows: 1, widths: Array(columns).fill("*"), body },
    layout: {
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      hLineColor: () => LINE,
      vLineColor: () => LINE,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    fontSize: 10,
    margin: [0, 2, 0, 12],
  };
}

// ---------------------------------------------------------------------------

/**
 * @param {string} markdown
 * @param {string} title  vira o título no topo e nos metadados do PDF
 * @param {string} [subtitle] ex.: "Última alteração em … por …"
 */
export async function markdownToPdf(markdown, title, subtitle) {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

  const doc = pdfmake.createPdf({
    pageSize: "A4",
    pageMargins: [56, 56, 56, 56],
    info: { title, creator: "Agenda Privada", producer: "Agenda Privada" },
    defaultStyle: { font: "Roboto", fontSize: 11, lineHeight: 1.3, color: "#374151" },
    styles: {
      title: { fontSize: 20, bold: true, color: PRIMARY },
      subtitle: { fontSize: 9, color: GRAY },
      h1: { fontSize: 17, bold: true, color: PRIMARY, margin: [0, 14, 0, 6] },
      h2: { fontSize: 14, bold: true, color: PRIMARY, margin: [0, 12, 0, 5] },
      h3: { fontSize: 12, bold: true, color: PRIMARY, margin: [0, 10, 0, 4] },
      h4: { fontSize: 10, bold: true, color: GRAY, margin: [0, 8, 0, 3] },
    },
    content: [
      { text: title, style: "title" },
      subtitle ? { text: subtitle, style: "subtitle", margin: [0, 4, 0, 0] } : null,
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 1.5, lineColor: GOLD }],
        margin: [0, 10, 0, 16],
      },
      ...blocks(tree.children),
    ].filter(Boolean),
    footer: (page, pages) => ({
      text: `${title}  ·  Página ${page} de ${pages}`,
      alignment: "center",
      fontSize: 8,
      color: "#9ca3af",
      margin: [56, 20, 56, 0],
    }),
  });
  return doc.getBuffer();
}
