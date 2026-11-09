import PageHeader from "./PageHeader";
import SideNav from "./SideNav";

// Moldura das páginas logadas: faixa de título + menu lateral + conteúdo.
export default function AppShell({ eyebrow, title, icon = false, children }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} icon={icon} />
      <section className="py-10 bg-white min-h-[60vh]">
        <div className="max-w-6xl mx-auto px-4 lg:flex lg:gap-8 lg:items-start">
          <SideNav />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </section>
    </>
  );
}
