import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui';

/** Registers the service worker and offers new versions without forcing a reload mid-shop. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-20 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg lg:bottom-6"
    >
      <p className="flex-1">A new version of Cart Wise is ready.</p>
      <button
        type="button"
        className="text-stone-300 hover:text-white"
        onClick={() => {
          setNeedRefresh(false);
        }}
      >
        Later
      </button>
      <Button className="min-h-9 px-3" onClick={() => void updateServiceWorker(true)}>
        Reload
      </Button>
    </div>
  );
}
