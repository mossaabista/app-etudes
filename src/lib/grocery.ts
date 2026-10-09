/** Shared by the Courses section and the assistant ("ajoute du lait et des pommes"). */

// A first guess at the aisle from the item's name; the select corrects it.
const GUESS: [RegExp, string][] = [
  [/pomme|banane|orange|citron|fraise|bleuet|raisin|tomate|salade|laitue|carotte|oignon|ail|poivron|brocoli|épinard|concombre|courgette|patate|avocat|champignon|légume|fruit|herbe|persil|coriandre/i, "Fruits & légumes"],
  [/pain|baguette|croissant|tortilla|pita|bagel|brioche/i, "Boulangerie"],
  [/lait|yogourt|yaourt|fromage|beurre|crème|œuf|oeuf|feta|mozzarella|cheddar/i, "Produits laitiers"],
  [/poulet|bœuf|boeuf|viande|steak|dinde|agneau|saumon|thon|poisson|crevette|haché/i, "Viandes & poissons"],
  [/riz|pâte|farine|sucre|sel|huile|vinaigre|conserve|lentille|pois|haricot|quinoa|avoine|céréale|épice|sauce|miel|café|thé|noix|amande/i, "Épicerie"],
  [/surgelé|congelé|glace|crème glacée/i, "Surgelés"],
  [/eau|jus|soda|boisson|lait d'avoine/i, "Boissons"],
  [/savon|shampo|dentifrice|papier|lessive|détergent|éponge|sac poubelle|mouchoir/i, "Hygiène & maison"],
];
export const guessAisle = (name: string) => GUESS.find(([re]) => re.test(name))?.[1] ?? "Épicerie";
