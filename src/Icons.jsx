// Line icons used across the app (24px grid, stroke = currentColor), so every phone draws them the same.
const P = {
  home: <><path d="M4 11l8-7 8 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
  bookmark: <path d="M6 4h12v17l-6-4-6 4z" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18.5 14.8c1.7.8 2.7 2.5 3 5.2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" /></>,
  pencil: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3.5" /><circle cx="9" cy="9" r="1.1" fill="currentColor" /><circle cx="15" cy="15" r="1.1" fill="currentColor" /><circle cx="15" cy="9" r="1.1" fill="currentColor" /><circle cx="9" cy="15" r="1.1" fill="currentColor" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></>,
  logout: <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  x: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  share: <><path d="M7 17L17 7" /><path d="M8 7h9v9" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  sparkle:<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  refresh: <><path d="M20 12a8 8 0 1 1-2.4-5.7" /><path d="M20 4v4.5h-4.5" /></>,
  trash: <><path d="M4 7h16" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /><path d="M10 11v5M14 11v5" /></>,
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  repeat: <><path d="M4 12a7 7 0 0 1 12-5l3 3" /><path d="M19 5v5h-5" /><path d="M20 12a7 7 0 0 1-12 5l-3-3" /><path d="M5 19v-5h5" /></>,
}

export default function Icon({ name, size = 20, stroke = 2, className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{P[name]}</svg>
  )
}
