import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/Badge";
import { LabActions } from "@/components/labs/LabActions";

export default async function LabsPage() {
  const user = await requireUser();

  const coursesWithLabs = await prisma.course.findMany({
    where: {
      userId: user.id,
      schedules: { some: { type: "Lab" } },
    },
    include: {
      schedules: { where: { type: "Lab" } },
      labs: { orderBy: { labNumber: "asc" } },
    },
  });

  const allLabs = await prisma.labSession.findMany({
    where: { userId: user.id },
    include: { course: { select: { code: true, color: true, name: true } } },
    orderBy: [{ date: "asc" }, { labNumber: "asc" }],
  });

  const now = new Date();
  const upcoming = allLabs.filter((l) => l.status !== "Completed" && l.status !== "Submitted" && l.dueDate && new Date(l.dueDate) >= now);
  const overdue = allLabs.filter((l) => l.status !== "Completed" && l.status !== "Submitted" && l.dueDate && new Date(l.dueDate) < now);

  return (
    <>
      <PageHeader title="Laboratoire" description="Suivi de vos séances de lab, rapports et livrables." />

      {/* Overdue alerts */}
      {overdue.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-red-800">En retard ({overdue.length})</h3>
          <div className="space-y-1">
            {overdue.map((lab) => (
              <div key={lab.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lab.course.color }} />
                <span className="font-medium text-red-900">{lab.course.code} — Lab {lab.labNumber}</span>
                <span className="text-red-700">{lab.deliverable}</span>
                {lab.dueDate && (
                  <span className="ml-auto text-xs text-red-600">{new Date(lab.dueDate).toLocaleDateString("fr-CA")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming summary */}
      {upcoming.length > 0 && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-blue-800">Prochains livrables ({upcoming.length})</h3>
          <div className="space-y-1">
            {upcoming.slice(0, 5).map((lab) => (
              <div key={lab.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lab.course.color }} />
                <span className="font-medium text-blue-900">{lab.course.code} — Lab {lab.labNumber}</span>
                <span className="text-blue-700">{lab.deliverable}</span>
                {lab.dueDate && (
                  <span className="ml-auto text-xs text-blue-600">{new Date(lab.dueDate).toLocaleDateString("fr-CA")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-course lab sections */}
      {coursesWithLabs.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState title="Aucun cours avec lab" description="Les cours avec des séances de laboratoire apparaîtront ici." />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {coursesWithLabs.map((course) => (
            <Card key={course.id}>
              <CardHeader
                title={
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: course.color }} />
                    <span>{course.code} — {course.name}</span>
                  </div>
                }
              />
              <CardBody>
                {/* Lab schedule info */}
                {course.schedules.map((s) => (
                  <div key={s.id} className="mb-4 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-medium">Horaire:</span>
                    <span>{s.day} {s.startTime}–{s.endTime}</span>
                    {s.room && <span className="text-slate-400">({s.room})</span>}
                  </div>
                ))}

                {/* Lab sessions table */}
                {course.labs.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Aucune séance de lab enregistrée.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                          <th className="pb-2 pr-4">#</th>
                          <th className="pb-2 pr-4">Date</th>
                          <th className="pb-2 pr-4">Sujet</th>
                          <th className="pb-2 pr-4">Livrable</th>
                          <th className="pb-2 pr-4">Date limite</th>
                          <th className="pb-2 pr-4">Statut</th>
                          <th className="pb-2 pr-4">Note</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {course.labs.map((lab) => {
                          const isOverdue = lab.dueDate && new Date(lab.dueDate) < now && lab.status !== "Completed" && lab.status !== "Submitted";
                          return (
                            <tr key={lab.id} className={`border-b border-slate-50 ${isOverdue ? "bg-red-50/50" : ""}`}>
                              <td className="py-2.5 pr-4 font-medium text-slate-700">Lab {lab.labNumber}</td>
                              <td className="py-2.5 pr-4 text-slate-600">
                                {lab.date ? new Date(lab.date).toLocaleDateString("fr-CA", { month: "short", day: "numeric" }) : "—"}
                              </td>
                              <td className="py-2.5 pr-4 text-slate-700">{lab.topic || "—"}</td>
                              <td className="py-2.5 pr-4 text-slate-600">{lab.deliverable || "—"}</td>
                              <td className={`py-2.5 pr-4 text-xs ${isOverdue ? "font-medium text-red-600" : "text-slate-500"}`}>
                                {lab.dueDate ? new Date(lab.dueDate).toLocaleDateString("fr-CA") : "—"}
                              </td>
                              <td className="py-2.5 pr-4">
                                <StatusBadge status={lab.status} />
                              </td>
                              <td className="py-2.5 pr-4 text-slate-600">
                                {lab.grade != null ? `${lab.grade}%` : "—"}
                              </td>
                              <td className="py-2.5">
                                <LabActions labId={lab.id} currentStatus={lab.status} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
