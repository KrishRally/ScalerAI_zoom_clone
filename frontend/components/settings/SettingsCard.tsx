/** One section of the Settings page. */
export default function SettingsCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border border-zoom-border bg-white p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-bold text-zoom-ink">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-zoom-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
