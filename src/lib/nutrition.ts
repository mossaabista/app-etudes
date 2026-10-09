/**
 * The nutrition engine: energy needs from Mifflin–St Jeor, macronutrient targets from the
 * sports-nutrition literature, and a small, honest food table (values per 100 g, rounded,
 * from USDA FoodData Central / Canadian Nutrient File) that recipes are built from, so a
 * plate's numbers come from what is on it rather than being typed in.
 */

export type Sex = "homme" | "femme";
export type Goal = "perdre" | "maintenir" | "prendre";

export const ACTIVITY = [
  { key: 1.2, label: "Sédentaire", desc: "Travail assis, peu ou pas de sport" },
  { key: 1.375, label: "Légèrement actif", desc: "Sport 1 à 3 fois par semaine" },
  { key: 1.55, label: "Actif", desc: "Sport 3 à 5 fois par semaine" },
  { key: 1.725, label: "Très actif", desc: "Sport 6 à 7 fois par semaine" },
  { key: 1.9, label: "Extrêmement actif", desc: "Travail physique et entraînement quotidien" },
];

export const GOALS: { key: Goal; label: string; desc: string }[] = [
  { key: "perdre", label: "Perdre du poids", desc: "≈ 0,5 kg par semaine, en préservant le muscle" },
  { key: "maintenir", label: "Maintenir", desc: "Stabilité, énergie, santé" },
  { key: "prendre", label: "Prendre du muscle", desc: "Léger surplus + entraînement" },
];

export interface NutritionProfile {
  sex: Sex;
  age: number;
  height: number;
  weight: number;
  activity: number;
  goal: Goal;
}

export interface Targets {
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  water: number;
  /** The reasoning, step by step, for the "pourquoi" panel. */
  why: string[];
}

const round = (n: number, to = 1) => Math.round(n / to) * to;

export function targets(p: NutritionProfile): Targets {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "homme" ? 5 : -161);
  const tdee = bmr * p.activity;
  // ~7 700 kcal per kg of body fat: a 550 kcal daily deficit is about 0.5 kg a week.
  const floor = p.sex === "homme" ? 1500 : 1200;
  const kcal = p.goal === "perdre" ? Math.max(floor, tdee - 550) : p.goal === "prendre" ? tdee + 300 : tdee;
  // Protein per kg: higher in a deficit to keep muscle, high when building it.
  const perKg = p.goal === "perdre" ? 1.8 : p.goal === "prendre" ? 1.8 : 1.4;
  const protein = p.weight * perKg;
  const fat = Math.max((kcal * 0.3) / 9, p.weight * 0.6);
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  const fiber = (kcal / 1000) * 14;
  const water = p.weight * 35;
  const deficit = p.goal === "perdre" ? round(tdee - kcal, 10) : 0;
  return {
    bmr: round(bmr, 10),
    tdee: round(tdee, 10),
    kcal: round(kcal, 10),
    protein: round(protein),
    fat: round(fat),
    carbs: round(carbs),
    fiber: round(fiber),
    water: round(water, 50),
    why: [
      `Métabolisme de base (Mifflin–St Jeor) : ${round(bmr, 10)} kcal — l'énergie dépensée au repos.`,
      `× ${String(p.activity).replace(".", ",")} pour ton activité = ${round(tdee, 10)} kcal pour rester stable.`,
      p.goal === "perdre"
        ? `− ${deficit} kcal par jour ≈ ${(deficit * 7 / 7700).toFixed(2).replace(".", ",")} kg par semaine${kcal === floor ? ` (plancher de sécurité de ${floor} kcal atteint)` : ""}.`
        : p.goal === "prendre"
          ? "+ 300 kcal : un léger surplus suffit pour construire du muscle sans trop de gras."
          : "Objectif maintien : on vise ta dépense, sans déficit ni surplus.",
      `Protéines ${String(perKg).replace(".", ",")} g/kg (${round(protein)} g) : ${p.goal === "maintenir" ? "couvre largement les besoins d'une personne active" : p.goal === "perdre" ? "préserve la masse musculaire pendant le déficit" : "soutient la construction musculaire"}.`,
      `Lipides ≈ 30 % des calories (${round(fat)} g) pour les hormones et les vitamines A, D, E, K ; le reste en glucides (${round(carbs)} g) pour l'énergie.`,
      `Fibres 14 g par 1 000 kcal (${round(fiber)} g), eau ≈ 35 ml/kg (${(round(water, 50) / 1000).toFixed(1).replace(".", ",")} L, boissons et aliments compris).`,
    ],
  };
}

