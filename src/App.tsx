import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  ShoppingBasket,
  BookOpen,
  Settings,
  ChevronDown,
  Plus,
  SlidersHorizontal,
  MoreHorizontal,
  ListOrdered,
  Archive,
  Download,
  Upload,
  Smartphone,
  ArrowRight,
  Check,
  Pencil,
  RefreshCw,
  X,
} from 'lucide-react';
import { db, change, backupText, readBackup, restore } from './db';
import { type AppState, type Recipe, type Batch, type ShoppingList } from './model';
import { addManual, newList, archiveList, getList } from './domain';
import { ShoppingView, ItemEditor, CategoryManager, type Commit } from './Shopping';
import {
  RecipeLibrary,
  RecipeEditor,
  RecipeDetails,
  RecipePlanner,
  PlannedRecipes,
} from './Recipes';
import { Sheet, Field, Submit, NoticeContext } from './ui';

type Modal = {
  kind:
    | 'lists'
    | 'newList'
    | 'editList'
    | 'options'
    | 'categories'
    | 'newItem'
    | 'editItem'
    | 'settings'
    | 'recipeEditor'
    | 'recipeDetails'
    | 'recipePlan'
    | 'plans'
    | 'restore';
  id?: string;
  recipe?: Recipe;
  recipes?: Recipe[];
  batch?: Batch;
  data?: AppState;
};
function downloadBackup(state: AppState) {
  const blob = new Blob([backupText(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `korb-sicherung-${new Date().toLocaleDateString('sv-SE')}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export default function App() {
  const state = useLiveQuery(() => db.snapshots.get('main'));
  const [tab, setTab] = useState(window.location.hash.includes('rezepte') ? 'recipes' : 'shopping');
  const [modal, setActualModal] = useState<Modal | null>(null);
  const [quickName, setQuickName] = useState('');
  const [toast, setToast] = useState('');
  const setModal = (next: Modal | null) => {
    if (next) setToast('');
    setActualModal(next);
  };
  const [pending, setPending] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW();
  const commit: Commit = async (mutator, message) => {
    setPending((n) => n + 1);
    try {
      await change(mutator);
      if (message) setToast(message);
      return true;
    } catch (e) {
      console.error('Änderung konnte nicht gespeichert werden.', e);
      setToast(
        e instanceof Error && !e.name.includes('Zod')
          ? e.message
          : 'Die Änderung konnte nicht gespeichert werden. Bitte Eingaben und freien Speicher prüfen.',
      );
      return false;
    } finally {
      setPending((n) => n - 1);
    }
  };
  useEffect(() => {
    const onHash = () => setTab(window.location.hash.includes('rezepte') ? 'recipes' : 'shopping');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        state?.preferences.theme === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
          : (state?.preferences.theme ?? 'light');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [state?.preferences.theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (offlineReady) setToast('Korb ist jetzt auch offline bereit.');
  }, [offlineReady]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      const offset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      document.documentElement.style.setProperty(
        '--keyboard-offset',
        `${offset > 120 ? offset : 0}px`,
      );
      document.documentElement.classList.toggle('keyboard-open', offset > 120);
    };
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
    };
  }, []);
  if (!state)
    return (
      <div className="loading">
        <ShoppingBasket size={32} />
        <p>Dein Korb wird geladen …</p>
      </div>
    );
  const list = state.lists.find((l) => l.id === state.preferences.activeListId)!;
  const listItems = state.items.filter((i) => i.listId === list.id);
  const open = listItems.filter((i) => !i.checked).length;
  const done = listItems.length - open;
  const close = () => setModal(null);
  const go = (next: string) => {
    window.location.hash = next === 'recipes' ? '/rezepte' : '/einkaufen';
    setTab(next);
    window.scrollTo({ top: 0 });
  };
  const planBatch = (batch: Batch) =>
    setModal({ kind: 'recipePlan', recipes: [batch.recipe], batch });
  const dismissAfter = async (mutator: (s: AppState) => void, message: string) => {
    if (await commit(mutator, message)) close();
  };
  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickName.trim()) return;
    const name = quickName.trim();
    if (await commit((s) => addManual(s, list.id, name, null), `${name} hinzugefügt.`)) {
      setQuickName('');
      void navigator.storage?.persist?.().catch(() => false);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Die Sicherung ist zu groß (maximal 5 MB).');
      const data = readBackup(await file.text());
      setModal({ kind: 'restore', data });
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Die Sicherung konnte nicht gelesen werden.');
    }
    if (fileInput.current) fileInput.current.value = '';
  }
  const modalRecipe = modal?.recipe;
  const editingItem =
    modal?.kind === 'editItem' ? state.items.find((i) => i.id === modal.id) : undefined;
  const editingList =
    modal?.kind === 'editList' ? state.lists.find((l) => l.id === modal.id) : undefined;
  return (
    <NoticeContext.Provider value={toast}>
      <div className="app-shell">
        <header className="app-header">
          <a href="#/einkaufen" className="brand" aria-label="Korb – Einkaufen">
            <span className="brand-symbol">
              <ShoppingBasket size={23} strokeWidth={1.7} />
            </span>
            <span>
              korb<span className="brand-dot">.</span>
            </span>
          </a>
          <div className="header-right">
            <button
              className="icon-button settings-button"
              aria-label="Einstellungen"
              onClick={() => setModal({ kind: 'settings' })}
            >
              <Settings size={21} />
            </button>
          </div>
        </header>
        {needRefresh && (
          <div className="update-banner">
            <span>Eine neue Version ist bereit.</span>
            <button
              className="text-button"
              disabled={pending > 0}
              onClick={() => {
                void updateServiceWorker(true);
              }}
            >
              Jetzt aktualisieren <RefreshCw size={14} />
            </button>
          </div>
        )}
        <main className={`main-content ${tab === 'recipes' ? 'recipes-page' : ''}`}>
          {tab === 'shopping' ? (
            <>
              <div className="page-heading shopping-heading">
                <div>
                  <span className="eyebrow">DEINE EINKAUFSLISTE</span>
                  <button
                    className="list-title"
                    aria-label={`${list.name}: Einkaufsliste wechseln`}
                    onClick={() => setModal({ kind: 'lists' })}
                  >
                    <h1>{list.name}</h1>
                    <ChevronDown size={24} />
                  </button>
                  <p>
                    {listItems.length
                      ? `${open} offen · ${done} erledigt`
                      : 'Alles, was du brauchst. An einem Ort.'}
                  </p>
                </div>
                <button
                  className="icon-button more-button"
                  aria-label="Listenoptionen"
                  onClick={() => setModal({ kind: 'options' })}
                >
                  <MoreHorizontal size={25} />
                </button>
              </div>
              {listItems.length > 0 && (
                <div
                  className="progress-track"
                  aria-label={`${done} von ${listItems.length} Artikeln erledigt`}
                >
                  <div style={{ width: `${(done / listItems.length) * 100}%` }} />
                </div>
              )}
              <div className="list-toolbar">
                <span>
                  <ShoppingBasket size={16} />
                  {listItems.length ? `${listItems.length} Artikel` : 'Dein nächster Einkauf'}
                </span>
                <button onClick={() => setModal({ kind: 'categories' })}>
                  <ListOrdered size={16} />
                  Kategorien
                </button>
              </div>
              <ShoppingView
                state={state}
                list={list}
                commit={commit}
                onEdit={(id) => setModal({ kind: 'editItem', id })}
                onRecipes={() => go('recipes')}
              />
            </>
          ) : (
            <RecipeLibrary
              state={state}
              commit={commit}
              onNew={() => setModal({ kind: 'recipeEditor' })}
              onOpen={(recipe) => setModal({ kind: 'recipeDetails', recipe })}
              onPlanMany={(recipes) => setModal({ kind: 'recipePlan', recipes })}
            />
          )}
        </main>
        {tab === 'shopping' && (
          <form className="addbar" onSubmit={quickAdd}>
            <button
              type="button"
              className="add-details"
              aria-label="Artikel mit Menge und Kategorie hinzufügen"
              onClick={() => setModal({ kind: 'newItem' })}
            >
              <SlidersHorizontal size={20} />
            </button>
            <input
              aria-label="Artikel hinzufügen"
              placeholder="Was fehlt noch?"
              maxLength={150}
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              autoComplete="off"
              enterKeyHint="done"
            />
            <button
              type="submit"
              className="add-submit"
              aria-label="Artikel hinzufügen"
              disabled={!quickName.trim() || pending > 0}
            >
              <Plus size={23} />
            </button>
          </form>
        )}
        <nav className="tabbar" aria-label="Hauptnavigation">
          <a
            href="#/einkaufen"
            className={tab === 'shopping' ? 'active' : ''}
            aria-current={tab === 'shopping' ? 'page' : undefined}
          >
            <ShoppingBasket size={23} />
            <span>Einkaufen</span>
            {open > 0 && <span className="nav-badge">{open}</span>}
          </a>
          <a
            href="#/rezepte"
            className={tab === 'recipes' ? 'active' : ''}
            aria-current={tab === 'recipes' ? 'page' : undefined}
          >
            <BookOpen size={22} />
            <span>Rezepte</span>
          </a>
        </nav>
        <div
          className={`toast ${toast ? 'visible' : ''}`}
          role="status"
          aria-label="Hinweis"
          aria-live="polite"
          aria-hidden={modal ? true : undefined}
        >
          {toast && (
            <>
              <Check size={17} />
              <span>{toast}</span>
              <button
                className="icon-button small"
                aria-label="Hinweis schließen"
                onClick={() => setToast('')}
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          aria-label="Sicherungsdatei auswählen"
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
          }}
        />

        {modal?.kind === 'lists' && (
          <Sheet
            title="Deine Einkaufslisten"
            subtitle="Für jeden Einkauf die passende Liste."
            onClose={close}
          >
            <div className="list-picker">
              {state.lists
                .filter((l) => !l.archived)
                .map((l) => (
                  <div
                    key={l.id}
                    className={`list-picker-row ${l.id === list.id ? 'selected' : ''}`}
                  >
                    <button
                      onClick={() => {
                        void dismissAfter((s) => {
                          s.preferences.activeListId = l.id;
                        }, '');
                      }}
                    >
                      <ShoppingBasket size={21} />
                      <span>
                        <strong>{l.name}</strong>
                        <small>
                          {state.items.filter((i) => i.listId === l.id && !i.checked).length}{' '}
                          Artikel offen
                        </small>
                      </span>
                      {l.id === list.id && <Check size={19} />}
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`${l.name} verwalten`}
                      onClick={() => setModal({ kind: 'editList', id: l.id })}
                    >
                      <MoreHorizontal size={21} />
                    </button>
                  </div>
                ))}
            </div>
            <button className="button secondary full" onClick={() => setModal({ kind: 'newList' })}>
              <Plus size={18} />
              Neue Liste
            </button>
            {state.lists.some((l) => l.archived) && (
              <details className="archived-lists">
                <summary>Archivierte Listen</summary>
                {state.lists
                  .filter((l) => l.archived)
                  .map((l) => (
                    <div className="archived-row" key={l.id}>
                      <span>{l.name}</span>
                      <button
                        className="text-button"
                        onClick={() => {
                          void commit((s) => {
                            getList(s, l.id).archived = false;
                          }, 'Liste wiederhergestellt.');
                        }}
                      >
                        Wiederherstellen
                      </button>
                    </div>
                  ))}
              </details>
            )}
          </Sheet>
        )}
        {(modal?.kind === 'newList' || (modal?.kind === 'editList' && editingList)) && (
          <Sheet title={editingList ? 'Liste verwalten' : 'Neue Einkaufsliste'} onClose={close}>
            <ListEditor
              key={editingList?.id ?? 'new'}
              list={editingList}
              commit={commit}
              onClose={close}
            />
          </Sheet>
        )}
        {modal?.kind === 'options' && (
          <Sheet title={list.name} onClose={close}>
            <div className="menu-list">
              <button onClick={() => setModal({ kind: 'editList', id: list.id })}>
                <Pencil size={20} />
                Liste verwalten
                <ArrowRight size={17} />
              </button>
              <button onClick={() => setModal({ kind: 'categories' })}>
                <ListOrdered size={20} />
                Kategorien bearbeiten
                <ArrowRight size={17} />
              </button>
              <button onClick={() => setModal({ kind: 'plans' })}>
                <BookOpen size={20} />
                Geplante Rezepte
                <ArrowRight size={17} />
              </button>
              <button
                disabled={!done}
                onClick={() => {
                  void dismissAfter((s) => {
                    s.items = s.items.filter((i) => i.listId !== list.id || !i.checked);
                    s.batches = s.batches.filter((b) =>
                      s.items.some((i) => i.contributions.some((c) => c.batchId === b.id)),
                    );
                  }, 'Erledigte Artikel entfernt.');
                }}
              >
                <Check size={20} />
                Erledigte Artikel entfernen<span>{done}</span>
              </button>
            </div>
          </Sheet>
        )}
        {modal?.kind === 'categories' && (
          <Sheet title="Kategorien" subtitle={list.name} onClose={close}>
            <CategoryManager list={list} commit={commit} />
          </Sheet>
        )}
        {(modal?.kind === 'newItem' || editingItem) && (
          <Sheet title={editingItem ? 'Artikel bearbeiten' : 'Artikel hinzufügen'} onClose={close}>
            <ItemEditor
              key={editingItem?.id ?? 'new'}
              item={editingItem}
              list={editingItem ? getList(state, editingItem.listId) : list}
              lists={state.lists}
              initialName={quickName}
              commit={commit}
              onClose={() => {
                if (!editingItem) setQuickName('');
                close();
              }}
            />
          </Sheet>
        )}
        {modal?.kind === 'recipeEditor' && (
          <Sheet title={modalRecipe ? 'Rezept bearbeiten' : 'Neues Rezept'} onClose={close} wide>
            <RecipeEditor
              key={modalRecipe?.id ?? 'new'}
              recipe={modalRecipe}
              commit={commit}
              onClose={close}
            />
          </Sheet>
        )}
        {modal?.kind === 'recipeDetails' && modalRecipe && (
          <Sheet title={modalRecipe.name} onClose={close}>
            <RecipeDetails
              recipe={modalRecipe}
              onPlan={() => setModal({ kind: 'recipePlan', recipes: [modalRecipe] })}
              onEdit={() => setModal({ kind: 'recipeEditor', recipe: modalRecipe })}
              onDelete={() => {
                if (
                  window.confirm(
                    `„${modalRecipe.name}“ aus deiner Sammlung löschen? Bereits geplante Zutaten bleiben auf der Einkaufsliste.`,
                  )
                )
                  void dismissAfter((s) => {
                    s.recipes = s.recipes.filter((r) => r.id !== modalRecipe.id);
                  }, 'Rezept gelöscht.');
              }}
            />
          </Sheet>
        )}
        {modal?.kind === 'recipePlan' && modal.recipes && (
          <Sheet
            title={modal.batch ? 'Rezeptbedarf anpassen' : 'Zum Einkauf hinzufügen'}
            onClose={close}
            wide
          >
            <RecipePlanner
              key={modal.batch?.id ?? modal.recipes.map((r) => r.id).join(',')}
              recipes={modal.recipes}
              batch={modal.batch}
              state={state}
              commit={commit}
              onClose={() => {
                close();
                go('shopping');
              }}
              onEditBatch={planBatch}
            />
          </Sheet>
        )}
        {modal?.kind === 'plans' && (
          <Sheet title="Geplante Rezepte" subtitle={list.name} onClose={close}>
            <PlannedRecipes state={state} listId={list.id} commit={commit} onEdit={planBatch} />
          </Sheet>
        )}
        {modal?.kind === 'settings' && (
          <Sheet title="Einstellungen" onClose={close}>
            <div className="form-stack">
              <section className="settings-card">
                <div className="settings-card-icon">
                  <Smartphone size={24} />
                </div>
                <div>
                  <h3>Auf deinem Gerät.</h3>
                  <p>
                    Deine Listen und Rezepte werden hier gespeichert. Sichere sie als Datei, um sie
                    aufzubewahren oder auf ein anderes Gerät zu übertragen.
                  </p>
                </div>
              </section>
              <div className="section-heading">
                <h3>Datensicherung</h3>
              </div>
              <div className="menu-list">
                <button
                  onClick={async () => {
                    const latest = await db.snapshots.get('main');
                    if (latest) {
                      downloadBackup(latest);
                      setToast('Sicherung zum Speichern bereit.');
                    }
                  }}
                >
                  <Download size={20} />
                  Sicherung exportieren
                  <ArrowRight size={17} />
                </button>
                <button onClick={() => fileInput.current?.click()}>
                  <Upload size={20} />
                  Sicherung wiederherstellen
                  <ArrowRight size={17} />
                </button>
              </div>
              <Field label="Darstellung">
                <select
                  value={state.preferences.theme}
                  onChange={(e) => {
                    const theme = e.target.value as AppState['preferences']['theme'];
                    void commit((s) => {
                      s.preferences.theme = theme;
                    });
                  }}
                >
                  <option value="system">Wie auf deinem iPhone</option>
                  <option value="light">Hell</option>
                  <option value="dark">Dunkel</option>
                </select>
              </Field>
              <section className="install-hint">
                <h3>Immer dabei</h3>
                <p>
                  Öffne Korb in Safari, tippe auf „Teilen“ und dann auf „Zum Home-Bildschirm“. Öffne
                  die installierte App einmal mit Internet, damit sie unterwegs offline bereit ist.
                </p>
              </section>
              <p className="version-text">Korb · Version 0.1 · Lokal auf diesem Gerät</p>
            </div>
          </Sheet>
        )}
        {modal?.kind === 'restore' && modal.data && (
          <Sheet title="Sicherung wiederherstellen" onClose={close}>
            <div className="form-stack">
              <p>Diese Sicherung enthält:</p>
              <div className="backup-stats">
                <span>
                  <strong>{modal.data.lists.length}</strong>Listen
                </span>
                <span>
                  <strong>{modal.data.recipes.length}</strong>Rezepte
                </span>
                <span>
                  <strong>{modal.data.items.length}</strong>Artikel
                </span>
              </div>
              <p className="notice">
                Die Sicherung ersetzt die Daten auf diesem Gerät. Vorher wird dein aktueller Stand
                als Sicherungsdatei zum Speichern bereitgestellt.
              </p>
              <button
                className="button primary full"
                disabled={pending > 0}
                onClick={async () => {
                  setPending((n) => n + 1);
                  try {
                    const latest = await db.snapshots.get('main');
                    if (latest) downloadBackup(latest);
                    await restore(modal.data!);
                    close();
                    setToast('Sicherung wiederhergestellt.');
                  } catch {
                    setToast(
                      'Die Wiederherstellung konnte nicht gespeichert werden. Deine vorherigen Daten bleiben erhalten.',
                    );
                  } finally {
                    setPending((n) => n - 1);
                  }
                }}
              >
                Daten ersetzen und wiederherstellen
              </button>
              <button className="button secondary full" onClick={close}>
                Abbrechen
              </button>
            </div>
          </Sheet>
        )}
      </div>
    </NoticeContext.Provider>
  );
}

function ListEditor({
  list,
  commit,
  onClose,
}: {
  list?: ShoppingList;
  commit: Commit;
  onClose: () => void;
}) {
  const [name, setName] = useState(list?.name ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await commit(
          (s) => {
            if (list) getList(s, list.id).name = name.trim();
            else {
              const created = newList(name);
              s.lists.push(created);
              s.preferences.activeListId = created.id;
            }
          },
          list ? 'Liste umbenannt.' : 'Neue Liste angelegt.',
        );
        setBusy(false);
        if (ok) onClose();
      }}
    >
      <Field label="Listenname">
        <input
          autoFocus
          maxLength={150}
          required
          value={name}
          placeholder="z. B. Wochenmarkt"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Submit busy={busy}>{list ? 'Namen speichern' : 'Liste erstellen'}</Submit>
      {list && (
        <button
          className="button secondary full"
          type="button"
          onClick={async () => {
            if (
              await commit(
                (s) => {
                  if (list.archived) getList(s, list.id).archived = false;
                  else archiveList(s, list.id);
                },
                list.archived ? 'Liste wiederhergestellt.' : 'Liste archiviert.',
              )
            )
              onClose();
          }}
        >
          <Archive size={18} />
          {list.archived ? 'Wiederherstellen' : 'Liste archivieren'}
        </button>
      )}
      {list && (
        <p className="small muted">Beim Archivieren bleiben Artikel und Kategorien erhalten.</p>
      )}
    </form>
  );
}
