import { useInfiniteQuery } from '@tanstack/react-query';
import * as activityApi from '../../api/activity';

const PAGE_SIZE = 20;

export const activityKeys = {
  board: (boardId: string) => ['boards', boardId, 'activity'] as const,
  card: (cardId: string) => ['cards', cardId, 'activity'] as const,
};

export function useBoardActivityQuery(boardId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: activityKeys.board(boardId),
    queryFn: ({ pageParam }) =>
      activityApi.getBoardActivity(boardId, { cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

export function useCardActivityQuery(cardId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: activityKeys.card(cardId),
    queryFn: ({ pageParam }) =>
      activityApi.getCardActivity(cardId, { cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}
