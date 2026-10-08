interface Props {
  on: boolean;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}

/** An on/off switch, like the ones in Zoom's settings. */
export default function Switch({ on, label, onToggle, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-zoom-blue" : "bg-[#C9CCD1]"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
