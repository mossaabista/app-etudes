"use client";

import { useState } from "react";
import { deleteCourseAction } from "@/server/actions/course.actions";
import { Button } from "@/components/ui/Button";

export function DeleteCourseButton({ courseId }: { courseId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex gap-1">
        <Button size="sm" variant="danger" onClick={() => deleteCourseAction(courseId)}>
          Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
      Delete
    </Button>
  );
}
