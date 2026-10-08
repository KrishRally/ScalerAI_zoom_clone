import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  icon: LucideIcon;
  variant?: "orange" | "blue";
  onClick: () => void;
  disabled?: boolean;
  /** Optional little control in the corner, like the dropdown arrow on "New meeting". */
  accessory?: React.ReactNode;
  badge?: React.ReactNode;
}

/** One of the big rounded square buttons on the Zoom home screen. */
export default function ActionTile({ label, icon: Icon, variant = "blue", onClick, disabled, accessory, badge }: Props) {
  const color =
    variant === "orange"
      ? "bg-zoom-orange hover:bg-zoom-orange-hover"
      : "bg-zoom-blue hover:bg-zoom-blue-hover";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <button
          onClick={onClick}
          disabled={disabled}
          className={`flex h-[72px] w-[72px] items-center justify-center rounded-[22px] text-white shadow-card transition-transform active:scale-95 disabled:opacity-60 sm:h-20 sm:w-20 sm:rounded-3xl ${color}`}
          aria-label={label}
        >
          {badge ?? <Icon className="h-8 w-8 sm:h-9 sm:w-9" strokeWidth={2} />}
        </button>
        {accessory}
      </div>
      <span className="text-[13px] font-semibold text-zoom-text">{label}</span>
    </div>
  );
}
