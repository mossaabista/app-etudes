"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TaskForm } from "./TaskForm";
import { useI18n } from "@/i18n/client";

type Course = { id: string; code: string; name: string };

export function AddTaskButton({ courses }: { courses: Course[] }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>{t.workspace.task.newButton}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.workspace.task.newTitle}>
        <TaskForm courses={courses} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
