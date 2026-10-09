import { requireUser } from "@/server/auth/current-user";
import { getProfile } from "@/server/profile";
import { listTurns } from "@/server/conversation";
import { AssistantConsole } from "@/components/assistant/AssistantConsole";
import type { ProfileType } from "@/lib/profile";

export const metadata = { title: "Assistant" };

/** Things worth asking first, for each role. Every one of them runs for real. */
const SUGGESTIONS: Record<ProfileType, string[]> = {
  etudiant: ["Qu'est-ce que j'ai aujourd'hui ?", "Qu'est-ce qui risque de ne pas être fini ?", "Planifie ma semaine", "Fais-moi un plan de révision"],
  pro: ["Qu'est-ce que j'ai aujourd'hui ?", "Quelles sont mes priorités ?", "Planifie ma semaine", "Ajoute une réunion demain à 14 h"],
  entrepreneur: ["Qu'est-ce que j'ai aujourd'hui ?", "Quels projets sont en retard ?", "Planifie ma semaine", "Crée un projet Lancement"],
  sportif: ["Qu'est-ce que j'ai aujourd'hui ?", "Trouve un créneau pour une séance demain", "J'ai couru 30 minutes", "Qu'est-ce qui risque de ne pas être fini ?"],
  freelance: ["Qu'est-ce que j'ai aujourd'hui ?", "Organise mon activité de freelance", "Quelles sont mes priorités ?", "Planifie ma semaine"],
  personnel: ["Qu'est-ce que j'ai aujourd'hui ?", "Ajoute lait et œufs aux courses", "Rappelle-moi d'appeler maman demain", "Planifie ma semaine"],
};

export default async function AssistantPage() {
  const user = await requireUser();
  const [profile, turns] = await Promise.all([getProfile(user.id), listTurns(user.id).catch(() => [])]);
  return (
    <div className="area-enter">
      <AssistantConsole initial={turns.map((t) => ({ id: t.id, role: t.role, text: t.text, outcome: t.outcome }))} suggestions={SUGGESTIONS[profile?.type ?? "etudiant"]} />
    </div>
  );
}
