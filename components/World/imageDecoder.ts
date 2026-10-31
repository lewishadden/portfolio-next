/* ------------------------------------------------------------------
   Image decoding off the main thread.

   createImageBitmap decodes on a background thread, but then scales and
   flips the result on the thread that asked for it: on the main thread
   that took up to 60ms for a large screenshot. Asking from a worker keeps
   all of it off the main thread; the bitmap comes back transferred, not
   copied. Like the KTX2 transcoder, the worker runs from a blob URL.
   ------------------------------------------------------------------ */

import { imageAccept } from './routes';

const workerSource = `
self.onmessage = async ({ data: { id, url, options } }) => {
  try {
    const response = await fetch(url, { headers: { Accept: ${JSON.stringify(imageAccept)} } });
    if (!response.ok) throw new Error(response.status + ' for ' + url);
    const bitmap = await createImageBitmap(await response.blob(), options);
    self.postMessage({ id, bitmap }, [bitmap]);
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
`;

interface Reply {
  id: number;
  bitmap?: ImageBitmap;
  error?: string;
}

interface Request {
  url: string;
  options: ImageBitmapOptions;
  resolve: (bitmap: ImageBitmap) => void;
  reject: (error: unknown) => void;
}

let worker: Worker | null | undefined;
let nextId = 0;
const pending = new Map<number, Request>();

async function decodeHere(url: string, options: ImageBitmapOptions) {
  const response = await fetch(url, { headers: { Accept: imageAccept } });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return createImageBitmap(await response.blob(), options);
}

function startWorker() {
  try {
    const source = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    const started = new Worker(source);
    started.onmessage = ({ data }: MessageEvent<Reply>) => {
      const request = pending.get(data.id);
      if (!request) return;
      pending.delete(data.id);
      if (data.bitmap) request.resolve(data.bitmap);
      else request.reject(new Error(data.error));
    };
    // A worker that can't run (a strict CSP): decode here from now on
    started.onerror = () => {
      worker = null;
      for (const request of pending.values())
        decodeHere(request.url, request.options).then(request.resolve, request.reject);
      pending.clear();
    };
    return started;
  } catch {
    return null;
  }
}

function decodeFresh(url: string, options: ImageBitmapOptions) {
  if (worker === undefined) worker = startWorker();
  if (!worker) return decodeHere(url, options);
  const id = nextId++;
  const decoded = new Promise<ImageBitmap>((resolve, reject) =>
    pending.set(id, { url, options, resolve, reject })
  );
  worker.postMessage({ id, url, options });
  return decoded;
}

/** Decodes under way, by URL and options: asking again for one of them shares it */
const inflight = new Map<string, Promise<ImageBitmap>>();

/**
 * Fetches an image and decodes it to an ImageBitmap (scaled, flipped… per
 * `options`) off the main thread. Asking for an image that is already being
 * fetched and decoded the same way shares that work (a remount, React's
 * development double mount), so the bitmap may have more than one owner:
 * upload it as often as needed, but never close or transfer it
 */
export function decodeImage(url: string, options: ImageBitmapOptions) {
  // The worker's own URL is a blob: resolve the image against the page
  const absolute = new URL(url, location.href).href;
  const key = `${absolute} ${JSON.stringify(options)}`;
  const shared = inflight.get(key);
  if (shared) return shared;
  const decoded = decodeFresh(absolute, options);
  inflight.set(key, decoded);
  const settle = () => inflight.delete(key);
  decoded.then(settle, settle);
  return decoded;
}