// --------------------------------------------------------------------------- foods

/** Per 100 g: kcal, protein, carbs, fat, fibre (g). */
export const FOODS: Record<string, { label: string; kcal: number; p: number; c: number; f: number; fib: number; aisle: string }> = {
  avoine: { label: "Flocons d'avoine", kcal: 379, p: 13.2, c: 67.7, f: 6.5, fib: 10.1, aisle: "Épicerie" },
  lait: { label: "Lait 2 %", kcal: 50, p: 3.3, c: 4.8, f: 2, fib: 0, aisle: "Produits laitiers" },
  yogourt: { label: "Yogourt grec nature 2 %", kcal: 73, p: 9.9, c: 3.9, f: 2, fib: 0, aisle: "Produits laitiers" },
  cottage: { label: "Fromage cottage 2 %", kcal: 84, p: 10.5, c: 4.3, f: 2.3, fib: 0, aisle: "Produits laitiers" },
  feta: { label: "Feta", kcal: 264, p: 14.2, c: 4.1, f: 21.3, fib: 0, aisle: "Produits laitiers" },
  oeuf: { label: "Œufs", kcal: 143, p: 12.6, c: 0.7, f: 9.5, fib: 0, aisle: "Produits laitiers" },
  pain: { label: "Pain de grains entiers", kcal: 252, p: 12.4, c: 42.7, f: 3.5, fib: 6, aisle: "Boulangerie" },
  tortilla: { label: "Tortilla de blé entier", kcal: 290, p: 9, c: 46, f: 7.5, fib: 7, aisle: "Boulangerie" },
  poulet: { label: "Poitrine de poulet", kcal: 165, p: 31, c: 0, f: 3.6, fib: 0, aisle: "Viandes & poissons" },
  saumon: { label: "Saumon", kcal: 206, p: 22, c: 0, f: 12, fib: 0, aisle: "Viandes & poissons" },
  thon: { label: "Thon en conserve (à l'eau)", kcal: 116, p: 25.5, c: 0, f: 0.8, fib: 0, aisle: "Épicerie" },
  boeuf: { label: "Bœuf haché extra-maigre", kcal: 217, p: 26, c: 0, f: 11.7, fib: 0, aisle: "Viandes & poissons" },
  tofu: { label: "Tofu ferme", kcal: 144, p: 17.3, c: 2.8, f: 8.7, fib: 2.3, aisle: "Fruits & légumes" },
  lentilles: { label: "Lentilles cuites", kcal: 116, p: 9, c: 20.1, f: 0.4, fib: 7.9, aisle: "Épicerie" },
  poischiches: { label: "Pois chiches cuits", kcal: 164, p: 8.9, c: 27.4, f: 2.6, fib: 7.6, aisle: "Épicerie" },
  haricotsrouges: { label: "Haricots rouges cuits", kcal: 127, p: 8.7, c: 22.8, f: 0.5, fib: 6.4, aisle: "Épicerie" },
  riz: { label: "Riz brun cuit", kcal: 123, p: 2.7, c: 25.6, f: 1, fib: 1.6, aisle: "Épicerie" },
  quinoa: { label: "Quinoa cuit", kcal: 120, p: 4.4, c: 21.3, f: 1.9, fib: 2.8, aisle: "Épicerie" },
  pates: { label: "Pâtes de blé entier cuites", kcal: 149, p: 5.8, c: 30, f: 1.7, fib: 3.9, aisle: "Épicerie" },
  patatedouce: { label: "Patate douce", kcal: 90, p: 2, c: 20.7, f: 0.2, fib: 3.3, aisle: "Fruits & légumes" },
  brocoli: { label: "Brocoli", kcal: 34, p: 2.8, c: 6.6, f: 0.4, fib: 2.6, aisle: "Fruits & légumes" },
  epinards: { label: "Épinards", kcal: 23, p: 2.9, c: 3.6, f: 0.4, fib: 2.2, aisle: "Fruits & légumes" },
  poivron: { label: "Poivron", kcal: 31, p: 1, c: 6, f: 0.3, fib: 2.1, aisle: "Fruits & légumes" },
  tomate: { label: "Tomates", kcal: 18, p: 0.9, c: 3.9, f: 0.2, fib: 1.2, aisle: "Fruits & légumes" },
  concombre: { label: "Concombre", kcal: 15, p: 0.7, c: 3.6, f: 0.1, fib: 0.5, aisle: "Fruits & légumes" },
  carotte: { label: "Carottes", kcal: 41, p: 0.9, c: 9.6, f: 0.2, fib: 2.8, aisle: "Fruits & légumes" },
  haricotsverts: { label: "Haricots verts", kcal: 31, p: 1.8, c: 7, f: 0.2, fib: 2.7, aisle: "Fruits & légumes" },
  avocat: { label: "Avocat", kcal: 160, p: 2, c: 8.5, f: 14.7, fib: 6.7, aisle: "Fruits & légumes" },
  fruits: { label: "Petits fruits", kcal: 57, p: 0.7, c: 14.5, f: 0.3, fib: 2.4, aisle: "Fruits & légumes" },
  banane: { label: "Banane", kcal: 89, p: 1.1, c: 22.8, f: 0.3, fib: 2.6, aisle: "Fruits & légumes" },
  pomme: { label: "Pomme", kcal: 52, p: 0.3, c: 13.8, f: 0.2, fib: 2.4, aisle: "Fruits & légumes" },
  amandes: { label: "Amandes", kcal: 579, p: 21.2, c: 21.6, f: 49.9, fib: 12.5, aisle: "Épicerie" },
  arachide: { label: "Beurre d'arachide naturel", kcal: 588, p: 25, c: 20, f: 50, fib: 6, aisle: "Épicerie" },
  chia: { label: "Graines de chia", kcal: 486, p: 16.5, c: 42.1, f: 30.7, fib: 34.4, aisle: "Épicerie" },
  hummus: { label: "Hummus", kcal: 166, p: 7.9, c: 14.3, f: 9.6, fib: 6, aisle: "Épicerie" },
  sauce: { label: "Sauce tomate", kcal: 29, p: 1.3, c: 5.3, f: 0.2, fib: 1.5, aisle: "Épicerie" },
  huile: { label: "Huile d'olive", kcal: 884, p: 0, c: 0, f: 100, fib: 0, aisle: "Épicerie" },
  miel: { label: "Miel", kcal: 304, p: 0.3, c: 82.4, f: 0, fib: 0, aisle: "Épicerie" },
};

