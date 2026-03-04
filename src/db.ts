/**
 * db.ts — Persistencia local con IndexedDB
 *
 * Guarda los vídeos generados (base64 + metadata) entre sesiones.
 * Sin dependencias externas, funciona en el webview de Tauri.
 *
 * Schema:
 *   DB: aether_db  v1
 *   Store: videos  (used for both videos and images internally to avoid wipe)
 *     id: string (uuid)
 *     url: string (data:video/mp4;base64,... or data:image/jpeg;base64,...)
 *     mediaType: 'video' | 'image'
 *     prompt: string
 *     inputThumb: string (data:image/jpeg;base64,..., redimensionada a 240px)
 *     createdAt: number (timestamp ms)
 */

const DB_NAME = 'aether_db';
const DB_VERSION = 1;
const STORE = 'videos';

export interface StoredMedia {
    id: string;
    url: string;          // data:video/mp4;base64,... or full resolution image url
    mediaType: 'video' | 'image';
    prompt: string;
    inputThumb: string;   // miniatura de la imagen de entrada, o de la propia foto
    createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                const store = db.createObjectStore(STORE, { keyPath: 'id' });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveMedia(media: StoredMedia): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(media);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadAllMedia(): Promise<StoredMedia[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).index('createdAt').getAll();
        req.onsuccess = () => resolve((req.result as StoredMedia[]).reverse()); // más recientes primero
        req.onerror = () => reject(req.error);
    });
}

export async function deleteMedia(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/** Genera una miniatura 240×135 de la imagen de entrada */
export function makeThumbnail(dataUrl: string, w = 240, h = 135): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            // Crop centrado manteniendo aspect ratio
            const scale = Math.max(w / img.width, h / img.height);
            const sw = w / scale, sh = h / scale;
            const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.src = dataUrl;
    });
}

/** Genera un ID único sencillo */
export function uid(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
