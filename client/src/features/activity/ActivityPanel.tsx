import { useBoardActivityQuery } from './hooks';
import { activityMessage } from './activityMessage';
import { relativeTimeFromNow } from '../../lib/relativeTime';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';

interface ActivityPanelProps {
  boardId: string;
  enabled: boolean;
}

export function ActivityPanel({ boardId, enabled }: ActivityPanelProps) {
  const query = useBoardActivityQuery(boardId, enabled);

  if (!enabled) {
    return null;
  }

  if (query.isPending) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }

  if (query.isError) {
    return <p className="text-sm text-danger">No se pudo cargar la actividad.</p>;
  }

  const items = query.data.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Todavía no hay actividad en este tablero.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item._id} className="text-sm text-text">
            {activityMessage(item)}
            <span className="ml-2 text-xs text-text-muted">
              {relativeTimeFromNow(item.createdAt)}
            </span>
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => void query.fetchNextPage()}
          isLoading={query.isFetchingNextPage}
          className="self-center px-3 py-1.5 text-xs"
        >
          Cargar más
        </Button>
      )}
    </div>
  );
}
