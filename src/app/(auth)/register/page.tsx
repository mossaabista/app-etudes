import { registerAction } from "@/server/actions/auth.actions";
import { AuthForm } from "@/components/auth/AuthForm";

export default function RegisterPage() {
  return (
    <AuthForm
      title="Créer un compte"
      action={registerAction}
      fields={[
        { name: "name", label: "Prénom et nom", autoComplete: "name" },
        { name: "email", label: "Courriel", type: "email", autoComplete: "email" },
        { name: "password", label: "Mot de passe (6 caractères minimum)", type: "password", autoComplete: "new-password", minLength: 6 },
      ]}
      submit="Créer mon compte"
      pendingLabel="Création…"
      footer={{ text: "Déjà un compte ?", link: "Se connecter", href: "/login" }}
    />
  );
}
