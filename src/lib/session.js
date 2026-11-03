import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isAllowedCim, memberName } from "./config";

// Sem senha: o acesso é CIM autorizado + palavra de verificação (env).
// A sessão é um cookie assinado com HMAC derivado da própria palavra, então
// trocar PALAVRA_VERIFICACAO invalida todas as sessões existentes.

const COOKIE_NAME = "agenda_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function getWord() {
  const word = process.env.PALAVRA_VERIFICACAO;
  if (!word) throw new Error("PALAVRA_VERIFICACAO não configurada.");
  return word;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function sha256(value) {
  return createHash("sha256").update(value).digest();
}

export function checkWord(input) {
  return timingSafeEqual(sha256(normalize(input)), sha256(normalize(getWord())));
}

function sign(payload) {
  const key = sha256(`calendar-check:${normalize(getWord())}`);
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function encode(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data?.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = await cookies();
  const data = decode(store.get(COOKIE_NAME)?.value);
  // Revalida o CIM a cada request: remover da lista corta o acesso na hora.
  if (!data || !isAllowedCim(data.cim)) return null;
  return { user: { cim: String(data.cim), name: memberName(data.cim) } };
}

export async function createSession({ cim }) {
  const store = await cookies();
  store.set(COOKIE_NAME, encode({ cim: String(cim), exp: Date.now() + MAX_AGE * 1000 }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
