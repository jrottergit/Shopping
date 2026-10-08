import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function add(page: Page, name: string) {
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Artikel hinzufügen', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Artikel hinzufügen', exact: true }).click();
  await expect(page.locator('.item-name').filter({ hasText: name })).toBeVisible();
}
async function gestureDrag(
  page: Page,
  handle: Locator,
  target: () => Locator,
  touch: boolean,
  pauseAtTarget = 0,
) {
  const box = (await handle.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = touch ? await page.context().newCDPSession(page) : undefined;
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await page.waitForTimeout(240);
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 8, start.y, { steps: 3 });
  }
  await expect(target()).toBeVisible();
  const destination = (await target().boundingBox())!;
  const end = {
    x: destination.x + destination.width / 2,
    y: destination.y + Math.min(15, destination.height / 2),
  };
  for (let step = 1; step <= 12; step++) {
    const point = {
      x: start.x + ((end.x - start.x) * step) / 12,
      y: start.y + ((end.y - start.y) * step) / 12,
    };
    if (cdp)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    else await page.mouse.move(point.x, point.y);
  }
  if (pauseAtTarget) await page.waitForTimeout(pauseAtTarget);
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else await page.mouse.up();
}
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Supermarkt', exact: true })).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});
test('Artikel, Kategorien und aktive Liste bleiben nach Neustart erhalten', async ({ page }) => {
  await add(page, 'Handcreme');
  await page.getByRole('button', { name: 'Handcreme bearbeiten' }).click();
  await page.getByLabel('Kategorie', { exact: true }).selectOption({ label: 'Haushalt' });
  await page.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(page.locator('.category-section').filter({ hasText: 'Haushalt' })).toContainText(
    'Handcreme',
  );
  await page.reload();
  await expect(page.locator('.category-section').filter({ hasText: 'Haushalt' })).toContainText(
    'Handcreme',
  );
  await page.getByRole('checkbox', { name: 'Handcreme abhaken' }).click();
  await expect(page.getByRole('button', { name: /Erledigt 1/ })).toBeVisible();
  await page
    .getByRole('button', { name: 'Supermarkt: Einkaufsliste wechseln', exact: true })
    .click();
  await page.getByRole('button', { name: /Drogerie 0 Artikel offen/ }).click();
  await add(page, 'Shampoo');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Drogerie', exact: true })).toBeVisible();
  await expect(page.locator('.item-name')).toHaveText('Shampoo');
});
test('Rezepte lassen sich manuell anlegen, skalieren und in die Liste übernehmen', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Rezepte', exact: true }).click();
  await page.getByRole('button', { name: 'Rezept anlegen', exact: true }).click();
  await page.getByLabel('Rezeptname', { exact: true }).fill('Mein Tomatensalat');
  await page.getByLabel('Zutat 1', { exact: true }).fill('Tomaten');
  await page.getByLabel('Menge Zutat 1', { exact: true }).fill('250');
  await page.getByRole('button', { name: 'Rezept speichern' }).click();
  await expect(page.getByRole('heading', { name: 'Mein Tomatensalat' })).toBeVisible();
  await page.getByRole('button', { name: /Mein Tomatensalat.*2 Portionen.*1 Zutaten/ }).click();
  await page.getByRole('button', { name: 'Zum Einkauf hinzufügen', exact: true }).click();
  await page.getByRole('textbox', { name: 'Portionen Mein Tomatensalat', exact: true }).fill('4');
  await page.getByRole('button', { name: '1 Zutaten hinzufügen' }).click();
  await expect(page.locator('.item-row').filter({ hasText: 'Tomaten' })).toContainText('500 g');
  await page.reload();
  await expect(page.locator('.item-row').filter({ hasText: 'Tomaten' })).toContainText('500 g');
});
test('Mehrere Rezepte werden gemeinsam mit Mengen pro Rezept geplant', async ({ page }) => {
  await page.getByRole('link', { name: 'Rezepte', exact: true }).click();
  await page.getByRole('button', { name: 'Mit Beispielrezepten ausprobieren' }).click();
  await page
    .getByRole('button', { name: 'Knuspriger Ofengemüse-Teller auswählen', exact: true })
    .click();
  await page.getByRole('button', { name: 'Overnight Oats auswählen', exact: true }).click();
  await page.getByRole('button', { name: 'Zum Einkauf', exact: true }).click();
  await page.getByRole('textbox', { name: 'Portionen Overnight Oats', exact: true }).fill('2');
  await page.getByRole('button', { name: '9 Zutaten hinzufügen' }).click();
  await expect(page.locator('.item-row').filter({ hasText: 'Joghurt' })).toContainText('350 g');
  await expect(page.locator('.item-row').filter({ hasText: 'Joghurt' })).toContainText('2 Rezepte');
});
test('Eine Sicherung lässt sich wiederherstellen; fehlerhafte Dateien ändern nichts', async ({
  page,
}) => {
  await add(page, 'Seife');
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sicherung exportieren' }).click();
  const download = await downloaded;
  const content = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(content).data.items[0].name).toBe('Seife');
  await page.getByLabel('Sicherungsdatei auswählen').setInputFiles({
    name: 'kaputt.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{kaputt'),
  });
  await expect(page.getByRole('status', { name: 'Hinweis', exact: true })).toContainText(
    'keine gültige Sicherung',
  );
  await page.getByRole('button', { name: 'Schließen', exact: true }).click();
  await add(page, 'Shampoo');
  await page.getByLabel('Sicherungsdatei auswählen').setInputFiles({
    name: 'korb.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });
  await page.getByRole('button', { name: 'Daten ersetzen und wiederherstellen' }).click();
  await expect(page.locator('.item-name')).toHaveCount(1);
  await expect(page.locator('.item-name')).toHaveText('Seife');
});
test('Offline-Kaltstart erhält Daten und erlaubt neue Artikel', async ({ page, context }) => {
  await add(page, 'Bananen');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.item-name')).toHaveText('Bananen');
  await add(page, 'Äpfel');
  await page.reload();
  await expect(page.locator('.item-name')).toHaveCount(2);
  await context.setOffline(false);
});
test('Drag & Drop verschiebt Artikel in eine leere Kategorie', async ({ page }, info) => {
  await add(page, 'Tomaten');
  await add(page, 'Zwiebeln');
  const handle = page.getByRole('button', { name: 'Tomaten verschieben', exact: true });
  const box = (await handle.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const touch = info.project.name === 'mobile-touch';
  const cdp = touch ? await page.context().newCDPSession(page) : undefined;
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await page.waitForTimeout(240);
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 8, start.y, { steps: 3 });
  }
  const destination = page.locator('.category-heading').filter({ hasText: 'Obst & Gemüse' });
  await expect(destination).toBeVisible();
  const target = (await destination.boundingBox())!;
  const end = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  for (let step = 1; step <= 12; step++) {
    const position = {
      x: start.x + ((end.x - start.x) * step) / 12,
      y: start.y + ((end.y - start.y) * step) / 12,
    };
    if (cdp)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [position] });
    else await page.mouse.move(position.x, position.y);
  }
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else await page.mouse.up();
  const category = page
    .locator('.category-section')
    .filter({ has: page.locator('.category-title').filter({ hasText: 'Obst & Gemüse' }) });
  await expect(category.locator('.item-name')).toHaveText('Tomaten');
  await page.reload();
  await expect(category.locator('.item-name')).toHaveText('Tomaten');
});
test('Mobiles Layout bleibt innerhalb des Bildschirms', async ({ page }, info) => {
  await add(page, 'Eine besonders lange Bezeichnung für Handcreme');
  await page.getByRole('button', { name: 'Kategorien', exact: true }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.getByRole('button', { name: 'Schließen', exact: true }).click();
  await page.screenshot({ path: `work/review-${info.project.name}.png`, fullPage: true });
});
test('Drag & Drop ordnet Artikel und Kategorien dauerhaft neu', async ({ page }, info) => {
  await add(page, 'A');
  await add(page, 'B');
  await add(page, 'C');
  await gestureDrag(
    page,
    page.getByRole('button', { name: 'C verschieben', exact: true }),
    () => page.locator('.sortable-item[data-item-name="A"]'),
    info.project.name === 'mobile-touch',
  );
  await expect(page.locator('.categories .item-name')).toHaveText(['C', 'A', 'B']);
  await page.reload();
  await expect(page.locator('.categories .item-name')).toHaveText(['C', 'A', 'B']);
  await page.getByRole('button', { name: 'Kategorien', exact: true }).click();
  await gestureDrag(
    page,
    page.getByRole('button', { name: 'Kühlregal verschieben', exact: true }),
    () =>
      page
        .locator('.category-editor-row')
        .filter({ has: page.getByRole('textbox', { name: 'Name Obst & Gemüse', exact: true }) }),
    info.project.name === 'mobile-touch',
  );
  await expect(page.locator('.category-editor-row input').first()).toHaveValue('Kühlregal');
  await page.getByRole('button', { name: 'Schließen', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Kategorien', exact: true }).click();
  await expect(page.locator('.category-editor-row input').first()).toHaveValue('Kühlregal');
});
test('Artikel können zwischen Listen verschoben werden', async ({ page }) => {
  await add(page, 'Handcreme');
  await page.getByRole('button', { name: 'Handcreme bearbeiten', exact: true }).click();
  await page.getByLabel('Einkaufsliste', { exact: true }).selectOption({ label: 'Drogerie' });
  await page.getByLabel('Kategorie', { exact: true }).selectOption({ label: 'Körperpflege' });
  await page.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Drogerie', exact: true })).toBeVisible();
  await expect(page.locator('.category-section').filter({ hasText: 'Körperpflege' })).toContainText(
    'Handcreme',
  );
  await page.getByRole('button', { name: 'Drogerie: Einkaufsliste wechseln', exact: true }).click();
  await page.getByRole('button', { name: /Supermarkt 0 Artikel offen/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.item-name')).toHaveCount(0);
});
test('Zugeklappte Kategorien öffnen sich beim Ziehen', async ({ page }, info) => {
  await add(page, 'Äpfel');
  await page.getByRole('button', { name: 'Äpfel bearbeiten', exact: true }).click();
  await page.getByLabel('Kategorie', { exact: true }).selectOption({ label: 'Obst & Gemüse' });
  await page.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await add(page, 'Tomaten');
  await page.getByRole('button', { name: 'Obst & Gemüse 1', exact: true }).click();
  await gestureDrag(
    page,
    page.getByRole('button', { name: 'Tomaten verschieben', exact: true }),
    () => page.locator('.category-heading').filter({ hasText: 'Obst & Gemüse' }),
    info.project.name === 'mobile-touch',
    600,
  );
  const category = page
    .locator('.category-section')
    .filter({ has: page.locator('.category-title').filter({ hasText: 'Obst & Gemüse' }) });
  await expect(category.locator('.item-name')).toHaveText(['Äpfel', 'Tomaten']);
});
