"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/server/actions/auth.actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Form";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerAction, null);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Create your account</h2>
      <form action={action} className="space-y-4">
        {state?.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
        )}
        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-slate-700">Full name</label>
          <Input id="name" name="name" required autoComplete="name" />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-700">Email</label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-slate-700">Password</label>
          <Input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-slate-900 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
