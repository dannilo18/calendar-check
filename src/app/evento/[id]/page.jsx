import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { readAgenda } from "@/lib/storage";
import AgendaForm from "@/components/AgendaForm";
import PageHeader from "@/components/PageHeader";

export const metadata = { title: "Editar Evento Privado" };

export default async function EditarEventoPage({ params }) {
  if (!(await getSession())) redirect("/login");

  const { id } = await params;
  const { events } = await readAgenda();
  const event = events.find((e) => e.id === id);
  if (!event) notFound();

  return (
    <>
      <PageHeader eyebrow="Agenda Privada" title="Editar Evento" />
      <section className="py-10 bg-white min-h-[60vh]">
        <div className="max-w-5xl mx-auto px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft size={14} /> Voltar à agenda privada
          </Link>
          <AgendaForm event={event} />
        </div>
      </section>
    </>
  );
}
