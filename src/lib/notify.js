import "server-only";
import nodemailer from "nodemailer";
import { headers } from "next/headers";
import { after } from "next/server";
import { readMembers } from "./members";

// Notificações por e-mail (Gmail da chapa, via senha de app).
//
//   GMAIL_USER           conta que envia (ex.: chapa.xxx@gmail.com)
//   GMAIL_APP_PASSWORD   senha de app de 16 letras (não é a senha da conta)
//   SITE_URL             (opcional) endereço público do site, para os links
//   SMTP_URL             (opcional) outro servidor em vez do Gmail, ex.:
//                        smtps://usuario:senha@smtp.dominio.com.br:465
//                        (o remetente continua sendo GMAIL_USER / EMAIL_FROM)
//
// Os e-mails dos membros vêm de membros.json no repositório privado (ver
// members.js), lidos na hora do envio; "email" vazio = não recebe. Sem GMAIL_USER/GMAIL_APP_PASSWORD
// (ou SMTP_URL) nada é enviado.

const PRIMARY = "#1a2744";
const GOLD = "#c5973a";

const SENDER = process.env.EMAIL_FROM || process.env.GMAIL_USER;

let transport;
function getTransport() {
  if (process.env.SMTP_URL && SENDER) {
    transport ??= nodemailer.createTransport(process.env.SMTP_URL);
    return transport;
  }
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  transport ??= nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      // O Google mostra a senha de app em grupos com espaço; aceita dos dois jeitos.
      pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, ""),
    },
  });
  return transport;
}

async function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

// Layout único dos e-mails: faixa azul, título, linhas de detalhe e botão.
function layout({ eyebrow, title, rows = [], text, button, footer }) {
  const rowsHtml = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td style="padding:4px 0;color:#1f2937;font-size:15px">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${PRIMARY};padding:20px 28px">
<div style="color:${GOLD};font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">${escapeHtml(eyebrow)}</div>
<div style="color:#ffffff;font-size:22px;font-weight:bold;font-family:Georgia,serif;margin-top:6px">${escapeHtml(title)}</div>
</td></tr>
<tr><td style="padding:24px 28px">
${rowsHtml ? `<table role="presentation" cellpadding="0" cellspacing="0">${rowsHtml}</table>` : ""}
${text ? `<p style="color:#374151;font-size:15px;line-height:1.5;white-space:pre-line;margin:16px 0 0">${escapeHtml(text)}</p>` : ""}
<p style="margin:24px 0 0"><a href="${escapeHtml(button.href)}" style="display:inline-block;background:${PRIMARY};color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:12px 24px;border-radius:8px">${escapeHtml(button.label)}</a></p>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

function plainText({ title, rows = [], text, button }) {
  return [
    title,
    "",
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    text ? `\n${text}` : "",
    "",
    `${button.label}: ${button.href}`,
  ].join("\n");
}

/**
 * Agenda o envio para depois da resposta (não atrasa quem salvou). Os
 * e-mails são lidos nessa hora; todos os membros com e-mail recebem, menos o autor; os endereços vão em cópia
 * oculta, ninguém vê o dos outros. Falha no envio só vai para o log.
 *
 * @param {{ author: { cim: string, name: string }, subject: string,
 *           eyebrow: string, title: string, rows?: [string, string][],
 *           text?: string, button: { label: string, path: string } }} msg
 */
export async function notifyMembers(msg) {
  const mailer = getTransport();
  if (!mailer) {
    console.info(`Notificação "${msg.subject}" não enviada: e-mail não configurado (GMAIL_USER/GMAIL_APP_PASSWORD).`);
    return;
  }

  const base = await siteUrl();
  const content = {
    ...msg,
    button: { label: msg.button.label, href: `${base}${msg.button.path}` },
    footer: `Enviado automaticamente pela Agenda Privada porque ${msg.author.name} fez esta alteração.`,
  };

  after(async () => {
    try {
      const recipients = [...(await readMembers()).values()]
        .filter((m) => m.email && m.cim !== String(msg.author.cim))
        .map((m) => m.email);
      if (recipients.length === 0) {
        console.info(
          `Notificação "${msg.subject}" não enviada: nenhum destinatário (quem fez a ação não recebe; e-mails vazios são ignorados).`,
        );
        return;
      }
      await mailer.sendMail({
        from: { name: "Agenda Privada", address: SENDER },
        to: { name: "Agenda Privada", address: SENDER },
        bcc: recipients,
        subject: msg.subject,
        text: plainText(content),
        html: layout(content),
      });
      console.info(`Notificação "${msg.subject}" enviada para ${recipients.length} membro(s).`);
    } catch (err) {
      console.error("Falha ao enviar notificação por e-mail:", err);
    }
  });
}
