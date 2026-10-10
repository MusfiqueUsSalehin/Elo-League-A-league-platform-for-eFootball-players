import { CircleCheck, Info, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useId } from 'react';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ---------- Buttons ---------- */

const buttonVariants = {
  primary: 'bg-flood font-semibold text-turf-900 hover:bg-flood/90',
  ghost: 'border border-line bg-transparent text-chalk hover:bg-turf-700',
  subtle: 'bg-turf-700 text-chalk hover:bg-turf-600',
  danger: 'border border-loss/40 bg-loss/15 text-loss hover:bg-loss/25',
  link: 'bg-transparent px-0 py-0 text-flood hover:underline',
};

const buttonSizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

/** Pass `as={Link}` to render a router link that looks like a button. */
export function Button({
  as: Tag = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  children,
  ...rest
}) {
  const isButton = Tag === 'button';
  return (
    <Tag
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg transition-colors',
        'aria-disabled:pointer-events-none aria-disabled:opacity-50 disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        variant !== 'link' && buttonSizes[size],
        className
      )}
      {...(isButton ? { type: 'button', disabled: disabled || loading } : {})}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />}
      {children}
    </Tag>
  );
}

/* ---------- Surfaces ---------- */

export const Card = ({ className, children, ...rest }) => (
  <div
    className={cx('rounded-xl border border-line bg-turf-800 shadow-panel', className)}
    {...rest}
  >
    {children}
  </div>
);

export const CardHeader = ({ title, subtitle, action, className }) => (
  <div
    className={cx(
      'flex items-start justify-between gap-4 border-b border-line px-5 py-4',
      className
    )}
  >
    <div>
      <h2 className="font-display text-xl leading-tight">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-mist">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const StatTile = ({ label, value, sub, tone }) => (
  <Card className="px-4 py-3">
    <p className="text-sm text-mist">{label}</p>
    <p
      className={cx(
        'scoreline mt-1 text-3xl',
        tone === 'gold' && 'text-flood',
        tone === 'green' && 'text-win',
        tone === 'red' && 'text-loss'
      )}
    >
      {value}
    </p>
    {sub && <p className="text-xs text-mist">{sub}</p>}
  </Card>
);

/* ---------- Form fields ---------- */

const inputBase =
  'w-full rounded-lg border bg-turf-900 px-3 py-2 text-sm text-chalk placeholder:text-mist/60 focus:border-flood/60';

/**
 * A labelled input. The label, hint and error are wired to the input for screen readers,
 * so callers only pass text. Any other prop goes straight to the <input>.
 */
export function TextField({ label, hint, error, className, id, ...rest }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={inputId} className="block text-sm text-mist">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(inputBase, error ? 'border-loss' : 'border-line')}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="text-xs text-mist/80">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-loss">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------- Feedback ---------- */

const alertTones = {
  error: { box: 'border-loss/40 bg-loss/10 text-loss', Icon: TriangleAlert },
  success: { box: 'border-win/40 bg-win/10 text-win', Icon: CircleCheck },
  info: { box: 'border-line bg-turf-700 text-chalk', Icon: Info },
};

/** Errors are announced to screen readers straight away; other tones wait politely. */
export function Alert({ tone = 'info', className, children }) {
  const { box, Icon } = alertTones[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm',
        box,
        className
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ label = 'Loading', className }) {
  return (
    <div
      role="status"
      className={cx('flex items-center justify-center py-14 text-mist', className)}
    >
      <LoaderCircle className="animate-spin" size={22} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export const FullPageSpinner = () => <Spinner className="min-h-screen" />;

export function Avatar({ name = '', size = 36 }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-turf-600 font-display text-sm text-flood"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}
