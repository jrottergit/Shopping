import {
  useEffect,
  useRef,
  useId,
  createContext,
  useContext,
  cloneElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { X, LoaderCircle, ShoppingBasket } from 'lucide-react';

export const NoticeContext = createContext('');
export function Sheet({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const notice = useContext(NoticeContext);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[autofocus]')?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`sheet ${wide ? 'wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="sheet-title"
    >
      <div className="sheet-inner">
        <header className="sheet-header">
          <div>
            <h2 id="sheet-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-button" aria-label="Schließen" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        <div className="sheet-content">
          {notice && (
            <div className="sheet-notice" role="status" aria-label="Hinweis">
              {notice}
            </div>
          )}
          {children}
        </div>
      </div>
    </dialog>
  );
}
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-illustration">
        <ShoppingBasket strokeWidth={1.35} size={66} />
        <span className="seed seed-one" />
        <span className="seed seed-two" />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Submit({
  children,
  busy = false,
  disabled = false,
}: {
  children: ReactNode;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button type="submit" className="button primary full" disabled={busy || disabled}>
      {busy && <LoaderCircle className="spin" size={18} />}
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generated = useId();
  const child = children as ReactElement<{ id?: string; 'aria-describedby'?: string }>;
  const id = child.props.id ?? generated;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(child, { id, ...(hint ? { 'aria-describedby': `${id}-hint` } : {}) })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
