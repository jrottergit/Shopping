import {
  uid,
  type AppState,
  type ShoppingList,
  type Contribution,
  type Recipe,
  type Ingredient,
  type Unit,
  type ShoppingItem,
  type Batch,
} from './model';

const supermarket = [
  'Obst & Gemüse',
  'Brot & Backwaren',
  'Kühlregal',
  'Vorrat',
  'Getränke',
  'Haushalt',
];
const drugstore = ['Körperpflege', 'Gesicht & Kosmetik', 'Haushalt', 'Gesundheit'];
export const normalizeName = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
export function newList(name: string, names = supermarket): ShoppingList {
  if (!name.trim()) throw new Error('Bitte einen Listennamen eingeben.');
  const unsortedId = uid();
  return {
    id: uid(),
    name: name.trim(),
    archived: false,
    unsortedId,
    categories: [
      ...names.map((name) => ({ id: uid(), name, collapsed: false })),
      { id: unsortedId, name: 'Unsortiert', collapsed: false },
    ],
  };
}
export function initialState(): AppState {
  const lists = [newList('Supermarkt'), newList('Drogerie', drugstore)];
  return {
    id: 'main',
    schemaVersion: 1,
    lists,
    recipes: [],
    items: [],
    batches: [],
    preferences: { activeListId: lists[0].id, theme: 'system' },
  };
}
export function getList(s: AppState, id: string): ShoppingList {
  const list = s.lists.find((l) => l.id === id);
  if (!list) throw new Error('Diese Liste existiert nicht mehr.');
  return list;
}
function canonical(c: Contribution): Contribution {
  if (c.unit === 'kg')
    return { ...c, amount: c.amount === null ? null : c.amount * 1000, unit: 'g' };
  if (c.unit === 'l')
    return { ...c, amount: c.amount === null ? null : c.amount * 1000, unit: 'ml' };
  return c;
}
export function addContribution(
  s: AppState,
  listId: string,
  name: string,
  c: Contribution,
  categoryId?: string,
  checked = false,
): ShoppingItem {
  name = name.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Bitte einen Artikelnamen eingeben.');
  const list = getList(s, listId);
  const contribution = canonical(c);
  const existing = s.items.find(
    (i) =>
      i.listId === listId &&
      i.checked === checked &&
      normalizeName(i.name) === normalizeName(name) &&
      i.contributions[0].unit === contribution.unit,
  );
  if (existing) {
    existing.contributions.push(contribution);
    list.categories.find((c) => c.id === existing.categoryId)!.collapsed = false;
    return existing;
  }
  const remembered = [...s.items]
    .reverse()
    .find((i) => i.listId === listId && normalizeName(i.name) === normalizeName(name))?.categoryId;
  const chosen = categoryId ?? remembered ?? list.unsortedId;
  const cat = list.categories.some((c) => c.id === chosen) ? chosen : list.unsortedId;
  const inCategory = s.items.filter((i) => i.listId === listId && i.categoryId === cat);
  const item: ShoppingItem = {
    id: uid(),
    listId,
    categoryId: cat,
    name,
    checked,
    position: Math.max(-1, ...inCategory.map((i) => i.position)) + 1,
    contributions: [contribution],
  };
  s.items.push(item);
  list.categories.find((c) => c.id === cat)!.collapsed = false;
  return item;
}
export function addManual(
  s: AppState,
  listId: string,
  name: string,
  amount: number | null,
  unit: Unit = '',
  categoryId?: string,
) {
  return addContribution(s, listId, name, { id: uid(), kind: 'manual', amount, unit }, categoryId);
}
export function sortedItems(s: AppState, listId: string, categoryId?: string) {
  return s.items
    .filter((i) => i.listId === listId && (!categoryId || i.categoryId === categoryId))
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}
export function moveItem(
  s: AppState,
  itemId: string,
  categoryId: string,
  targetId?: string,
  after = false,
) {
  const item = s.items.find((i) => i.id === itemId);
  if (!item) return;
  const list = getList(s, item.listId);
  if (!list.categories.some((c) => c.id === categoryId))
    throw new Error('Kategorie nicht gefunden.');
  const target = sortedItems(s, item.listId, categoryId).filter((i) => i.id !== itemId);
  const index = targetId ? target.findIndex((i) => i.id === targetId) : -1;
  target.splice(index < 0 ? target.length : index + Number(after), 0, item);
  item.categoryId = categoryId;
  target.forEach((i, position) => {
    i.position = position;
  });
}
export function reorderCategory(s: AppState, listId: string, activeId: string, targetId: string) {
  const list = getList(s, listId);
  const from = list.categories.findIndex((c) => c.id === activeId);
  const to = list.categories.findIndex((c) => c.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  list.categories.splice(to, 0, list.categories.splice(from, 1)[0]);
}
export function removeCategory(s: AppState, listId: string, categoryId: string) {
  const list = getList(s, listId);
  if (categoryId === list.unsortedId)
    throw new Error('Unsortiert bleibt als Auffangkategorie erhalten.');
  for (const item of sortedItems(s, listId, categoryId)) moveItem(s, item.id, list.unsortedId);
  list.categories = list.categories.filter((c) => c.id !== categoryId);
}
export function archiveList(s: AppState, listId: string) {
  if (s.lists.filter((l) => !l.archived).length <= 1)
    throw new Error('Mindestens eine aktive Liste bleibt erhalten.');
  getList(s, listId).archived = true;
  if (s.preferences.activeListId === listId)
    s.preferences.activeListId = s.lists.find((l) => !l.archived)!.id;
}
export function removeBatch(s: AppState, batchId: string, openOnly = false) {
  s.items.forEach((i) => {
    if (!openOnly || !i.checked)
      i.contributions = i.contributions.filter((c) => c.batchId !== batchId);
  });
  s.items = s.items.filter((i) => i.contributions.length);
  if (!openOnly) s.batches = s.batches.filter((b) => b.id !== batchId);
}
export function planRecipe(
  s: AppState,
  recipe: Recipe,
  listId: string,
  servings: number,
  selected: string[],
  replaceBatchId?: string,
): Batch {
  getList(s, listId);
  if (servings <= 0 || !Number.isFinite(servings) || servings > 1000)
    throw new Error('Bitte eine gültige Portionszahl eingeben.');
  const bought = new Set<string>();
  const layout = new Map<string, { categoryId: string; position: number; name: string }>();
  if (replaceBatchId) {
    const old = s.batches.find((b) => b.id === replaceBatchId && b.listId === listId);
    if (!old) throw new Error('Der geplante Rezeptbedarf existiert nicht mehr.');
    s.items
      .filter((i) => i.checked)
      .forEach((i) =>
        i.contributions
          .filter((c) => c.batchId === replaceBatchId)
          .forEach((c) => bought.add(c.ingredientId!)),
      );
    s.items
      .filter((i) => !i.checked)
      .forEach((i) =>
        i.contributions
          .filter((c) => c.batchId === replaceBatchId)
          .forEach((c) =>
            layout.set(c.ingredientId!, {
              categoryId: i.categoryId,
              position: i.position,
              name: i.name,
            }),
          ),
      );
    removeBatch(s, replaceBatchId, true);
  }
  const original = s.batches.find((b) => b.id === replaceBatchId);
  const batch: Batch = {
    id: replaceBatchId ?? uid(),
    listId,
    recipe: structuredClone(recipe),
    servings,
    selected: [...selected],
    ...(original?.originBatchId ? { originBatchId: original.originBatchId } : {}),
  };
  const previous = s.batches.findIndex((b) => b.id === batch.id);
  if (previous >= 0) s.batches[previous] = batch;
  else s.batches.push(batch);
  for (const ingredient of recipe.ingredients.filter(
    (i) => selected.includes(i.id) && !bought.has(i.id),
  )) {
    const previousLayout = layout.get(ingredient.id);
    const item = addContribution(
      s,
      listId,
      previousLayout?.name ?? ingredient.name,
      {
        id: uid(),
        kind: 'recipe',
        amount:
          ingredient.amount === null ? null : (ingredient.amount * servings) / recipe.servings,
        unit: ingredient.unit,
        batchId: batch.id,
        ingredientId: ingredient.id,
        recipeName: recipe.name,
      },
      previousLayout?.categoryId,
    );
    if (previousLayout && item.contributions.length === 1) item.position = previousLayout.position;
  }
  return batch;
}
export function editItem(
  s: AppState,
  itemId: string,
  name: string,
  categoryId: string,
  edited: Contribution[],
  targetListId?: string,
) {
  const old = s.items.find((i) => i.id === itemId);
  if (!old) throw new Error('Artikel nicht gefunden.');
  const previous = structuredClone(old);
  const destination = targetListId ?? previous.listId;
  getList(s, destination);
  s.items = s.items.filter((i) => i.id !== itemId);
  for (const contribution of edited) {
    let moved = contribution;
    if (destination !== previous.listId && contribution.kind === 'recipe') {
      const source = s.batches.find((b) => b.id === contribution.batchId)!;
      const origin = source.originBatchId ?? source.id;
      let target = s.batches.find(
        (b) => b.listId === destination && (b.originBatchId ?? b.id) === origin,
      );
      if (!target) {
        target = {
          ...structuredClone(source),
          id: uid(),
          listId: destination,
          selected: [],
          originBatchId: origin,
        };
        s.batches.push(target);
      }
      if (!target.selected.includes(contribution.ingredientId!))
        target.selected.push(contribution.ingredientId!);
      moved = { ...contribution, batchId: target.id };
      if (
        !s.items.some((i) =>
          i.contributions.some(
            (c) => c.batchId === source.id && c.ingredientId === contribution.ingredientId,
          ),
        )
      )
        source.selected = source.selected.filter((id) => id !== contribution.ingredientId);
    }
    const entry = addContribution(s, destination, name, moved, categoryId, previous.checked);
    if (entry.contributions.length === 1 && destination === previous.listId)
      entry.position = previous.position;
  }
  s.batches = s.batches.filter((b) =>
    s.items.some((i) => i.contributions.some((c) => c.batchId === b.id)),
  );
}
export function demoRecipes(): Recipe[] {
  const make = (
    name: string,
    servings: number,
    minutes: number,
    ingredients: [string, number | null, Unit][],
    instructions: string,
  ): Recipe => ({
    id: uid(),
    name,
    servings,
    minutes,
    favorite: false,
    instructions,
    ingredients: ingredients.map(([name, amount, unit]): Ingredient => ({
      id: uid(),
      name,
      amount,
      unit,
    })),
  });
  return [
    make(
      'Pasta mit Tomaten & Feta',
      2,
      25,
      [
        ['Pasta', 200, 'g'],
        ['Tomaten', 400, 'g'],
        ['Feta', 150, 'g'],
        ['Olivenöl', 2, 'EL'],
        ['Basilikum', null, 'nach Geschmack'],
      ],
      '1. Pasta in Salzwasser kochen.\n2. Tomaten schneiden und mit Olivenöl in einer Pfanne anbraten.\n3. Feta dazugeben, Pasta unterheben und mit Basilikum servieren.',
    ),
    make(
      'Knuspriger Ofengemüse-Teller',
      2,
      40,
      [
        ['Kartoffeln', 500, 'g'],
        ['Karotten', 300, 'g'],
        ['Zucchini', 1, 'Stück'],
        ['Olivenöl', 2, 'EL'],
        ['Joghurt', 150, 'g'],
      ],
      '1. Ofen auf 200 °C vorheizen.\n2. Gemüse schneiden, mit Öl und Gewürzen vermischen.\n3. Auf einem Blech etwa 30 Minuten backen. Mit Joghurt servieren.',
    ),
    make(
      'Overnight Oats',
      1,
      5,
      [
        ['Haferflocken', 50, 'g'],
        ['Milch', 150, 'ml'],
        ['Joghurt', 100, 'g'],
        ['Banane', 1, 'Stück'],
      ],
      '1. Haferflocken, Milch und Joghurt verrühren.\n2. Über Nacht abgedeckt im Kühlschrank ziehen lassen.\n3. Am Morgen mit Banane ergänzen.',
    ),
  ];
}
