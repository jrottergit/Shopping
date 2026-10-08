import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Clock3,
  Users,
  ArrowRight,
  BookOpen,
  Heart,
  Check,
  Minus,
  Trash2,
  Pencil,
  Soup,
} from 'lucide-react';
import {
  type AppState,
  type Recipe,
  type Batch,
  type Unit,
  type Ingredient,
  uid,
  units,
  recipeSchema,
  parseAmount,
  numberText,
  amountText,
} from './model';
import { planRecipe, demoRecipes } from './domain';
import { Empty, Field, Submit } from './ui';
import type { Commit } from './Shopping';

export function RecipeLibrary({
  state,
  commit,
  onNew,
  onOpen,
  onPlanMany,
}: {
  state: AppState;
  commit: Commit;
  onNew: () => void;
  onOpen: (r: Recipe) => void;
  onPlanMany: (rs: Recipe[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const query = search.toLocaleLowerCase('de');
  const recipes = state.recipes.filter(
    (r) =>
      r.name.toLocaleLowerCase('de').includes(query) ||
      r.ingredients.some((i) => i.name.toLocaleLowerCase('de').includes(query)),
  );
  useEffect(
    () => setSelected((ids) => ids.filter((id) => state.recipes.some((r) => r.id === id))),
    [state.recipes],
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DEINE SAMMLUNG</span>
          <h1>Rezepte</h1>
          <p>Lieblingsgerichte. Schnell auf der Liste.</p>
        </div>
        <button className="icon-button filled large" onClick={onNew} aria-label="Rezept anlegen">
          <Plus size={24} />
        </button>
      </div>
      {!!state.recipes.length && (
        <label className="search-field">
          <Search size={19} />
          <input
            aria-label="Rezepte suchen"
            value={search}
            placeholder="Rezept oder Zutat suchen …"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      )}
      {!state.recipes.length ? (
        <Empty
          title="Deine Lieblingsgerichte, immer dabei."
          text="Lege ein Rezept an. Die Zutaten kannst du mit der passenden Portionszahl direkt auf deine Einkaufsliste übernehmen."
        >
          <button className="button primary" onClick={onNew}>
            <Plus size={18} />
            Erstes Rezept anlegen
          </button>
          <button
            className="text-button"
            onClick={() => {
              void commit((s) => {
                if (!s.recipes.length) s.recipes.push(...demoRecipes());
              }, 'Drei Beispielrezepte hinzugefügt.');
            }}
          >
            Mit Beispielrezepten ausprobieren
          </button>
        </Empty>
      ) : !recipes.length ? (
        <Empty title="Kein Rezept gefunden." text="Versuche einen anderen Namen oder eine Zutat." />
      ) : (
        <div className="recipe-grid">
          {recipes.map((r, index) => (
            <article className={`recipe-card tone-${index % 3}`} key={r.id}>
              <button
                className="recipe-select"
                aria-label={`${r.name} auswählen`}
                aria-pressed={selected.includes(r.id)}
                onClick={() =>
                  setSelected(
                    selected.includes(r.id)
                      ? selected.filter((id) => id !== r.id)
                      : [...selected, r.id],
                  )
                }
              >
                {selected.includes(r.id) ? <Check size={16} /> : <Plus size={16} />}
              </button>
              <button
                className="recipe-favorite"
                aria-label={`${r.name} ${r.favorite ? 'aus Favoriten entfernen' : 'als Favorit markieren'}`}
                aria-pressed={r.favorite}
                onClick={() => {
                  void commit((s) => {
                    s.recipes.find((x) => x.id === r.id)!.favorite = !r.favorite;
                  });
                }}
              >
                <Heart size={18} fill={r.favorite ? 'currentColor' : 'none'} />
              </button>
              <button className="recipe-card-main" onClick={() => onOpen(r)}>
                <div className="recipe-art">
                  <Soup size={47} strokeWidth={1.1} />
                </div>
                <h2>{r.name}</h2>
                <div className="recipe-meta">
                  {r.minutes > 0 && (
                    <span>
                      <Clock3 size={14} />
                      {r.minutes} Min.
                    </span>
                  )}
                  <span>
                    <Users size={14} />
                    {numberText(r.servings)} Portionen
                  </span>
                </div>
                <div className="recipe-card-bottom">
                  <span>{r.ingredients.length} Zutaten</span>
                  <ArrowRight size={19} />
                </div>
              </button>
            </article>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="selection-bar">
          <span>
            <strong>{selected.length}</strong> ausgewählt
          </span>
          <button
            className="button primary"
            onClick={() => {
              onPlanMany(state.recipes.filter((r) => selected.includes(r.id)));
              setSelected([]);
            }}
          >
            Zum Einkauf <ArrowRight size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Auswahl aufheben"
            onClick={() => setSelected([])}
          >
            <Minus size={18} />
          </button>
        </div>
      )}
    </>
  );
}
export function RecipeEditor({
  recipe,
  commit,
  onClose,
}: {
  recipe?: Recipe;
  commit: Commit;
  onClose: () => void;
}) {
  const [name, setName] = useState(recipe?.name ?? '');
  const [servings, setServings] = useState(String(recipe?.servings ?? 2));
  const [minutes, setMinutes] = useState(String(recipe?.minutes || ''));
  const [instructions, setInstructions] = useState(recipe?.instructions ?? '');
  const makeIngredient = () => ({ id: uid(), name: '', value: '', unit: 'g' as Unit });
  const [ingredients, setIngredients] = useState<
    { id: string; name: string; value: string; unit: Unit }[]
  >(
    recipe?.ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      value: i.amount === null ? '' : String(i.amount).replace('.', ','),
    })) ?? [makeIngredient()],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (index: number, patch: Partial<(typeof ingredients)[number]>) =>
    setIngredients(ingredients.map((i, n) => (n === index ? { ...i, ...patch } : i)));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = recipeSchema.safeParse({
        id: recipe?.id ?? uid(),
        name,
        servings: parseAmount(servings),
        minutes: minutes ? Number(minutes) : 0,
        instructions,
        favorite: recipe?.favorite ?? false,
        ingredients: ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          amount: parseAmount(i.value),
          unit: i.unit,
        })),
      });
      if (!result.success)
        throw new Error('Bitte Rezeptname, Portionszahl und alle Zutaten prüfen.');
      if (
        await commit((s) => {
          const index = s.recipes.findIndex((r) => r.id === result.data.id);
          if (index >= 0) s.recipes[index] = result.data;
          else s.recipes.push(result.data);
        }, 'Rezept gespeichert.')
      )
        onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bitte Eingaben prüfen.');
    }
    setBusy(false);
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <Field label="Rezeptname">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Pasta mit Tomaten"
          maxLength={150}
          required
        />
      </Field>
      <div className="two-fields">
        <Field label="Portionen">
          <input
            inputMode="decimal"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            required
          />
        </Field>
        <Field label="Zeit in Minuten">
          <input
            type="number"
            min="0"
            max="10000"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="Optional"
          />
        </Field>
      </div>
      <div className="section-heading">
        <h3>Zutaten</h3>
        <span>{ingredients.length}</span>
      </div>
      <div className="ingredient-editor">
        {ingredients.map((i, idx) => (
          <div className="ingredient-editor-row" key={i.id}>
            <input
              aria-label={`Zutat ${idx + 1}`}
              placeholder="Zutat"
              value={i.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              maxLength={150}
              required
            />
            <div className="ingredient-details">
              <input
                aria-label={`Menge Zutat ${idx + 1}`}
                inputMode="decimal"
                placeholder="Menge"
                value={i.value}
                onChange={(e) => update(idx, { value: e.target.value })}
              />
              <select
                aria-label={`Einheit Zutat ${idx + 1}`}
                value={i.unit}
                onChange={(e) =>
                  update(idx, {
                    unit: e.target.value as Unit,
                    ...(e.target.value === 'nach Geschmack' ? { value: '' } : {}),
                  })
                }
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u || 'ohne Einheit'}
                  </option>
                ))}
              </select>
              <button
                className="icon-button danger"
                type="button"
                disabled={ingredients.length === 1}
                aria-label={`Zutat ${idx + 1} entfernen`}
                onClick={() => setIngredients(ingredients.filter((_, n) => n !== idx))}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="button secondary full"
        onClick={() => setIngredients([...ingredients, makeIngredient()])}
      >
        <Plus size={18} />
        Zutat ergänzen
      </button>
      <Field label="Zubereitung">
        <textarea
          rows={6}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="So wird's gemacht …"
          maxLength={50000}
        />
      </Field>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Submit busy={busy}>Rezept speichern</Submit>
    </form>
  );
}
export function RecipeDetails({
  recipe,
  onPlan,
  onEdit,
  onDelete,
}: {
  recipe: Recipe;
  onPlan: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="form-stack">
      <div className="recipe-detail-hero">
        <Soup size={68} strokeWidth={1.15} />
        <div className="recipe-meta">
          <span>
            <Users size={16} />
            {numberText(recipe.servings)} Portionen
          </span>
          {recipe.minutes > 0 && (
            <span>
              <Clock3 size={16} />
              {recipe.minutes} Minuten
            </span>
          )}
        </div>
      </div>
      <button className="button primary full" onClick={onPlan}>
        <Plus size={19} />
        Zum Einkauf hinzufügen
      </button>
      <div className="section-heading">
        <h3>Zutaten</h3>
        <span>{recipe.ingredients.length}</span>
      </div>
      <div className="ingredient-preview">
        {recipe.ingredients.map((i) => (
          <div key={i.id}>
            <span>{i.name}</span>
            <strong>{amountText(i.amount, i.unit)}</strong>
          </div>
        ))}
      </div>
      {recipe.instructions && (
        <>
          <h3>Zubereitung</h3>
          <p className="instructions">{recipe.instructions}</p>
        </>
      )}
      <div className="row-buttons">
        <button className="button secondary" onClick={onEdit}>
          <Pencil size={17} />
          Bearbeiten
        </button>
        <button className="button danger subtle" onClick={onDelete}>
          <Trash2 size={17} />
          Löschen
        </button>
      </div>
    </div>
  );
}
export function RecipePlanner({
  recipes,
  state,
  batch,
  commit,
  onClose,
  onEditBatch,
}: {
  recipes: Recipe[];
  state: AppState;
  batch?: Batch;
  commit: Commit;
  onClose: () => void;
  onEditBatch: (b: Batch) => void;
}) {
  const [listId, setListId] = useState(batch?.listId ?? state.preferences.activeListId);
  const [quantities, setQuantities] = useState(
    Object.fromEntries(recipes.map((r) => [r.id, String(batch?.servings ?? r.servings)])),
  );
  const [selected, setSelected] = useState<Record<string, string[]>>(
    Object.fromEntries(
      recipes.map((r) => [r.id, batch?.selected ?? r.ingredients.map((i) => i.id)]),
    ),
  );
  const [additional, setAdditional] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const existing = !batch
    ? state.batches.filter(
        (b) =>
          b.listId === listId &&
          recipes.some((r) => r.id === b.recipe.id) &&
          state.items.some((i) => !i.checked && i.contributions.some((c) => c.batchId === b.id)),
      )
    : [];
  const count = Object.values(selected).reduce((n, ids) => n + ids.length, 0);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const numbers = Object.fromEntries(
        recipes.map((r) => {
          const amount = parseAmount(quantities[r.id]);
          if (!amount || amount > 1000)
            throw new Error('Bitte eine Portionszahl zwischen 0 und 1000 eingeben.');
          return [r.id, amount];
        }),
      );
      if (existing.length && !additional)
        throw new Error('Bitte bestehenden Bedarf bearbeiten oder zusätzliches Planen bestätigen.');
      if (
        await commit(
          (s) => {
            for (const r of recipes)
              if (selected[r.id].length)
                planRecipe(s, r, listId, numbers[r.id], selected[r.id], batch?.id);
            s.preferences.activeListId = listId;
          },
          batch ? 'Offene Zutaten aktualisiert.' : 'Zutaten zur Einkaufsliste hinzugefügt.',
        )
      )
        onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bitte Eingaben prüfen.');
    }
    setBusy(false);
  }
  return (
    <form className="form-stack" onSubmit={save}>
      <Field label="Einkaufsliste">
        <select
          value={listId}
          onChange={(e) => {
            setListId(e.target.value);
            setAdditional(false);
          }}
          disabled={!!batch}
        >
          {state.lists
            .filter((l) => !l.archived)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </select>
      </Field>
      {batch && (
        <p className="notice">
          Bereits abgehakte Zutaten bleiben erhalten. Nur offene Zutaten werden neu berechnet.
        </p>
      )}
      {existing.length > 0 && (
        <div className="notice">
          <strong>Bereits auf dieser Liste</strong>
          {existing.map((b) => (
            <button type="button" className="text-button" key={b.id} onClick={() => onEditBatch(b)}>
              {b.recipe.name} · {numberText(b.servings)} Portionen bearbeiten <Pencil size={14} />
            </button>
          ))}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={additional}
              onChange={(e) => setAdditional(e.target.checked)}
            />
            Diese Rezepte zusätzlich einplanen
          </label>
        </div>
      )}
      {recipes.map((r) => {
        const amount = Number(quantities[r.id].replace(',', '.'));
        const factor = Number.isFinite(amount) && amount > 0 ? amount / r.servings : 1;
        return (
          <section className="plan-recipe" key={r.id}>
            <div className="plan-heading">
              <h3>{r.name}</h3>
              <div className="stepper">
                <button
                  type="button"
                  aria-label={`Weniger Portionen ${r.name}`}
                  onClick={() =>
                    setQuantities({
                      ...quantities,
                      [r.id]: String(
                        Math.max(
                          0.5,
                          (Number(quantities[r.id].replace(',', '.')) || r.servings) - 1,
                        ),
                      ),
                    })
                  }
                >
                  <Minus size={17} />
                </button>
                <input
                  aria-label={`Portionen ${r.name}`}
                  inputMode="decimal"
                  value={quantities[r.id]}
                  onChange={(e) => setQuantities({ ...quantities, [r.id]: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={`Mehr Portionen ${r.name}`}
                  onClick={() =>
                    setQuantities({
                      ...quantities,
                      [r.id]: String(
                        Math.min(
                          1000,
                          (Number(quantities[r.id].replace(',', '.')) || r.servings) + 1,
                        ),
                      ),
                    })
                  }
                >
                  <Plus size={17} />
                </button>
              </div>
            </div>
            <p className="small muted">Portionen wählen. Zutaten abwählen, die du schon hast.</p>
            <div className="plan-ingredients">
              {r.ingredients.map((i: Ingredient) => (
                <label key={i.id}>
                  <input
                    type="checkbox"
                    checked={selected[r.id].includes(i.id)}
                    onChange={() =>
                      setSelected({
                        ...selected,
                        [r.id]: selected[r.id].includes(i.id)
                          ? selected[r.id].filter((id) => id !== i.id)
                          : [...selected[r.id], i.id],
                      })
                    }
                  />
                  <span>{i.name}</span>
                  <strong>
                    {amountText(i.amount === null ? null : i.amount * factor, i.unit)}
                  </strong>
                </label>
              ))}
            </div>
          </section>
        );
      })}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Submit busy={busy} disabled={!count || (!!existing.length && !additional)}>
        {batch ? 'Offene Zutaten aktualisieren' : `${count} Zutaten hinzufügen`}
      </Submit>
    </form>
  );
}
export function PlannedRecipes({
  state,
  listId,
  commit,
  onEdit,
}: {
  state: AppState;
  listId: string;
  commit: Commit;
  onEdit: (b: Batch) => void;
}) {
  const batches = state.batches.filter(
    (b) =>
      b.listId === listId &&
      state.items.some((i) => i.contributions.some((c) => c.batchId === b.id)),
  );
  return (
    <div className="form-stack">
      {!batches.length ? (
        <Empty
          title="Noch keine Rezepte eingeplant."
          text="Übernimm Zutaten aus deiner Rezeptsammlung in diese Liste."
        />
      ) : (
        <>
          <p className="muted">
            Entfernst du ein Rezept aus der Planung, bleiben manuelle Ergänzungen erhalten.
          </p>
          {batches.map((b) => (
            <div key={b.id} className="planned-row">
              <BookOpen size={22} />
              <button className="planned-name" onClick={() => onEdit(b)}>
                <strong>{b.recipe.name}</strong>
                <small>{numberText(b.servings)} Portionen</small>
              </button>
              <button
                className="icon-button danger"
                aria-label={`${b.recipe.name} aus Planung entfernen`}
                onClick={() => {
                  void commit((s) => {
                    s.items.forEach((i) => {
                      i.contributions = i.contributions.filter((c) => c.batchId !== b.id);
                    });
                    s.items = s.items.filter((i) => i.contributions.length);
                    s.batches = s.batches.filter((x) => x.id !== b.id);
                  }, 'Rezeptbedarf entfernt.');
                }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
