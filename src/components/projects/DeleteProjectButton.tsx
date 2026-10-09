"use client";

import { useState } from "react";
import { deleteProjectAction } from "@/server/actions/project.actions";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/client";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [confirming, setConfirming] = useState(false);
  const { t } = useI18n();

  if (confirming) {
    return (
      <div className="flex gap-1">
        <Button size="sm" variant="danger" onClick={() => deleteProjectAction(projectId)}>{t.workspace.projects.confirmDelete}</Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>{t.common.cancel}</Button>
      </div>
    );
  }

  return <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>{t.common.delete}</Button>;
}
