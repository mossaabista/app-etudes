import { GraduationCap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
            <GraduationCap size={24} className="text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">App Études</h1>
          <p className="mt-1 text-xs text-slate-500">Academic Life OS</p>
        </div>
        {children}
      </div>
    </div>
  );
}
