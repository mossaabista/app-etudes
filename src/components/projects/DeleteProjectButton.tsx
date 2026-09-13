"use client";

import { useState } from "react";
import { deleteProjectAction } from "@/server/actions/project.actions";
import { Button } from "@/components/ui/Button";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex gap-1">
        <Button size="sm" variant="danger" onClick={() => deleteProjectAction(projectId)}>Confirm</Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
    );
  }

  return <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>Delete</Button>;
}
