// Wordmark drawn as text. Not the official logo file.
// "stacked" is the newer Zoom Workplace look: a small "zoom" above "Workplace".
export default function ZoomLogo({ className = "", stacked = false }: { className?: string; stacked?: boolean }) {
  if (stacked) {
    return (
      <span className={`inline-flex flex-col leading-none ${className.includes("text-white") ? "" : "text-zoom-ink"} ${className}`}>
        <span className="text-[13px] font-black tracking-tight">zoom</span>
        <span className="text-[19px] font-bold tracking-tight">Workplace</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <span className="text-[26px] font-black leading-none tracking-tight text-zoom-blue">zoom</span>
      <span className="hidden text-[15px] font-bold text-zoom-ink sm:inline">Workplace</span>
    </span>
  );
}
