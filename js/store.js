const DB_NAME = "lanbai-cuoti";
const DB_VERSION = 1;
const STORES = ["mistakes", "tasks", "images", "meta"];

let dbPromise = null;
let openError = null;

function openDB() {
  if (openError) return Promise.reject(openError);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("当前浏览器不支持 IndexedDB，请更换浏览器或关闭隐私模式"));
      return;
    }
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("本地数据库打开失败"));
    request.onblocked = () => reject(new Error("数据库被其他页面占用，请关闭其他标签页后重试"));
  }).catch((err) => {
    openError = err;
    throw err;
  });

  return dbPromise;
}

export function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function isAvailable() {
  try {
    await openDB();
    return true;
  } catch (err) {
    console.warn(err);
    return false;
  }
}

export async function getAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const request = tx.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error("读取数据失败"));
  });
}

export async function getOne(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error || new Error("读取数据失败"));
  });
}

export async function put(store, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error || new Error("保存失败，可能是存储空间已满"));
    tx.onabort = () => reject(tx.error || new Error("保存被中止"));
  });
}

export async function remove(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("删除失败"));
    tx.onabort = () => reject(tx.error || new Error("删除被中止"));
  });
}

export async function clear(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("清空失败"));
  });
}

export async function clearAll() {
  for (const store of STORES) {
    await clear(store);
  }
}

export async function bulkPut(store, items) {
  if (!items || !items.length) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const target = tx.objectStore(store);
    items.forEach((item) => target.put(item));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("批量保存失败"));
    tx.onabort = () => reject(tx.error || new Error("批量保存被中止"));
  });
}