import { getAll, getOne, put, remove, uid } from "../store.js";
import { debounce, esc, icon } from "../utils/dom.js";
import { fmtDateTime, relativeFrom } from "../utils/date.js";
import { getSubjects } from "../settings.js";
import { DIFFICULTIES, REASONS, STATUS_CLASS, STATUS_LABELS, difficultyLabel, nextReviewState, planNextReview } from "../utils/mistake.js";
import { compressImage } from "../utils/image.js";
import { recognizeText } from "../ocr.js";
import { openModal, confirmModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

export const title = "错题本";

const state = { q: "", subject: "", status: "" };

function emptyState(titleText, desc) {
  return `<div class="empty">
    <div class="empty-icon">${icon("book", 24)}</div>
    <div class="empty-title">${esc(titleText)}</div>
    <div class="empty-desc">${esc(desc)}</div>
  </div>`;
}

function cardHtml(item) {
  const tags = Array.isArray(item.tags) ? item.tags.slice(0, 2) : [];
  return `<button type="button" class="mistake-card" data-open="${esc(item.id)}">
    <div class="mc-top">
      <span class="badge badge-blue">${esc(item.subject || "未分类")}</span>
      <span class="badge ${STATUS_CLASS[item.status] || "badge-gray"}">${STATUS_LABELS[item.status] || "待复习"}</span>
      ${tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}
    </div>
    <div class="mc-question">${esc(item.question || "（无题目内容）")}</div>
    <div class="mc-foot">
      <span>${esc(relativeFrom(item.createdAt))}录入 · ${esc(difficultyLabel(item.difficulty))}</span>
      <span>${item.reviewCount ? `复习 ${item.reviewCount} 次` : "待首次复习"}</span>
    </div>
  </button>`;
}

async function loadImages(ids) {
  const list = [];
  for (const id of ids || []) {
    try {
      const record = await getOne("images", id);
      if (record && record.blob) list.push({ id, record, url: URL.createObjectURL(record.blob) });
    } catch (err) {
      console.warn("读取图片失败", err);
    }
  }
  return list;
}

function openDetail(item, refresh) {
  const content = `<div class="stack">
    <div class="row-between wrap">
      <div class="row wrap">
        <span class="badge badge-blue">${esc(item.subject || "未分类")}</span>
        <span class="badge ${STATUS_CLASS[item.status] || "badge-gray"}">${STATUS_LABELS[item.status] || "待复习"}</span>
        <span class="badge badge-gray">${esc(difficultyLabel(item.difficulty))}</span>
        ${(item.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}
      </div>
      <span class="stat-note">${esc(relativeFrom(item.createdAt))}录入</span>
    </div>
    <div class="detail-imgs" data-imgs></div>
    <div class="detail-block">
      <div class="detail-label">题目</div>
      <div class="detail-text">${esc(item.question || "")}</div>
    </div>
    ${item.answer ? `<div class="detail-block"><div class="detail-label">答案</div><div class="detail-text">${esc(item.answer)}</div></div>` : ""}
    ${item.explanation ? `<div class="detail-block"><div class="detail-label">解析</div><div class="detail-text">${esc(item.explanation)}</div></div>` : ""}
    ${item.reason ? `<div class="detail-block"><div class="detail-label">错误原因</div><div class="detail-text">${esc(item.reason)}</div></div>` : ""}
    <div class="stat-line">
      <span>已复习 ${Number(item.reviewCount) || 0} 次</span>
      <span>${item.lastReviewAt ? `上次复习 ${esc(fmtDateTime(item.lastReviewAt))}` : "尚未复习"}</span>
      <span>${item.nextReviewAt ? `下次复习 ${esc(item.nextReviewAt)}` : item.status === "mastered" ? "已掌握，不再提醒" : "待安排"}</span>
    </div>
  </div>`;

  const urls = [];
  const modal = openModal({
    title: "错题详情",
    content,
    size: "wide",
    footer: `<button type="button" class="btn btn-ghost" data-edit>${icon("edit", 16)} 编辑</button>
             <button type="button" class="btn btn-danger" data-delete>${icon("trash", 16)} 删除</button>
             <button type="button" class="btn btn-primary" data-review>完成本次复习</button>`,
    onClose: () => urls.forEach((url) => URL.revokeObjectURL(url)),
  });

  const imgWrap = modal.body.querySelector("[data-imgs]");
  imgWrap.innerHTML = item.images && item.images.length
    ? '<span class="settings-desc">照片加载中…</span>'
    : "";
  if (item.images && item.images.length) {
    loadImages(item.images).then((photos) => {
      if (!document.body.contains(imgWrap)) {
        photos.forEach((photo) => URL.revokeObjectURL(photo.url));
        return;
      }
      if (!photos.length) {
        imgWrap.innerHTML = "";
        return;
      }
      urls.push(...photos.map((photo) => photo.url));
      imgWrap.innerHTML = photos
        .map((photo) => `<img src="${photo.url}" alt="错题照片">`)
        .join("");
    });
  }

  modal.foot.querySelector("[data-review]").addEventListener("click", async () => {
    try {
      await put("mistakes", { ...item, ...nextReviewState(item) });
      toast("已记录复习进度", "success");
      modal.close();
      refresh();
    } catch (err) {
      toast(err.message || "记录失败", "error");
    }
  });

  modal.foot.querySelector("[data-delete]").addEventListener("click", async () => {
    const ok = await confirmModal({
      title: "删除错题",
      message: "删除后无法恢复，确定要移除这道错题吗？",
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    try {
      for (const id of item.images || []) {
        await remove("images", id).catch(() => {});
      }
      await remove("mistakes", item.id);
      toast("已删除", "success");
      modal.close();
      refresh();
    } catch (err) {
      toast(err.message || "删除失败", "error");
    }
  });

  modal.foot.querySelector("[data-edit]").addEventListener("click", () => {
    modal.close();
    openForm(item, refresh, urls);
  });
}

async function openForm(record, refresh) {
  const isEdit = Boolean(record);
  const photos = [];
  const originalIds = record && Array.isArray(record.images) ? [...record.images] : [];

  if (originalIds.length) {
    const existing = await loadImages(originalIds);
    photos.push(...existing);
  }

  const subjects = [...new Set([...getSubjects(), ...(record && record.subject ? [record.subject] : [])])];
  const subjectOptions = subjects
    .map((name) => `<option value="${esc(name)}" ${record && record.subject === name ? "selected" : ""}>${esc(name)}</option>`)
    .join("");
  const reasonOptions = [`<option value="">未填写</option>`]
    .concat(REASONS.map((reason) => `<option value="${esc(reason)}" ${record && record.reason === reason ? "selected" : ""}>${esc(reason)}</option>`))
    .join("");
  const difficultyOptions = DIFFICULTIES
    .map((item) => `<option value="${item.value}" ${Number(record && record.difficulty) === item.value ? "selected" : ""}>${esc(item.label)}</option>`)
    .join("");

  const content = `<form class="stack" id="mistake-form" novalidate>
    <div class="form-grid">
      <label class="field">
        <span class="field-label">学科</span>
        <select class="select" id="f-subject">${subjectOptions}</select>
      </label>
      <label class="field">
        <span class="field-label">难度</span>
        <select class="select" id="f-difficulty">${difficultyOptions}</select>
      </label>
      <div class="field span-2">
        <span class="field-label">题目 <span class="req">*</span></span>
        <textarea class="textarea" id="f-question" placeholder="写下题目，或上传照片后点「识别文字」">${esc(record ? record.question : "")}</textarea>
      </div>
    </div>

    <div class="field">
      <span class="field-label">题目照片</span>
      <div class="upload" id="upload-zone" role="button" tabindex="0">
        <input type="file" id="f-file" accept="image/*" multiple hidden>
        <span>${icon("camera", 20)} 点击选择照片，或拖拽到此处</span>
      </div>
      <div class="thumbs" id="f-thumbs"></div>
      <div class="ocr-row">
        <button type="button" class="btn btn-soft btn-sm" id="f-ocr">${icon("spark", 15)} 识别照片文字</button>
        <span class="ocr-status" id="f-ocr-status"></span>
      </div>
      <span class="field-hint">照片会在本机压缩后保存；OCR 首次使用需联网加载语言模型。</span>
    </div>

    <div class="form-grid">
      <label class="field span-2">
        <span class="field-label">答案</span>
        <textarea class="textarea" id="f-answer" placeholder="正确答案（选填）">${esc(record ? record.answer : "")}</textarea>
      </label>
      <label class="field span-2">
        <span class="field-label">解析</span>
        <textarea class="textarea" id="f-explanation" placeholder="解题思路与关键步骤（选填）">${esc(record ? record.explanation : "")}</textarea>
      </label>
      <label class="field">
        <span class="field-label">错误原因</span>
        <select class="select" id="f-reason">${reasonOptions}</select>
      </label>
      <label class="field">
        <span class="field-label">知识点标签</span>
        <input class="input" id="f-tags" placeholder="逗号分隔，如：二次函数, 顶点式" value="${esc(record && record.tags ? record.tags.join(", ") : "")}">
      </label>
    </div>
  </form>`;

  const modal = openModal({
    title: isEdit ? "编辑错题" : "新增错题",
    content,
    size: "wide",
    footer: `<button type="button" class="btn btn-ghost" data-close>取消</button>
             <button type="button" class="btn btn-primary" data-save>${isEdit ? "保存修改" : "存入错题本"}</button>`,
    onClose: () => photos.forEach((photo) => photo.url && URL.revokeObjectURL(photo.url)),
  });

  const body = modal.body;
  const zone = body.querySelector("#upload-zone");
  const fileInput = body.querySelector("#f-file");
  const thumbs = body.querySelector("#f-thumbs");
  const ocrStatus = body.querySelector("#f-ocr-status");
  const questionInput = body.querySelector("#f-question");

  function renderThumbs() {
    thumbs.innerHTML = photos
      .map((photo, index) => `<div class="thumb">
        <img src="${photo.url}" alt="第 ${index + 1} 张照片">
        <button type="button" class="thumb-del" data-remove="${index}" aria-label="移除照片">×</button>
      </div>`)
      .join("");
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    for (const file of files) {
      if (!file.type || !file.type.startsWith("image/")) {
        toast("只能上传图片文件", "warn");
        continue;
      }
      if (file.size > 12 * 1024 * 1024) {
        toast(`${file.name} 超过 12MB，已跳过`, "warn");
        continue;
      }
      try {
        const blob = await compressImage(file);
        photos.push({ blob, url: URL.createObjectURL(blob), isNew: true });
      } catch (err) {
        console.warn(err);
        toast(`${file.name} 处理失败`, "warn");
      }
    }
    renderThumbs();
  }

  renderThumbs();

  zone.addEventListener("click", () => fileInput.click());
  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("drag");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("drag");
    addFiles(event.dataTransfer.files);
  });
  fileInput.addEventListener("change", () => {
    addFiles(fileInput.files);
    fileInput.value = "";
  });

  thumbs.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-remove]");
    if (!btn) return;
    const index = Number(btn.getAttribute("data-remove"));
    const [removed] = photos.splice(index, 1);
    if (removed && removed.url) URL.revokeObjectURL(removed.url);
    renderThumbs();
  });

  body.querySelector("#f-ocr").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    const target = photos[0];
    if (!target || !target.blob) {
      toast("请先选择一张题目照片", "warn");
      return;
    }
    btn.disabled = true;
    ocrStatus.classList.remove("warn");
    ocrStatus.textContent = "正在准备识别…";
    try {
      const text = await recognizeText(target.blob, ({ status, progress }) => {
        ocrStatus.textContent = progress
          ? `${status} ${Math.round(progress * 100)}%`
          : status;
      });
      if (!text) {
        ocrStatus.classList.add("warn");
        ocrStatus.textContent = "未识别到文字";
        toast("未识别到文字，请手动输入", "warn");
        return;
      }
      if (questionInput.value.trim()) {
        questionInput.value = `${questionInput.value.trim()}\n${text}`;
      } else {
        questionInput.value = text;
      }
      ocrStatus.textContent = "识别完成，可继续修改";
      toast("已提取文字", "success");
    } catch (err) {
      console.error(err);
      ocrStatus.classList.add("warn");
      ocrStatus.textContent = "识别失败，请手动输入";
      toast("文字识别失败，请手动输入", "warn");
    } finally {
      btn.disabled = false;
    }
  });

  const saveBtn = modal.foot.querySelector("[data-save]");
  saveBtn.addEventListener("click", async () => {
    const question = questionInput.value.trim();
    if (!question) {
      toast("请填写题目内容", "warn");
      questionInput.focus();
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "保存中…";
    try {
      const imageIds = [];
      for (const photo of photos) {
        if (photo.isNew && photo.blob) {
          const imageId = uid();
          await put("images", { id: imageId, blob: photo.blob, createdAt: Date.now() });
          imageIds.push(imageId);
        } else if (photo.id) {
          imageIds.push(photo.id);
        }
      }
      for (const oldId of originalIds) {
        if (!imageIds.includes(oldId)) await remove("images", oldId).catch(() => {});
      }

      const tagsRaw = body.querySelector("#f-tags").value;
      const tags = tagsRaw
        .split(/[,，、\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 8);

      const common = {
        question,
        answer: body.querySelector("#f-answer").value.trim(),
        explanation: body.querySelector("#f-explanation").value.trim(),
        reason: body.querySelector("#f-reason").value,
        subject: body.querySelector("#f-subject").value,
        difficulty: Number(body.querySelector("#f-difficulty").value) || 3,
        tags,
        images: imageIds,
        updatedAt: new Date().toISOString(),
      };

      if (isEdit) {
        await put("mistakes", { ...record, ...common });
      } else {
        await put("mistakes", {
          id: uid(),
          ...common,
          status: "todo",
          reviewCount: 0,
          lastReviewAt: null,
          createdAt: new Date().toISOString(),
          nextReviewAt: planNextReview(0),
        });
      }
      modal.close();
      toast(isEdit ? "已保存修改" : "已存入错题本", "success");
      refresh();
    } catch (err) {
      console.error(err);
      toast(err.message || "保存失败，可能是存储空间已满", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? "保存修改" : "存入错题本";
    }
  });
}

export async function render(el) {
  let all = [];
  try {
    all = await getAll("mistakes");
  } catch (err) {
    el.innerHTML = `<div class="card card-pad empty">
      <div class="empty-icon">${icon("alert", 24)}</div>
      <div class="empty-title">本地数据读取失败</div>
      <div class="empty-desc">${esc(err.message || "请检查浏览器是否允许本地存储")}</div>
    </div>`;
    return undefined;
  }

  const subjects = getSubjects();
  const subjectOptions = [`<option value="">全部学科</option>`]
    .concat(subjects.map((name) => `<option value="${esc(name)}" ${state.subject === name ? "selected" : ""}>${esc(name)}</option>`))
    .join("");
  const statusOptions = [
    ["", "全部状态"],
    ["todo", "待复习"],
    ["reviewing", "复习中"],
    ["mastered", "已掌握"],
  ]
    .map(([value, label]) => `<option value="${value}" ${state.status === value ? "selected" : ""}>${label}</option>`)
    .join("");

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">错题本</h1>
        <p class="page-sub">收录、分类，再按节奏复习 · <span id="m-count"></span></p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" data-new>${icon("plus", 16)} 新增错题</button>
      </div>
    </div>

    <div class="toolbar">
      <div class="search">
        ${icon("search", 16)}
        <input class="input" id="m-q" placeholder="搜索题目、答案或解析" value="${esc(state.q)}">
      </div>
      <select class="select select-sm" id="m-subject">${subjectOptions}</select>
      <select class="select select-sm" id="m-status">${statusOptions}</select>
    </div>

    <div id="m-list"></div>`;

  const listNode = el.querySelector("#m-list");
  const countNode = el.querySelector("#m-count");
  const qInput = el.querySelector("#m-q");
  const subjectSelect = el.querySelector("#m-subject");
  const statusSelect = el.querySelector("#m-status");

  function filtered() {
    const keyword = state.q.trim().toLowerCase();
    return all
      .filter((item) => {
        if (state.subject && item.subject !== state.subject) return false;
        if (state.status && item.status !== state.status) return false;
        if (!keyword) return true;
        const haystack = [
          item.question,
          item.answer,
          item.explanation,
          item.subject,
          (item.tags || []).join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(keyword);
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }

  function paint() {
    const list = filtered();
    countNode.textContent = `共 ${list.length} 道`;
    if (!list.length) {
      listNode.innerHTML = all.length
        ? emptyState("没有匹配的错题", "换个关键词或清理筛选条件再试试。")
        : emptyState("错题本还是空的", "点右上角「新增错题」，拍照或手写录入第一道错题。");
      return;
    }
    listNode.innerHTML = `<div class="mistake-grid">${list.map(cardHtml).join("")}</div>`;
  }

  paint();

  qInput.addEventListener("input", debounce(() => {
    state.q = qInput.value;
    paint();
  }, 160));
  subjectSelect.addEventListener("change", () => {
    state.subject = subjectSelect.value;
    paint();
  });
  statusSelect.addEventListener("change", () => {
    state.status = statusSelect.value;
    paint();
  });

  const refresh = () => render(el);

  el.onclick = (event) => {
    if (event.target.closest("[data-new]")) {
      openForm(null, refresh);
      return;
    }
    const card = event.target.closest("[data-open]");
    if (card) {
      const item = all.find((entry) => entry.id === card.getAttribute("data-open"));
      if (item) openDetail(item, refresh);
    }
  };

  return undefined;
}