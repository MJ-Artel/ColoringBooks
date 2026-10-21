// Flat 2D icons. Tool tips and bodies use currentColor, so each tool shows the colour you've picked.

const OUTLINE = 'stroke="#161616" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"';
const tilted = (body, extra = '') =>
  `<svg viewBox="0 0 48 48" aria-hidden="true"><g transform="rotate(-40 24 24)" ${OUTLINE}>${body}</g>${extra}</svg>`;

export const TOOL_ICONS = {
  pencil: tilted(`
    <path d="M4 24 L13 19.5 V28.5 Z" fill="#ecc9a0"/>
    <path d="M4 24 L7.6 22.2 V25.8 Z" fill="currentColor" stroke="none"/>
    <rect x="13" y="19.5" width="27" height="9" fill="currentColor"/>
    <rect x="13.7" y="20.2" width="25.6" height="2.4" fill="#fff" opacity=".3" stroke="none"/>
    <rect x="40" y="19.5" width="4.5" height="9" rx="1" fill="currentColor"/>
    <rect x="40" y="19.5" width="4.5" height="9" rx="1" fill="#000" opacity=".22"/>`),
  crayon: tilted(`
    <path d="M5 24 Q5.4 20.6 9 19.4 L13 18.5 V29.5 L9 28.6 Q5.4 27.4 5 24 Z" fill="currentColor"/>
    <rect x="13" y="18" width="30" height="12" rx="2.5" fill="currentColor"/>
    <rect x="17" y="18" width="21" height="12" fill="#fbf6ea"/>
    <path d="M20.5 18 V30 M34.5 18 V30" stroke="currentColor" stroke-width="2.4"/>
    <rect x="17" y="18" width="21" height="12" fill="none"/>`),
  watercolour: tilted(`
    <path d="M24 21.4 L43 22.4 Q45 24 43 25.6 L24 26.6 Z" fill="#c08a5a"/>
    <rect x="16" y="20.5" width="8.5" height="7" rx="1" fill="#cfd4da"/>
    <path d="M16 20.5 Q8.5 20.6 3 24 Q8.5 27.4 16 27.5 Z" fill="#eadfca"/>
    <path d="M10.5 21.7 Q6.5 22.5 3 24 Q6.5 25.5 10.5 26.3 Z" fill="currentColor" stroke="none"/>`,
    `<circle cx="11" cy="41" r="3.2" fill="currentColor" opacity=".55"/>`),
  marker: tilted(`
    <path d="M5 24 L11 21 V27 Z" fill="currentColor"/>
    <path d="M11 20.2 H14.5 V27.8 H11 Z" fill="#e3ddd0"/>
    <rect x="14.5" y="17.5" width="21" height="13" rx="3" fill="#f6f2ea"/>
    <rect x="18" y="21.5" width="13" height="5" rx="1.5" fill="currentColor" stroke="none"/>
    <rect x="34" y="17" width="10" height="14" rx="3" fill="currentColor"/>`),
  alcohol: tilted(`
    <path d="M3.5 22 L9 20.4 L12 20.8 V27.2 L9 27.6 L5.5 26.2 Z" fill="currentColor"/>
    <rect x="12" y="19.5" width="31" height="9" rx="4.5" fill="#efebe2"/>
    <rect x="12" y="19.5" width="6" height="9" fill="#d8d2c4"/>
    <rect x="24" y="19.5" width="6" height="9" fill="currentColor"/>
    <path d="M37 19.5 H39 Q43 19.5 43 24 Q43 28.5 39 28.5 H37 Z" fill="currentColor"/>`),
  glitter: tilted(`
    <path d="M4.5 24 L12 21 V27 Z" fill="#cfd4da"/>
    <circle cx="5.2" cy="24" r="1.4" fill="currentColor"/>
    <rect x="12" y="19.5" width="31" height="9" rx="4.5" fill="currentColor"/>
    <g fill="#fff" stroke="none"><circle cx="18" cy="22.2" r="1"/><circle cx="24" cy="25.8" r=".9"/><circle cx="30" cy="22" r="1.1"/><circle cx="36.5" cy="25.4" r=".8"/></g>`,
    `<path d="M39 4.5 l1.6 3.9 3.9 1.6 -3.9 1.6 -1.6 3.9 -1.6 -3.9 -3.9 -1.6 3.9 -1.6z" fill="#f2c14e" ${OUTLINE} stroke-width="1.1"/>`),
  graphite: tilted(`
    <path d="M4 24 L12.5 20 V28 Z" fill="#ecc9a0"/>
    <path d="M4 24 L7.4 22.4 V25.6 Z" fill="#4a4743" stroke="none"/>
    <rect x="12.5" y="20" width="22.5" height="8" fill="#f2c14e"/>
    <rect x="13" y="20.6" width="21.5" height="2" fill="#fff" opacity=".35" stroke="none"/>
    <rect x="35" y="20" width="4" height="8" fill="#cfd4da"/>
    <path d="M39 20 H41.5 Q44 20 44 24 Q44 28 41.5 28 H39 Z" fill="#f4a6b0"/>`),
  fill: `<svg viewBox="0 0 48 48" aria-hidden="true"><g ${OUTLINE}>
    <g transform="rotate(-28 27 25)">
      <path d="M17.5 17 H36.5 L34 37 Q27 40.5 20 37 Z" fill="#cfd4da"/>
      <ellipse cx="27" cy="17" rx="9.5" ry="3" fill="#eef0f3"/>
      <path d="M18.5 16 Q27 5 35.5 16" fill="none"/>
    </g>
    <path d="M16.5 15.5 Q11.5 22 12.5 31 Q13.2 36 10 38.5 Q5 41.5 7.5 44 Q15 46 18.5 41.5 Q16 37.5 15.8 32 Q15.5 24 19.5 17.5 Z" fill="currentColor"/>
  </g></svg>`,
  eraser: tilted(`
    <rect x="7" y="17" width="34" height="14" rx="3" fill="#f4a6b0"/>
    <path d="M22 17 H38 Q41 17 41 20 V28 Q41 31 38 31 H22 Z" fill="#5e7d55"/>
    <path d="M10 27.5 H21" stroke="#fff" stroke-opacity=".6"/>`),
};

const line = (d) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const UI_ICONS = {
  undo: line('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  redo: line('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
  zoomIn: line('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/>'),
  zoomOut: line('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/>'),
  fit: line('<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>'),
  save: line('<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>'),
  print: line('<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 14h10v6H7z"/>'),
  clear: line('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  pages: line('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  more: line('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  close: line('<path d="M6 6l12 12M18 6 6 18"/>'),
  book: line('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'),
  plus: line('<path d="M12 5v14M5 12h14"/>'),
};
