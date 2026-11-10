export function toast(message, type = "info", duration = 2600) {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const node = document.createElement("div");
  node.className = `toast toast-${type}`;
  node.textContent = message;
  root.appendChild(node);
  requestAnimationFrame(() => node.classList.add("show"));
  setTimeout(() => {
    node.classList.remove("show");
    setTimeout(() => node.remove(), 220);
  }, duration);
}