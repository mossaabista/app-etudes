"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { enablePush, pushSupported } from "@/lib/push-client";

type State =
  | "loading"
  | "needs-install"
  | "unsupported"
  | "denied"
  | "enabled"
  | "disabled";

const ERROR = "rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-sm text-[#ffd9cf]";
const SUCCESS = "rounded-xl bg-[rgba(60,160,100,0.16)] px-3 py-2 text-sm text-[#cdf3da]";
const NOTE = "rounded-xl border border-[rgba(255,220,148,0.16)] bg-[rgba(255,220,148,0.06)] px-3 py-2 text-sm text-[var(--ink)]";

export function PushNotifications({ vapidPublicKey }: { vapidPublicKey: string }) {
  const t = useI18n().t.settingsUi.push;
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;

      if (!pushSupported()) {
        // iOS exposes PushManager only inside an installed home-screen app, so an
        // unsupported result there means "not installed yet", not "impossible".
        setState(iOS && !standalone ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const existing = await registration?.pushManager.getSubscription();
        setState(existing ? "enabled" : "disabled");
      } catch {
        setState("disabled");
      }
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setMessage(null);
    const outcome = await enablePush(vapidPublicKey);
    if (outcome === "enabled") {
      setState("enabled");
      setMessage({ tone: "ok", text: t.enabled });
    } else if (outcome === "denied") setState("denied");
    else if (outcome === "dismissed") setState("disabled");
    else if (outcome === "unsupported") setMessage({ tone: "err", text: vapidPublicKey ? t.unsupported : t.notReady });
    else setMessage({ tone: "err", text: t.failed });
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      const endpoint = subscription?.endpoint;
      await subscription?.unsubscribe();

      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });

      setState("disabled");
      setMessage({ tone: "ok", text: t.disabled });
    } catch {
      setMessage({ tone: "err", text: t.disableFailed });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) throw new Error("test failed");
      setMessage({ tone: "ok", text: t.sent });
    } catch {
      setMessage({ tone: "err", text: t.testFailed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--ink-dim)]">{t.intro}</p>

      {message && (
        <p role={message.tone === "err" ? "alert" : "status"} className={message.tone === "err" ? ERROR : SUCCESS}>
          {message.text}
        </p>
      )}

      {state === "loading" && <p className="text-xs text-[var(--ink-dim)]">{t.checking}</p>}

      {state === "needs-install" && <p className={NOTE}>{t.needsInstall}</p>}

      {state === "unsupported" && <p className={NOTE}>{t.unsupported}</p>}

      {state === "denied" && <p className={NOTE}>{t.denied}</p>}

      {state === "disabled" && (
        <button type="button" onClick={enable} disabled={busy} className="mod-chip mod-chip-gold focus-ring">
          <Bell size={13} /> {busy ? t.enabling : t.enable}
        </button>
      )}

      {state === "enabled" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[rgba(60,160,100,0.16)] px-2.5 py-1 text-xs font-medium text-[#cdf3da]">{t.enabledBadge}</span>
          <button type="button" onClick={sendTest} disabled={busy} className="mod-chip focus-ring">
            <Send size={13} /> {t.test}
          </button>
          <button type="button" onClick={disable} disabled={busy} className="mod-chip focus-ring">
            <BellOff size={13} /> {t.disable}
          </button>
        </div>
      )}
    </div>
  );
}
