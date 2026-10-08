import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  variant?: "orange" | "blue";
  onClick: () => void;
  disabled?: boolean;
  /** Something next to the label, like the dropdown arrow beside "New meeting". */
  labelExtra?: React.ReactNode;
  /** Shown instead of the icon, for example a spinner while starting. */
  badge?: React.ReactNode;
}

/** One of the rounded square buttons on the Zoom home screen. */
export default function ActionTile({ label, icon: Icon, variant = "blue", onClick, disabled, labelExtra, badge }: Props) {
  const color = variant === "orange" ? "bg-zoom-orange hover:bg-zoom-orange-hover" : "bg-zoom-blue hover:bg-zoom-blue-hover";
  return (
    <div className="relative flex flex-col items-center gap-2.5">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`flex h-[60px] w-[60px] items-center justify-center rounded-[18px] text-white transition-transform active:scale-95 disabled:opacity-60 sm:h-[68px] sm:w-[68px] sm:rounded-[20px] ${color}`}
        aria-label={label}
      >
        {badge ?? <Icon className="h-7 w-7 sm:h-8 sm:w-8" />}
      </button>
      <span className="flex items-center gap-1 whitespace-nowrap text-[15px] text-zoom-text">
        {label}
        {labelExtra}
      </span>
    </div>
  );
}
