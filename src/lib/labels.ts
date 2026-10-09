/** French labels for the enum values stored in English in the database. */
export const LABELS: Record<string, string> = {
  // Assessment types
  Assignment: "Devoir",
  Quiz: "Quiz",
  Midterm: "Mi-session",
  Final: "Examen final",
  Exam: "Examen",
  Lab: "Laboratoire",
  Project: "Projet",
  Presentation: "Présentation",
  Report: "Rapport",
  // Schedule
  Lecture: "Cours magistral",
  Tutorial: "DGD / tutoriel",
  Monday: "Lundi",
  Tuesday: "Mardi",
  Wednesday: "Mercredi",
  Thursday: "Jeudi",
  Friday: "Vendredi",
  Saturday: "Samedi",
  Sunday: "Dimanche",
  // Statuses and priorities
  ToDo: "À faire",
  InProgress: "En cours",
  Done: "Fait",
  Deferred: "Reporté",
  Upcoming: "À venir",
  Completed: "Terminé",
  Submitted: "Remis",
  Overdue: "En retard",
  NotStarted: "Pas commencé",
  Low: "Basse",
  Medium: "Moyenne",
  High: "Haute",
  Critical: "Critique",
};

export const label = (value: string) => LABELS[value] ?? value;

/** English labels for the same stored values. */
export const LABELS_EN: Record<string, string> = {
  Assignment: "Assignment",
  Quiz: "Quiz",
  Midterm: "Midterm",
  Final: "Final exam",
  Exam: "Exam",
  Lab: "Lab",
  Project: "Project",
  Presentation: "Presentation",
  Report: "Report",
  Lecture: "Lecture",
  Tutorial: "Tutorial",
  ToDo: "To do",
  InProgress: "In progress",
  Done: "Done",
  Deferred: "Deferred",
  Upcoming: "Upcoming",
  Completed: "Completed",
  Submitted: "Submitted",
  Overdue: "Overdue",
  NotStarted: "Not started",
  Low: "Low",
  Medium: "Medium",
  High: "High",
  Critical: "Critical",
};

/** A stored value in the reader's language. */
export const labelIn = (value: string, locale: "fr" | "en") => (locale === "en" ? LABELS_EN[value] : LABELS[value]) ?? value;
