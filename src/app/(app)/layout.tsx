import { getCurrentUser } from "@/server/auth/current-user";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Topbar } from "@/components/layout/Topbar";
import { QuickCapture } from "@/components/capture/QuickCapture";
import { LandWatcher } from "@/components/layout/LandWatcher";
import { getProfile } from "@/server/profile";
import { getLayout } from "@/server/layout";
import { navKeys } from "@/lib/nav";
import { prisma } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id) : null;
  const role = profile?.type ?? "etudiant";
  const roles = profile?.roles ?? [role];
  // Modules show for the roles that need them and for anyone who already has data in them.
  const [courses, projects, layout, documents] = user
    ? await Promise.all([prisma.course.count({ where: { userId: user.id } }), prisma.project.count({ where: { userId: user.id } }), getLayout(user.id), prisma.trackerEntry.count({ where: { userId: user.id, module: "app:documents" } })])
    : [0, 0, null, 0];
  const nav = navKeys({ roles, prefs: profile?.nav ?? { shown: [], hidden: [] }, counts: { courses, projects, documents }, areas: layout?.areas.map((a) => a.key) ?? [] });

  return (
    <div className="flex h-dvh">
      <div className="glass-backdrop" aria-hidden />
      <Sidebar userName={user?.name} nav={nav} role={role} roles={roles} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar nav={nav} role={role} roles={roles} />
        <main className="app-main flex-1 overflow-y-auto px-4 py-6 md:px-8 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-6">
          {children}
        </main>
        <BottomNav nav={nav} />
        <QuickCapture />
        <LandWatcher />
      </div>
    </div>
  );
}
