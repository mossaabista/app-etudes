"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TaskForm } from "./TaskForm";

type Course = { id: string; code: string; name: string };

export function AddTaskButton({ courses }: { courses: Course[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>+ Add Task</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New Task">
        <TaskForm courses={courses} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
