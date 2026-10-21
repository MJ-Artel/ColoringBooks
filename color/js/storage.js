// Keeps each page's colouring in the visitor's own browser (IndexedDB). Every call fails quietly:
// private windows and locked-down browsers simply don't autosave.

const DB_NAME = 'mjartel-studio';
const STORE = 'pages';
let opening = null;

function db() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return opening;
}

async function run(mode, work) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const req = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function savePage(id, blob) {
  try {
    await run('readwrite', (s) => s.put({ blob, savedAt: Date.now() }, id));
    return true;
  } catch {
    return false;
  }
}

export async function loadPage(id) {
  try {
    return (await run('readonly', (s) => s.get(id))) || null;
  } catch {
    return null;
  }
}

export async function removePage(id) {
  try {
    await run('readwrite', (s) => s.delete(id));
  } catch {
    // nothing saved, nothing to remove
  }
}

export async function savedPageIds() {
  try {
    return new Set(await run('readonly', (s) => s.getAllKeys()));
  } catch {
    return new Set();
  }
}
