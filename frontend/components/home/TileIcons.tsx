// The white symbols inside the home screen buttons, drawn to look like Zoom's.

type P = { className?: string };

export function CameraIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="2" y="6" width="13.5" height="12" rx="3" />
      <path d="M17 10.2l4.2-2.6c.5-.3.8 0 .8.5v7.8c0 .5-.3.8-.8.5L17 13.8z" />
    </svg>
  );
}

export function JoinIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="currentColor" stroke="none" />
      <path d="M12 8v8M8 12h8" stroke="#0B5CFF" strokeWidth="2.2" />
    </svg>
  );
}

export function ScheduleIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="#fff" />
      <path d="M8 3v4M16 3v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <text x="12" y="17.6" textAnchor="middle" fontSize="9" fontWeight="800" fill="#0B5CFF" fontFamily="Arial, sans-serif">31</text>
    </svg>
  );
}

export function ShareIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" fill="#fff" />
      <path d="M12 16V9M8.8 11.8L12 8.6l3.2 3.2" stroke="#0B5CFF" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NotesIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M15.6 4.6a2 2 0 012.8 0l1 1a2 2 0 010 2.8l-9.2 9.2-4.4 1.2 1.2-4.4z" />
      <path d="M4.5 3l.6 1.6 1.6.6-1.6.6L4.5 7.4l-.6-1.6L2.3 5.2l1.6-.6zM8.5 6.5l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z" />
    </svg>
  );
}
