import { DefaultLoadingManager } from 'three';

/**
 * Downloads through three's default loading manager (models, their
 * textures, project screenshots) for the loading screen. Hooked when the 3D
 * chunk loads, before anything renders: models start downloading during
 * render, before any effect could listen.
 */
export const downloads = { loaded: 0, total: 0, busy: false };

const manager = DefaultLoadingManager;
const { onStart, onProgress, onLoad } = manager;

manager.onStart = (url, itemsLoaded, itemsTotal) => {
  downloads.busy = true;
  downloads.loaded = itemsLoaded;
  downloads.total = itemsTotal;
  onStart?.(url, itemsLoaded, itemsTotal);
};
manager.onProgress = (url, itemsLoaded, itemsTotal) => {
  downloads.loaded = itemsLoaded;
  downloads.total = itemsTotal;
  onProgress?.(url, itemsLoaded, itemsTotal);
};
manager.onLoad = () => {
  downloads.busy = false;
  onLoad?.();
};
