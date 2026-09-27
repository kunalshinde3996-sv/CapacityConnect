// Tiny set of shared UI pieces (no component library needed for this prototype).

type Tone = 'neutral' | 'brand' | 'green' | 'amber' | 'red';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

const buttonVariants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/60',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  danger: 'bg-white text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Alert({ tone = 'red', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div role="alert" className={`rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${toneClasses[tone]}`}>
      {children}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-slate-500" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export const LEVEL_NAMES: Record<number, string> = { 1: 'Aware', 2: 'Working', 3: 'Proficient', 4: 'Expert' };

export function levelLabel(level: number | null) {
  return level === null ? 'No claim' : `L${level} ${LEVEL_NAMES[level] ?? ''}`.trim();
}

// Pinned to the bottom of the screen, so it is visible even when the user has
// scrolled far down a list on a phone. Announced to screen readers.
export function Toast({ tone, children, onClose }: { tone: Tone; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:justify-end">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ring-inset ${toneClasses[tone]}`}
      >
        <p className="flex-1">{children}</p>
        <button onClick={onClose} className="-m-1 p-1 opacity-60 hover:opacity-100" aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}
