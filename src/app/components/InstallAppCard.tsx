import { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallAppCard() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const confirmInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', confirmInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', confirmInstalled);
    };
  }, []);

  if (installed || !promptEvent) return null;

  const install = async () => {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPromptEvent(null);
  };

  return (
    <section className="mb-5 rounded-3xl bg-[#041b42] p-5 text-white shadow-lg" aria-label="Install NETS Pay Together">
      <div className="flex items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10">
          <Smartphone className="size-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black">Add NETS to your home screen</h2>
          <p className="mt-1 text-xs leading-relaxed text-blue-100/75">Launch in a secure standalone window and keep the app shell available offline.</p>
        </div>
      </div>
      <button type="button" onClick={install} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-[#0053a0]">
        <Download className="size-4" aria-hidden="true" /> Install app
      </button>
    </section>
  );
}
