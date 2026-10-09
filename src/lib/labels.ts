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
