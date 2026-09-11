import React from "react";

// ============================================================
// 🎨 ICONOS REUTILIZABLES
// ============================================================
// Antes cada componente tenía su propio <SunIcon />, <XIcon />, etc.
// definido inline (con código duplicado). Ahora todos viven acá.
// ============================================================

const Icon = ({ children, className = "w-5 h-5", ...props }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
);

export const XIcon = (props) => (
  <Icon {...props}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </Icon>
);

export const SunIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </Icon>
);

export const MoonIcon = (props) => (
  <Icon {...props}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </Icon>
);

export const LogOutIcon = (props) => (
  <Icon {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </Icon>
);

export const CalendarIcon = (props) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </Icon>
);

export const UserIcon = (props) => (
  <Icon {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </Icon>
);

export const UsersIcon = (props) => (
  <Icon {...props}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </Icon>
);

export const ScissorsIcon = (props) => (
  <Icon {...props}>
    <circle cx="6" cy="6" r="3"></circle>
    <circle cx="6" cy="18" r="3"></circle>
    <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
    <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
    <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
  </Icon>
);

export const SettingsIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </Icon>
);

export const DollarIcon = (props) => (
  <Icon {...props}>
    <line x1="12" y1="1" x2="12" y2="23"></line>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
  </Icon>
);

export const HomeIcon = (props) => (
  <Icon {...props}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </Icon>
);

export const SearchIcon = (props) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </Icon>
);

export const ArrowLeftIcon = (props) => (
  <Icon {...props}>
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </Icon>
);

export const PencilIcon = (props) => (
  <Icon {...props}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
  </Icon>
);

export const BuildingIcon = (props) => (
  <Icon {...props}>
    <rect x="4" y="2" width="16" height="20" rx="2"></rect>
    <line x1="9" y1="7" x2="10" y2="7"></line>
    <line x1="14" y1="7" x2="15" y2="7"></line>
    <line x1="9" y1="11" x2="10" y2="11"></line>
    <line x1="14" y1="11" x2="15" y2="11"></line>
    <path d="M10 22v-4a2 2 0 1 1 4 0v4"></path>
  </Icon>
);

export const TrashIcon = (props) => (
  <Icon {...props}>
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </Icon>
);

export const BanIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
  </Icon>
);

export const PlayIcon = (props) => (
  <Icon {...props}>
    <polygon points="6 3 20 12 6 21 6 3"></polygon>
  </Icon>
);

export const PlusIcon = (props) => (
  <Icon {...props}>
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </Icon>
);

// ============================================================
// Glifos del directorio público (landing y detalle de tienda)
// ============================================================
// Mismo trazo que el resto del set: 24x24, stroke 2, redondeado.
// Star y Heart necesitan relleno variable, así que no pasan por el
// wrapper <Icon /> (que fija fill="none").

export const MapPinIcon = (props) => (
  <Icon {...props}>
    <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0z"></path>
    <circle cx="12" cy="10.5" r="3"></circle>
  </Icon>
);

export const ArrowRightIcon = (props) => (
  <Icon {...props}>
    <path d="M13 7l5 5-5 5"></path>
    <path d="M5 12h13"></path>
  </Icon>
);

export const CheckIcon = (props) => (
  <Icon {...props}>
    <path d="M5 13l4 4L19 7"></path>
  </Icon>
);

export const ClockIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9"></circle>
    <path d="M12 7.5V12l3 2"></path>
  </Icon>
);

export const StarIcon = ({ className = "w-4 h-4", ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M11.48 3.5c.16-.38.88-.38 1.04 0l2.12 5.11 5.51.44c.44.04.62.59.28.88l-4.2 3.6 1.28 5.38c.1.43-.36.77-.74.54L12 16.56l-4.77 2.9c-.38.23-.84-.11-.74-.54l1.28-5.39-4.2-3.59a.47.47 0 0 1 .28-.88l5.51-.44 2.12-5.1z" />
  </svg>
);

export const HeartIcon = ({ className = "w-4 h-4", relleno = false, ...props }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={relleno ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
  </svg>
);
