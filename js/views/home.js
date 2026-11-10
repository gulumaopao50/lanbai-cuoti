import { getAll, put } from "../store.js";
import { dateKey, fmtTime, formatDuration, msUntilNext, todayLabel } from "../utils/date.js";
import { esc, icon } from "../utils/dom.js";
import { STATUS_CLASS, STATUS_LABELS, isDue, nextReviewState } from "../utils/mistake.js";
import { toast } from "../components/toast.js";

export const title = "今日";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function taskRow(task) {
  return `<div class="list-item ${task.done ? "done" : ""}">
    <button type="button" class="check ${task.done ? "done" : ""}" data-toggle-task="${esc(task.id)}"
      aria-label="${task.done ? "取消完成" : "标记完成"}">${icon("check", 13)}</button>
    <div class="li-main">
      <div class="li-title">${esc(task.title)}</div>
      <div class="li-meta">
        <span>${icon("clock", 13)} ${esc(fmtTime(task.datetime))}</span>
        ${task.subject ? `<span class="tag">${esc(task.subject)}</span>` : ""}
        ${task.duration ? `<span>${task.duration} 分钟</span>` : ""}
      </div>
    </div>
  </div>`;
}

function reviewRow(item) {
  const text = String(item.question || "");
  const short = text.length > 44 ? `${text.slice(0, 44)}…` : text;
  return `<div class="list-item">
    <div class="li-main">
      <div class="li-title">${esc(short)}</div>
      <div class="li-meta">
        <span class="badge badge-blue">${esc(item.subject)}</span>
        <span class="badge ${STATUS_CLASS[item.status] || "badge-gray"}">${STATUS_LABELS[item.status] || "待复习"}</span>
        <span>${item.reviewCount ? `已复习 ${item.reviewCount} 次` : "首次复习"}</span>
      </div>
    </div>
    <button type="button" class="btn btn-soft btn-sm" data-review="${esc(item.id)}">完成复习</button>
  </div>`;
}

