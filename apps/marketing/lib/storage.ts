/**
 * IndexedDB-based persistence for spreadsheet data.
 * Stores sheets so users can close the browser and come back.
 */

const DB_NAME = 'varyn_workspace';
const DB_VERSION = 1;
const STORE_NAME = 'sheets';

export interface SavedSheet {
  id: string;
  title: string;
  columns: string[];
  rows: Record<string, string>[];
  savedAt: number;
  sourceUrl?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveSheet(sheet: SavedSheet): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(sheet);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSheet(id: string): Promise<SavedSheet | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result ?? undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSheets(): Promise<SavedSheet[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const sheets = (request.result as SavedSheet[]).sort(
        (a, b) => b.savedAt - a.savedAt,
      );
      resolve(sheets);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSheet(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllSheetMeta(): Promise<{ id: string; title: string; rows: number; cols: number; savedAt: number }[]> {
  const sheets = await getAllSheets();
  return sheets.map((s) => ({
    id: s.id,
    title: s.title,
    rows: s.rows.length,
    cols: s.columns.length,
    savedAt: s.savedAt,
  }));
}
