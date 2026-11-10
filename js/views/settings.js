import { clearAll, bulkPut, getAll } from "../store.js";
import { dateKey } from "../utils/date.js";
import { esc, icon } from "../utils/dom.js";
import { addSubject, getSettings, getSubjects, importSettings, removeSubject } from "../settings.js";
import { blobToDataURL, dataURLToBlob, downloadJSON } from "../utils/image.js";
import { notificationState, requestNotificationPermission } from "../remind.js";
import { openModal, confirmModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

export const title = "设置";

function notifyInfo() {
  const state = notificationState();
  if (state === "granted") return { cls: "badge-ok", text: "已开启" };
  if (state === "denied") return { cls: "badge-warn", text: "已被拒绝" };
  if (state === "unsupported") return { cls: "badge-gray", text: "浏览器不支持" };
  return { cls: "badge-gray", text: "未开启" };
}

function fmtBytes(bytes) {
  const value = Number(bytes);
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`;
}

function chooseImportMode(data) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const modal = openModal({
      title: "导入备份",
      content: `<p class="detail-text">备份包含 ${data.mistakes.length} 道错题、${data.tasks.length} 个任务。<br><br>覆盖导入：清空当前数据后再写入备份。<br>合并导入：保留当前数据，相同记录会被备份内容覆盖。</p>`,
      footer: `<button type="button" class="btn btn-ghost" data-mode="cancel">取消</button>
               <button type="button" class="btn btn-ghost" data-mode="merge">合并导入</button>
               <button type="button" class="btn btn-danger" data-mode="replace">覆盖导入</button>`,
      onClose: () => done("cancel"),
    });
    modal.foot.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        done(btn.getAttribute("data-mode"));
        modal.close();
      });
    });
  });
}

function validateBackup(data) {
  if (!data || typeof data !== "object") throw new Error("备份文件内容为空");
  if (data.app !== "lanbai-cuoti") throw new Error("这不是本应用导出的备份文件");
  if (!Array.isArray(data.mistakes) || !Array.isArray(data.tasks)) throw new Error("备份文件结构不完整");
}

function validRecords(list) {
  return list.filter((item) => item && typeof item === "object" && typeof item.id === "string" && item.id);
}

async function applyImport(data, mode) {
  if (mode === "replace") await clearAll();
  if (data.settings) importSettings(data.settings);

  const imageRecords = [];
  Object.entries(data.images || {}).forEach(([id, dataURL]) => {
    try {
      imageRecords.push({ id, blob: dataURLToBlob(dataURL), createdAt: Date.now() });
    } catch (err) {
      console.warn("跳过一张无法解析的图片", err);
    }
  });

  await bulkPut("images", imageRecords);
  await bulkPut("mistakes", validRecords(data.mistakes));
  await bulkPut("tasks", validRecords(data.tasks));
  return { mistakes: validRecords(data.mistakes).length, tasks: validRecords(data.tasks).length };
}

export async function render(el) {
  const profile = notifyInfo();

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">设置</h1>
        <p class="page-sub">通知、学科分类与本地数据</p>
      </div>
    </div>

    <div class="stack">
      <section class="card">
        <div class="settings-block">
          <div class="settings-row">
            <div>
              <div class="settings-title">系统通知</div>
              <div class="settings-desc">授权后，页面切到后台也能收到任务提醒；未授权时仍会在页面内弹窗提醒。</div>
            </div>
            <div class="row">
              <span class="badge ${profile.cls}" id="notify-badge">${profile.text}</span>
              <button type="button" class="btn btn-soft btn-sm" data-notify>开启通知</button>
            </div>
          </div>
          <p class="settings-desc" id="notify-hint">${
            profile.text === "已被拒绝"
              ? "通知已被浏览器拒绝，请在地址栏左侧的站点设置中重新允许。"
              : "提醒依赖页面保持打开，浏览器在后台节流时提醒可能略有延迟。"
          }</p>
        </div>

        <div class="settings-block">
          <div class="settings-title">学科分类</div>
          <p class="settings-desc">新增的学科会出现在错题录入与任务关联中，至少保留一个。</p>
          <div class="row" style="margin-top:12px">
            <input class="input" id="new-subject" placeholder="添加学科，例如：信息技术" style="max-width:280px">
            <button type="button" class="btn btn-soft" data-add-subject>${icon("plus", 16)} 添加</button>
          </div>
          <div class="row wrap" id="subject-list" style="margin-top:14px"></div>
        </div>

        <div class="settings-block">
          <div class="settings-title">数据管理</div>
          <p class="settings-desc">数据仅保存在本机浏览器，清除浏览器数据会丢失。换设备请先导出备份。<span id="storage-usage"></span></p>
          <div class="row wrap" style="margin-top:14px">
            <button type="button" class="btn btn-soft" data-export>${icon("download", 16)} 导出备份</button>
            <button type="button" class="btn btn-ghost" data-import>${icon("upload", 16)} 导入备份</button>
            <button type="button" class="btn btn-danger" data-clear>${icon("trash", 16)} 清空全部数据</button>
            <input type="file" id="import-file" accept="application/json,.json" hidden>
          </div>
        </div>

        <div class="settings-block">
          <div class="settings-title">关于</div>
          <p class="settings-desc">蓝白错题本 · 错题收集、学习计划与专注倒计时。<br>本地优先，无需登录；所有照片与文字都保存在这台设备的浏览器中。</p>
        </div>
      </section>
    </div>`;

  const subjectList = el.querySelector("#subject-list");
  const newSubjectInput = el.querySelector("#new-subject");

  function renderSubjects() {
    subjectList.innerHTML = getSubjects()
      .map((name) => `<span class="chip">${esc(name)}<button type="button" class="chip-x" data-del-subject="${esc(name)}" aria-label="删除学科 ${esc(name)}">×</button></span>`)
      .join("");
  }
  renderSubjects();

  if (navigator.storage && typeof navigator.storage.estimate === "function") {
    navigator.storage
      .estimate()
      .then((info) => {
        const usageNode = el.querySelector("#storage-usage");
        if (usageNode && info && typeof info.usage === "number") {
          usageNode.textContent = ` 当前已用约 ${fmtBytes(info.usage)}。`;
        }
      })
      .catch(() => {});
  }

  el.querySelector("[data-notify]").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    const result = await requestNotificationPermission();
    btn.disabled = false;
    const next = notifyInfo();
    const badge = el.querySelector("#notify-badge");
    badge.className = `badge ${next.cls}`;
    badge.textContent = next.text;
    if (result === "granted") {
      toast("通知权限已开启", "success");
    } else if (result === "denied") {
      toast("通知权限被拒绝，请到浏览器站点设置中开启", "warn");
    } else if (result === "unsupported") {
      toast("当前浏览器不支持系统通知，将使用页面内提醒", "warn");
    }
  });

  el.querySelector("[data-add-subject]").addEventListener("click", () => {
    const result = addSubject(newSubjectInput.value);
    if (!result.ok) {
      toast(result.message, "warn");
      return;
    }
    newSubjectInput.value = "";
    renderSubjects();
    toast("学科已添加", "success");
  });

  newSubjectInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") el.querySelector("[data-add-subject]").click();
  });

  el.querySelector("[data-export]").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    try {
      const [mistakes, tasks, images] = await Promise.all([
        getAll("mistakes"),
        getAll("tasks"),
        getAll("images"),
      ]);
      const imageMap = {};
      for (const image of images) {
        if (image && image.blob) imageMap[image.id] = await blobToDataURL(image.blob);
      }
      downloadJSON(
        {
          app: "lanbai-cuoti",
          version: 1,
          exportedAt: new Date().toISOString(),
          settings: getSettings(),
          mistakes,
          tasks,
          images: imageMap,
        },
        `错题本备份-${dateKey()}.json`
      );
      toast(`已导出 ${mistakes.length} 道错题、${tasks.length} 个任务`, "success");
    } catch (err) {
      console.error(err);
      toast(err.message || "导出失败", "error");
    } finally {
      btn.disabled = false;
    }
  });

  const importInput = el.querySelector("#import-file");
  el.querySelector("[data-import]").addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", async () => {
    const file = importInput.files && importInput.files[0];
    importInput.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error("文件不是有效的 JSON");
      }
      validateBackup(data);
      const mode = await chooseImportMode(data);
      if (mode === "cancel") return;
      const counts = await applyImport(data, mode);
      toast(`导入完成：${counts.mistakes} 道错题、${counts.tasks} 个任务`, "success");
      await render(el);
    } catch (err) {
      console.error(err);
      toast(err.message || "导入失败，请检查备份文件", "error");
    }
  });

  el.querySelector("[data-clear]").addEventListener("click", async () => {
    const first = await confirmModal({
      title: "清空全部数据",
      message: "将删除所有错题、任务与照片，且无法恢复。建议先导出备份。",
      confirmText: "继续",
      danger: true,
    });
    if (!first) return;
    const second = await confirmModal({
      title: "再次确认",
      message: "这是最后一步确认，清空后数据无法找回。确定要清空吗？",
      confirmText: "确认清空",
      danger: true,
    });
    if (!second) return;
    try {
      await clearAll();
      toast("全部数据已清空", "success");
      await render(el);
    } catch (err) {
      toast(err.message || "清空失败", "error");
    }
  });

  el.onclick = async (event) => {
    const del = event.target.closest("[data-del-subject]");
    if (!del) return;
    const name = del.getAttribute("data-del-subject");
    const result = removeSubject(name);
    if (!result.ok) {
      toast(result.message, "warn");
      return;
    }
    renderSubjects();
    toast(`已删除学科「${name}」`, "success");
  };

  return undefined;
}