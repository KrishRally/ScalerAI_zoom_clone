import { colorFor, initials } from "@/lib/format";

interface Props {
  name: string;
  color?: string;
  size?: number;
  className?: string;
  /** A circle instead of a rounded square (the top bar profile picture). */
  round?: boolean;
}

/** Rounded square with initials, like Zoom's default profile picture. */
export default function Avatar({ name, color, size = 32, className = "", round = false }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center ${round ? "rounded-full" : "rounded-[28%]"} font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.38),
        backgroundColor: color || colorFor(name),
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
