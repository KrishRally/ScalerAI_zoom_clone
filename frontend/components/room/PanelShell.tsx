import { X } from "lucide-react";

/** White side panel used by Participants, Chat, Notes and Host tools. Full screen on phones. */
export default function PanelShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <aside className="absolute inset-0 z-30 flex flex-col bg-white text-zoom-text sm:static sm:z-auto sm:my-2 sm:mr-2 sm:w-80 sm:shrink-0 sm:rounded-lg">
      <div className="flex items-center justify-between border-b border-zoom-border px-3 py-2.5">
        <h2 className="text-sm font-bold">{title}</h2>
        <button onClick={onClose} className="rounded p-1 text-zoom-muted hover:bg-zoom-surface" aria-label="Close panel">
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </aside>
  );
}
