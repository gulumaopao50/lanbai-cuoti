import { esc, icon, el } from "./utils/dom.js";
import { toast } from "./components/toast.js";
import { startReminders } from "./remind.js";
import * as home from "./views/home.js";
import * as mistakes from "./views/mistakes.js";
import * as plans from "./views/plans.js";
import * as focus from "./views/focus.js";
import * as settings from "./views/settings.js";

const NAV = [
  { id: "home", label: "今日", icon: "home", mod: home },
  { id: "mistakes", label: "错题本", icon: "book", mod: mistakes },
  { id: "plans", label: "计划", icon: "calendar", mod: plans },
  { id: "focus", label: "专注", icon: "timer", mod: focus },
  { id: "settings", label: "设置", icon: "settings", mod: settings },
];

let cleanup = null;
let renderToken = 0;

function buildNav() {
  const sidebar = document.getElementById("sidebar-nav");
  const tabbar = document.getElementById("tabbar");
  sidebar.innerHTML = NAV
    .map((item) => `<a class="nav-item" data-nav="${item.id}" href="#/${item.id}">${icon(item.icon, 18)}<span>${item.label}</span></a>`)
    .join("");
  tabbar.innerHTML = NAV
    .map((item) => `<a class="tab-item" data-nav="${item.id}" href="#/${item.id}">${icon(item.icon, 20)}<span>${item.label}</span></a>`)
    .join("");
}

function currentNav() {
  const raw = location.hash.replace(/^#\/?/, "").split("?")[0];
  return NAV.find((item) => item.id === raw) || NAV[0];
}

async function route() {
  const nav = currentNav();
  const view = document.getElementById("view");
  const token = ++renderToken;

  if (typeof cleanup === "function") {
    try {
      cleanup();
    } catch (err) {
      console.warn("清理上一个视图失败", err);
    }
  }
  cleanup = null;

  document.querySelectorAll("[data-nav]").forEach((node) => {
    node.classList.toggle("active", node.getAttribute("data-nav") === nav.id);
  });
  document.title = `${nav.label} · 蓝白错题本`;
  view.innerHTML = '<div class="skeleton">正在加载…</div>';

  try {
    const result = await nav.mod.render(view);
    if (token !== renderToken) {
      if (typeof result === "function") result();
      return;
    }
    cleanup = typeof result === "function" ? result : null;
  } catch (err) {
    console.error(err);
    if (token !== renderToken) return;
    view.innerHTML = `<div class="card card-pad empty">
      <div class="empty-icon">${icon("alert", 24)}</div>
      <div class="empty-title">页面加载失败</div>
      <div class="empty-desc">${esc(err.message || "请刷新页面后重试")}</div>
    </div>`;
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const swUrl = new URL("./sw.js", document.baseURI).href;
  navigator.serviceWorker.register(swUrl, { scope: "./" }).then((registration) => {
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          toast("应用有新版本，重新打开后生效", "info", 4000);
        }
      });
    });
  }).catch((err) => {
    console.warn("Service Worker 注册失败", err);
  });
}

const INSTALL_DISMISSED_KEY = "lanbai-cuoti.install-dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone === true
  );
}

let installBar = null;

function dismissInstallBar() {
  if (!installBar) return;
  localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
  installBar.classList.remove("show");
  setTimeout(() => {
    if (installBar) {
      installBar.remove();
      installBar = null;
    }
  }, 260);
}

function syncInstallBar() {
  if (!installBar) return;
  const hasBtn = installBar.querySelector(".install-accept");
  const canInstall = Boolean(window.deferredPrompt);
  if (canInstall && !hasBtn) {
    const btn = el("button", "btn btn-primary btn-sm install-accept");
    btn.type = "button";
    btn.textContent = "安装";
    btn.addEventListener("click", async () => {
      const promptEvent = window.deferredPrompt;
      if (!promptEvent) {
        toast("请点击浏览器菜单中的「安装应用」或「添加到主屏幕」", "info", 3600);
        return;
      }
      btn.disabled = true;
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === "accepted") {
          toast("正在安装，稍后可在桌面打开错题本", "success");
        } else {
          toast("已取消安装。也可点击浏览器菜单 → 安装应用 / 添加到主屏幕", "info", 3600);
        }
      } catch (err) {
        console.warn("触发安装对话框失败", err);
        toast("无法唤起安装窗口，请点击浏览器菜单 → 安装应用 / 添加到主屏幕", "warn", 3600);
      }
      window.deferredPrompt = null;
      btn.remove();
      btn.disabled = false;
    });
    installBar.insertBefore(btn, installBar.querySelector(".install-close"));
  }
}

function showInstallGuide() {
  if (isStandalone()) return;
  if (localStorage.getItem(INSTALL_DISMISSED_KEY) === "1") return;
  if (installBar) {
    syncInstallBar();
    return;
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const hint = isIOS
    ? '点击底部 <b>分享</b> 按钮，选择「添加到主屏幕」，即可像 App 一样离线使用。'
    : window.deferredPrompt
      ? '点击「安装」按钮，即可像 App 一样全屏离线使用。'
      : '点击浏览器菜单中的「安装应用」或「添加到主屏幕」，即可离线使用。';

  const bar = el("div", "install-bar");
  bar.innerHTML = `
    <img src="./icons/icon-192.png" alt="错题本图标" class="install-icon">
    <div class="install-text">
      <strong>安装蓝白错题本</strong>
      <span>${hint}</span>
    </div>
    <button type="button" class="install-close" aria-label="关闭安装提示">×</button>`;

  document.body.appendChild(bar);
  installBar = bar;
  requestAnimationFrame(() => bar.classList.add("show"));
  bar.querySelector(".install-close").addEventListener("click", dismissInstallBar);
  syncInstallBar();
}

function listenInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    window.deferredPrompt = event;
    showInstallGuide();
    syncInstallBar();
  });
  window.addEventListener("appinstalled", () => {
    toast("安装成功，可在桌面打开错题本", "success");
    if (installBar) {
      const bar = installBar;
      installBar = null;
      bar.classList.remove("show");
      setTimeout(() => bar.remove(), 260);
    }
  });
}

function init() {
  buildNav();
  window.addEventListener("hashchange", route);
  window.addEventListener("unhandledrejection", (event) => {
    console.error("未处理的异步错误", event.reason);
  });
  if (!location.hash) history.replaceState(null, "", "#/home");
  route();
  startReminders();
  registerServiceWorker();
  listenInstallPrompt();
  setTimeout(showInstallGuide, 800);
}

init();