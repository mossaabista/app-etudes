"use client";

import { logoutAction } from "@/server/actions/auth.actions";
import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <p className="mb-3 text-xs text-slate-500">Sign out of your account on this device.</p>
      <Button type="submit" variant="danger" size="sm">
        Sign out
      </Button>
    </form>
  );
}
