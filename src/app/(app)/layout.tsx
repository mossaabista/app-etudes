import { getCurrentUser } from "@/server/auth/current-user";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Topbar } from "@/components/layout/Topbar";
import { QuickCapture } from "@/components/capture/QuickCapture";
import { LandWatcher } from "@/components/layout/LandWatcher";
import { getProfile } from "@/server/profile";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id) : null;
  // Course tools (syllabus import, Brightspace sync, labs) only show for students.
  const student = !profile || profile.type === "etudiant";

  return (
    <div className="flex h-dvh">
      <div className="glass-backdrop" aria-hidden />
      <Sidebar userName={user?.name} student={student} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar student={student} />
        <main className="app-main flex-1 overflow-y-auto px-4 py-6 md:px-8 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-6">
          {children}
        </main>
        <BottomNav student={student} />
        <QuickCapture />
        <LandWatcher />
      </div>
    </div>
  );
}
