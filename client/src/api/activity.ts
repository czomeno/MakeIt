import { apiRequest } from './client';
import type { ActivityPage } from '../types/api';

export interface ActivityQuery {
  cursor?: string;
  limit?: number;
}

function toQueryString(query: ActivityQuery): string {
  const params = new URLSearchParams();
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit) params.set('limit', String(query.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function getBoardActivity(
  boardId: string,
  query: ActivityQuery = {},
): Promise<ActivityPage> {
  return apiRequest<ActivityPage>(`/boards/${boardId}/activity${toQueryString(query)}`);
}

export function getCardActivity(cardId: string, query: ActivityQuery = {}): Promise<ActivityPage> {
  return apiRequest<ActivityPage>(`/cards/${cardId}/activity${toQueryString(query)}`);
}
