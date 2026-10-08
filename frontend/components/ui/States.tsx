import { CalendarDays } from "lucide-react";

export function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <CalendarDays className="h-10 w-10 text-zoom-border" />
      <p className="mt-2 text-sm font-semibold text-zoom-muted">{title}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center text-sm">
      <p className="text-zoom-red">{message}</p>
      <button className="btn-secondary mt-3" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
