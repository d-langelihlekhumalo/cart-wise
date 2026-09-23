import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { useId } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-stone-300',
  secondary: 'bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-100',
  danger: 'bg-red-700 text-white hover:bg-red-800 disabled:bg-stone-300',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 font-medium transition-colors disabled:cursor-not-allowed ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  );
}

const inputStyles =
  'block min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-base shadow-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 focus:outline-none';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | undefined;
}

export function TextField({
  label,
  hint,
  error,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-stone-700">
        {label}
      </label>
      <input
        id={id}
        className={inputStyles}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-help` : undefined}
        {...props}
      />
      <FieldHelp id={`${id}-help`} hint={hint} error={error} />
    </div>
  );
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-stone-700">
        {label}
      </label>
      <select
        id={id}
        className={inputStyles}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-help` : undefined}
        {...props}
      >
        {children}
      </select>
      <FieldHelp id={`${id}-help`} hint={hint} error={error} />
    </div>
  );
}

function FieldHelp({
  id,
  hint,
  error,
}: {
  id: string;
  hint?: string | undefined;
  error?: string | undefined;
}) {
  if (error) {
    return (
      <p id={id} className="text-sm text-red-700">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={id} className="text-sm text-stone-500">
        {hint}
      </p>
    );
  }
  return null;
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200"
    >
      {children}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 ${className}`}>
      {children}
    </section>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex justify-center py-12" role="status">
      <span className="size-8 animate-spin rounded-full border-4 border-stone-200 border-t-brand-600" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
