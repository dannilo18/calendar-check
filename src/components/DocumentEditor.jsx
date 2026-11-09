"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import {
  AlertCircle,
  Bold,
  CheckSquare,
  FileUp,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  Save,
  Strikethrough,
  Table,
  Underline,
  Undo2,
} from "lucide-react";
import { saveDocumentAction } from "@/app/actions/documentos";
import { docUrl } from "@/lib/library";
import { Field, INPUT, INPUT_ERROR } from "./fields";

// Editor visual, no estilo do Word: ninguém vê markdown. O texto continua
// sendo salvo em markdown (legível no GitHub e no histórico), convertido
// pelo próprio editor ao salvar.

const TEMPLATE = `## Contexto

Descreva a situação que motivou a decisão.

## Decisão

O que foi decidido.

## Responsáveis e prazos

- [ ] Tarefa — responsável — prazo
`;

// Ajusta o HTML que o mammoth gera do Word para o que o editor espera:
// - tabela do Word não tem cabeçalho marcado: a 1ª linha vira cabeçalho;
// - listas com ☐/☑ (como exportamos tarefas para o Word) voltam a ser tarefas;
// - imagens são descartadas (ficariam embutidas no texto).
function adaptWordHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("img").forEach((img) => img.remove());
  doc.querySelectorAll("table").forEach((table) => {
    const first = table.querySelector("tr");
    if (!first || first.querySelector("th")) return;
    first.querySelectorAll("td").forEach((td) => {
      const th = doc.createElement("th");
      th.innerHTML = td.innerHTML;
      td.replaceWith(th);
    });
  });
  doc.querySelectorAll("ul").forEach((ul) => {
    const items = [...ul.children].filter((li) => li.tagName === "LI");
    if (!items.length || !items.every((li) => /^\s*[☐☑]/.test(li.textContent))) return;
    ul.setAttribute("data-type", "taskList");
    for (const li of items) {
      li.setAttribute("data-type", "taskItem");
      li.setAttribute("data-checked", String(li.textContent.trim().startsWith("☑")));
      const walker = doc.createTreeWalker(li, NodeFilter.SHOW_TEXT);
      const text = walker.nextNode();
      if (text) text.textContent = text.textContent.replace(/^\s*[☐☑]\s*/, "");
    }
  });
  return doc.body.innerHTML;
}

const STYLES = [
  { value: "p", label: "Texto normal" },
  { value: "1", label: "Título 1" },
  { value: "2", label: "Título 2" },
  { value: "3", label: "Título 3" },
];

