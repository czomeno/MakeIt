import { apiRequest } from './client';
import type { Card } from '../types/api';

export interface CardInput {
  title: string;
  description?: string;
  labels?: string[];
  dueDate?: string;
  company?: string;
  jobUrl?: string;
  assignees?: string[];
}

export interface MoveCardInput {
  columnId: string;
}

export async function createCard(columnId: string, input: CardInput): Promise<Card> {
  const data = await apiRequest<{ card: Card }>(`/columns/${columnId}/cards`, {
    method: 'POST',
    body: input,
  });
  return data.card;
}

export async function updateCard(id: string, input: Partial<CardInput>): Promise<Card> {
  const data = await apiRequest<{ card: Card }>(`/cards/${id}`, { method: 'PATCH', body: input });
  return data.card;
}

export function deleteCard(id: string): Promise<void> {
  return apiRequest<void>(`/cards/${id}`, { method: 'DELETE' });
}

export async function moveCard(id: string, input: MoveCardInput): Promise<Card> {
  const data = await apiRequest<{ card: Card }>(`/cards/${id}/move`, {
    method: 'PATCH',
    body: input,
  });
  return data.card;
}
