import Dexie, { type EntityTable } from 'dexie';
import { initialState } from './domain';
import { stateSchema, type AppState } from './model';

export class KorbDatabase extends Dexie {
  snapshots!: EntityTable<AppState, 'id'>;
  constructor(name = 'korb-local-v1') {
    super(name);
    this.version(1).stores({ snapshots: 'id' });
  }
}
export const db = new KorbDatabase();
export async function initialize(database = db) {
  await database.transaction('rw', database.snapshots, async () => {
    if (!(await database.snapshots.get('main'))) await database.snapshots.put(initialState());
  });
}
export async function change(mutator: (s: AppState) => void, database = db) {
  await database.transaction('rw', database.snapshots, async () => {
    const current = await database.snapshots.get('main');
    if (!current) throw new Error('Daten konnten nicht geladen werden.');
    mutator(current);
    const valid = stateSchema.parse(current);
    await database.snapshots.put(valid);
  });
}
export function backupText(s: AppState): string {
  return JSON.stringify(
    { app: 'Korb', format: 1, exportedAt: new Date().toISOString(), data: s },
    null,
    2,
  );
}
export function readBackup(text: string): AppState {
  if (new TextEncoder().encode(text).length > 5 * 1024 * 1024)
    throw new Error('Die Sicherung ist zu groß (maximal 5 MB).');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Diese Datei enthält keine gültige Sicherung.');
  }
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('app' in raw) ||
    raw.app !== 'Korb' ||
    !('format' in raw) ||
    raw.format !== 1 ||
    !('data' in raw)
  )
    throw new Error('Bitte eine Korb-Sicherung im JSON-Format auswählen.');
  const result = stateSchema.safeParse(raw.data);
  if (!result.success)
    throw new Error(
      'Die Sicherung ist unvollständig oder hat ein nicht unterstütztes Format. Deine Daten bleiben erhalten.',
    );
  return result.data;
}
export async function restore(s: AppState, database = db) {
  const valid = stateSchema.parse(s);
  await database.transaction('rw', database.snapshots, async () => {
    await database.snapshots.put(valid);
  });
}
