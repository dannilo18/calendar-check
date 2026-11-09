import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

// Renderiza markdown (com tabelas, checklists e riscado do GFM). O HTML que
// aparece no texto (ex.: <u> do sublinhado do editor) passa por um filtro com
// a lista de tags do GitHub + <u>; scripts, eventos e links "javascript:"
// são descartados, então o conteúdo é seguro mesmo vindo de qualquer membro.
const schema = { ...defaultSchema, tagNames: [...defaultSchema.tagNames, "u"] };
const components = {
  a: ({ href = "", children, node: _node, ...props }) => {
    const external = /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        {...props}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  ),
};

export default function MarkdownView({ content, className = "" }) {
  if (!content?.trim()) {
    return <p className="text-sm text-gray-400 italic">Documento vazio.</p>;
  }
  return (
    <div className={`markdown ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={components}
      >
        {content}
      </Markdown>
    </div>
  );
}
