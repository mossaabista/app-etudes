import { registerAction } from "@/server/actions/auth.actions";
import { AuthForm } from "@/components/auth/AuthForm";
import { getMessages } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getMessages()).auth.registerTitle };
}

export default async function RegisterPage() {
  const t = (await getMessages()).auth;
  return (
    <AuthForm
      title={t.registerTitle}
      action={registerAction}
      fields={[
        { name: "name", label: t.name, autoComplete: "given-name" },
        { name: "email", label: t.email, type: "email", autoComplete: "email" },
        { name: "password", label: t.password, type: "password", autoComplete: "new-password", minLength: 8 },
      ]}
      submit={t.register}
      pendingLabel={t.registering}
      footer={{ text: t.haveAccount, link: t.signIn, href: "/login" }}
    />
  );
}
