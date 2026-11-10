import { getAll, put, remove, uid } from "../store.js";
import { dateKey, dayLabel, fmtTime, toDateTimeLocal } from "../utils/date.js";
import { esc, icon } from "../utils/dom.js";
import { getSubjects } from "../settings.js";
import { openModal, confirmModal } from "../components/modal.js";
import { toast } from "../components/toast.js";
import { refreshReminders } from "../remind.js";

export const title = "计划";

const state = { mode: "date", date: dateKey() };

const PRIORITIES = [
  { value: "high", label: "高优先级", cls: "badge-warn" },
  { value: "normal", label: "普通", cls: "badge-blue" },
  { value: "low", label: "低优先级", cls: "badge-gray" },
];

function priorityOf(value) {
  return PRIORITIES.find((item) => item.value === value) || PRIORITIES[1];
}

function taskRow(task) {
  const priority = priorityOf(task.priority);
  return `<div class="list-item ${task.done ? "done" : ""}">
    <button type="button" class="check ${task.done ? "done" : ""}" data-toggle="${esc(task.id)}"
      aria-label="${task.done ? "取消完成" : "标记完成"}">${icon("check", 13)}</button>
    <div class="li-main">
      <div class="li-title">${esc(task.title)}</div>
      <div class="li-meta">
        <span>${esc(dayLabel(task.datetime))} ${esc(fmtTime(task.datetime))}</span>
        ${task.subject ? `<span class="tag">${esc(task.subject)}</span>` : ""}
        ${task.duration ? `<span>${task.duration} 分钟</span>` : ""}
        <span class="badge ${priority.cls}">${priority.label}</span>
      </div>
    </div>
    <button type="button" class="btn-icon act" data-edit="${esc(task.id)}" aria-label="编辑任务">${icon("edit", 15)}</button>
    <button type="button" class="btn-icon" data-delete="${esc(task.id)}" aria-label="删除任务">${icon("trash", 15)}</button>
  </div>`;
}

function openForm(record, refresh) {
  const isEdit = Boolean(record);
  const subjects = getSubjects();
  const subjectOptions = [`<option value="">不关联学科</option>`]
    .concat(subjects.map((name) => `<option value="${esc(name)}" ${record && record.subject === name ? "selected" : ""}>${esc(name)}</option>`))
    .join("");
  const priorityOptions = PRIORITIES
    .map((item) => `<option value="${item.value}" ${(record && record.priority) === item.value ? "selected" : ""}>${item.label}</option>`)
    .join("");

  const defaultTime = record ? record.datetime : toDateTimeLocal(new Date(Date.now() + 30 * 60000));

  const content = `<form class="stack" id="task-form" novalidate>
    <label class="field">
      <span class="field-label">任务内容 <span class="req">*</span></span>
      <input class="input" id="t-title" placeholder="例如：整理数学错题 5 道" value="${esc(record ? record.title : "")}">
    </label>
    <div class="form-grid">
      <label class="field">
        <span class="field-label">提醒时间</span>
        <input class="input" type="datetime-local" id="t-datetime" value="${esc(defaultTime)}">
      </label>
      <label class="field">
        <span class="field-label">预计时长（分钟）</span>
        <input class="input" type="number" min="0" max="600" step="5" id="t-duration" value="${record && record.duration ? record.duration : 30}">
      </label>
      <label class="field">
        <span class="field-label">关联学科</span>
        <select class="select" id="t-subject">${subjectOptions}</select>
      </label>
      <label class="field">
        <span class="field-label">优先级</span>
        <select class="select" id="t-priority">${priorityOptions}</select>
      </label>
    </div>
    <p class="field-hint">到达提醒时间时，页面会弹出提醒并播放提示音；授权通知后，切到后台也能收到系统通知。</p>
  </form>`;

  const modal = openModal({
    title: isEdit ? "编辑任务" : "添加任务",
    content,
    footer: `<button type="button" class="btn btn-ghost" data-close>取消</button>
             <button type="button" class="btn btn-primary" data-save>${isEdit ? "保存修改" : "添加任务"}</button>`,
  });

  const titleInput = modal.body.querySelector("#t-title");
  const saveBtn = modal.foot.querySelector("[data-save]");

  saveBtn.addEventListener("click", async () => {
    const titleValue = titleInput.value.trim();
    if (!titleValue) {
      toast("请填写任务内容", "warn");
      titleInput.focus();
      return;
    }
    const datetime = modal.body.querySelector("#t-datetime").value;
    if (!datetime) {
      toast("请选择提醒时间", "warn");
      return;
    }
    const durationValue = Number(modal.body.querySelector("#t-duration").value);
    const data = {
      title: titleValue,
      datetime,
      duration: Number.isFinite(durationValue) && durationValue > 0 ? Math.min(600, durationValue) : 0,
      subject: modal.body.querySelector("#t-subject").value,
      priority: modal.body.querySelector("#t-priority").value,
    };
    saveBtn.disabled = true;
    try {
      if (isEdit) {
        await put("tasks", { ...record, ...data });
      } else {
        await put("tasks", {
          id: uid(),
          ...data,
          done: false,
          doneAt: null,
          createdAt: new Date().toISOString(),
        });
      }
      modal.close();
      toast(isEdit ? "任务已更新" : "任务已添加", "success");
      refreshReminders();
      refresh();
    } catch (err) {
      console.error(err);
      toast(err.message || "保存失败", "error");
      saveBtn.disabled = false;
    }
  });
}

