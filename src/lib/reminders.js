import "server-only";
import { longDate } from "./library";
import { readMembers } from "./members";
import { sendEmail } from "./notify";
import { readAgenda, updateAgenda } from "./storage";

// Lembrete da véspera: quem confirmou presença num evento de amanhã recebe um
// e-mail. Chamado uma vez por dia (cron da Vercel, ver vercel.json e
// src/app/api/lembretes/route.js).
//
// Cada evento lembrado ganha `reminder_sent_for: <data do evento>` no
// agenda.json, então rodar de novo no mesmo dia não manda e-mail repetido; se
// a data do evento mudar, ele volta a ser lembrado na nova véspera.

const TIME_ZONE = "America/Fortaleza";

/** Data de amanhã ("AAAA-MM-DD") no fuso da chapa. */
export function tomorrow(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Envia os lembretes dos eventos de amanhã. Devolve um resumo por evento
 * (sem e-mails, para poder ir para o log).
 */
export async function sendEventReminders({ baseUrl, now = new Date() } = {}) {
  const date = tomorrow(now);
  const agenda = await readAgenda();
  const events = agenda.events.filter((e) => e.event_date === date && e.reminder_sent_for !== date);
  if (events.length === 0) return { date, events: [] };

  const members = await readMembers();
  const summary = [];
  const sent = [];

  for (const event of events) {
    const confirmed = agenda.attendances
      .filter((a) => a.event_id === event.id)
      .map((a) => members.get(String(a.cim)))
      .filter(Boolean);
    const recipients = [...new Set(confirmed.map((m) => m.email).filter(Boolean))];
    const item = { title: event.title, confirmed: confirmed.length, recipients: recipients.length };
    summary.push(item);
    if (recipients.length === 0) continue;

    try {
      const when = event.event_time ? `amanhã às ${event.event_time}` : "amanhã";
      item.sent = await sendEmail({
        recipients,
        baseUrl,
        subject: `Lembrete: ${event.title} — ${when}`,
        eyebrow: "Lembrete · é amanhã",
        title: event.title,
        rows: [
          ["Data", longDate(event.event_date)],
          ["Horário", event.event_time],
          ["Local", event.location],
          ["Confirmados", `${confirmed.length} irmão(s)`],
        ],
        text: event.description,
        button: { label: "Ver na agenda", path: "/" },
        footer: "Você recebeu este lembrete porque confirmou presença neste evento na Agenda Privada.",
      });
      if (item.sent > 0) sent.push(event.id);
    } catch (err) {
      item.error = err.message;
      console.error(`Falha ao enviar o lembrete de "${event.title}":`, err);
    }
  }

  if (sent.length > 0) {
    await updateAgenda((data) => {
      for (const e of data.events) if (sent.includes(e.id) && e.event_date === date) e.reminder_sent_for = date;
    });
  }
  return { date, events: summary };
}
