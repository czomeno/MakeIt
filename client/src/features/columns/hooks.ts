import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as columnsApi from '../../api/columns';
import { boardsKeys } from '../boards/hooks';
import { applyColumnMove, type ColumnMoveParams } from '../board/boardReducers';
import { toastError } from '../../stores/toastStore';
import type { BoardWithContent } from '../../types/api';

// Columnas y tarjetas no tienen query propia: viven dentro del detalle del
// tablero (GET /boards/:id), así que toda mutación invalida esa query.
export function useCreateColumnMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: columnsApi.CreateColumnInput) => columnsApi.createColumn(boardId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
    },
  });
}

export function useUpdateColumnMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: columnsApi.UpdateColumnInput }) =>
      columnsApi.updateColumn(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
    },
  });
}

export function useDeleteColumnMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => columnsApi.deleteColumn(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
    },
  });
}

export interface MoveColumnVariables {
  columnId: string;
  apiInput: columnsApi.MoveColumnInput;
  columnMove: ColumnMoveParams;
}

interface MoveContext {
  previous?: BoardWithContent;
}

export function useMoveColumnMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, MoveColumnVariables, MoveContext>({
    // Mismo scope que useMoveCardMutation: mover una columna y mover una
    // tarjeta del mismo tablero tampoco deben correr en paralelo.
    scope: { id: `board-${boardId}` },
    mutationFn: ({ columnId, apiInput }) => columnsApi.moveColumn(columnId, apiInput),
    onMutate: async ({ columnMove }) => {
      await queryClient.cancelQueries({ queryKey: boardsKeys.detail(boardId) });
      const previous = queryClient.getQueryData<BoardWithContent>(boardsKeys.detail(boardId));
      if (previous) {
        queryClient.setQueryData(boardsKeys.detail(boardId), applyColumnMove(previous, columnMove));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(boardsKeys.detail(boardId), context.previous);
      }
      toastError('No se pudo mover la columna. Se ha deshecho el cambio.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
    },
  });
}
