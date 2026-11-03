import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CalendarDays, Clock, MapPin, PlusCircle, Pencil } from "lucide-react";
import { getSession } from "@/lib/session";
import { readAgenda } from "@/lib/storage";
import { memberName } from "@/lib/config";
import AttendanceButtons from "@/components/AttendanceButtons";
import AgendaCalendar from "@/components/AgendaCalendar";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda Privada" };

const FILTERS = [
  { key: "proximos", label: "Próximos eventos" },
  { key: "passados", label: "Eventos passados" },
];

// Data de hoje ("YYYY-MM-DD") no fuso de Teresina, independente do fuso do
// servidor (a Vercel roda em UTC).
function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
}

// "YYYY-MM-DD" → Date ao meio-dia local, para não pular de dia por fuso.
function parseDate(value) {
  return new Date(`${String(value).slice(0, 10)}T12:00:00`);
}

export default async function AgendaPrivadaPage({ searchParams }) {
  const { mostrar } = await searchParams;
  const filter = mostrar === "passados" ? "passados" : "proximos";
  const session = await getSession();
  if (!session) redirect("/login");

  let agenda;
  let loadError = false;
  try {
    agenda = await readAgenda();
  } catch (err) {
    console.error(err);
    agenda = { events: [], attendances: [] };
    loadError = true;
  }

  const events = [...agenda.events].sort(
    (a, b) =>
      String(a.event_date).localeCompare(String(b.event_date)) ||
      String(a.event_time ?? "").localeCompare(String(b.event_time ?? "")),
  );

  // Próximos: de hoje em diante, do mais perto ao mais longe.
  // Passados: antes de hoje, do mais recente ao mais antigo.
  const today = todayKey();
  const listed =
    filter === "passados"
      ? events.filter((ev) => String(ev.event_date).slice(0, 10) < today).reverse()
      : events.filter((ev) => String(ev.event_date).slice(0, 10) >= today);

  const myCim = session.user.cim;
  const byEvent = new Map();
  for (const a of agenda.attendances) {
    if (!byEvent.has(a.event_id)) byEvent.set(a.event_id, []);
    byEvent.get(a.event_id).push(a);
  }
  const calendarEvents = events.map((ev) => ({
    ...ev,
    attendees: (byEvent.get(ev.id) ?? []).map((r) => memberName(r.cim)),
  }));

  return (
    <>
      <PageHeader eyebrow="Restrito" title="Agenda Privada" icon />

      <section className="py-10 bg-white min-h-[60vh]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-end mb-8">
            <Link
              href="/novo"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors"
            >
              <PlusCircle size={15} /> Novo evento
            </Link>
          </div>

          {loadError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm mb-8">
              <AlertCircle size={15} className="flex-shrink-0" />
              Não foi possível carregar a agenda. Tente novamente em instantes.
            </div>
          )}

          {events.length === 0 ? (
            <div className="text-center py-20 text-gray-300">
              <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm text-gray-400">Nenhum evento privado cadastrado.</p>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 mb-8">
                <AgendaCalendar events={calendarEvents} />
              </div>
              <div className="flex gap-2 mb-5" role="tablist">
                {FILTERS.map(({ key, label }) => (
                  <Link
                    key={key}
                    href={key === "proximos" ? "/" : `/?mostrar=${key}`}
                    role="tab"
                    aria-selected={filter === key}
                    scroll={false}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      filter === key
                        ? "bg-primary text-white border-primary"
                        : "border-gray-200 text-gray-500 hover:border-gold hover:text-gold"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>

              {listed.length === 0 && (
                <div className="text-center py-12 text-gray-300">
                  <CalendarDays size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm text-gray-400">
                    {filter === "passados" ? "Nenhum evento passado." : "Nenhum evento próximo."}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {listed.map((ev) => {
                  const date = parseDate(ev.event_date);
                  const confirmed = byEvent.get(ev.id) ?? [];
                  const isMineConfirmed = confirmed.some((r) => r.cim === myCim);
                  return (
                    <div
                      key={ev.id}
                      className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm hover:shadow-md hover:border-gold/40 transition-all"
                    >
                      <div className="flex items-start sm:items-center gap-4">
                        <div className="w-14 h-16 bg-primary/5 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-gray-400 text-[10px] font-semibold uppercase leading-none mb-1">
                            {date.toLocaleString("pt-BR", { weekday: "short" }).replace(".", "")}
                          </span>
                          <span className="font-bold text-primary text-lg leading-none">
                            {date.toLocaleString("pt-BR", { day: "2-digit" })}
                          </span>
                          <span className="text-gold text-xs font-semibold uppercase">
                            {date.toLocaleString("pt-BR", { month: "short" }).replace(".", "")}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Nome completo (quebra linha) e local sempre na linha de baixo. */}
                          <p className="font-semibold text-primary text-sm leading-snug break-words">
                            {ev.title}
                          </p>
                          {(ev.location || ev.event_time) && (
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400 mt-1">
                              {ev.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin size={11} className="flex-shrink-0" /> {ev.location}
                                </span>
                              )}
                              {ev.event_time && (
                                <span className="flex items-center gap-1">
                                  <Clock size={11} className="flex-shrink-0" />
                                  {String(ev.event_time).slice(0, 5)}
                                </span>
                              )}
                            </p>
                          )}
                        </div>

                        {/* No celular o botão vai para a linha da presença (abaixo). */}
                        <EditLink id={ev.id} className="hidden sm:flex" />
                      </div>

                      {ev.description && (
                        <p className="text-xs text-gray-500 mt-3 whitespace-pre-line">
                          {ev.description}
                        </p>
                      )}

                      <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">Sua presença:</span>
                          <AttendanceButtons eventId={ev.id} confirmed={isMineConfirmed} />
                          <EditLink id={ev.id} className="flex sm:hidden ml-auto" />
                        </div>
                        {confirmed.length > 0 && (
                          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <li className="text-xs font-semibold text-gray-400">
                              Confirmados ({confirmed.length}):
                            </li>
                            {confirmed.map((r) => (
                              <li
                                key={r.cim}
                                className="flex items-center gap-1.5 text-xs text-gray-500"
                              >
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                {memberName(r.cim)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

function EditLink({ id, className = "" }) {
  return (
    <Link
      href={`/evento/${id}`}
      prefetch={false}
      className={`${className} items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-gold hover:text-gold transition-colors flex-shrink-0`}
    >
      <Pencil size={12} /> Editar
    </Link>
  );
}
