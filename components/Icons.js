// Shared inline icon set (plain SVG, no icon-package dependency) used across
// the homepage shell.

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
};

export function Icon({ name, className }) {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg {...common} className={className} aria-hidden="true">
      {paths}
    </svg>
  );
}

const ICONS = {
  seatMatrix: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </>
  ),
  central: (
    <>
      <path d="M3 21h18" />
      <path d="M4 21V10l8-6 8 6v11" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  state: (
    <>
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </>
  ),
  institute: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="M6.5 10.5V16c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-5.5" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  link: (
    <>
      <path d="M9 15 15 9" />
      <path d="M11 6l1-1a4 4 0 0 1 5.7 5.7l-1 1" />
      <path d="M13 18l-1 1A4 4 0 0 1 6.3 13.3l1-1" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m14.5 9.5-1.8 4.7a1 1 0 0 1-.5.5L7.5 16.5l1.8-4.7a1 1 0 0 1 .5-.5z" />
    </>
  ),
};
