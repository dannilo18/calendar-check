"use server";

import { redirect } from "next/navigation";
import { getMember } from "@/lib/members";
import { checkWord, createSession, destroySession } from "@/lib/session";

export async function loginAction(_prevState, formData) {
  const cim = formData.get("cim")?.toString().trim() ?? "";
  const palavra = formData.get("palavra")?.toString() ?? "";
  const values = { cim };

  if (!cim || !palavra)
    return { error: "Preencha todos os campos.", values };

  let ok = false;
  try {
    ok = checkWord(palavra) && !!(await getMember(cim));
  } catch (err) {
    console.error(err);
    return { error: "Acesso indisponível no momento.", values };
  }
  // Mensagem única para não revelar quais CIMs são autorizados.
  if (!ok) return { error: "CIM ou palavra de verificação inválidos.", values };

  await createSession({ cim });
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
