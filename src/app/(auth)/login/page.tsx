import { loginAction } from "@/server/actions/auth.actions";
import { AuthForm } from "@/components/auth/AuthForm";
import { getMessages } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getMessages()).auth.loginTitle };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ compte?: string }> }) {
  const { compte } = await searchParams;
  const t = (await getMessages()).auth;
  return (
    <>
      {compte === "supprime" && (
        <p role="status" className="mx-auto mb-4 max-w-sm rounded-xl bg-[rgba(20,14,6,0.6)] px-4 py-3 text-center text-sm text-[#f6e7c6]">
          {t.deleted}
        </p>
      )}
      <AuthForm
        title={t.loginTitle}
        action={loginAction}
        fields={[
          { name: "email", label: t.email, type: "email", autoComplete: "email" },
          { name: "password", label: t.password, type: "password", autoComplete: "current-password" },
        ]}
        submit={t.login}
        pendingLabel={t.loggingIn}
        footer={{ text: t.noAccount, link: t.createAccount, href: "/register" }}
      />
    </>
  );
}
