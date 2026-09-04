export function PlusIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}

export function LogoutIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M7.5 17.5H4a1 1 0 01-1-1v-13a1 1 0 011-1h3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 14l4-4-4-4M17 10H7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrashIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m-6.5 0l.6 10.4a1.5 1.5 0 001.5 1.4h3.8a1.5 1.5 0 001.5-1.4L14.5 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.5 9.2v4.6M11.5 9.2v4.6" strokeLinecap="round" />
    </svg>
  );
}

export function GripIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <circle cx="7" cy="5" r="1.3" />
      <circle cx="13" cy="5" r="1.3" />
      <circle cx="7" cy="10" r="1.3" />
      <circle cx="13" cy="10" r="1.3" />
      <circle cx="7" cy="15" r="1.3" />
      <circle cx="13" cy="15" r="1.3" />
    </svg>
  );
}

export function ColumnsIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <path d="M8.3 4v12M12.7 4v12" />
    </svg>
  );
}
