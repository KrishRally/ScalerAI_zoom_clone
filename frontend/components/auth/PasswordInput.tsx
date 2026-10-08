"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
}

/** Password box with a show / hide button. */
export default function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`input pr-10 ${props.className ?? ""}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zoom-muted hover:text-zoom-ink"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
