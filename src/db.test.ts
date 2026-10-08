import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach } from 'vitest';
import { KorbDatabase, initialize, change, backupText, readBackup, restore } from './db';
import { initialState, addManual, planRecipe, demoRecipes } from './domain';
import { uid } from './model';

const databases: KorbDatabase[] = [];
function database() {
  const db = new KorbDatabase(`test-${uid()}`);
  databases.push(db);
  return db;
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});
describe('Lokale Speicherung und Sicherungen', () => {
  it('behält Änderungen nach erneutem Öffnen der Datenbank', async () => {
    const db = database();
    await initialize(db);
    await change((s) => addManual(s, s.preferences.activeListId, 'Handcreme', null), db);
    db.close();
    await db.open();
    expect((await db.snapshots.get('main'))!.items[0].name).toBe('Handcreme');
  });
  it('verliert bei gleichzeitig gestarteten Änderungen keinen Artikel', async () => {
    const db = database();
    await initialize(db);
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        change((s) => addManual(s, s.preferences.activeListId, `Artikel ${index}`, null), db),
      ),
    );
    expect((await db.snapshots.get('main'))!.items).toHaveLength(20);
  });
  it('rollt eine fehlerhafte Änderung vollständig zurück', async () => {
    const db = database();
    await initialize(db);
    const before = await db.snapshots.get('main');
    await expect(
      change((s) => {
        addManual(s, s.preferences.activeListId, 'Seife', null);
        s.preferences.activeListId = 'fehlt';
      }, db),
    ).rejects.toThrow();
    expect(await db.snapshots.get('main')).toEqual(before);
  });
  it('stellt Rezepte, Bedarf, Kategorien, Reihenfolge und erledigte Artikel vollständig wieder her', async () => {
    const db = database(),
      s = initialState();
    s.recipes = demoRecipes();
    addManual(s, s.preferences.activeListId, 'Handcreme', null);
    planRecipe(
      s,
      s.recipes[0],
      s.preferences.activeListId,
      4,
      s.recipes[0].ingredients.map((i) => i.id),
    );
    s.items[0].checked = true;
    s.lists[0].categories.reverse();
    s.preferences.theme = 'dark';
    const restored = readBackup(backupText(s));
    await initialize(db);
    await restore(restored, db);
    expect(await db.snapshots.get('main')).toEqual(s);
  });
  it('weist fehlerhafte Daten und ungültige Referenzen zurück', async () => {
    const db = database();
    await initialize(db);
    const before = await db.snapshots.get('main');
    for (const content of ['{', '{}', JSON.stringify({ app: 'Korb', format: 2, data: before })])
      expect(() => readBackup(content)).toThrow();
    const broken = structuredClone(before!);
    addManual(broken, broken.preferences.activeListId, 'Seife', null);
    broken.items[0].categoryId = 'fehlt';
    expect(() => readBackup(backupText(broken))).toThrow();
    await expect(restore(broken, db)).rejects.toThrow();
    expect(await db.snapshots.get('main')).toEqual(before);
  });
  it('weist doppelte Beitrags-IDs und unvereinbare Einheiten zurück', () => {
    const s = initialState();
    const i = addManual(s, s.preferences.activeListId, 'Zucker', 100, 'g');
    i.contributions.push({ ...i.contributions[0] });
    expect(() => readBackup(backupText(s))).toThrow();
    i.contributions[1].id = uid();
    i.contributions[1].unit = 'EL';
    expect(() => readBackup(backupText(s))).toThrow();
  });
});
