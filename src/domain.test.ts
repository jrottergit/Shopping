import { describe, it, expect } from 'vitest';
import {
  initialState,
  addManual,
  planRecipe,
  removeBatch,
  moveItem,
  removeCategory,
  archiveList,
  editItem,
  reorderCategory,
} from './domain';
import { type Recipe, type AppState, uid, parseAmount, itemAmount, stateSchema } from './model';

const recipe = (name = 'Tomatenpasta'): Recipe => ({
  id: uid(),
  name,
  servings: 2,
  minutes: 20,
  favorite: false,
  instructions: '',
  ingredients: [
    { id: uid(), name: 'Tomaten', amount: 250, unit: 'g' },
    { id: uid(), name: 'Salz', amount: null, unit: 'nach Geschmack' },
  ],
});
const prepared = () => {
  const s = initialState();
  const r = recipe();
  s.recipes.push(r);
  return { s, r, listId: s.preferences.activeListId };
};
const valid = (s: AppState) => expect(stateSchema.safeParse(s).success).toBe(true);
describe('Einkaufsbedarf', () => {
  it('skaliert Portionen, normalisiert kg und erhält manuelle Mengen', () => {
    const { s, r, listId } = prepared();
    addManual(s, listId, ' tomaten ', 0.5, 'kg');
    planRecipe(
      s,
      r,
      listId,
      4,
      r.ingredients.map((i) => i.id),
    );
    const tomatoes = s.items.find((i) => i.name.toLowerCase() === 'tomaten')!;
    expect(itemAmount(tomatoes)).toBe('1 kg');
    expect(tomatoes.contributions).toHaveLength(2);
    expect(s.items.find((i) => i.name === 'Salz')!.contributions[0].amount).toBeNull();
    valid(s);
  });
  it('entfernt nur den gewählten Rezeptbeitrag aus zusammengefassten Mengen', () => {
    const { s, r, listId } = prepared();
    const other = recipe('Salat');
    s.recipes.push(other);
    addManual(s, listId, 'Tomaten', 100, 'g');
    const first = planRecipe(s, r, listId, 2, [r.ingredients[0].id]);
    planRecipe(s, other, listId, 2, [other.ingredients[0].id]);
    removeBatch(s, first.id);
    expect(itemAmount(s.items[0])).toBe('350 g');
    expect(s.items[0].contributions).toHaveLength(2);
    valid(s);
  });
  it('vermischt gekaufte Mengen nicht mit neuem Bedarf', () => {
    const { s, r, listId } = prepared();
    const bought = addManual(s, listId, 'Tomaten', 100, 'g');
    bought.checked = true;
    planRecipe(s, r, listId, 2, [r.ingredients[0].id]);
    expect(s.items).toHaveLength(2);
    expect(itemAmount(s.items.find((i) => !i.checked)!)).toBe('250 g');
    valid(s);
  });
  it('rechnet g, Stück und Esslöffel nicht zusammen', () => {
    const s = initialState(),
      id = s.preferences.activeListId;
    addManual(s, id, 'Zucker', 100, 'g');
    addManual(s, id, 'Zucker', 2, 'EL');
    addManual(s, id, 'Zuckerwürfel', 3, 'Stück');
    expect(s.items).toHaveLength(3);
    valid(s);
  });
  it('vereinheitlicht Liter und Milliliter', () => {
    const s = initialState(),
      id = s.preferences.activeListId;
    addManual(s, id, 'Milch', 1, 'l');
    addManual(s, id, 'Milch', 500, 'ml');
    expect(itemAmount(s.items[0])).toBe('1,5 l');
    valid(s);
  });
  it('fasst nur innerhalb derselben Liste zusammen', () => {
    const s = initialState();
    addManual(s, s.lists[0].id, 'Seife', 1, 'Stück');
    addManual(s, s.lists[1].id, 'Seife', 2, 'Stück');
    expect(s.items).toHaveLength(2);
    valid(s);
  });
  it('aktualisiert offene Portionen ohne manuelle Mengen zu entfernen', () => {
    const { s, r, listId } = prepared();
    addManual(s, listId, 'Tomaten', 100, 'g');
    const b = planRecipe(s, r, listId, 2, [r.ingredients[0].id]);
    planRecipe(s, b.recipe, listId, 4, b.selected, b.id);
    expect(itemAmount(s.items[0])).toBe('600 g');
    expect(s.batches).toHaveLength(1);
    valid(s);
  });
  it('behält bereits abgehakte Zutaten bei Portionsänderungen bei', () => {
    const { s, r, listId } = prepared();
    const b = planRecipe(
      s,
      r,
      listId,
      2,
      r.ingredients.map((i) => i.id),
    );
    s.items.find((i) => i.name === 'Tomaten')!.checked = true;
    planRecipe(s, b.recipe, listId, 4, b.selected, b.id);
    expect(s.items.filter((i) => i.name === 'Tomaten')).toHaveLength(1);
    expect(itemAmount(s.items.find((i) => i.name === 'Tomaten')!)).toBe('250 g');
    valid(s);
  });
  it('behält Kategorie und Reihenfolge bei Portionsänderungen bei', () => {
    const { s, r, listId } = prepared();
    const b = planRecipe(s, r, listId, 2, [r.ingredients[0].id]);
    const category = s.lists[0].categories[0].id;
    moveItem(s, s.items[0].id, category);
    addManual(s, listId, 'Zwiebeln', null, '', category);
    const previousPosition = s.items[0].position;
    planRecipe(s, b.recipe, listId, 4, b.selected, b.id);
    const updated = s.items.find((i) => i.name === 'Tomaten')!;
    expect(updated.categoryId).toBe(category);
    expect(updated.position).toBe(previousPosition);
    valid(s);
  });
  it('verschiebt manuelle Artikel zwischen Listen', () => {
    const s = initialState();
    const item = addManual(s, s.lists[0].id, 'Seife', 2, 'Stück');
    editItem(s, item.id, item.name, s.lists[1].unsortedId, item.contributions, s.lists[1].id);
    expect(s.items).toHaveLength(1);
    expect(s.items[0].listId).toBe(s.lists[1].id);
    expect(itemAmount(s.items[0])).toBe('2 Stück');
    valid(s);
  });
  it('verschiebt Rezeptzutaten mit korrekter Herkunft zwischen Listen', () => {
    const { s, r, listId } = prepared();
    const source = planRecipe(
      s,
      r,
      listId,
      2,
      r.ingredients.map((i) => i.id),
    );
    const item = s.items.find((i) => i.name === 'Tomaten')!;
    editItem(s, item.id, item.name, s.lists[1].unsortedId, item.contributions, s.lists[1].id);
    const target = s.batches.find((b) => b.listId === s.lists[1].id)!;
    expect(target.selected).toEqual([r.ingredients[0].id]);
    expect(source.selected).not.toContain(r.ingredients[0].id);
    planRecipe(s, source.recipe, listId, 4, source.selected, source.id);
    expect(s.items.filter((i) => i.name === 'Tomaten')).toHaveLength(1);
    removeBatch(s, target.id);
    expect(s.items.some((i) => i.name === 'Tomaten')).toBe(false);
    valid(s);
  });
  it('speichert Rezeptbedarf unabhängig von späteren Rezeptänderungen', () => {
    const { s, r, listId } = prepared();
    const b = planRecipe(s, r, listId, 2, [r.ingredients[0].id]);
    r.ingredients[0].amount = 900;
    s.recipes = [];
    expect(b.recipe.ingredients[0].amount).toBe(250);
    expect(itemAmount(s.items[0])).toBe('250 g');
    valid(s);
  });
  it('trennt Mengenbeiträge bei Änderung zu unvereinbaren Einheiten', () => {
    const { s, r, listId } = prepared();
    addManual(s, listId, 'Tomaten', 1, 'Stück');
    const b = planRecipe(s, r, listId, 2, [r.ingredients[0].id]);
    const i = s.items.find((i) => i.contributions[0].unit === 'g')!;
    editItem(
      s,
      i.id,
      'Tomaten',
      i.categoryId,
      i.contributions.map((c) => ({ ...c, amount: 2, unit: 'Stück' })),
    );
    expect(s.items).toHaveLength(1);
    expect(itemAmount(s.items[0])).toBe('3 Stück');
    removeBatch(s, b.id);
    expect(itemAmount(s.items[0])).toBe('1 Stück');
    valid(s);
  });
});
describe('Listen und Sortierung', () => {
  it('verschiebt Artikel in eine leere Kategorie und merkt die Zuordnung', () => {
    const s = initialState(),
      l = s.lists[0];
    const i = addManual(s, l.id, 'Handcreme', null);
    const category = l.categories[0];
    moveItem(s, i.id, category.id);
    i.checked = true;
    const next = addManual(s, l.id, 'Handcreme', null);
    expect(next.categoryId).toBe(category.id);
    valid(s);
  });
  it('ordnet Artikel vor und hinter dem Ziel', () => {
    const s = initialState(),
      l = s.lists[0];
    const a = addManual(s, l.id, 'A', null),
      b = addManual(s, l.id, 'B', null),
      c = addManual(s, l.id, 'C', null);
    moveItem(s, c.id, l.unsortedId, a.id);
    expect(c.position).toBeLessThan(a.position);
    moveItem(s, c.id, l.unsortedId, b.id, true);
    expect(c.position).toBeGreaterThan(b.position);
    valid(s);
  });
  it('verschiebt bei Kategorienlöschung Artikel nach Unsortiert', () => {
    const s = initialState(),
      l = s.lists[0];
    const cat = l.categories[0];
    addManual(s, l.id, 'Apfel', 2, 'Stück', cat.id);
    removeCategory(s, l.id, cat.id);
    expect(s.items[0].categoryId).toBe(l.unsortedId);
    expect(() => removeCategory(s, l.id, l.unsortedId)).toThrow();
    valid(s);
  });
  it('sortiert Kategorien nur in der ausgewählten Liste', () => {
    const s = initialState(),
      l = s.lists[0];
    const previous = structuredClone(s.lists[1].categories);
    const first = l.categories[0].id;
    reorderCategory(s, l.id, first, l.categories[2].id);
    expect(l.categories[2].id).toBe(first);
    expect(s.lists[1].categories).toEqual(previous);
    valid(s);
  });
  it('erhält archivierte Daten und mindestens eine aktive Liste', () => {
    const s = initialState(),
      l = s.lists[0];
    addManual(s, l.id, 'Seife', null);
    archiveList(s, l.id);
    expect(s.preferences.activeListId).toBe(s.lists[1].id);
    expect(s.items).toHaveLength(1);
    expect(() => archiveList(s, s.lists[1].id)).toThrow();
    valid(s);
  });
});
describe('Mengeneingabe', () => {
  it('versteht Dezimalkomma und Brüche und weist ungültige Mengen zurück', () => {
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount('1/2')).toBe(0.5);
    expect(parseAmount('')).toBeNull();
    for (const value of ['0', '-1', '1/0', 'abc', 'Infinity'])
      expect(() => parseAmount(value)).toThrow();
  });
});
