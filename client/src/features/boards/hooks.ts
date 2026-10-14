import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as boardsApi from '../../api/boards';

export const boardsKeys = {
  all: ['boards'] as const,
  detail: (id: string) => ['boards', id] as const,
};

export function useBoardsQuery() {
  return useQuery({ queryKey: boardsKeys.all, queryFn: boardsApi.listBoards });
}

export function useBoardQuery(id: string) {
  return useQuery({ queryKey: boardsKeys.detail(id), queryFn: () => boardsApi.getBoard(id) });
}

export function useCreateBoardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: boardsApi.createBoard,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardsKeys.all });
    },
  });
}

export function useUpdateBoardMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: boardsApi.UpdateBoardInput) => boardsApi.updateBoard(boardId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardsKeys.all });
    },
  });
}

export function useDeleteBoardMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => boardsApi.deleteBoard(boardId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: boardsKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardsKeys.all });
    },
  });
}
