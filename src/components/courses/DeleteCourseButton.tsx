"use client";

import { useState } from "react";
import { deleteCourseAction } from "@/server/actions/course.actions";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/client";

export function DeleteCourseButton({ courseId }: { courseId: string }) {
  const [confirming, setConfirming] = useState(false);
  const { t } = useI18n();

  if (confirming) {
    return (
      <div className="flex gap-1">
        <Button size="sm" variant="danger" onClick={() => deleteCourseAction(courseId)}>
          {t.academics.confirmDelete}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          {t.common.cancel}
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
      {t.common.delete}
    </Button>
  );
}