export type Slot = "matin" | "midi" | "collation" | "soir";

export const SLOTS: { key: Slot; label: string; share: number; time: string; when: string }[] = [
  { key: "matin", label: "Petit-déjeuner", share: 0.25, time: "07:30", when: "dans l'heure qui suit le réveil" },
  { key: "midi", label: "Déjeuner", share: 0.35, time: "12:30", when: "4 à 5 h après le petit-déjeuner" },
  { key: "collation", label: "Collation", share: 0.1, time: "16:00", when: "en milieu d'après-midi, ou 1 à 2 h avant l'entraînement" },
  { key: "soir", label: "Dîner", share: 0.3, time: "19:00", when: "2 à 3 h avant le coucher" },
];

export interface Recipe {
  key: string;
  name: string;
  slot: Slot;
  minutes: number;
  /** Ingredient key → grams for one base portion. */
  items: Record<string, number>;
  steps: string;
}

export const RECIPES: Recipe[] = [
  { key: "gruau", name: "Gruau protéiné aux petits fruits", slot: "matin", minutes: 8, items: { avoine: 60, lait: 250, yogourt: 100, fruits: 100, chia: 10 }, steps: "Cuire l'avoine dans le lait 4 min, hors du feu ajouter le yogourt, garnir de fruits et de chia." },
  { key: "omelette", name: "Omelette aux épinards et pain complet", slot: "matin", minutes: 12, items: { oeuf: 150, epinards: 60, poivron: 50, pain: 60, huile: 5 }, steps: "Faire tomber les légumes dans l'huile, ajouter les œufs battus, cuire à feu moyen ; servir avec le pain grillé." },
  { key: "toast", name: "Toast avocat et œufs", slot: "matin", minutes: 10, items: { pain: 70, avocat: 70, oeuf: 100 }, steps: "Écraser l'avocat sur le pain grillé, ajouter deux œufs pochés ou au plat, sel, poivre, citron." },
  { key: "bol-yogourt", name: "Bol de yogourt grec, fruits et amandes", slot: "matin", minutes: 3, items: { yogourt: 200, fruits: 100, amandes: 20, miel: 10 }, steps: "Superposer yogourt, fruits et amandes concassées ; un filet de miel." },
  { key: "bol-quinoa", name: "Bol quinoa, poulet et légumes rôtis", slot: "midi", minutes: 30, items: { quinoa: 150, poulet: 120, brocoli: 100, patatedouce: 100, huile: 10 }, steps: "Rôtir patate douce et brocoli 20 min à 220 °C, griller le poulet, servir sur le quinoa." },
  { key: "salade-pc", name: "Salade de pois chiches et feta", slot: "midi", minutes: 10, items: { poischiches: 150, concombre: 100, tomate: 100, feta: 40, huile: 10 }, steps: "Tout couper en dés, assaisonner d'huile d'olive, citron, origan." },
  { key: "wrap-thon", name: "Wrap au thon et houmous", slot: "midi", minutes: 8, items: { tortilla: 70, thon: 100, hummus: 30, epinards: 30, tomate: 60 }, steps: "Tartiner le houmous, ajouter thon égoutté, épinards et tomates, rouler serré." },
  { key: "bowl-tofu", name: "Bowl de tofu croustillant", slot: "midi", minutes: 25, items: { tofu: 150, riz: 150, carotte: 60, epinards: 40, huile: 10 }, steps: "Dorer le tofu en cubes à la poêle, servir sur le riz avec carottes râpées et épinards." },
  { key: "pomme-arachide", name: "Pomme et beurre d'arachide", slot: "collation", minutes: 2, items: { pomme: 150, arachide: 20 }, steps: "Trancher la pomme, tremper dans le beurre d'arachide." },
  { key: "cottage", name: "Cottage et petits fruits", slot: "collation", minutes: 2, items: { cottage: 150, fruits: 80 }, steps: "Mélanger, c'est prêt." },
  { key: "houmous", name: "Houmous et crudités", slot: "collation", minutes: 5, items: { hummus: 60, carotte: 80, concombre: 80 }, steps: "Couper les légumes en bâtonnets." },
  { key: "banane", name: "Banane et amandes", slot: "collation", minutes: 1, items: { banane: 120, amandes: 15 }, steps: "À emporter partout." },
  { key: "saumon", name: "Saumon, riz brun et haricots verts", slot: "soir", minutes: 25, items: { saumon: 150, riz: 150, haricotsverts: 120, huile: 5 }, steps: "Saumon au four 12 min à 200 °C, haricots à la vapeur 6 min, servir avec le riz." },
  { key: "chili", name: "Chili de lentilles", slot: "soir", minutes: 35, items: { lentilles: 150, haricotsrouges: 100, sauce: 150, poivron: 60, huile: 5 }, steps: "Faire revenir le poivron, ajouter sauce, lentilles et haricots, épices à chili, mijoter 20 min." },
  { key: "bolognaise", name: "Pâtes complètes à la bolognaise maigre", slot: "soir", minutes: 25, items: { pates: 180, boeuf: 100, sauce: 150 }, steps: "Dorer la viande, ajouter la sauce, mijoter 10 min, servir sur les pâtes." },
  { key: "poulet-patate", name: "Poulet, patate douce et brocoli", slot: "soir", minutes: 30, items: { poulet: 140, patatedouce: 200, brocoli: 120, huile: 10 }, steps: "Tout sur une plaque, 25 min à 210 °C, paprika et ail." },
];

export interface Macros {
  kcal: number;
  p: number;
  c: number;
  f: number;
  fib: number;
}

export function macrosOf(items: Record<string, number>): Macros {
  const m = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
  for (const [k, g] of Object.entries(items)) {
    const food = FOODS[k];
    if (!food) continue;
    m.kcal += (food.kcal * g) / 100;
    m.p += (food.p * g) / 100;
    m.c += (food.c * g) / 100;
    m.f += (food.f * g) / 100;
    m.fib += (food.fib * g) / 100;
  }
  return m;
}

/** A recipe scaled so its calories land on a slot's share of the day (within 0.6–1.8×). */
export function portion(recipe: Recipe, kcal: number) {
  const base = macrosOf(recipe.items);
  const k = Math.min(1.8, Math.max(0.6, kcal / base.kcal));
  const items = Object.fromEntries(Object.entries(recipe.items).map(([f, g]) => [f, Math.max(5, Math.round((g * k) / 5) * 5)]));
  return { items, macros: macrosOf(items), factor: k };
}
