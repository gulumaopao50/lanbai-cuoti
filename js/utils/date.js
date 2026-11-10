const PAD = (n) => String(n).padStart(2, "0");

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

export function asDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  return new Date();
}

export function dateKey(value = new Date()) {
  const d = asDate(value);
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
}

export function toDateTimeLocal(value = new Date()) {
  const d = asDate(value);
  return `${dateKey(d)}T${PAD(d.getHours())}:${PAD(d.getMinutes())}`;
}

export function fmtDate(value) {
  const d = asDate(value);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function fmtMonthDay(value) {
  const d = asDate(value);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function fmtTime(value) {
  const d = asDate(value);
  return `${PAD(d.getHours())}:${PAD(d.getMinutes())}`;
}

export function fmtDateTime(value) {
  if (!value) return "";
  const d = asDate(value);
  return `${fmtMonthDay(d)} ${fmtTime(d)}`;
}

export function weekdayCN(value = new Date()) {
  return WEEKDAYS[asDate(value).getDay()];
}

export function todayLabel() {
  const d = new Date();
  return `${fmtDate(d)} ${weekdayCN(d)}`;
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function dayLabel(value) {
  const key = dateKey(value);
  const today = dateKey();
  if (key === today) return "今天";
  if (key === addDays(today, -1)) return "昨天";
  if (key === addDays(today, 1)) return "明天";
  return fmtMonthDay(value);
}

export function daysBetween(from, to = new Date()) {
  const a = new Date(`${dateKey(from)}T00:00:00`).getTime();
  const b = new Date(`${dateKey(to)}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function relativeFrom(value) {
  if (!value) return "";
  const diff = Date.now() - asDate(value).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return fmtMonthDay(value);
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} 小时 ${m} 分`;
  if (m > 0) return `${m} 分 ${s} 秒`;
  return `${s} 秒`;
}

export function formatClock(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${PAD(m)}:${PAD(s)}`;
}

export function msUntilNext(value) {
  const d = asDate(value);
  return d.getTime() - Date.now();
}