import { esc, icon } from "../utils/dom.js";

export function openModal({ title = "", content = "", footer = "", size = "", onMount = null, onClose = null }) {
  const root = document.getElementById("modal-root");
  if (!root) throw new Error("缺少 modal-root 容器");

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <span class="modal-title">${esc(title)}</span>
        <button type="button" class="btn-icon" data-close aria-label="关闭">${icon("close", 16)}</button>
      </div>
      <div class="modal-body"></div>
      ${footer ? '<div class="modal-foot"></div>' : ""}
    </div>`;

  const body = backdrop.querySelector(".modal-body");
  if (content instanceof Node) body.appendChild(content);
  else body.innerHTML = content;

  const foot = backdrop.querySelector(".modal-foot");
  if (foot) {
    if (footer instanceof Node) foot.appendChild(footer);
    else foot.innerHTML = footer;
  }

  root.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("open"));

  let closed = false;
  function onKey(event) {
    if (event.key === "Escape") close();
  }

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    backdrop.classList.remove("open");
    setTimeout(() => backdrop.remove(), 190);
    if (typeof onClose === "function") {
      try {
        onClose();
      } catch (err) {
        console.warn(err);
      }
    }
  }

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
    if (event.target.closest("[data-close]")) close();
  });
  document.addEventListener("keydown", onKey);

  const focusable = body.querySelector("input, textarea, select");
  if (focusable) setTimeout(() => focusable.focus(), 80);

  if (typeof onMount === "function") onMount({ body, foot, close, backdrop });

  return { body, foot, close, backdrop };
}

export function confirmModal(options = {}) {
  const {
    title = "请确认",
    message = "",
    confirmText = "确定",
    cancelText = "取消",
    danger = false,
  } = options;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const modal = openModal({
      title,
      content: `<p class="detail-text">${esc(message)}</p>`,
      footer: `<button type="button" class="btn btn-ghost" data-cancel>${esc(cancelText)}</button>
               <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok>${esc(confirmText)}</button>`,
      onClose: () => finish(false),
    });

    modal.foot.querySelector("[data-cancel]").addEventListener("click", () => {
      finish(false);
      modal.close();
    });
    modal.foot.querySelector("[data-ok]").addEventListener("click", () => {
      finish(true);
      modal.close();
    });
  });
}