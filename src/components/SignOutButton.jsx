import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

export default function SignOutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-gold transition-colors"
      >
        <LogOut size={13} /> Sair
      </button>
    </form>
  );
}
