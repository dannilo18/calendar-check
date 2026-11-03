"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, CalendarDays, Users } from "lucide-react";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TYPE_LABEL = { institutional: "Institucional", visit: "Visita" };
const TYPE_COLOR = {
  institutional: "bg-gold/20 text-primary",
  visit: "bg-blue-100 text-blue-700",
};

function toDateKey(dateValue) {
  const d = new Date(dateValue);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default function AgendaCalendar({ events }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);

  const eventsByDate = {};
  for (const ev of events) {
    const key = toDateKey(ev.event_date);
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(ev);
  }

  const todayKey = toDateKey(today);
  const firstWeekday = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrev = new Date(currentYear, currentMonth, 0).getDate();

  const cells = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, key, events: eventsByDate[key] ?? [] });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, outside: true });
  }

  function prevMonth() {
    setSelectedDate(null);
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  }

  function nextMonth() {
    setSelectedDate(null);
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  }

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
      {/* Calendar */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif font-bold text-primary text-xl">
            {MONTHS[currentMonth]} {currentYear}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg border border-gray-200 hover:border-gold hover:text-gold transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg border border-gray-200 hover:border-gold hover:text-gold transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-[11px] font-semibold text-gray-400 uppercase py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            const isToday = !cell.outside && cell.key === todayKey;
            const isSelected = !cell.outside && cell.key === selectedDate;
            const hasEvents = !cell.outside && cell.events.length > 0;

            return (
              <button
                key={i}
                disabled={cell.outside || !hasEvents}
                onClick={() => !cell.outside && hasEvents && setSelectedDate(cell.key === selectedDate ? null : cell.key)}
                className={[
                  "relative flex flex-col items-center justify-start rounded-xl p-1.5 aspect-square text-sm font-medium transition-all",
                  cell.outside ? "text-gray-200 cursor-default" : "text-primary",
                  !cell.outside && !isSelected && !isToday ? "hover:bg-gray-50" : "",
                  isToday && !isSelected ? "ring-2 ring-gold" : "",
                  isSelected ? "bg-primary text-white" : "",
                  hasEvents && !isSelected ? "cursor-pointer" : "",
                ].join(" ")}
              >
                <span>{cell.day}</span>
                {hasEvents && (
                  <span className="flex gap-0.5 mt-0.5">
                    {cell.events.slice(0, 3).map((_, ei) => (
                      <span
                        key={ei}
                        className={`w-2 h-2 rounded-full ${isSelected ? "bg-white/70" : "bg-gold"}`}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-5 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gold" /> Eventos neste dia
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-md ring-2 ring-gold inline-block" /> Hoje
          </span>
        </div>
      </div>

      {/* Events panel */}
      <div>
        {selectedDate ? (
          <>
            <h3 className="font-semibold text-primary text-sm mb-4 capitalize">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </h3>
            <div className="space-y-3">
              {selectedEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
                >
                  {TYPE_LABEL[ev.type] && (
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-2 inline-block ${TYPE_COLOR[ev.type] ?? "bg-gray-100 text-gray-500"}`}>
                      {TYPE_LABEL[ev.type]}
                    </span>
                  )}
                  <p className="font-semibold text-primary text-sm leading-snug">
                    {ev.title}
                  </p>
                  {ev.event_time && (
                    <p className="flex items-center gap-1 text-xs text-gray-400 mt-1.5">
                      <Clock size={11} />
                      {String(ev.event_time).slice(0, 5)}
                    </p>
                  )}
                  {ev.location && (
                    <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <MapPin size={11} />
                      {ev.location}
                    </p>
                  )}
                  {ev.description && (
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed border-t border-gray-100 pt-2">
                      {ev.description}
                    </p>
                  )}
                  {/* Lista de confirmados (presenças). */}
                  {Array.isArray(ev.attendees) && (
                    <div className="text-xs text-gray-500 mt-2 border-t border-gray-100 pt-2">
                      <p className="flex items-center gap-1 font-semibold text-gray-400 mb-1">
                        <Users size={11} /> Confirmados ({ev.attendees.length})
                      </p>
                      {ev.attendees.length === 0 ? (
                        <p className="text-gray-400">Ninguém confirmou ainda.</p>
                      ) : (
                        <ul className="space-y-0.5">
                          {ev.attendees.map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-gray-300">
            <CalendarDays size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm text-gray-400">
              Clique em um dia marcado para ver os eventos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
