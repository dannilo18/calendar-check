"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteFileAction } from "@/app/actions/documentos";

// Excluir com confirmação em dois cliques. Sem `redirectTo`, só recarrega.
export default function DeleteFileButton({ category, fileName, sha, redirectTo, label = "Excluir" }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handle() {
    setLoading(true);
    setError(null);
    const result = await deleteFileAction(category, fileName, sha);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors"
        >
          <Trash2 size={12} /> {label}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={handle}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancelar
          </button>
        </>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
