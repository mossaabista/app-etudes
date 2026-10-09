import { requireUser } from "@/server/auth/current-user";
import { listRuns, listWorkflows } from "@/server/workflows";
import { pushIsConfigured } from "@/server/notifications/push";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkflowsWorkspace } from "@/components/workflows/WorkflowsWorkspace";
import { getMessages } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getMessages()).nav.workflows };
}

export default async function WorkflowsPage() {
  const user = await requireUser();
  const [workflows, runs, t] = await Promise.all([listWorkflows(user.id), listRuns(user.id, 20), getMessages()]);
  return (
    <div className="area-enter mx-auto max-w-4xl">
      <PageHeader title={t.nav.workflows} description={t.workspace.wf.intro} />
      <WorkflowsWorkspace workflows={workflows} runs={runs} push={pushIsConfigured()} />
    </div>
  );
}
