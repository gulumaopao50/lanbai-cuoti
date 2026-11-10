import { getAll } from "./store.js";
import { openModal } from "./components/modal.js";
import { fmtTime } from "./utils/date.js";

const fired = new Set();
let timerId = null;
let audioCtx = null;

export function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    const start = audioCtx.currentTime;
    [0, 0.2, 0.4].forEach((offset) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.22);
    });
  } catch (err) {
    console.warn("播放提示音失败", err);
  }
}

export function showReminder(title, body) {
  const content = `
    <div class="detail-block">
      <div class="detail-label">提醒内容</div>
      <div class="detail-text">${body || title}</div>
    </div>
    <p class="settings-desc" style="margin-top:12px">提示时间：${fmtTime(new Date())}</p>`;
  openModal({
    title: "时间到了",
    content,
    footer: `<a class="btn btn-ghost" href="#/plans" data-close>查看计划</a>
             <button type="button" class="btn btn-primary" data-close>知道了</button>`,
  });
}

export async function notify(title, body = "") {
  playChime();
  const grantNative = "Notification" in window && Notification.permission === "granted";
  if (grantNative && document.visibilityState === "hidden") {
    try {
      new Notification(title, { body: body || "该处理一下了", tag: "lanbai-reminder" });
      return;
    } catch (err) {
      console.warn("系统通知发送失败，改为页面内提醒", err);
    }
  }
  showReminder(title, body);
}

function safeString(value) {
  return String(value ?? "");
}

async function checkDueTasks() {
  if (!("indexedDB" in window)) return;
  let tasks;
  try {
    tasks = await getAll("tasks");
  } catch (err) {
    console.warn("读取任务失败，提醒暂停一次", err);
    return;
  }
  const now = Date.now();
  tasks.forEach((task) => {
    if (!task || task.done || !task.datetime) return;
    const at = new Date(task.datetime).getTime();
    if (Number.isNaN(at)) return;
    const key = `task:${task.id}:${task.datetime}`;
    if (fired.has(key)) return;
    const diff = now - at;
    if (diff >= 0 && diff < 90000) {
      fired.add(key);
      const extra = task.duration ? `，预计 ${task.duration} 分钟` : "";
      notify("任务提醒", `「${safeString(task.title)}」${extra}`);
    }
  });
}

export function refreshReminders() {
  checkDueTasks();
}

export function startReminders() {
  if (timerId) return;
  checkDueTasks();
  timerId = setInterval(checkDueTasks, 15000);
}

export function notificationState() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch (err) {
    console.warn("申请通知权限失败", err);
    return "denied";
  }
}