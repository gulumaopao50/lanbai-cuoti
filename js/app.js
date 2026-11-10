import { esc, icon, el } from "./utils/dom.js";
import { toast } from "./components/toast.js";
import { openModal } from "./components/modal.js";
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

function detectBrowser() {
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  if (/MicroMessenger\//i.test(ua)) return { id: "wechat", name: "微信", ios: isIOS };
  if (/QQ\//i.test(ua) && !/MQQBrowser/i.test(ua)) return { id: "qq", name: "手机QQ", ios: isIOS };
  if (/MQQBrowser/i.test(ua)) return { id: "qqbrowser", name: "QQ浏览器", ios: isIOS };
  if (/MiuiBrowser|XiaoMi/i.test(ua)) return { id: "mi", name: "小米浏览器", ios: isIOS };
  if (/HuaweiBrowser|HUAWEI/i.test(ua)) return { id: "huawei", name: "华为浏览器", ios: isIOS };
  if (/HONOR|HiBrowser/i.test(ua)) return { id: "honor", name: "荣耀浏览器", ios: isIOS };
  if (/HeyTapBrowser|OppoBrowser/i.test(ua)) return { id: "oppo", name: "OPPO浏览器", ios: isIOS };
  if (/VivoBrowser/i.test(ua)) return { id: "vivo", name: "vivo浏览器", ios: isIOS };
  if (/Quark/i.test(ua)) return { id: "quark", name: "夸克浏览器", ios: isIOS };
  if (/UCBrowser|UBrowser/i.test(ua)) return { id: "uc", name: "UC浏览器", ios: isIOS };
  if (/baiduboxapp|BaiduMobile/i.test(ua)) return { id: "baidu", name: "百度App", ios: isIOS };
  if (/SamsungBrowser/i.test(ua)) return { id: "samsung", name: "三星浏览器", ios: isIOS };
  if (/EdgiOS|Edg\//i.test(ua)) return { id: "edge", name: "Edge浏览器", ios: isIOS };
  if (/Firefox/i.test(ua)) return { id: "firefox", name: "Firefox浏览器", ios: isIOS };
  if (/CriOS|Chrome\//i.test(ua)) return { id: "chrome", name: "Chrome浏览器", ios: isIOS };
  if (isIOS) return { id: "safari", name: "Safari浏览器", ios: true };
  return { id: "unknown", name: "当前浏览器", ios: isIOS };
}

const INSTALL_STEPS = {
  wechat: {
    intro: "微信内无法直接安装应用，请先转到系统浏览器打开：",
    steps: ["点右下角「···」更多按钮", "选择「在浏览器打开」（iOS 为「在 Safari 中打开」）", "在浏览器打开本页后，按该浏览器的安装指引操作"],
  },
  qq: {
    intro: "QQ 内无法直接安装应用，请先转到系统浏览器打开：",
    steps: ["点右上角「···」更多按钮", "选择「用浏览器打开」", "在浏览器打开本页后，按该浏览器的安装指引操作"],
  },
  baidu: {
    intro: "百度 App 内无法直接安装，请先转到系统浏览器：",
    steps: ["点底部「更多」或右上角「···」", "选择「在浏览器打开」", "在浏览器打开本页后，按该浏览器的安装指引操作"],
  },
  mi: {
    intro: "小米浏览器部分版本隐藏了「添加到桌面」，按以下顺序找：",
    steps: [
      "点底部「☰ 菜单」按钮（三条横线）",
      "在菜单面板上**向右滑动**——菜单有两页，「添加到桌面/主屏幕」多在第二页或「更多工具」里",
      "若找到「添加到桌面」，点击确认即可",
      "若两页都没有该选项，说明此版本不支持：改用 Chrome 或夸克浏览器打开本页安装（应用商店可装），可获完整离线 App 体验",
    ],
  },
  huawei: {
    intro: "在华为浏览器中安装到主屏幕：",
    steps: ["点底部「☰ 菜单」按钮", "找到「添加到」", "选择「添加到主屏幕」", "确认后桌面会出现「错题本」图标"],
  },
  honor: {
    intro: "在荣耀浏览器中安装到主屏幕：",
    steps: ["点底部「☰ 菜单」按钮", "找到「添加到」", "选择「添加到主屏幕」", "确认后桌面会出现「错题本」图标"],
  },
  oppo: {
    intro: "OPPO 浏览器的「添加到桌面」藏在菜单第二页：",
    steps: [
      "点底部「☰ 菜单」按钮（三条横线）",
      "在菜单面板上**向右滑动**到第二页——「添加到桌面 / 创建快捷方式」通常在第二页或「更多工具」里",
      "也可点开「添加收藏」，留意弹窗里是否有「保存到桌面」选项",
      "若都没有该选项：改用 Chrome 或夸克浏览器打开本页安装（软件商店可装），体验更完整",
    ],
  },
  vivo: {
    intro: "在 vivo 浏览器中安装：",
    steps: ["点底部「☰ 菜单」按钮", "找到「添加到桌面」", "确认后桌面会出现「错题本」图标"],
  },
  quark: {
    intro: "在夸克浏览器中安装：",
    steps: ["点底部「☰ 菜单」按钮", "找到「添加到主屏幕」", "确认后桌面会出现「错题本」图标"],
  },
  uc: {
    intro: "在 UC 浏览器中安装：",
    steps: ["点底部「☰ 菜单」按钮", "找到「添加到主屏幕」（或「添加书签」里的主屏幕选项）", "确认后桌面会出现「错题本」图标"],
  },
  qqbrowser: {
    intro: "在 QQ 浏览器中安装：",
    steps: ["点底部「☰ 菜单」按钮", "找到「添加到桌面」", "确认后桌面会出现「错题本」图标"],
  },
  chrome: {
    intro: "在 Chrome 中安装：",
    steps: ["点地址栏右侧「⋮ 菜单」按钮", "选择「安装应用」或「添加到主屏幕」", "点「安装」确认", "桌面会出现「错题本」图标，点开即全屏离线使用"],
  },
  edge: {
    intro: "在 Edge 中安装：",
    steps: ["点地址栏右侧「⋯ 菜单」按钮", "选择「添加到手机」或「安装此应用」", "确认后桌面会出现「错题本」图标"],
  },
  samsung: {
    intro: "在三星浏览器中安装：",
    steps: ["点底部「☰ 菜单」按钮", "选择「添加页面至」", "选择「主屏幕」", "桌面会出现「错题本」图标"],
  },
  firefox: {
    intro: "在 Firefox 中安装：",
    steps: ["点地址栏右侧「⋮ 菜单」按钮", "找到「安装」或「添加到主屏幕」", "确认后桌面会出现「错题本」图标"],
  },
  safari: {
    intro: "在 Safari 中添加到主屏幕：",
    steps: ["点底部「分享」按钮（方框加向上箭头）", "向下滑动列表，选择「添加到主屏幕」", "点「添加」确认", "桌面会出现「错题本」图标，点开即全屏离线使用"],
  },
  unknown: {
    intro: "通用安装方法：",
    steps: ["点浏览器「菜单」按钮（☰ 或 ⋮）", "在菜单中找「添加到主屏幕 / 添加到桌面 / 安装应用」", "确认后桌面会出现「错题本」图标", "若菜单里没有，可换用 Chrome、Edge 或系统自带浏览器打开本页"],
  },
};

function showInstallGuideModal() {
  const browser = detectBrowser();
  const guide = INSTALL_STEPS[browser.id] || INSTALL_STEPS.unknown;
  const stepsHtml = guide.steps
    .map((step, index) => `<li><span class="step-num">${index + 1}</span><span>${esc(step)}</span></li>`)
    .join("");

  openModal({
    title: `安装指引 · ${browser.name}`,
    content: `<div class="stack">
      <div class="detail-block">
        <div class="detail-label">${esc(guide.intro)}</div>
        <ol class="step-list">${stepsHtml}</ol>
      </div>
      <p class="settings-desc">安装后桌面出现蓝底白勾的「错题本」图标，点开即全屏独立窗口，<b>断网也能正常使用</b>。<br>提示：国产浏览器若找不到「添加到桌面」选项，最稳妥的方式是<b>用 Chrome 或 Edge 打开本页</b>安装，体验也最完整。本页地址：<span class="install-url">${esc(location.href)}</span></p>
    </div>`,
    footer: `<button type="button" class="btn btn-primary" data-close>我知道了</button>`,
  });
}

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
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const promptEvent = window.deferredPrompt;
      if (!promptEvent) {
        showInstallGuideModal();
        return;
      }
      btn.disabled = true;
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === "accepted") {
          toast("正在安装，稍后可在桌面打开错题本", "success");
        } else {
          toast("已取消安装，可随时从菜单再次安装", "info", 3000);
        }
      } catch (err) {
        console.warn("触发安装对话框失败", err);
        showInstallGuideModal();
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

  const browser = detectBrowser();
  const hint = browser.ios
    ? "点击横幅查看安装步骤，添加到主屏幕即可离线使用。"
    : window.deferredPrompt
      ? "点击「安装」按钮，即可像 App 一样全屏离线使用。"
      : `当前是${browser.name}，点击横幅查看安装步骤。`;

  const bar = el("div", "install-bar");
  bar.setAttribute("role", "button");
  bar.setAttribute("tabindex", "0");
  bar.innerHTML = `
    <img src="./icons/icon-192.png" alt="错题本图标" class="install-icon">
    <div class="install-text">
      <strong>安装蓝白错题本</strong>
      <span>${hint}</span>
    </div>
    <button type="button" class="install-open" aria-label="查看安装步骤">${icon("arrow", 18)}</button>
    <button type="button" class="install-close" aria-label="关闭安装提示">×</button>`;

  document.body.appendChild(bar);
  installBar = bar;
  requestAnimationFrame(() => bar.classList.add("show"));

  bar.addEventListener("click", (event) => {
    if (event.target.closest(".install-close") || event.target.closest(".install-accept")) return;
    showInstallGuideModal();
  });
  bar.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showInstallGuideModal();
    }
  });
  bar.querySelector(".install-close").addEventListener("click", (event) => {
    event.stopPropagation();
    dismissInstallBar();
  });
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