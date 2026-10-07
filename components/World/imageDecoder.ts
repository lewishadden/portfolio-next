/* ------------------------------------------------------------------
   Image decoding off the main thread.

   createImageBitmap decodes on a background thread, but then scales and
   flips the result on the thread that asked for it: on the main thread
   that took up to 60ms for a large screenshot. Asking from a worker keeps
   all of it off the main thread; the bitmap comes back transferred, not
   copied. Like the KTX2 transcoder, the worker runs from a blob URL.
   ------------------------------------------------------------------ */

const workerSource = `
self.onmessage = async ({ data: { id, url, options } }) => {
  try {
    const response = await fetch(url);
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
  const response = await fetch(url);
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

/** Fetches an image and decodes it to an ImageBitmap (scaled, flipped… per `options`) off the main thread */
export function decodeImage(url: string, options: ImageBitmapOptions) {
  if (worker === undefined) worker = startWorker();
  // The worker's own URL is a blob: resolve the image against the page
  const absolute = new URL(url, location.href).href;
  if (!worker) return decodeHere(absolute, options);
  const id = nextId++;
  const decoded = new Promise<ImageBitmap>((resolve, reject) =>
    pending.set(id, { url: absolute, options, resolve, reject })
  );
  worker.postMessage({ id, url: absolute, options });
  return decoded;
}
