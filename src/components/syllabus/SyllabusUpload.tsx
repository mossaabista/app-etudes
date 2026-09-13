"use client";

import { useState } from "react";
import { Field, Select } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";

type Course = { id: string; code: string; name: string };

export function SyllabusUpload({ courses }: { courses: Course[] }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/syllabus/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Upload failed" });
      } else {
        setMessage({ type: "success", text: "Syllabus uploaded successfully!" });
        form.reset();
        window.location.reload();
      }
    } catch {
      setMessage({ type: "error", text: "Upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm font-medium text-slate-700">Upload Syllabus</p>

      {message && (
        <p className={`rounded-md px-3 py-2 text-sm ${message.type === "error" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
          {message.text}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Course" htmlFor="syllCourse">
          <Select id="syllCourse" name="courseId" required>
            <option value="">Select course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </Select>
        </Field>
        <Field label="PDF file" htmlFor="syllFile">
          <input
            id="syllFile"
            name="file"
            type="file"
            accept=".pdf"
            required
            className="w-full text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
        </Field>
      </div>

      <Button type="submit" disabled={uploading}>
        {uploading ? "Uploading..." : "Upload"}
      </Button>
    </form>
  );
}