export default function DocumentEditor({ doc }) {
  const isEdit = !!doc;
  const [state, formAction, isPending] = useActionState(saveDocumentAction, null);
  const [name, setName] = useState(doc?.name ?? "");
  const [baseline, setBaseline] = useState(null);
  const [changed, setChanged] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const editor = useEditor({
    immediatelyRender: false,
    // Re-renderiza a cada mudança para a barra refletir negrito/estilo atuais
    // (documentos são pequenos, o custo é desprezível).
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Image,
      Placeholder.configure({ placeholder: "Comece a escrever aqui…" }),
      Markdown,
    ],
    content: doc?.content ?? TEMPLATE,
    contentType: "markdown",
    editorProps: { attributes: { class: "markdown doc-editor" } },
    // O markdown de referência é o que o próprio editor gera ao abrir, para
    // diferenças só de formatação não contarem como "alteração".
    onCreate: ({ editor }) => setBaseline(editor.getMarkdown()),
    onUpdate: () => setChanged(true),
  });

  const dirty = name !== (doc?.name ?? "") || (changed && editor?.getMarkdown() !== baseline);

  // Ao sair com alterações não salvas, o navegador pede confirmação.
  useEffect(() => {
    if (!dirty || isPending) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, isPending]);

  useEffect(() => {
    if (state?.field === "name") document.querySelector('[name="name"]')?.focus();
  }, [state]);

  function submit() {
    if (isPending || !editor) return;
    const formData = new FormData();
    if (isEdit) {
      formData.set("originalName", doc.name);
      formData.set("sha", doc.sha);
    }
    formData.set("name", name);
    formData.set("content", editor.getMarkdown());
    startTransition(() => formAction(formData));
  }

  // Word (.docx) → texto do editor. Imagens do Word não são trazidas.
  async function importWord(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;
    if (!/\.docx$/i.test(file.name)) {
      setImportMsg({ error: true, text: "Envie um arquivo .docx (Word 2007 ou mais novo). Arquivos .doc antigos: abra no Word e use “Salvar como” .docx." });
      return;
    }
    const hasText = editor.getText().trim() && editor.getMarkdown() !== baseline;
    if (hasText && !window.confirm("Substituir o texto atual pelo conteúdo do arquivo Word?")) return;

    setImporting(true);
    setImportMsg(null);
    try {
      const mammoth = (await import("mammoth")).default;
      let images = 0;
      const result = await mammoth.convertToHtml(
        { arrayBuffer: await file.arrayBuffer() },
        {
          // O mammoth ignora sublinhado por padrão.
          styleMap: ["u => u"],
          convertImage: mammoth.images.imgElement(() => {
            images++;
            return { src: "" };
          }),
        },
      );
      const html = adaptWordHtml(result.value);
      editor.commands.setContent(html, { contentType: "html", emitUpdate: true });
      setChanged(true);
      if (!name.trim()) setName(file.name.replace(/\.docx$/i, ""));
      setImportMsg({
        error: false,
        text: `Conteúdo de “${file.name}” importado. Confira a formatação antes de salvar.${
          images ? ` ${images} imagem(ns) do Word não foram trazidas.` : ""
        }`,
      });
    } catch (err) {
      console.error(err);
      setImportMsg({ error: true, text: "Não foi possível ler este arquivo Word." });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      className="space-y-5"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          submit();
        }
      }}
    >
      {state?.error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {state.error}
        </div>
      )}
      {state?.warning && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 text-sm">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <span>
            {state.warning}{" "}
            <Link href={docUrl(state.name)} className="font-semibold underline">
              Abrir documento
            </Link>
          </span>
        </div>
      )}

      <Field label="Título do documento" required>
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Ata da reunião de 10/11/2026"
          className={`${INPUT} text-base ${state?.field === "name" ? INPUT_ERROR : ""}`}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".docx" className="sr-only" onChange={importWord} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing || !editor}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-primary hover:border-gold hover:text-gold disabled:opacity-60 transition-colors"
        >
          {importing ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
          Importar do Word
        </button>
        <span className="text-xs text-gray-400">Traz o texto de um arquivo .docx para o editor.</span>
      </div>
      {importMsg && (
        <p className={`text-sm ${importMsg.error ? "text-red-600" : "text-green-700"}`}>{importMsg.text}</p>
      )}

      <div className="rounded-2xl border border-gray-200 bg-gray-100 overflow-hidden">
        <Toolbar editor={editor} />
        {/* "Folha" branca centralizada, como uma página do Word. */}
        <div className="px-2 py-4 sm:px-6 sm:py-6 max-h-[75vh] overflow-y-auto">
          <div className="bg-white shadow-sm rounded-md max-w-3xl mx-auto min-h-[55vh] px-5 py-6 sm:px-12 sm:py-10">
            {editor ? (
              <EditorContent editor={editor} />
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin" /> Carregando editor…
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !editor}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-base font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isEdit ? "Salvar alterações" : "Criar documento"}
        </button>
        <Link
          href={isEdit ? docUrl(doc.name) : "/documentos"}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancelar
        </Link>
        <span className="text-xs text-gray-400 ml-auto">
          {dirty ? "Alterações não salvas · Ctrl+S para salvar" : "Sem alterações"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Toolbar({ editor }) {
  if (!editor) return <div className="h-12 bg-white border-b border-gray-200" />;
  const e = editor;
  const s = {
    style: e.isActive("heading", { level: 1 })
      ? "1"
      : e.isActive("heading", { level: 2 })
        ? "2"
        : e.isActive("heading", { level: 3 })
          ? "3"
          : "p",
    bold: e.isActive("bold"),
    italic: e.isActive("italic"),
    underline: e.isActive("underline"),
    strike: e.isActive("strike"),
    bullet: e.isActive("bulletList"),
    ordered: e.isActive("orderedList"),
    task: e.isActive("taskList"),
    quote: e.isActive("blockquote"),
    link: e.isActive("link"),
    table: e.isActive("table"),
    canUndo: e.can().undo(),
    canRedo: e.can().redo(),
  };

  const chain = () => editor.chain().focus();

  function setStyle(value) {
    if (value === "p") chain().setParagraph().run();
    else chain().setHeading({ level: Number(value) }).run();
  }

  function setLink() {
    const current = editor.getAttributes("link").href ?? "";
    const url = window.prompt("Endereço do link (deixe vazio para remover):", current || "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="bg-white border-b border-gray-200 px-2 py-1.5 space-y-1">
      <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Formatação">
        <Btn title="Desfazer (Ctrl+Z)" icon={Undo2} disabled={!s.canUndo} onClick={() => chain().undo().run()} />
        <Btn title="Refazer (Ctrl+Y)" icon={Redo2} disabled={!s.canRedo} onClick={() => chain().redo().run()} />
        <Sep />
        <select
          value={s.style}
          onChange={(e) => setStyle(e.target.value)}
          aria-label="Estilo do parágrafo"
          className="h-9 border border-gray-200 rounded-lg px-2 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-gold/30"
        >
          {STYLES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Sep />
        <Btn title="Negrito (Ctrl+B)" icon={Bold} active={s.bold} onClick={() => chain().toggleBold().run()} />
        <Btn title="Itálico (Ctrl+I)" icon={Italic} active={s.italic} onClick={() => chain().toggleItalic().run()} />
        <Btn title="Sublinhado (Ctrl+U)" icon={Underline} active={s.underline} onClick={() => chain().toggleUnderline().run()} />
        <Btn title="Riscado" icon={Strikethrough} active={s.strike} onClick={() => chain().toggleStrike().run()} />
        <Sep />
        <Btn title="Lista com marcadores" icon={List} active={s.bullet} onClick={() => chain().toggleBulletList().run()} />
        <Btn title="Lista numerada" icon={ListOrdered} active={s.ordered} onClick={() => chain().toggleOrderedList().run()} />
        <Btn title="Lista de tarefas" icon={CheckSquare} active={s.task} onClick={() => chain().toggleTaskList().run()} />
        <Btn title="Citação" icon={Quote} active={s.quote} onClick={() => chain().toggleBlockquote().run()} />
        <Sep />
        <Btn title="Link" icon={Link2} active={s.link} onClick={setLink} />
        <Btn
          title="Inserir tabela"
          icon={Table}
          active={s.table}
          onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        />
        <Btn title="Linha divisória" icon={Minus} onClick={() => chain().setHorizontalRule().run()} />
      </div>

      {s.table && (
        <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-gray-100 text-xs">
          <span className="text-gray-400 font-semibold uppercase tracking-wide px-1">Tabela:</span>
          <TextBtn onClick={() => chain().addRowAfter().run()}>+ Linha</TextBtn>
          <TextBtn onClick={() => chain().addColumnAfter().run()}>+ Coluna</TextBtn>
          <TextBtn onClick={() => chain().deleteRow().run()}>− Linha</TextBtn>
          <TextBtn onClick={() => chain().deleteColumn().run()}>− Coluna</TextBtn>
          <TextBtn danger onClick={() => chain().deleteTable().run()}>
            Excluir tabela
          </TextBtn>
        </div>
      )}
    </div>
  );
}

function Btn({ title, icon: Icon, active = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${
        active ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100 hover:text-primary"
      }`}
    >
      <Icon size={17} />
    </button>
  );
}

function TextBtn({ children, onClick, danger = false }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md border transition-colors ${
        danger
          ? "border-red-200 text-red-500 hover:bg-red-50"
          : "border-gray-200 text-gray-600 hover:border-gold hover:text-gold"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="w-px h-6 bg-gray-200 mx-1" />;
}
