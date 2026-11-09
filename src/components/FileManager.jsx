"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, CopyPlus, FileText, Loader2, Upload } from "lucide-react";
import { uploadFileAction } from "@/app/actions/documentos";
import { CATEGORIES, MAX_UPLOAD_BYTES, baseName, fileUrl, formatBytes } from "@/lib/library";
import DeleteFileButton from "./DeleteFileButton";
import { Field, INPUT } from "./fields";

// Gestão de uma pasta de arquivos: envio (com pergunta quando o nome já
// existe) + lista com exclusão. `files`: [{ name, size, sha }].
export default function FileManager({ category, files }) {
  const config = CATEGORIES[category];
  const isImage = category === "identidade-visual";
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(uploadFileAction, null);
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState(null);
  const [conflictDismissed, setConflictDismissed] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    if (state?.conflict) setConflictDismissed(false);
    if (state?.success) {
      formRef.current?.reset();
      setFile(null);
      setName("");
      router.refresh();
    }
  }, [state, router]);

  function pick(e) {
    const f = e.target.files?.[0] ?? null;
    setLocalError(
      f && f.size > MAX_UPLOAD_BYTES
        ? `Arquivo grande demais (${formatBytes(f.size)}). Máximo: ${formatBytes(MAX_UPLOAD_BYTES)}.`
        : null,
    );
    setFile(f);
    if (f && !name) setName(baseName(f.name));
  }

  // Monta o FormData a partir do estado (o <input type="file"> não pode ser
  // repreenchido depois que o React reseta o formulário).
  function send(resolution) {
    if (!file || localError) return;
    const formData = new FormData();
    formData.set("category", category);
    formData.set("name", name);
    formData.set("file", file);
    if (resolution) formData.set("resolution", resolution);
    startTransition(() => formAction(formData));
  }

  function cancelConflict() {
    setConflictDismissed(true);
    formRef.current?.reset();
    setFile(null);
    setName("");
  }

  const showConflict = state?.conflict && !conflictDismissed;
  const error = localError ?? state?.error;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-serif font-bold text-primary text-xl mb-6">Enviar {config.typeLabel}</h2>

        {state?.success && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 mb-5 flex items-start gap-3">
            <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-700 text-sm font-semibold">
              &quot;{state.fileName}&quot; enviado com sucesso!
            </p>
          </div>
        )}

        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            send(null);
          }}
          className="space-y-5 max-w-md"
        >
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <Field label={`Arquivo (máx. ${formatBytes(MAX_UPLOAD_BYTES)})`} required>
            <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-200 rounded-xl px-4 py-8 cursor-pointer hover:border-gold hover:bg-gold/5 transition-colors group text-center">
              <input type="file" accept={config.accept} required className="sr-only" onChange={pick} />
              {file ? (
                <>
                  <FileText size={24} className="text-gold mb-2" />
                  <span className="text-sm font-medium text-primary break-all">{file.name}</span>
                  <span className="text-xs text-gray-400 mt-1">
                    {formatBytes(file.size)} · clique para trocar
                  </span>
                </>
              ) : (
                <>
                  <Upload size={24} className="text-gray-300 group-hover:text-gold mb-2 transition-colors" />
                  <span className="text-sm text-gray-400 group-hover:text-gold transition-colors">
                    Selecionar {config.typeLabel}
                  </span>
                </>
              )}
            </label>
          </Field>

          <Field label="Nome" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              placeholder="Nome exibido na lista"
              className={INPUT}
            />
          </Field>

          {showConflict ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 space-y-3">
              <p className="text-sm text-amber-800">
                Já existe um arquivo chamado <strong>{state.existingName}</strong>. O que deseja fazer?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => send("overwrite")}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 disabled:opacity-60 transition-colors"
                >
                  <Upload size={12} /> Substituir
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => send("keep-both")}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-amber-300 text-amber-800 rounded-lg text-xs font-semibold hover:bg-amber-100 disabled:opacity-60 transition-colors"
                >
                  <CopyPlus size={12} /> Manter os dois
                </button>
                <button
                  type="button"
                  onClick={cancelConflict}
                  className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              disabled={isPending || !file || !!localError}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors"
            >
              {isPending ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Enviar
            </button>
          )}
        </form>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Arquivos enviados ({files.length})
        </h3>
        {files.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum arquivo enviado ainda.</p>
        ) : (
          <div className="space-y-3">
            {files.map((f) => (
              <div
                key={f.name}
                className="flex flex-wrap sm:flex-nowrap items-center gap-4 bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm"
              >
                <div className="w-10 h-10 bg-primary/5 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(category, f.name)} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <FileText size={18} className="text-gold" />
                  )}
                </div>
                <a
                  href={fileUrl(category, f.name, { download: true })}
                  download
                  className="flex-1 min-w-0 group"
                >
                  <p className="font-medium text-primary text-sm leading-snug break-words group-hover:text-gold transition-colors">
                    {f.name}
                  </p>
                  <p className="text-xs text-gray-300 mt-0.5">{formatBytes(f.size)}</p>
                </a>
                <DeleteFileButton category={category} fileName={f.name} sha={f.sha} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
