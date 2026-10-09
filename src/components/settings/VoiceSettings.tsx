"use client";

import { useEffect, useState } from "react";
import { Mic, Volume2 } from "lucide-react";
import { DEFAULT_VOICE, LOCALES, loadVoicePrefs, micPermission, saveVoicePrefs, webSpeechInput, webSpeechOutput, type VoicePrefs } from "@/lib/voice";

const MIC: Record<string, string> = {
  granted: "Micro autorisé.",
  denied: "Micro bloqué : autorise-le dans les réglages du navigateur pour dicter.",
  prompt: "Le navigateur te demandera l'accès au micro la première fois.",
  unknown: "Le navigateur te demandera l'accès au micro au moment de dicter.",
};

/** How OROM listens and speaks on this device. Saved on this device only. */
export function VoiceSettings() {
  const [p, setP] = useState<VoicePrefs>(DEFAULT_VOICE);
  const [voices, setVoices] = useState<{ name: string; lang: string }[]>([]);
  const [mic, setMic] = useState("unknown");
  const [support, setSupport] = useState({ input: false, output: false });

  useEffect(() => {
    const t = setTimeout(() => {
      const loaded = loadVoicePrefs();
      setP(loaded);
      setSupport({ input: webSpeechInput.supported(), output: webSpeechOutput.supported() });
      setVoices(webSpeechOutput.voices(loaded.locale));
      void micPermission().then(setMic);
    }, 0);
    // Voices load asynchronously in Chrome.
    const onVoices = () => setVoices(webSpeechOutput.voices(loadVoicePrefs().locale));
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    return () => {
      clearTimeout(t);
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
    };
  }, []);

  const set = (patch: Partial<VoicePrefs>) => {
    const next = { ...p, ...patch };
    setP(next);
    saveVoicePrefs(next);
    if (patch.locale) setVoices(webSpeechOutput.voices(patch.locale));
  };
  const field = "rounded-lg border border-[rgba(255,220,148,0.18)] bg-[rgba(20,12,3,0.4)] px-2.5 py-1.5 text-sm text-[var(--ink)]";

  return (
    <div className="space-y-3" id="voix">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-dim)]">
        <Mic size={13} className="text-[#f0cd79]" /> Voix — réglée sur cet appareil
      </p>
      {!support.input && <p className="text-xs text-[#ffd9a8]">Ce navigateur ne propose pas la dictée : tu peux toujours écrire à OROM.</p>}
      {!support.output && <p className="text-xs text-[#ffd9a8]">Ce navigateur ne sait pas lire les réponses à voix haute : elles restent affichées.</p>}
      <p className="text-xs text-[var(--ink-dim)]">{MIC[mic] ?? MIC.unknown}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-[var(--ink-dim)]">
          Langue
          <select value={p.locale} onChange={(e) => set({ locale: e.target.value, voice: null })} className={`${field} mt-1 w-full`}>
            {LOCALES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          Voix
          <select value={p.voice ?? ""} onChange={(e) => set({ voice: e.target.value || null })} className={`${field} mt-1 w-full`}>
            <option value="">La meilleure disponible</option>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          Débit ({p.rate.toFixed(2)})
          <input type="range" min={0.7} max={1.4} step={0.05} value={p.rate} onChange={(e) => set({ rate: Number(e.target.value) })} className="mt-2 w-full accent-[#e8bf63]" />
        </label>
      </div>
      <label className="tile flex cursor-pointer items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-[var(--ink)]">Mode conversation</span>
          <span className="block text-xs text-[var(--ink-dim)]">
            Après une réponse parlée, OROM réécoute tout seul, tant que la page Assistant est ouverte. Le micro reste visiblement allumé ; « Échap » ou le bouton carré l&apos;arrête. Un navigateur ne peut pas écouter en arrière-plan : pas de « Hey OROM » page fermée.
          </span>
        </span>
        <input type="checkbox" checked={p.conversation} onChange={() => set({ conversation: !p.conversation })} className="h-5 w-5 accent-[#e8bf63]" />
      </label>
      <label className="tile flex cursor-pointer items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-[var(--ink)]">Répondre à voix haute quand j&apos;écris</span>
          <span className="block text-xs text-[var(--ink-dim)]">Quand tu parles, OROM répond toujours à voix haute (un résumé court, le détail reste à l&apos;écran).</span>
        </span>
        <input type="checkbox" checked={p.speakTyped} onChange={() => set({ speakTyped: !p.speakTyped })} className="h-5 w-5 accent-[#e8bf63]" />
      </label>
      {support.output && (
        <button type="button" onClick={() => webSpeechOutput.speak("Bonjour, je suis OROM. Dis-moi ce que tu veux accomplir.", p)} className="mod-chip focus-ring">
          <Volume2 size={13} /> Tester la voix
        </button>
      )}
    </div>
  );
}
