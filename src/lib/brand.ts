/** The product's names and line, in one place so a rename is one edit. */
export const BRAND = {
  name: "Aurum",
  /** The one assistant the user talks to. */
  assistant: "Jarvis",
  tagline: { fr: "Le temps est d'or.", en: "Time is golden." },
  promise: {
    fr: "Ton assistant personnel : tu lui parles, il organise tes études, ton travail, ton sport et ta vie — et il vérifie que c'est vraiment fait.",
    en: "Your personal assistant: talk to it, and it organises your studies, work, training and life — and checks it's really done.",
  },
} as const;
