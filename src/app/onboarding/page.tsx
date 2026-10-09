import { requireUser } from "@/server/auth/current-user";
import { getMessages } from "@/i18n/server";
import { Onboarding } from "@/components/onboarding/Onboarding";

export async function generateMetadata() {
  return { title: (await getMessages()).onboarding.welcomeTitle.replace(/\.$/, "") };
}

export default async function OnboardingPage() {
  const user = await requireUser();
  return <Onboarding name={user.name.split(" ")[0]} vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />;
}
