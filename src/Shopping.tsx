import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Check,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
} from 'lucide-react';
import {
  type AppState,
  type ShoppingItem,
  type Category,
  type ShoppingList,
  type Contribution,
  units,
  parseAmount,
  itemAmount,
  uid,
} from './model';
import {
  sortedItems,
  moveItem,
  reorderCategory,
  removeCategory,
  getList,
  addManual,
  editItem,
  normalizeName,
} from './domain';
import { Empty, Field, Submit } from './ui';

export type Commit = (mutator: (s: AppState) => void, message?: string) => Promise<boolean>;
const sensorsOptions = { delay: 190, tolerance: 7 };
const collision: CollisionDetection = (args) => {
  const kind = args.active.data.current?.kind;
  const droppableContainers = args.droppableContainers.filter((d) =>
    kind === 'category'
      ? d.data.current?.kind === 'category'
      : d.data.current?.kind === 'item' || d.data.current?.kind === 'category',
  );
  const inside = pointerWithin({ ...args, droppableContainers });
  const rows = inside.filter(
    (c) => droppableContainers.find((d) => d.id === c.id)?.data.current?.kind === 'item',
  );
  return rows.length
    ? rows
    : inside.length
      ? inside
      : closestCenter({ ...args, droppableContainers });
};
export function ShoppingView({
  state,
  list,
  commit,
  onEdit,
  onRecipes,
}: {
  state: AppState;
  list: ShoppingList;
  commit: Commit;
  onEdit: (id: string) => void;
  onRecipes: () => void;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: sensorsOptions }),
    useSensor(KeyboardSensor),
  );
  const [active, setActive] = useState<{ id: string; kind: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const items = sortedItems(state, list.id);
  const open = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);
  const displayedCategories =
    active?.kind === 'item'
      ? [
          ...list.categories.filter((c) => open.some((i) => i.categoryId === c.id)),
          ...list.categories.filter((c) => !open.some((i) => i.categoryId === c.id)),
        ]
      : list.categories;
  const [showDone, setShowDone] = useState(false);
  useEffect(() => {
    setShowDone(false);
  }, [list.id]);
  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );
  function finish(event: DragEndEvent) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setActive(null);
    setOver(null);
    const { active: a, over: target } = event;
    if (!target || a.id === target.id) return;
    if (a.data.current?.kind === 'category') {
      void commit((s) =>
        reorderCategory(s, list.id, a.data.current!.categoryId, target.data.current!.categoryId),
      );
    } else {
      const targetItem = target.data.current?.itemId;
      const after =
        targetItem && a.rect.current.translated
          ? a.rect.current.translated.top + a.rect.current.translated.height / 2 >
            target.rect.top + target.rect.height / 2
          : false;
      void commit((s) =>
        moveItem(
          s,
          a.data.current!.itemId,
          target.data.current!.categoryId,
          targetItem,
          Boolean(after),
        ),
      );
    }
  }
  const overlayItem =
    active?.kind === 'item' ? items.find((i) => `item:${i.id}` === active.id) : undefined;
  const overlayCat =
    active?.kind === 'category'
      ? list.categories.find((c) => `category:${c.id}` === active.id)
      : undefined;
  return (
    <>
      {!items.length && (
        <Empty
          title="Platz für deinen nächsten Einkauf."
          text="Ergänze deinen ersten Artikel oder übernimm die Zutaten eines Rezepts."
        >
          <button className="button secondary" onClick={onRecipes}>
            Rezepte entdecken <ChevronRight size={17} />
          </button>
        </Empty>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={(e) => {
          setActive({ id: String(e.active.id), kind: e.active.data.current?.kind });
        }}
        onDragEnd={finish}
        onDragCancel={() => {
          setActive(null);
          setOver(null);
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
        }}
        onDragOver={(e) => {
          setOver(e.over ? String(e.over.id) : null);
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          const catId = e.over?.data.current?.categoryId;
          const cat = list.categories.find((c) => c.id === catId);
          if (e.active.data.current?.kind === 'item' && cat?.collapsed)
            hoverTimer.current = setTimeout(() => {
              void commit((s) => {
                getList(s, list.id).categories.find((c) => c.id === catId)!.collapsed = false;
              });
            }, 450);
        }}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Zum Verschieben Leertaste drücken. Mit Pfeiltasten bewegen, mit Escape abbrechen. Alternativ das Artikelmenü öffnen.',
          },
        }}
      >
        <SortableContext
          items={list.categories.map((c) => `category:${c.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="categories">
            {displayedCategories.map((cat) => {
              const categoryItems = open.filter((i) => i.categoryId === cat.id);
              if (!categoryItems.length && !active) return null;
              return (
                <CategorySection
                  key={cat.id}
                  cat={cat}
                  items={categoryItems}
                  activeKind={active?.kind}
                  over={over}
                  onToggle={() => {
                    void commit((s) => {
                      const c = getList(s, list.id).categories.find((c) => c.id === cat.id)!;
                      c.collapsed = !c.collapsed;
                    });
                  }}
                  onCheck={(id) => {
                    void commit((s) => {
                      const i = s.items.find((i) => i.id === id)!;
                      i.checked = true;
                    });
                  }}
                  onEdit={onEdit}
                />
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 160, easing: 'ease-out' }}>
          {overlayItem ? (
            <div className="drag-preview">
              <GripVertical size={18} />
              <strong>{overlayItem.name}</strong>
              <span>{itemAmount(overlayItem)}</span>
            </div>
          ) : overlayCat ? (
            <div className="drag-preview">
              <GripVertical size={18} />
              <strong>{overlayCat.name}</strong>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {done.length > 0 && (
        <section className="completed-section">
          <button
            className="completed-toggle"
            onClick={() => setShowDone(!showDone)}
            aria-expanded={showDone}
          >
            {showDone ? <ChevronDown size={17} /> : <ChevronRight size={17} />}Erledigt{' '}
            <span>{done.length}</span>
            <Check size={16} />
          </button>
          {showDone && (
            <div className="completed-items">
              {done.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  onCheck={() => {
                    void commit((s) => {
                      const item = s.items.find((x) => x.id === i.id)!;
                      item.checked = false;
                      const matching = s.items.find(
                        (x) =>
                          x.id !== i.id &&
                          !x.checked &&
                          x.listId === item.listId &&
                          normalizeName(x.name) === normalizeName(item.name) &&
                          x.contributions[0].unit === item.contributions[0].unit,
                      );
                      if (matching) {
                        matching.contributions.push(...item.contributions);
                        s.items = s.items.filter((x) => x.id !== i.id);
                      }
                    });
                  }}
                  onEdit={() => onEdit(i.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}
      {items.length > 0 && open.length === 0 && (
        <div className="all-done">
          <span>
            <Check size={21} />
          </span>
          <div>
            <strong>Alles im Korb.</strong>
            <p>Dein Einkauf ist erledigt.</p>
          </div>
        </div>
      )}
    </>
  );
}
function CategorySection({
  cat,
  items,
  onToggle,
  onCheck,
  onEdit,
  activeKind,
  over,
}: {
  cat: Category;
  items: ShoppingItem[];
  onToggle: () => void;
  onCheck: (id: string) => void;
  onEdit: (id: string) => void;
  activeKind?: string;
  over: string | null;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `category:${cat.id}`,
    data: { kind: 'category', categoryId: cat.id },
  });
  return (
    <section
      ref={setNodeRef}
      className={`category-section ${isDragging ? 'dragging' : ''} ${over === `category:${cat.id}` ? 'drop-category' : ''}`}
      style={{
        transform: activeKind === 'category' ? CSS.Transform.toString(transform) : undefined,
        transition,
      }}
    >
      <header className="category-heading">
        <button
          className="drag-handle category-grip"
          aria-label={`${cat.name} verschieben`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <button className="category-title" onClick={onToggle} aria-expanded={!cat.collapsed}>
          <span>{cat.name}</span>
          <span className="count">{items.length}</span>
          {cat.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      </header>
      {!cat.collapsed && (
        <SortableContext
          items={items.map((i) => `item:${i.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="category-items">
            {items.map((i) => (
              <SortableItem
                key={i.id}
                item={i}
                over={over}
                onCheck={() => onCheck(i.id)}
                onEdit={() => onEdit(i.id)}
              />
            ))}
            {!items.length && <div className="drop-empty">Hier ablegen</div>}
          </div>
        </SortableContext>
      )}
    </section>
  );
}
function SortableItem({
  item,
  onCheck,
  onEdit,
  over,
}: {
  item: ShoppingItem;
  onCheck: () => void;
  onEdit: () => void;
  over: string | null;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `item:${item.id}`,
    data: { kind: 'item', itemId: item.id, categoryId: item.categoryId },
  });
  return (
    <div
      ref={setNodeRef}
      data-item-name={item.name}
      className={`sortable-item ${isDragging ? 'dragging' : ''} ${over === `item:${item.id}` && !isDragging ? 'drop-before' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <ItemRow
        item={item}
        onCheck={onCheck}
        onEdit={onEdit}
        handle={
          <button
            className="drag-handle"
            aria-label={`${item.name} verschieben`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={18} />
          </button>
        }
      />
    </div>
  );
}
function ItemRow({
  item,
  onCheck,
  onEdit,
  handle,
}: {
  item: ShoppingItem;
  onCheck: () => void;
  onEdit: () => void;
  handle?: React.ReactNode;
}) {
  const sources = [
    ...new Set(item.contributions.filter((c) => c.recipeName).map((c) => c.recipeName)),
  ];
  return (
    <div className={`item-row ${item.checked ? 'checked' : ''}`}>
      {handle ?? <span className="handle-spacer" />}
      <button
        className="check-button"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={`${item.name} ${item.checked ? 'wieder öffnen' : 'abhaken'}`}
        onClick={onCheck}
      >
        <span>{item.checked && <Check size={15} strokeWidth={3} />}</span>
      </button>
      <button className="item-text" onClick={onEdit}>
        <span className="item-name">{item.name}</span>
        {sources.length > 0 && (
          <small>{sources.length === 1 ? sources[0] : `${sources.length} Rezepte`}</small>
        )}
      </button>
      <span className="item-amount">{itemAmount(item)}</span>
      <button
        className="icon-button item-menu"
        onClick={onEdit}
        aria-label={`${item.name} bearbeiten`}
      >
        <MoreHorizontal size={20} />
      </button>
    </div>
  );
}
export function ItemEditor({
  item,
  list,
  lists = [list],
  commit,
  onClose,
  initialName = '',
}: {
  item?: ShoppingItem;
  list: ShoppingList;
  lists?: ShoppingList[];
  commit: Commit;
  onClose: () => void;
  initialName?: string;
}) {
  const [name, setName] = useState(item?.name ?? initialName);
  const [destinationId, setDestination] = useState(list.id);
  const destination = lists.find((l) => l.id === destinationId) ?? list;
  const [categoryId, setCategory] = useState(item?.categoryId ?? list.unsortedId);
  const [parts, setParts] = useState(
    (
      item?.contributions ?? [
        { id: uid(), kind: 'manual' as const, amount: null, unit: '' as const },
      ]
    ).map((c) => ({ ...c, value: c.amount === null ? '' : String(c.amount).replace('.', ',') })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const contributions: Contribution[] = parts.map(({ value, ...c }) => ({
        ...c,
        amount: parseAmount(value),
      }));
      const ok = await commit(
        (s) => {
          if (item) editItem(s, item.id, name, categoryId, contributions, destinationId);
          else
            addManual(
              s,
              destinationId,
              name,
              contributions[0].amount,
              contributions[0].unit,
              categoryId,
            );
          s.preferences.activeListId = destinationId;
        },
        item ? 'Artikel gespeichert.' : `${name.trim()} hinzugefügt.`,
      );
      if (ok) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bitte Eingaben prüfen.');
    }
    setBusy(false);
  }
  return (
    <form onSubmit={save} className="form-stack">
      <Field label="Artikel">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={150}
          required
          autoFocus
          placeholder="z. B. Handcreme"
        />
      </Field>
      <Field label="Einkaufsliste">
        <select
          value={destinationId}
          onChange={(e) => {
            setDestination(e.target.value);
            setCategory(lists.find((l) => l.id === e.target.value)!.unsortedId);
          }}
        >
          {lists
            .filter((l) => !l.archived)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Kategorie">
        <select value={categoryId} onChange={(e) => setCategory(e.target.value)}>
          {destination.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-section-title">
        {parts.length > 1 ? 'Mengen nach Herkunft' : 'Menge'}
      </div>
      {parts.map((p, idx) => (
        <div key={p.id} className="quantity-part">
          <small>{p.kind === 'manual' ? 'Manuell ergänzt' : p.recipeName}</small>
          <div className="quantity-inputs">
            <input
              aria-label={`Menge ${p.kind === 'manual' ? 'manuell' : p.recipeName}`}
              inputMode="decimal"
              value={p.value}
              placeholder="Optional"
              onChange={(e) =>
                setParts(parts.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))
              }
            />
            <select
              aria-label={`Einheit ${idx + 1}`}
              value={p.unit}
              onChange={(e) =>
                setParts(
                  parts.map((x, i) =>
                    i === idx ? { ...x, unit: e.target.value as Contribution['unit'] } : x,
                  ),
                )
              }
            >
              {units.map((u) => (
                <option key={u} value={u}>
                  {u || 'ohne Einheit'}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Submit busy={busy}>{item ? 'Änderungen speichern' : 'Artikel hinzufügen'}</Submit>
      {item && (
        <>
          <div className="row-buttons">
            <button
              type="button"
              className="button secondary"
              onClick={async () => {
                if (
                  await commit((s) => {
                    const rows = sortedItems(s, list.id, item.categoryId).filter((i) => !i.checked);
                    const index = rows.findIndex((i) => i.id === item.id);
                    if (index > 0) moveItem(s, item.id, item.categoryId, rows[index - 1].id);
                  })
                )
                  onClose();
              }}
            >
              <ArrowUp size={17} />
              Nach oben
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={async () => {
                if (
                  await commit((s) => {
                    const rows = sortedItems(s, list.id, item.categoryId).filter((i) => !i.checked);
                    const index = rows.findIndex((i) => i.id === item.id);
                    if (index >= 0 && index < rows.length - 1)
                      moveItem(s, item.id, item.categoryId, rows[index + 1].id, true);
                  })
                )
                  onClose();
              }}
            >
              <ArrowDown size={17} />
              Nach unten
            </button>
          </div>
          <button
            type="button"
            className="button danger subtle full"
            onClick={async () => {
              if (
                await commit((s) => {
                  s.items = s.items.filter((i) => i.id !== item.id);
                }, 'Artikel entfernt.')
              )
                onClose();
            }}
          >
            <Trash2 size={17} />
            Artikel entfernen
          </button>
        </>
      )}
    </form>
  );
}
export function CategoryManager({ list, commit }: { list: ShoppingList; commit: Commit }) {
  const [name, setName] = useState('');
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: sensorsOptions }),
    useSensor(KeyboardSensor),
  );
  return (
    <div className="form-stack">
      <p className="muted">Ordne die Kategorien passend zu deinem Weg durch den Laden.</p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => {
          if (e.over)
            void commit((s) =>
              reorderCategory(s, list.id, String(e.active.id), String(e.over!.id)),
            );
        }}
      >
        <SortableContext
          items={list.categories.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="category-editor-list">
            {list.categories.map((c) => (
              <CategoryEditorRow
                key={c.id}
                category={c}
                permanent={c.id === list.unsortedId}
                onRename={(name) =>
                  commit((s) => {
                    const l = getList(s, list.id);
                    if (!name.trim()) throw new Error('Bitte einen Kategorienamen eingeben.');
                    if (
                      l.categories.some(
                        (x) => x.id !== c.id && normalizeName(x.name) === normalizeName(name),
                      )
                    )
                      throw new Error('Diese Kategorie existiert bereits.');
                    l.categories.find((x) => x.id === c.id)!.name = name.trim();
                  })
                }
                onDelete={() => {
                  void commit(
                    (s) => removeCategory(s, list.id, c.id),
                    'Artikel nach Unsortiert verschoben.',
                  );
                }}
                onMove={(direction) => {
                  void commit((s) => {
                    const l = getList(s, list.id);
                    const idx = l.categories.findIndex((x) => x.id === c.id);
                    const to = idx + direction;
                    if (to >= 0 && to < l.categories.length)
                      reorderCategory(s, list.id, c.id, l.categories[to].id);
                  });
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await commit((s) => {
              const l = getList(s, list.id);
              if (l.categories.some((c) => normalizeName(c.name) === normalizeName(name)))
                throw new Error('Diese Kategorie existiert bereits.');
              l.categories.push({ id: uid(), name: name.trim(), collapsed: false });
            }, 'Kategorie hinzugefügt.')
          )
            setName('');
        }}
      >
        <input
          aria-label="Neue Kategorie"
          placeholder="Neue Kategorie …"
          maxLength={150}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="icon-button filled" aria-label="Kategorie hinzufügen">
          <Plus size={21} />
        </button>
      </form>
    </div>
  );
}
function CategoryEditorRow({
  category,
  permanent,
  onRename,
  onDelete,
  onMove,
}: {
  category: Category;
  permanent: boolean;
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => void;
  onMove: (direction: number) => void;
}) {
  const [name, setName] = useState(category.name);
  useEffect(() => setName(category.name), [category.name]);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: category.id,
  });
  return (
    <div
      ref={setNodeRef}
      className="category-editor-row"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className="drag-handle"
        aria-label={`${category.name} verschieben`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={19} />
      </button>
      <input
        aria-label={`Name ${category.name}`}
        value={name}
        maxLength={150}
        onChange={(e) => setName(e.target.value)}
        onBlur={async () => {
          if (name !== category.name && !(await onRename(name))) setName(category.name);
        }}
      />
      <div className="category-row-actions">
        <button
          className="icon-button small"
          aria-label={`${category.name} nach oben`}
          onClick={() => onMove(-1)}
        >
          <ArrowUp size={15} />
        </button>
        <button
          className="icon-button small"
          aria-label={`${category.name} nach unten`}
          onClick={() => onMove(1)}
        >
          <ArrowDown size={15} />
        </button>
        <button
          className="icon-button small danger"
          disabled={permanent}
          aria-label={`${category.name} löschen`}
          onClick={onDelete}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
