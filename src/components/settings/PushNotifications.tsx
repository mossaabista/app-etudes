"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type State =
  | "loading"
  | "needs-install"
  | "unsupported"
  | "denied"
  | "enabled"
  | "disabled";

export function PushNotifications({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;

      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

      if (!supported) {
        // iOS exposes PushManager only inside an installed home-screen app, so an
        // unsupported result there means "not installed yet", not "impossible".
        setState(iOS && !standalone ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      const existing = await registration?.pushManager.getSubscription();
      setState(existing ? "enabled" : "disabled");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Enregistrement échoué");

      setState("enabled");
      setMessage({ tone: "ok", text: "Notifications activées sur cet appareil." });
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Échec." });
    } finally {
      setBusy(false);
    }
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
      setMessage({ tone: "ok", text: "Notifications désactivées sur cet appareil." });
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Échec." });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Envoi échoué");
      setMessage({ tone: "ok", text: "Envoyée. Elle devrait arriver dans un instant." });
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Échec." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Un résumé chaque matin vers 7 h : tes cours du jour, les devoirs, labos et tâches à rendre.
        Rien n&apos;est envoyé les jours sans cours ni échéance.
      </p>

      {message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            message.tone === "err" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {message.text}
        </p>
      )}

      {state === "loading" && <p className="text-xs text-slate-500">Vérification…</p>}

      {state === "needs-install" && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sur iPhone, les notifications ne fonctionnent que depuis l&apos;app installée. Ajoute
          d&apos;abord la page à ton écran d&apos;accueil (Partager → Sur l&apos;écran
          d&apos;accueil), puis reviens ici <strong>depuis l&apos;icône</strong>.
        </p>
      )}

      {state === "unsupported" && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
          Ce navigateur ne gère pas les notifications push.
        </p>
      )}

      {state === "denied" && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Les notifications ont été refusées pour ce site. Réautorise-les dans les réglages du
          système, puis recharge cette page.
        </p>
      )}

      {state === "disabled" && (
        <Button onClick={enable} disabled={busy}>
          {busy ? "Activation…" : "Activer les notifications"}
        </Button>
      )}

      {state === "enabled" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            Activées sur cet appareil
          </span>
          <Button onClick={sendTest} variant="secondary" size="sm" disabled={busy}>
            Envoyer un test
          </Button>
          <Button onClick={disable} variant="ghost" size="sm" disabled={busy}>
            Désactiver
          </Button>
        </div>
      )}
    </div>
  );
}

// The VAPID key travels as base64url; PushManager wants raw bytes. Backing it with
// an explicit ArrayBuffer keeps the type as BufferSource rather than ArrayBufferLike.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
