import type { SVGAttributes } from "preact";

type P = SVGAttributes<SVGSVGElement>;
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round" as const,
  "stroke-linejoin": "round" as const,
  "aria-hidden": true,
};

export const IconPlus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconX = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base} {...p} stroke-width={3}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const IconUndo = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);
export const IconRedo = (p: P) => (
  <svg {...base} {...p}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </svg>
);
export const IconChevronL = (p: P) => (
  <svg {...base} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const IconChevronR = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);
export const IconGrip = (p: P) => (
  <svg {...base} {...p} fill="currentColor" stroke="none">
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
);
export const IconDots = (p: P) => (
  <svg {...base} {...p} fill="currentColor" stroke="none">
    <circle cx="12" cy="5" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="19" r="1.8" />
  </svg>
);
export const IconDownload = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
  </svg>
);
export const IconUpload = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
  </svg>
);
export const IconFile = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8z" />
    <path d="M14 3v5h5" />
  </svg>
);
export const IconNew = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8z" />
    <path d="M14 3v5h5M12 11v6M9 14h6" />
  </svg>
);
export const IconNote = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v9l-6 6H5a1 1 0 0 1-1-1z" />
    <path d="M14 20v-6h6" />
  </svg>
);
export const IconCalendar = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M8 3v4M16 3v4" />
  </svg>
);
export const IconEdit = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 20h4l10-10-4-4L4 16z" />
    <path d="M12.5 7.5l4 4" />
  </svg>
);
export const IconLock = (p: P) => (
  <svg {...base} {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
export const IconZoomIn = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4-4M11 8v6M8 11h6" />
  </svg>
);
export const IconZoomOut = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4-4M8 11h6" />
  </svg>
);
export const IconFit = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
  </svg>
);
export const IconArrowL = (p: P) => (
  <svg {...base} {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const IconArrowR = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconHelp = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14" />
    <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);
export const IconShield = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
export const IconGithub = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
  </svg>
);
export const IconLogo = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden {...p}>
    <rect x="4" y="5" width="16" height="14" rx="1.5" fill="#fff" />
    <rect x="4" y="5" width="16" height="4" rx="1.5" fill="#cfdcfa" />
    <rect x="6.5" y="11.5" width="5" height="1.6" rx="0.8" fill="#2d5be3" />
    <rect x="6.5" y="15" width="8" height="1.6" rx="0.8" fill="#2d5be3" />
    <circle cx="16" cy="12.5" r="2" stroke="#d7263d" stroke-width="1.4" />
  </svg>
);
