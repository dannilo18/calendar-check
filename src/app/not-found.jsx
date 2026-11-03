import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="font-serif text-3xl font-bold text-primary">Página não encontrada</h1>
      <Link href="/" className="text-sm text-gold hover:underline">Voltar à agenda</Link>
    </div>
  );
}
