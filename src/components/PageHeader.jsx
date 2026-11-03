import { Lock } from "lucide-react";

export default function PageHeader({ eyebrow, title, icon = false }) {
  return (
    <div className="bg-gradient-to-br from-primary to-primary-dark py-12">
      <div className="max-w-5xl mx-auto px-4">
        <p className="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-2">
          {eyebrow}
        </p>
        <h1 className="text-white font-serif text-3xl font-bold flex items-center gap-3">
          {icon && <Lock size={22} className="text-gold" />} {title}
        </h1>
      </div>
    </div>
  );
}
