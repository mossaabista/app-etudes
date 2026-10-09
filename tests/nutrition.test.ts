import { describe, expect, it } from "vitest";
import { FOODS, NO_PREFS, RECIPES, SLOTS, dayMenu, foodConflict, recipeAllowed, sanitizeFoodPrefs, shoppingList, weekMenu, type FoodPrefs } from "@/lib/nutrition";

const prefs = (p: Partial<FoodPrefs>): FoodPrefs => ({ ...NO_PREFS, ...p });
const foodsOf = (days: ReturnType<typeof weekMenu>) => new Set(days.flatMap((d) => d.meals.flatMap((m) => Object.keys(m.items))));

describe("nutrition restrictions", () => {
  it("every recipe is built from known foods", () => {
    for (const r of RECIPES) for (const f of Object.keys(r.items)) expect(FOODS[f], `${r.key}: ${f}`).toBeDefined();
  });

  it("keeps only what it understands from stored preferences", () => {
    expect(sanitizeFoodPrefs({ diet: "carnivore", allergens: ["arachides", "kryptonite"], avoid: ["tofu", "pizza", 3] })).toEqual({ diet: "omnivore", allergens: ["arachides"], avoid: ["tofu"] });
    expect(sanitizeFoodPrefs(null)).toEqual(NO_PREFS);
  });

  it("explains why a food is ruled out", () => {
    expect(foodConflict("arachide", prefs({ allergens: ["arachides"] }))).toMatch(/allergie : arachides/);
    expect(foodConflict("avoine", prefs({ allergens: ["gluten"] }))).toMatch(/gluten/);
    expect(foodConflict("miel", prefs({ diet: "vegetalien" }))).toMatch(/végétalien/);
    expect(foodConflict("saumon", prefs({ diet: "pescetarien" }))).toBeNull();
    expect(foodConflict("brocoli", prefs({ avoid: ["brocoli"] }))).toMatch(/ne veux pas/);
  });

  it("never puts an allergen in a whole week of menus", () => {
    const p = prefs({ allergens: ["arachides", "noix", "lait"] });
    const week = weekMenu("2026-10-12", 2200, p);
    expect(week).toHaveLength(7);
    for (const f of foodsOf(week)) expect(foodConflict(f, p), f).toBeNull();
    expect(foodsOf(week).has("arachide")).toBe(false);
    expect(foodsOf(week).has("yogourt")).toBe(false);
  });

  it("respects a vegan diet, and leaves a meal empty rather than break a restriction", () => {
    const vegan = prefs({ diet: "vegetalien" });
    for (const d of weekMenu("2026-10-12", 2000, vegan)) for (const m of d.meals) expect(m.recipe && recipeAllowed(m.recipe, vegan)).toBe(true);
    // Vegan, no gluten and no soy: no breakfast in the library fits.
    const strict = prefs({ diet: "vegetalien", allergens: ["gluten", "soja"] });
    const breakfast = dayMenu("2026-10-12", 2000, strict).find((m) => m.slot.key === "matin")!;
    expect(breakfast.recipe).toBeNull();
    expect(breakfast.items).toEqual({});
  });

  it("varies the menu across the week and sizes portions to the calories", () => {
    const week = weekMenu("2026-10-12", 2400, NO_PREFS);
    expect(new Set(week.map((d) => d.meals[0].recipe!.key)).size).toBeGreaterThan(3);
    const day = week[0].meals.reduce((s, m) => s + m.macros.kcal, 0);
    expect(day).toBeGreaterThan(2400 * 0.75);
    expect(day).toBeLessThan(2400 * 1.25);
    expect(week.map((d) => d.day)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
  });

  it("adds the week's groceries up per food, rounded up, sorted by aisle", () => {
    const week = weekMenu("2026-10-12", 2000, NO_PREFS);
    const list = shoppingList(week);
    const raw = week.flatMap((d) => d.meals).reduce((s, m) => s + (m.items.huile ?? 0), 0);
    const oil = list.find((i) => i.food === "huile")!;
    expect(oil.grams).toBeGreaterThanOrEqual(raw);
    expect(oil.grams % 50).toBe(0);
    expect(new Set(list.map((i) => i.food)).size).toBe(list.length);
    const aisles = list.map((i) => i.aisle);
    expect(aisles).toEqual([...aisles].sort((a, b) => a.localeCompare(b, "fr")));
    expect(SLOTS).toHaveLength(4);
  });
});
