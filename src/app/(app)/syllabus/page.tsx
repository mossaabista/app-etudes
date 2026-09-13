import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SyllabusUpload } from "@/components/syllabus/SyllabusUpload";

export default async function SyllabusPage() {
  const user = await requireUser();

  const [syllabi, courses] = await Promise.all([
    prisma.syllabus.findMany({
      where: { userId: user.id },
      include: { course: { select: { code: true, name: true, color: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({
      where: { userId: user.id },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader title="Syllabus" description="Upload and manage your course syllabi." />

      <Card className="mb-6">
        <CardBody>
          <SyllabusUpload courses={courses} />
        </CardBody>
      </Card>

      {syllabi.length === 0 ? (
        <EmptyState
          title="No syllabi uploaded"
          description="Upload your course syllabi (PDF) to keep them organized."
        />
      ) : (
        <div className="space-y-3">
          {syllabi.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-500 text-xs font-bold">
                PDF
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">{s.fileName}</p>
                <div className="mt-0.5 flex gap-2 text-xs text-slate-500">
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: s.course.color }}>
                    {s.course.code}
                  </span>
                  <span>{new Date(s.createdAt).toLocaleDateString("en-CA")}</span>
                </div>
              </div>
              <Badge tone={s.parsed ? "green" : "neutral"}>{s.parsed ? "Parsed" : "Uploaded"}</Badge>
              {s.fileUrl && (
                <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                  View
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
