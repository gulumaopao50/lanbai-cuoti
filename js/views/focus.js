import { esc, icon } from "../utils/dom.js";
import { formatClock } from "../utils/date.js";
import { notify } from "../remind.js";
import { toast } from "../components/toast.js";

export const title = "专注";

const PRESETS = [15, 25, 45];

export async function render(el) {
  let total = 25 * 60;
  let remain = total;
  let running = false;
  let endAt = 0;
  let ticker = null;

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">专注</h1>
        <p class="page-sub">一次只做一件事，结束时会有提示音和提醒</p>
      </div>
    </div>

    <section class="card card-pad" style="text-align:center">
      <div class="focus-presets">
        ${PRESETS.map((min) => `<button type="button" class="chip" data-min="${min}">${min} 分钟</button>`).join("")}
        <input class="input" id="custom-min" type="number" min="1" max="180" placeholder="自定义分钟" style="width:128px;height:32px">
        <button type="button" class="btn btn-soft btn-sm" data-custom>设定</button>
      </div>

      <div class="ring-wrap" style="margin-top:22px">
        <div class="ring" id="ring">
          <div class="ring-inner">
            <div class="timer-display" id="clock">25:00</div>
            <div class="timer-label" id="timer-label">准备开始</div>
          </div>
        </div>
      </div>

      <div class="row" style="justify-content:center;margin-top:22px">
        <button type="button" class="btn btn-primary" id="start-btn">${icon("play", 16)} 开始专注</button>
        <button type="button" class="btn btn-ghost" id="reset-btn">${icon("rotate", 16)} 重置</button>
      </div>
      <p class="settings-desc" style="margin-top:16px">建议用 25 分钟专注 + 5 分钟休息的节奏。倒计时依赖页面运行，切到后台时可能略有延迟。</p>
    </section>`;

  const ring = el.querySelector("#ring");
  const clock = el.querySelector("#clock");
  const label = el.querySelector("#timer-label");
  const startBtn = el.querySelector("#start-btn");
  const resetBtn = el.querySelector("#reset-btn");
  const customInput = el.querySelector("#custom-min");

  function paint() {
    clock.textContent = formatClock(remain);
    const ratio = total > 0 ? Math.min(1, Math.max(0, (total - remain) / total)) : 0;
    ring.style.background = `conic-gradient(var(--blue) ${ratio * 360}deg, var(--blue-soft) 0deg)`;
    if (running) {
      startBtn.innerHTML = `${icon("pause", 16)} 暂停`;
      label.textContent = "专注中，加油";
    } else if (remain < total) {
      startBtn.innerHTML = `${icon("play", 16)} 继续专注`;
      label.textContent = remain > 0 ? "已暂停" : "本轮结束";
    } else {
      startBtn.innerHTML = `${icon("play", 16)} 开始专注`;
      label.textContent = "准备开始";
    }
    el.querySelectorAll("[data-min]").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.getAttribute("data-min")) * 60 === total);
    });
  }

  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }

  function finish() {
    running = false;
    stopTicker();
    remain = 0;
    paint();
    label.textContent = "本轮专注结束";
    const minutes = Math.max(1, Math.round(total / 60));
    notify("专注结束", `已完成 ${minutes} 分钟专注，起来活动一下吧`);
  }

  function tick() {
    const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    remain = left;
    paint();
    if (left <= 0 && running) finish();
  }

  function start() {
    if (running) {
      running = false;
      stopTicker();
      remain = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      paint();
      return;
    }
    if (remain <= 0) remain = total;
    endAt = Date.now() + remain * 1000;
    running = true;
    stopTicker();
    ticker = setInterval(tick, 250);
    paint();
  }

  function reset() {
    running = false;
    stopTicker();
    remain = total;
    paint();
  }

  startBtn.addEventListener("click", start);
  resetBtn.addEventListener("click", reset);

  el.querySelectorAll("[data-min]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (running) {
        toast("请先暂停计时再切换时长", "warn");
        return;
      }
      total = Number(btn.getAttribute("data-min")) * 60;
      remain = total;
      paint();
    });
  });

  el.querySelector("[data-custom]").addEventListener("click", () => {
    if (running) {
      toast("请先暂停计时再切换时长", "warn");
      return;
    }
    const value = Number(customInput.value);
    if (!Number.isFinite(value) || value < 1 || value > 180) {
      toast("请输入 1 到 180 之间的分钟数", "warn");
      return;
    }
    total = Math.round(value) * 60;
    remain = total;
    paint();
    toast(`已设定 ${Math.round(value)} 分钟`, "success");
  });

  paint();

  return () => stopTicker();
}