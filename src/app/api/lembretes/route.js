import { timingSafeEqual } from "node:crypto";
import { sendEventReminders } from "@/lib/reminders";

// Disparado pelo cron da Vercel (vercel.json) todo dia às 18:00 UTC = 15:00
// em Fortaleza. A Vercel envia "Authorization: Bearer <CRON_SECRET>"; sem
// CRON_SECRET configurado a rota fica fechada.

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(request) {
  if (!authorized(request)) return new Response("Não autorizado.", { status: 401 });
  try {
    const result = await sendEventReminders();
    console.info("Lembretes:", JSON.stringify(result));
    return Response.json(result);
  } catch (err) {
    console.error("Falha nos lembretes:", err);
    return Response.json({ error: "Falha ao enviar os lembretes." }, { status: 500 });
  }
}
