const KEY = "lanbai-cuoti.settings.v1";

export const BASE_SUBJECTS = [
  "语文",
  "数学",
  "英语",
  "物理",
  "化学",
  "生物",
  "历史",
  "地理",
  "政治",
  "其他",
];

const DEFAULTS = {
  subjects: [...BASE_SUBJECTS],
};

let cache = null;

export function getSettings() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = { ...DEFAULTS, subjects: [...BASE_SUBJECTS] };
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = {
      ...DEFAULTS,
      ...parsed,
      subjects: Array.isArray(parsed.subjects) && parsed.subjects.length
        ? parsed.subjects
        : [...BASE_SUBJECTS],
    };
    return cache;
  } catch (err) {
    console.warn("读取设置失败", err);
    cache = { ...DEFAULTS, subjects: [...BASE_SUBJECTS] };
    return cache;
  }
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("保存设置失败", err);
  }
  return next;
}

export function getSubjects() {
  return getSettings().subjects;
}

export function addSubject(name) {
  const value = String(name || "").trim();
  if (!value) return { ok: false, message: "学科名称不能为空" };
  const subjects = getSubjects();
  if (subjects.includes(value)) return { ok: false, message: "该学科已存在" };
  saveSettings({ subjects: [...subjects, value] });
  return { ok: true };
}

export function removeSubject(name) {
  const subjects = getSubjects();
  if (subjects.length <= 1) return { ok: false, message: "至少保留一个学科" };
  saveSettings({ subjects: subjects.filter((s) => s !== name) });
  return { ok: true };
}

export function importSettings(value) {
  if (!value || !Array.isArray(value.subjects) || !value.subjects.length) return;
  saveSettings({ subjects: value.subjects.filter((s) => typeof s === "string" && s.trim()) });
}