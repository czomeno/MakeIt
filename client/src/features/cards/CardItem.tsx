import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { Card } from '../../types/api';
import { avatarColorFor, pillClassesFor } from '../../lib/badgeColors';

interface CardItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  card: Card;
  onOpen: () => void;
  isDragging?: boolean;
  isOverlay?: boolean;
}

export const CardItem = forwardRef<HTMLButtonElement, CardItemProps>(function CardItem(
  { card, onOpen, isDragging = false, isOverlay = false, className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      className={`flex w-60 shrink-0 flex-col gap-2 rounded-lg border bg-bg p-2.5 text-left text-sm text-text shadow-sm transition-colors ${
        isOverlay ? 'border-accent shadow-xl' : 'border-border hover:border-accent'
      } ${isDragging ? 'opacity-40' : ''} ${className}`}
      {...rest}
    >
      <span className="font-medium">{card.title}</span>
      {card.company && (
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <span
            aria-hidden="true"
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white ${avatarColorFor(card.company)}`}
          >
            {card.company.charAt(0).toUpperCase()}
          </span>
          {card.company}
        </span>
      )}
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <span
              key={label}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${pillClassesFor(label)}`}
            >
              {label}
            </span>
          ))}
        </div>
      )}
      {card.dueDate && (
        <span className="text-[11px] text-text-muted">
          {new Date(card.dueDate).toLocaleDateString('es-ES')}
        </span>
      )}
    </button>
  );
});
