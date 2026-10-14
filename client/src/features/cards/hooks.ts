import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as cardsApi from '../../api/cards';
import { boardsKeys } from '../boards/hooks';
import { applyCardMove, type CardMoveParams } from '../board/boardReducers';
import { toastError } from '../../stores/toastStore';
import type { BoardWithContent } from '../../types/api';

export function useCreateCardMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, input }: { columnId: string; input: cardsApi.CardInput }) =>
      cardsApi.createCard(columnId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
    },
  });
}

export function useUpdateCardMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<cardsApi.CardInput> }) =>
      cardsApi.updateCard(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
    },
  });
}

export function useDeleteCardMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cardsApi.deleteCard(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
    },
  });
}

export interface MoveCardVariables {
  cardId: string;
  apiInput: cardsApi.MoveCardInput;
  cardMove: CardMoveParams;
}

interface MoveContext {
  previous?: BoardWithContent;
}

export function useMoveCardMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, MoveCardVariables, MoveContext>({
    // Los movimientos sobre el mismo tablero se encolan: nunca corren en
    // paralelo, así que un arrastre nunca pisa el optimismo de otro.
    scope: { id: `board-${boardId}` },
    mutationFn: ({ cardId, apiInput }) => cardsApi.moveCard(cardId, apiInput),
    onMutate: async ({ cardMove }) => {
      await queryClient.cancelQueries({ queryKey: boardsKeys.detail(boardId) });
      const previous = queryClient.getQueryData<BoardWithContent>(boardsKeys.detail(boardId));
      if (previous) {
        queryClient.setQueryData(boardsKeys.detail(boardId), applyCardMove(previous, cardMove));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(boardsKeys.detail(boardId), context.previous);
      }
      toastError('No se pudo mover la tarjeta. Se ha deshecho el cambio.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
    },
  });
}
