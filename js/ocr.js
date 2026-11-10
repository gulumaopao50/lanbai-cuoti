const CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

let loader = null;

function loadEngine() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CDN;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (window.Tesseract) resolve(window.Tesseract);
      else reject(new Error("OCR 引擎加载异常"));
    };
    script.onerror = () => reject(new Error("OCR 引擎加载失败，请检查网络"));
    document.head.appendChild(script);
  }).catch((err) => {
    loader = null;
    throw err;
  });

  return loader;
}

export async function recognizeText(blob, onProgress = () => {}) {
  const engine = await loadEngine();
  onProgress({ status: "正在初始化识别引擎…", progress: 0 });

  let worker = null;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
  }, 180000);

  try {
    worker = await engine.createWorker("chi_sim+eng", 1, {
      logger: (message) => {
        if (!message) return;
        const status = message.status === "recognizing text"
          ? "正在识别文字"
          : "正在加载语言模型";
        onProgress({ status, progress: Number(message.progress) || 0 });
      },
    });
    if (timedOut) throw new Error("识别超时，请重试或手动输入");
    onProgress({ status: "正在识别文字…", progress: 0 });
    const result = await worker.recognize(blob);
    const text = result && result.data && result.data.text ? String(result.data.text) : "";
    return text.trim();
  } finally {
    clearTimeout(timeout);
    if (worker) {
      try {
        await worker.terminate();
      } catch (err) {
        console.warn("释放 OCR 资源失败", err);
      }
    }
  }
}