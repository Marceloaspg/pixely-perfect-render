import { useEffect, useRef, useState } from 'react';

type TurnstileOptions = {
  sitekey: string;
  action: 'quote_registration';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
  theme: 'light' | 'dark' | 'auto';
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

const scriptId = 'cloudflare-turnstile-api';

export function CloudflareTurnstile({
  resetKey,
  onToken,
}: {
  resetKey: number;
  onToken: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const siteKey = import.meta.env['VITE_CLOUDFLARE_TURNSTILE_SITE_KEY'] as string | undefined;

  useEffect(() => {
    if (!siteKey) return;
    let disposed = false;
    let widgetId: string | undefined;
    setScriptReady(false);
    setScriptFailed(false);
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const renderWidget = () => {
      if (disposed || !containerRef.current || !window.turnstile || widgetId) return;
      try {
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: 'quote_registration',
          theme: 'auto',
          callback: token => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        });
        setScriptReady(true);
      } catch {
        setScriptFailed(true);
        onTokenRef.current('');
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    if (window.turnstile) renderWidget();
    else {
      script.addEventListener('load', renderWidget);
      script.addEventListener('error', () => {
        if (!disposed) {
          setScriptReady(false);
          setScriptFailed(true);
          onTokenRef.current('');
        }
      }, { once: true });
    }

    return () => {
      disposed = true;
      if (widgetId) window.turnstile?.remove(widgetId);
      onToken('');
    };
  }, [resetKey, siteKey]);

  if (!siteKey) {
    return <p role="alert" className="text-sm text-primary-foreground">A proteção antispam está sendo configurada. O registro de novos orçamentos está temporariamente indisponível.</p>;
  }

  return (
    <div className="min-w-0">
      <div ref={containerRef} />
      {scriptFailed
        ? <p role="alert" className="mt-2 text-xs text-primary-foreground">Não foi possível carregar a verificação. Tente novamente mais tarde.</p>
        : !scriptReady && <p role="status" className="mt-2 text-xs text-primary-foreground/75">Carregando verificação antispam…</p>}
    </div>
  );
}
