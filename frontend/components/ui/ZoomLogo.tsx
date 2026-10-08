// Wordmark drawn as text in the brand blue. Not the official logo file.
export default function ZoomLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <span className="text-[26px] font-black leading-none tracking-tight text-zoom-blue">zoom</span>
      <span className="hidden text-[15px] font-bold text-zoom-ink sm:inline">Workplace</span>
    </span>
  );
}
