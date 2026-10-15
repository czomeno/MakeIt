import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

type DropdownVariant = 'field' | 'filter' | 'compact';

interface DropdownProps<T extends string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // Nombre accesible sin etiqueta visible ("Filtrar por prioridad"); el
  // lector anuncia también el valor elegido ("Filtrar por prioridad: Alta").
  ariaLabel?: string;
  // Id de una <label> visible (formularios): se anuncia "Plantilla Genérico".
  labelledBy?: string;
  id?: string;
  // filter: píldora; si está en la primera opción ("sin filtro") muestra
  // `placeholder` y se resalta en azul con cualquier otra.
  variant?: DropdownVariant;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  onBlur?: () => void;
}

const BUTTON_CLASSES: Record<DropdownVariant, string> = {
  field: 'w-full justify-between rounded-lg px-3 py-2 text-sm',
  filter: 'rounded-lg px-3 py-2 text-sm font-medium',
  compact: 'rounded-md px-2 py-1 text-xs',
};

// Desplegable propio (patrón listbox de WAI-ARIA) en lugar del <select>
// nativo: la lista del nativo la dibuja el sistema y en algunos navegadores
// no se abría. La lista va en un portal con posición fija para que no la
// recorte un contenedor con overflow (p. ej. el cuerpo de un modal).
export function Dropdown<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  labelledBy,
  id,
  variant = 'field',
  placeholder,
  disabled = false,
  invalid = false,
  describedBy,
  className = '',
  onBlur,
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const buttonId = id ?? `${generatedId}-button`;
  const listId = `${generatedId}-list`;

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedLabel = options[selectedIndex]?.label ?? '';
  const isFiltering = variant === 'filter' && selectedIndex > 0;
  const buttonText =
    variant === 'filter' && !isFiltering && placeholder ? placeholder : selectedLabel;

  function open() {
    if (disabled) {
      return;
    }
    setActiveIndex(selectedIndex);
    setIsOpen(true);
  }

  function close({ returnFocus }: { returnFocus: boolean }) {
    setIsOpen(false);
    if (returnFocus) {
      buttonRef.current?.focus();
    }
  }

  function choose(index: number) {
    const option = options[index];
    if (option && option.value !== value) {
      onChange(option.value);
    }
    close({ returnFocus: true });
  }

  // Coloca la lista bajo el botón (o encima si no cabe) sin salirse de la
  // pantalla, y la sigue si se hace scroll o cambia el tamaño de la ventana.
  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    function place() {
      const button = buttonRef.current;
      const list = listRef.current;
      if (!button || !list) {
        return;
      }
      const rect = button.getBoundingClientRect();
      const listHeight = list.offsetHeight;
      const listWidth = Math.max(list.offsetWidth, rect.width);
      const margin = 8;
      const below = window.innerHeight - rect.bottom;
      const top =
        below < listHeight + margin && rect.top > listHeight + margin
          ? rect.top - listHeight - 6
          : rect.bottom + 6;
      const left = Math.min(rect.left, window.innerWidth - listWidth - margin);
      setPosition({ top, left: Math.max(margin, left), minWidth: rect.width });
    }
    place();
    listRef.current?.focus();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !listRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    // scrollIntoView no existe en jsdom (tests).
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [isOpen, activeIndex, listId]);

  function handleButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    }
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => Math.min(options.length - 1, index + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        choose(activeIndex);
        break;
      case 'Escape':
      case 'Tab':
        // Escape no debe llegar al modal que contenga el desplegable.
        event.preventDefault();
        event.stopPropagation();
        close({ returnFocus: true });
        break;
    }
  }

  const stateClasses = invalid
    ? 'border-danger bg-surface text-text'
    : isFiltering
      ? 'border-accent bg-accent/10 text-accent'
      : 'border-border bg-surface text-text hover:bg-surface-hover';

  return (
    <>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel}: ${selectedLabel}` : undefined}
        aria-labelledby={!ariaLabel && labelledBy ? `${labelledBy} ${buttonId}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        onClick={() => (isOpen ? close({ returnFocus: false }) : open())}
        onKeyDown={handleButtonKeyDown}
        onBlur={onBlur}
        className={`flex items-center gap-1.5 border text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60 ${BUTTON_CLASSES[variant]} ${stateClasses} ${className}`}
      >
        <span className="truncate">{buttonText}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-150 motion-reduce:transition-none ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          <path
            d="m5 8 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-labelledby={!ariaLabel ? labelledBy : undefined}
            aria-activedescendant={`${listId}-${activeIndex}`}
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
            style={position}
            className="fixed z-[60] max-h-72 overflow-auto rounded-lg border border-border bg-surface p-1 text-text shadow-lg focus:outline-none"
          >
            {options.map((option, index) => {
              const isSelected = index === selectedIndex;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex cursor-pointer items-center justify-between gap-4 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap ${
                    index === activeIndex ? 'bg-surface-hover' : ''
                  } ${isSelected ? 'font-semibold text-accent' : ''}`}
                >
                  {option.label}
                  {isSelected && (
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                      <path
                        d="m4.5 10.5 3.5 3.5 7.5-8"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
