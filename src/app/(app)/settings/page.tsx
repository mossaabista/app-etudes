"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/server/actions/auth.actions";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <Card>
        <CardBody className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Account</h3>
            <p className="mt-1 text-xs text-slate-500">Manage your account settings.</p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="danger" size="sm">
              Sign out
            </Button>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
