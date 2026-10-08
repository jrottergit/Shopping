import { z } from 'zod';

export const units = [
  '',
  'g',
  'kg',
  'ml',
  'l',
  'Stück',
  'TL',
  'EL',
  'Bund',
  'Prise',
  'Packung',
  'Dose',
  'Flasche',
  'nach Geschmack',
] as const;
export type Unit = (typeof units)[number];
const id = z.string().min(1).max(150);
const text = z.string().trim().min(1).max(150);
const quantity = z.number().finite().positive().max(1e9).nullable();
const unit = z.enum(units);
export const ingredientSchema = z.object({ id, name: text, amount: quantity, unit });
export const recipeSchema = z.object({
  id,
  name: text,
  servings: z.number().finite().positive().max(1000),
  minutes: z.number().int().min(0).max(10000),
  instructions: z.string().max(50000),
  ingredients: z.array(ingredientSchema).min(1).max(300),
  favorite: z.boolean(),
});
const categorySchema = z.object({ id, name: text, collapsed: z.boolean() });
const listSchema = z.object({
  id,
  name: text,
  archived: z.boolean(),
  categories: z.array(categorySchema).min(1).max(100),
  unsortedId: id,
});
const contributionSchema = z.object({
  id,
  kind: z.enum(['manual', 'recipe']),
  amount: quantity,
  unit,
  batchId: id.optional(),
  ingredientId: id.optional(),
  recipeName: text.optional(),
});
const itemSchema = z.object({
  id,
  listId: id,
  categoryId: id,
  name: text,
  checked: z.boolean(),
  position: z.number().int().min(0),
  contributions: z.array(contributionSchema).min(1).max(1000),
});
const batchSchema = z.object({
  id,
  listId: id,
  recipe: recipeSchema,
  servings: z.number().finite().positive().max(1000),
  selected: z.array(id).max(300),
  originBatchId: id.optional(),
});
export const stateSchema = z
  .object({
    id: z.literal('main'),
    schemaVersion: z.literal(1),
    lists: z.array(listSchema).min(1).max(100),
    recipes: z.array(recipeSchema).max(2000),
    items: z.array(itemSchema).max(20000),
    batches: z.array(batchSchema).max(2000),
    preferences: z.object({ activeListId: id, theme: z.enum(['system', 'light', 'dark']) }),
  })
  .superRefine((s, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const unique = (values: string[]) => new Set(values).size === values.length;
    if (
      !unique(s.lists.map((l) => l.id)) ||
      !unique(s.recipes.map((r) => r.id)) ||
      !unique(s.items.map((i) => i.id)) ||
      !unique(s.batches.map((b) => b.id))
    )
      fail('Doppelte IDs.');
    const lists = new Map(s.lists.map((l) => [l.id, l]));
    if (!s.lists.some((l) => l.id === s.preferences.activeListId && !l.archived))
      fail('Aktive Liste fehlt.');
    for (const l of s.lists) {
      if (
        !unique(l.categories.map((c) => c.id)) ||
        !l.categories.some((c) => c.id === l.unsortedId)
      )
        fail('Ungültige Kategorien.');
    }
    for (const r of [...s.recipes, ...s.batches.map((b) => b.recipe)])
      if (!unique(r.ingredients.map((i) => i.id))) fail('Doppelte Zutaten.');
    const batches = new Map(s.batches.map((b) => [b.id, b]));
    const contributionIds: string[] = [];
    for (const b of s.batches) {
      if (
        !lists.has(b.listId) ||
        !unique(b.selected) ||
        b.selected.some((i) => !b.recipe.ingredients.some((r) => r.id === i))
      )
        fail('Ungültiger Rezeptbedarf.');
    }
    for (const i of s.items) {
      if (!lists.get(i.listId)?.categories.some((c) => c.id === i.categoryId))
        fail('Artikel ohne gültige Liste oder Kategorie.');
      if (
        i.contributions.some(
          (c) => c.unit !== i.contributions[0].unit || c.unit === 'kg' || c.unit === 'l',
        )
      )
        fail('Unvereinbare Einheiten.');
      for (const c of i.contributions) {
        contributionIds.push(c.id);
        if (c.kind === 'recipe') {
          const b = batches.get(c.batchId ?? '');
          if (
            !b ||
            b.listId !== i.listId ||
            !b.recipe.ingredients.some((r) => r.id === c.ingredientId) ||
            !c.recipeName
          )
            fail('Ungültige Rezeptzuordnung.');
        } else if (c.batchId || c.ingredientId || c.recipeName)
          fail('Ungültiger manueller Artikel.');
      }
    }
    if (!unique(contributionIds)) fail('Doppelte Mengenbeiträge.');
  });

export type Ingredient = z.infer<typeof ingredientSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type ShoppingList = z.infer<typeof listSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Contribution = z.infer<typeof contributionSchema>;
export type ShoppingItem = z.infer<typeof itemSchema>;
export type Batch = z.infer<typeof batchSchema>;
export type AppState = z.infer<typeof stateSchema>;
export const uid = () => crypto.randomUUID();

export function parseAmount(value: string): number | null {
  const v = value.trim().replace(',', '.');
  if (!v) return null;
  const match = v.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  const n = match ? Number(match[1]) / Number(match[2]) : Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1e9)
    throw new Error('Bitte eine positive Menge eingeben, z. B. 1,5 oder 1/2.');
  return n;
}
export const numberText = (n: number) =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 }).format(n);
export function amountText(amount: number | null, u: Unit): string {
  if (amount === null) return u === 'nach Geschmack' ? u : u ? `nach Bedarf · ${u}` : '';
  if (u === 'g' && amount >= 1000) return `${numberText(amount / 1000)} kg`;
  if (u === 'ml' && amount >= 1000) return `${numberText(amount / 1000)} l`;
  return `${numberText(amount)}${u ? ` ${u}` : ''}`;
}
export function itemAmount(i: ShoppingItem): string {
  const amounts = i.contributions.filter((c) => c.amount !== null).map((c) => c.amount!);
  const known = amounts.length ? amounts.reduce((a, b) => a + b, 0) : null;
  const result = amountText(known, i.contributions[0].unit);
  return known !== null && amounts.length < i.contributions.length
    ? `${result} + nach Bedarf`
    : result;
}