export async function render(el) {
  let tasks = [];
  let mistakes = [];
  try {
    const result = await Promise.all([getAll("tasks"), getAll("mistakes")]);
    tasks = result[0];
    mistakes = result[1];
  } catch (err) {
    el.innerHTML = `<div class="card card-pad empty">
      <div class="empty-icon">${icon("alert", 24)}</div>
      <div class="empty-title">本地数据读取失败</div>
      <div class="empty-desc">${esc(err.message || "请检查浏览器是否允许本地存储")}</div>
    </div>`;
    return undefined;
  }

  const today = dateKey();
  const todayTasks = tasks
    .filter((task) => task.datetime && dateKey(task.datetime) === today)
    .sort((a, b) => String(a.datetime).localeCompare(String(b.datetime)));
  const doneTasks = todayTasks.filter((task) => task.done).length;
  const dues = mistakes
    .filter((item) => isDue(item, today))
    .sort((a, b) => String(a.nextReviewAt || "").localeCompare(String(b.nextReviewAt || "")));
  const nextTask = tasks
    .filter((task) => !task.done && task.datetime && new Date(task.datetime).getTime() > Date.now())
    .sort((a, b) => String(a.datetime).localeCompare(String(b.datetime)))[0];

  const taskHtml = todayTasks.length
    ? todayTasks.map(taskRow).join("")
    : `<div class="empty">
        <div class="empty-icon">${icon("calendar", 24)}</div>
        <div class="empty-title">今天还没有任务</div>
        <div class="empty-desc">去「计划」里添加今天要完成的事，完成后在这里打钩。</div>
        <a class="btn btn-soft btn-sm" href="#/plans">添加任务</a>
      </div>`;

  const reviewHtml = dues.length
    ? dues.slice(0, 6).map(reviewRow).join("")
    : `<div class="empty">
        <div class="empty-icon">${icon("check", 24)}</div>
        <div class="empty-title">今天没有到期的错题</div>
        <div class="empty-desc">按 1 / 3 / 7 / 15 天的节奏复习，记完就能在这里看到。</div>
      </div>`;

  const progress = todayTasks.length ? Math.round((doneTasks / todayTasks.length) * 100) : 0;

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">${greeting()}，今天也要加油</h1>
        <p class="page-sub">${todayLabel()} · <span id="next-remind">正在计算提醒…</span></p>
      </div>
      <div class="page-actions">
        <a class="btn btn-ghost" href="#/focus">${icon("timer", 16)} 开始专注</a>
        <a class="btn btn-primary" href="#/mistakes">${icon("plus", 16)} 记一道错题</a>
      </div>
    </div>

    <div class="grid grid-3">
      <div class="card stat">
        <div class="stat-top"><span>错题总数</span><span class="stat-icon">${icon("book", 16)}</span></div>
        <div class="stat-num">${mistakes.length}<small>道</small></div>
        <div class="stat-note">已掌握 ${mistakes.filter((item) => item.status === "mastered").length} 道</div>
      </div>
      <div class="card stat">
        <div class="stat-top"><span>今日待复习</span><span class="stat-icon">${icon("target", 16)}</span></div>
        <div class="stat-num">${dues.length}<small>道</small></div>
        <div class="stat-note">${dues.length ? "按计划复习，效果更好" : "今日复习已清空"}</div>
      </div>
      <div class="card stat">
        <div class="stat-top"><span>今日任务</span><span class="stat-icon">${icon("check", 16)}</span></div>
        <div class="stat-num">${doneTasks}<small>/ ${todayTasks.length}</small></div>
        <div class="stat-note">完成度 ${progress}%</div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:16px">
      <section class="card">
        <div class="card-head">
          <span class="card-title">${icon("list", 17)} 今日任务</span>
          <a class="card-link" href="#/plans">全部计划</a>
        </div>
        <div class="card-body">${taskHtml}</div>
      </section>

      <section class="card">
        <div class="card-head">
          <span class="card-title">${icon("book", 17)} 待复习错题</span>
          <a class="card-link" href="#/mistakes">错题本</a>
        </div>
        <div class="card-body">${reviewHtml}</div>
      </section>
    </div>

    <div class="quick" style="margin-top:16px">
      <a class="quick-item" href="#/mistakes">
        <span class="quick-icon">${icon("camera", 18)}</span>
        <span><span class="quick-title">拍照记错题</span><span class="quick-desc">识别文字并自动分类</span></span>
      </a>
      <a class="quick-item" href="#/plans">
        <span class="quick-icon">${icon("calendar", 18)}</span>
        <span><span class="quick-title">制定计划</span><span class="quick-desc">安排今天的任务清单</span></span>
      </a>
      <a class="quick-item" href="#/focus">
        <span class="quick-icon">${icon("timer", 18)}</span>
        <span><span class="quick-title">专注倒计时</span><span class="quick-desc">25 分钟专注学习</span></span>
      </a>
    </div>`;

  const countdownNode = el.querySelector("#next-remind");
  const tick = () => {
    if (!document.body.contains(countdownNode)) return;
    if (!nextTask) {
      countdownNode.textContent = "今天没有待触发的提醒";
      return;
    }
    const remain = msUntilNext(nextTask.datetime);
    const titleText = String(nextTask.title || "下一个任务");
    countdownNode.textContent = remain > 0
      ? `距「${titleText}」提醒还有 ${formatDuration(remain)}`
      : `「${titleText}」提醒时间已到`;
  };
  tick();
  const interval = setInterval(tick, 1000);

  el.onclick = async (event) => {
    const toggle = event.target.closest("[data-toggle-task]");
    if (toggle) {
      const task = tasks.find((item) => item.id === toggle.getAttribute("data-toggle-task"));
      if (!task) return;
      toggle.disabled = true;
      try {
        await put("tasks", { ...task, done: !task.done, doneAt: task.done ? null : new Date().toISOString() });
        toast(task.done ? "已取消完成" : "任务完成，继续保持", "success");
        await render(el);
      } catch (err) {
        toast(err.message || "更新失败", "error");
        toggle.disabled = false;
      }
      return;
    }

    const review = event.target.closest("[data-review]");
    if (review) {
      const item = mistakes.find((entry) => entry.id === review.getAttribute("data-review"));
      if (!item) return;
      review.disabled = true;
      try {
        const patch = nextReviewState(item);
        await put("mistakes", { ...item, ...patch });
        toast(patch.status === "mastered" ? "连续复习完成，已掌握" : "已记录复习，下次按计划提醒", "success");
        await render(el);
      } catch (err) {
        toast(err.message || "记录失败", "error");
        review.disabled = false;
      }
    }
  };

  return () => clearInterval(interval);
}