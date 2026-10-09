import { loginAction } from "@/server/actions/auth.actions";
import { AuthForm } from "@/components/auth/AuthForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ compte?: string }> }) {
  const { compte } = await searchParams;
  return (
    <>
      {compte === "supprime" && (
        <p role="status" className="mx-auto mb-4 max-w-sm rounded-xl bg-[rgba(20,14,6,0.6)] px-4 py-3 text-center text-sm text-[#f6e7c6]">
          Ton compte et toutes ses données ont été supprimés.
        </p>
      )}
      <AuthForm
        title="Connexion"
        action={loginAction}
        fields={[
          { name: "email", label: "Courriel", type: "email", autoComplete: "email" },
          { name: "password", label: "Mot de passe", type: "password", autoComplete: "current-password" },
        ]}
        submit="Se connecter"
        pendingLabel="Connexion…"
        footer={{ text: "Pas encore de compte ?", link: "Créer un compte", href: "/register" }}
      />
    </>
  );
}