export async function render(el) {
  let tasks = [];
  try {
    tasks = await getAll("tasks");
  } catch (err) {
    el.innerHTML = `<div class="card card-pad empty">
      <div class="empty-icon">${icon("alert", 24)}</div>
      <div class="empty-title">本地数据读取失败</div>
      <div class="empty-desc">${esc(err.message || "请检查浏览器是否允许本地存储")}</div>
    </div>`;
    return undefined;
  }

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">学习计划</h1>
        <p class="page-sub">把任务拆小，一条一条完成</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" data-new>${icon("plus", 16)} 添加任务</button>
      </div>
    </div>

    <section class="card">
      <div class="card-head">
        <div class="segmented">
          <button type="button" class="seg ${state.mode === "date" ? "active" : ""}" data-mode="date">按日期</button>
          <button type="button" class="seg ${state.mode === "all" ? "active" : ""}" data-mode="all">全部任务</button>
          <button type="button" class="seg ${state.mode === "done" ? "active" : ""}" data-mode="done">已完成</button>
        </div>
        <input type="date" class="input select-sm ${state.mode === "date" ? "" : "hidden"}" id="p-date" value="${esc(state.date)}">
      </div>
      <div class="card-body" id="p-list"></div>
    </section>`;

  const listNode = el.querySelector("#p-list");
  const dateInput = el.querySelector("#p-date");

  function visibleTasks() {
    if (state.mode === "done") {
      return tasks
        .filter((task) => task.done)
        .sort((a, b) => String(b.doneAt || "").localeCompare(String(a.doneAt || "")));
    }
    if (state.mode === "all") {
      return tasks
        .slice()
        .sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1;
          return String(a.datetime || "").localeCompare(String(b.datetime || ""));
        });
    }
    return tasks
      .filter((task) => task.datetime && dateKey(task.datetime) === state.date)
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return String(a.datetime).localeCompare(String(b.datetime));
      });
  }

  function paint() {
    const list = visibleTasks();
    if (!list.length) {
      const desc = state.mode === "done"
        ? "完成的任务会出现在这里，先去做一条吧。"
        : state.mode === "all"
          ? "还没有任何任务，点右上角「添加任务」开始安排。"
          : "这一天还没有安排，试着添加一条学习任务。";
      listNode.innerHTML = `<div class="empty">
        <div class="empty-icon">${icon("calendar", 24)}</div>
        <div class="empty-title">暂无任务</div>
        <div class="empty-desc">${esc(desc)}</div>
      </div>`;
      return;
    }
    listNode.innerHTML = `<div class="list">${list.map(taskRow).join("")}</div>`;
  }

  paint();

  dateInput.addEventListener("change", () => {
    state.date = dateInput.value || dateKey();
    paint();
  });

  const refresh = () => render(el);

  el.onclick = async (event) => {
    const modeBtn = event.target.closest("[data-mode]");
    if (modeBtn) {
      state.mode = modeBtn.getAttribute("data-mode");
      await render(el);
      return;
    }

    if (event.target.closest("[data-new]")) {
      openForm(null, refresh);
      return;
    }

    const toggle = event.target.closest("[data-toggle]");
    if (toggle) {
      const task = tasks.find((item) => item.id === toggle.getAttribute("data-toggle"));
      if (!task) return;
      toggle.disabled = true;
      try {
        await put("tasks", { ...task, done: !task.done, doneAt: task.done ? null : new Date().toISOString() });
        toast(task.done ? "已取消完成" : "完成一条，继续保持", "success");
        refresh();
      } catch (err) {
        toast(err.message || "更新失败", "error");
        toggle.disabled = false;
      }
      return;
    }

    const edit = event.target.closest("[data-edit]");
    if (edit) {
      const task = tasks.find((item) => item.id === edit.getAttribute("data-edit"));
      if (task) openForm(task, refresh);
      return;
    }

    const del = event.target.closest("[data-delete]");
    if (del) {
      const task = tasks.find((item) => item.id === del.getAttribute("data-delete"));
      if (!task) return;
      const ok = await confirmModal({
        title: "删除任务",
        message: `确定删除「${task.title}」吗？此操作无法撤销。`,
        confirmText: "删除",
        danger: true,
      });
      if (!ok) return;
      try {
        await remove("tasks", task.id);
        toast("任务已删除", "success");
        refresh();
      } catch (err) {
        toast(err.message || "删除失败", "error");
      }
    }
  };

  return undefined;
}