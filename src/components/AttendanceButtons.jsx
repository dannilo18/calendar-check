"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { setAttendanceAction } from "@/app/actions/agenda";

// Botão único: clicar confirma presença; clicar de novo desfaz.
export default function AttendanceButtons({ eventId, confirmed: initial }) {
  const [confirmed, setConfirmed] = useState(!!initial);
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    setError(null);
    const next = !confirmed;
    startTransition(async () => {
      const result = await setAttendanceAction(eventId, next);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setConfirmed(next);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        disabled={isPending}
        onClick={toggle}
        title={confirmed ? "Clique para desfazer a confirmação" : undefined}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-60 ${
          confirmed
            ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
            : "border-gray-200 text-gray-500 hover:border-gold hover:text-gold"
        }`}
      >
        {confirmed && <Check size={12} />}
        {confirmed ? "Confirmado" : "Vou"}
      </button>
      {isPending && <Loader2 size={13} className="animate-spin text-gray-400" />}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
