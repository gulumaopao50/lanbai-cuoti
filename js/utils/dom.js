const ATTRS = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  home: '<path d="M3 10.8 12 3.5l9 7.3"/><path d="M5.2 9.6V20.5h13.6V9.6"/><path d="M9.5 20.5v-6h5v6"/>',
  book: '<path d="M4.5 5.4A2.4 2.4 0 0 1 6.9 3H19.5v18H6.9a2.4 2.4 0 0 1-2.4-2.4z"/><path d="M8 7.5h7.5M8 11h5.5"/>',
  calendar: '<rect x="3.2" y="5" width="17.6" height="16" rx="2.4"/><path d="M3.2 10h17.6M8 3v4M16 3v4"/>',
  timer: '<circle cx="12" cy="13.4" r="7.6"/><path d="M12 9.6v3.8l2.4 2.4M9.2 2.2h5.6"/>',
  settings: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2.1"/><circle cx="15" cy="12" r="2.1"/><circle cx="8" cy="17" r="2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14 6 4 4"/>',
  camera: '<path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v11H4z"/><circle cx="12" cy="13.5" r="3.4"/>',
  image: '<rect x="3.2" y="4.5" width="17.6" height="15" rx="2.4"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4.5 17 4.5-4.5 3.5 3.5 3-3L20 17"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M4.5 19.5h15"/>',
  upload: '<path d="M12 16V5M8 9l4-4 4 4"/><path d="M4.5 19.5h15"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>',
  rotate: '<path d="M5 10a7.5 7.5 0 0 1 12.8-3.3L20 9"/><path d="M20 4v5h-5"/><path d="M19 14a7.5 7.5 0 0 1-12.8 3.3L4 15"/><path d="M4 20v-5h5"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  tag: '<path d="M4 5h7l8 8-6 6-9-9z"/><circle cx="8.5" cy="9.5" r="1.2"/>',
  spark: '<path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.9L12 18.5l-1.8-5.8L4.7 10.8 10.2 9z"/>',
  alert: '<path d="M12 4 3 20h18z"/><path d="M12 10v4M12 17.2v.3"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4.2" cy="6" r="1"/><circle cx="4.2" cy="12" r="1"/><circle cx="4.2" cy="18" r="1"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.9"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};

export function icon(name, size = 18) {
  const body = ICONS[name] || ICONS.spark;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ${ATTRS} aria-hidden="true">${body}</svg>`;
}

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

export function debounce(fn, wait = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}