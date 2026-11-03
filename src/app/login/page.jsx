import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LoginForm from "./LoginForm";

export const metadata = { title: "Agenda Privada - Acesso" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return <LoginForm />;
}
