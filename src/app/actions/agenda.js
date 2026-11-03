"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { updateAgenda, newId } from "@/lib/storage";

const BASE_PATH = "/";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function parseFormData(formData) {
  return {
    title: formData.get("title")?.toString().trim() || null,
    description: formData.get("description")?.toString().trim() || null,
    event_date: formData.get("event_date")?.toString() || null,
    event_time: formData.get("event_time")?.toString() || null,
    location: formData.get("location")?.toString().trim() || null,
  };
}

function validate(data) {
  if (!data.title)
    return { error: "Título é obrigatório.", field: "title", values: data };
  if (!data.event_date || !DATE_RE.test(data.event_date))
    return { error: "Data é obrigatória.", field: "event_date", values: data };
  if (data.event_time && !TIME_RE.test(data.event_time))
    return { error: "Horário inválido.", field: "event_time", values: data };
  return null;
}

class NotFound extends Error {}

export async function createEventAction(_prevState, formData) {
  if (!(await getSession())) return { error: "Sem permissão." };

  const data = parseFormData(formData);
  const invalid = validate(data);
  if (invalid) return invalid;

  try {
    await updateAgenda((agenda) => {
      const now = new Date().toISOString();
      agenda.events.push({ id: newId(), ...data, created_at: now, updated_at: now });
    });
  } catch (err) {
    console.error(err);
    return { error: "Erro ao criar evento.", values: data };
  }
  revalidatePath(BASE_PATH);
  return { success: true };
}

export async function updateEventAction(_prevState, formData) {
  if (!(await getSession())) return { error: "Sem permissão." };

  const id = formData.get("id")?.toString();
  if (!id) return { error: "ID inválido." };

  const data = parseFormData(formData);
  const invalid = validate(data);
  if (invalid) return invalid;

  try {
    await updateAgenda((agenda) => {
      const ev = agenda.events.find((e) => e.id === id);
      if (!ev) throw new NotFound();
      Object.assign(ev, data, { updated_at: new Date().toISOString() });
    });
  } catch (err) {
    if (err instanceof NotFound) return { error: "Evento não encontrado.", values: data };
    console.error(err);
    return { error: "Erro ao atualizar evento.", values: data };
  }
  revalidatePath(BASE_PATH);
  return { success: true };
}

export async function deleteEventAction(id) {
  if (!(await getSession())) return { error: "Sem permissão." };

  try {
    await updateAgenda((agenda) => {
      const before = agenda.events.length;
      agenda.events = agenda.events.filter((e) => e.id !== id);
      if (agenda.events.length === before) throw new NotFound();
      agenda.attendances = agenda.attendances.filter((a) => a.event_id !== id);
    });
  } catch (err) {
    if (err instanceof NotFound) return { error: "Evento não encontrado." };
    console.error(err);
    return { error: "Erro ao excluir evento." };
  }
  revalidatePath(BASE_PATH);
  return { success: true };
}

// Só existe confirmação; desconfirmar apaga a resposta.
export async function setAttendanceAction(eventId, confirmed) {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };
  const { cim } = session.user;

  try {
    await updateAgenda((agenda) => {
      if (!agenda.events.some((e) => e.id === eventId)) throw new NotFound();
      agenda.attendances = agenda.attendances.filter(
        (a) => !(a.event_id === eventId && a.cim === cim),
      );
      if (confirmed) {
        agenda.attendances.push({
          event_id: eventId,
          cim,
          created_at: new Date().toISOString(),
        });
      }
    });
  } catch (err) {
    if (err instanceof NotFound) return { error: "Evento não encontrado." };
    console.error(err);
    return { error: "Erro ao salvar presença." };
  }
  revalidatePath(BASE_PATH);
  return { success: true };
}
