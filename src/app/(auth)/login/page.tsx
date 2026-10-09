import { loginAction } from "@/server/actions/auth.actions";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
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
  );
}
