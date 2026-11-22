import type { StudioProject } from '../types/studio';

const DB_NAME = 'keystone_motion_studio_db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const ACTIVE_PROJECT_KEY = 'active_project_v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProjectToIndexedDB(
  project: StudioProject
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(project, ACTIVE_PROJECT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback quietly if private browsing blocks IndexedDB
    try {
      const lightCopy: StudioProject = {
        ...project,
        assets: project.assets.map((a) => ({ ...a, dataUrl: undefined })),
      };
      localStorage.setItem(ACTIVE_PROJECT_KEY, JSON.stringify(lightCopy));
    } catch {
      // Ignore quota errors
    }
  }
}

export async function loadProjectFromIndexedDB(): Promise<StudioProject | null> {
  try {
    const db = await openDb();
    const result = await new Promise<StudioProject | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(ACTIVE_PROJECT_KEY);
        req.onsuccess = () => resolve(req.result as StudioProject | undefined);
        req.onerror = () => reject(req.error);
      }
    );
    if (result && result.composition && Array.isArray(result.composition.layers)) {
      return restoreAssetUrls(result);
    }
  } catch {
    // Try localStorage fallback
    try {
      const raw = localStorage.getItem(ACTIVE_PROJECT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StudioProject;
        if (parsed?.composition?.layers) {
          return restoreAssetUrls(parsed);
        }
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function restoreAssetUrls(project: StudioProject): StudioProject {
  const assets = (project.assets || []).map((asset) => {
    if (asset.dataUrl && asset.dataUrl.startsWith('data:')) {
      return { ...asset, url: asset.dataUrl };
    }
    return asset;
  });
  return { ...project, assets };
}

export function validateImportedProject(raw: unknown): StudioProject | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<StudioProject>;
  if (
    !candidate.composition ||
    typeof candidate.composition.width !== 'number' ||
    typeof candidate.composition.height !== 'number' ||
    typeof candidate.composition.fps !== 'number' ||
    typeof candidate.composition.durationFrames !== 'number' ||
    !Array.isArray(candidate.composition.layers)
  ) {
    return null;
  }

  return restoreAssetUrls({
    version: candidate.version ?? 1,
    id: candidate.id || `proj_${Date.now()}`,
    name: candidate.name || 'Imported Project',
    composition: candidate.composition,
    assets: Array.isArray(candidate.assets) ? candidate.assets : [],
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
