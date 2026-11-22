type WaitUntil = (promise: Promise<unknown>) => void;

const isWorkersRuntime = () =>
  (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ===
  "Cloudflare-Workers";

// Non-literal specifier: Node / Vercel bundles must not try to resolve the Workers built-in.
const WORKERS_MODULE = "cloudflare:workers";
let waitUntilPromise: Promise<WaitUntil | undefined> | undefined;

const loadWaitUntil = () => {
  waitUntilPromise ??= isWorkersRuntime()
    ? import(/* @vite-ignore */ WORKERS_MODULE)
        .then((mod: { waitUntil?: WaitUntil }) => mod.waitUntil)
        .catch(() => undefined)
    : Promise.resolve(undefined);
  return waitUntilPromise;
};

/**
 * Runs `task` after the response without blocking it. On Workers the task is registered with
 * `waitUntil` so the isolate stays alive; elsewhere the long-lived server process finishes it.
 */
export const runInBackground = (task: () => Promise<void> | void, label: string) => {
  const promise = Promise.resolve()
    .then(task)
    .catch((error) => {
      console.warn(`Background task failed: ${label}`, error);
    });
  void loadWaitUntil().then((waitUntil) => waitUntil?.(promise));
};
