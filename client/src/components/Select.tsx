import { useId } from 'react';
import { Dropdown, type DropdownOption } from './Dropdown';

interface SelectProps<T extends string> {
  label: string;
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  className?: string;
}

// Campo de formulario con etiqueta, ayuda y error, sobre el desplegable
// propio (ver Dropdown). Con react-hook-form se usa a través de <Controller>.
export function Select<T extends string>({
  label,
  options,
  value,
  onChange,
  onBlur,
  error,
  hint,
  className = '',
}: SelectProps<T>) {
  const id = useId();
  const labelId = `${id}-label`;
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {/* Sin htmlFor a propósito: con <label for> el botón tomaría la etiqueta
          como nombre dos veces ("Plantilla Plantilla") en vez de "Plantilla Genérico". */}
      <span id={labelId} className="text-sm font-medium text-text">
        {label}
      </span>
      <Dropdown
        id={`${id}-button`}
        labelledBy={labelId}
        options={options}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        invalid={Boolean(error)}
        describedBy={[errorId, hintId].filter(Boolean).join(' ') || undefined}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
