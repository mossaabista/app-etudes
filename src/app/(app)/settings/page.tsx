import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { LogoutButton } from "@/components/settings/LogoutButton";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader title="Settings" description="Manage your account." />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Account" />
          <CardBody>
            <LogoutButton />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="About" />
          <CardBody>
            <div className="space-y-1 text-xs text-slate-500">
              <p>App Études — Academic Life OS</p>
              <p>Version 1.0.0</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
