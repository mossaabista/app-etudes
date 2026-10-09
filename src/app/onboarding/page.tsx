import { requireUser } from "@/server/auth/current-user";
import { getProfile } from "@/server/profile";
import { Onboarding } from "@/components/onboarding/Onboarding";

export const metadata = { title: "Bienvenue · Aurum" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  return <Onboarding name={user.name.split(" ")[0]} current={profile} />;
}
