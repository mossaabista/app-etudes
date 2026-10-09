import { requireUser } from "@/server/auth/current-user";
import { listRuns, listWorkflows } from "@/server/workflows";
import { pushIsConfigured } from "@/server/notifications/push";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkflowsWorkspace } from "@/components/workflows/WorkflowsWorkspace";

export const metadata = { title: "Automatisations · OROM" };

export default async function WorkflowsPage() {
  const user = await requireUser();
  const [workflows, runs] = await Promise.all([listWorkflows(user.id), listRuns(user.id, 20)]);
  return (
    <div className="area-enter mx-auto max-w-4xl">
      <PageHeader title="Automatisations" description="Des enchaînements que tu lances d'un geste, ou qui se font chaque matin si tu l'autorises." />
      <WorkflowsWorkspace workflows={workflows} runs={runs} push={pushIsConfigured()} />
    </div>
  );
}
