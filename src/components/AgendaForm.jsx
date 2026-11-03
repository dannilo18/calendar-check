"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Save, Trash2 } from "lucide-react";
import { createEventAction, updateEventAction, deleteEventAction } from "@/app/actions/agenda";
import { INPUT, INPUT_ERROR, Field } from "./fields";

const BASE_PATH = "/";

export default function AgendaForm({ event }) {
  const isEdit = !!event;
  const action = isEdit ? updateEventAction : createEventAction;
  const [state, formAction, isPending] = useActionState(action, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push(BASE_PATH);
      router.refresh();
    }
  }, [state, router]);

  // Se a submissão falhar, o React reseta os campos não controlados para o
  // defaultValue atual — reidratamos com o que foi enviado (`state.values`)
  // para não perder o que já tinha sido preenchido.
  useEffect(() => {
    if (state?.field) {
      const el = document.querySelector(`[name="${state.field}"]`);
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [state]);

  const submitted = state?.values;

  function val(name, fallback = "") {
    if (submitted && submitted[name] !== undefined)
      return submitted[name] ?? fallback;
    return event?.[name] ?? fallback;
  }

  function cls(name) {
    return `${INPUT} ${state?.field === name ? INPUT_ERROR : ""}`;
  }

  return (
    <form action={formAction} className="space-y-8 max-w-2xl mx-auto">
      {isEdit && <input type="hidden" name="id" value={event.id} />}

      {state?.error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm">
          <AlertCircle size={15} className="flex-shrink-0" /> {state.error}
        </div>
      )}

      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-5">
        <h3 className="font-serif font-bold text-primary text-base">Evento</h3>

        <Field label="Título" required>
          <input
            name="title"
            type="text"
            required
            defaultValue={val("title")}
            placeholder="Ex: Reunião mensal"
            className={cls("title")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Data" required>
            <input
              name="event_date"
              type="date"
              required
              defaultValue={String(val("event_date")).slice(0, 10)}
              className={cls("event_date")}
            />
          </Field>
          <Field label="Horário">
            <input
              name="event_time"
              type="time"
              defaultValue={val("event_time") ? String(val("event_time")).slice(0, 5) : ""}
              className={cls("event_time")}
            />
          </Field>
        </div>

        <Field label="Local">
          <input
            name="location"
            type="text"
            defaultValue={val("location")}
            placeholder="Ex: Sala de reuniões"
            className={INPUT}
          />
        </Field>
      </section>

      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-5">
        <h3 className="font-serif font-bold text-primary text-base">Descrição</h3>
        <Field label="Detalhes">
          <textarea
            name="description"
            rows={4}
            defaultValue={val("description")}
            placeholder="Informações adicionais sobre o evento..."
            className={`${INPUT} resize-y`}
          />
        </Field>
      </section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {isEdit ? "Salvar alterações" : "Criar evento"}
        </button>

        {isEdit && <DeleteButton eventId={event.id} />}
      </div>
    </form>
  );
}

function DeleteButton({ eventId }) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  async function handle() {
    setLoading(true);
    setError(null);
    const result = await deleteEventAction(eventId);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(BASE_PATH);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:border-red-300 hover:text-red-500 transition-colors"
        >
          <Trash2 size={14} /> Excluir evento
        </button>
      ) : (
        <>
          <span className="text-xs text-gray-500">Confirmar exclusão?</span>
          <button
            type="button"
            onClick={handle}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
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
