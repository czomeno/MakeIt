import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '../../socket/socketClient';
import { TAB_ID } from '../../socket/clientId';
import { boardsKeys } from '../boards/hooks';
import { membersKeys, invitationsKeys } from '../members/hooks';
import { activityKeys } from '../activity/hooks';
import { useAuthStore } from '../../stores/authStore';
import { toastInfo } from '../../stores/toastStore';
import { upsertCard, removeCard, upsertColumn, removeColumn } from './remoteReducers';
import type { SocketEventPayloads } from '../../socket/events';
import type { BoardWithContent } from '../../types/api';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';
export interface PresenceUser {
  userId: string;
  name: string;
  initials: string;
}
export type ActiveDrag = { kind: 'card' | 'column'; id: string } | null;
export type AccessLostReason = 'removed' | 'deleted' | null;

interface UseBoardSocketOptions {
  // Ref (no estado) para no reinstalar los listeners del socket en cada
  // arrastre; Board.tsx escribe aquí qué se está arrastrando ahora mismo.
  activeDragRef: MutableRefObject<ActiveDrag>;
  activeCardId: string | null;
  onActiveCardRemoved: () => void;
}

interface UseBoardSocketResult {
  connectionStatus: ConnectionStatus;
  presence: PresenceUser[];
  accessLost: AccessLostReason;
}

// Hook de un solo tablero activo a la vez: se une a su room al montar, sale
// al desmontar. El socket en sí es un singleton (socketClient.ts) que
// persiste entre tableros; este hook solo gestiona la room y la cache.
export function useBoardSocket(
  boardId: string,
  { activeDragRef, activeCardId, onActiveCardRemoved }: UseBoardSocketOptions,
): UseBoardSocketResult {
  const queryClient = useQueryClient();
  const myUserId = useAuthStore((state) => state.user?.id);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    socket.connected ? 'connected' : 'connecting',
  );
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [accessLost, setAccessLost] = useState<AccessLostReason>(null);

  // Los listeners se instalan una vez por boardId; estas refs les dan acceso
  // al valor más reciente de props que sí cambian a menudo (qué tarjeta está
  // abierta) sin tener que reinstalarlos en cada cambio.
  const activeCardIdRef = useRef(activeCardId);
  activeCardIdRef.current = activeCardId;
  const onActiveCardRemovedRef = useRef(onActiveCardRemoved);
  onActiveCardRemovedRef.current = onActiveCardRemoved;

  useEffect(() => {
    setAccessLost(null);
  }, [boardId]);

  useEffect(() => {
    function isEcho(actorId: string, clientId?: string): boolean {
      // Con clientId (la inmensa mayoría de los casos): compara por pestaña,
      // no por usuario, para que otra pestaña del mismo usuario SÍ reciba
      // el evento. Sin clientId, cae en comparar por actorId como red de
      // seguridad.
      return clientId ? clientId === TAB_ID : actorId === myUserId;
    }

    function updateBoard(updater: (board: BoardWithContent) => BoardWithContent) {
      queryClient.setQueryData<BoardWithContent>(boardsKeys.detail(boardId), (prev) =>
        prev ? updater(prev) : prev,
      );
    }

    function invalidateBoard() {
      void queryClient.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
    }

    // Si lo que acaba de moverse/borrarse por otro es justo lo que este
    // cliente está arrastrando, cancela el arrastre en vez de dejar que la
    // vista previa local y la cache diverjan. dnd-kit escucha Escape de
    // forma global mientras cualquier sensor tiene un arrastre activo.
    function interruptDragIfActive(kind: 'card' | 'column', id: string) {
      if (activeDragRef.current?.kind === kind && activeDragRef.current.id === id) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        toastInfo('Alguien más ha movido lo que estabas arrastrando. Se canceló el arrastre.');
      }
    }

    function onCardCreated(payload: SocketEventPayloads['card:created']) {
      if (isEcho(payload.actorId, payload.clientId)) return;
      updateBoard((board) => upsertCard(board, payload.card as BoardWithContent['columns'][number]['cards'][number]));
    }
    function onCardUpdated(payload: SocketEventPayloads['card:updated']) {
      if (isEcho(payload.actorId, payload.clientId)) return;
      updateBoard((board) => upsertCard(board, payload.card as BoardWithContent['columns'][number]['cards'][number]));
    }
    function onCardMoved(payload: SocketEventPayloads['card:moved']) {
      if (isEcho(payload.actorId, payload.clientId)) return;
      const card = payload.card as BoardWithContent['columns'][number]['cards'][number];
      interruptDragIfActive('card', card._id);
      updateBoard((board) => upsertCard(board, card));
    }
    function onCardDeleted(payload: SocketEventPayloads['card:deleted']) {
      if (isEcho(payload.actorId, payload.clientId)) return;
      interruptDragIfActive('card', payload.cardId);
      updateBoard((board) => removeCard(board, payload.cardId));
      if (activeCardIdRef.current === payload.cardId) {
        onActiveCardRemovedRef.current();
        toastInfo('Alguien ha eliminado la tarjeta que tenías abierta.');
      }
    }
    function onColumnCreated(payload: SocketEventPayloads['column:created']) {
      if (isEcho(payload.actorId, payload.clientId)) return;
      updateBoard((board) => upsertColumn(board, payload.column as BoardWithContent['columns'][number]));
    }
    function onColumnUpdated(payload: SocketEventPayloads['column:updated']) {
      if (isEcho(payload.actorId, payload.clientId)) return;
      updateBoard((board) => upsertColumn(board, payload.column as BoardWithContent['columns'][number]));
    }
    function onColumnMoved(payload: SocketEventPayloads['column:moved']) {
      if (isEcho(payload.actorId, payload.clientId)) return;
      const column = payload.column as BoardWithContent['columns'][number];
      interruptDragIfActive('column', column._id);
      updateBoard((board) => upsertColumn(board, column));
    }
    function onColumnDeleted(payload: SocketEventPayloads['column:deleted']) {
      if (isEcho(payload.actorId, payload.clientId)) return;
      interruptDragIfActive('column', payload.columnId);
      updateBoard((board) => removeColumn(board, payload.columnId));
    }
    function onBoardUpdated(payload: SocketEventPayloads['board:updated']) {
      if (isEcho(payload.actorId, payload.clientId)) return;
      const incoming = payload.board as Partial<BoardWithContent>;
      updateBoard((board) => ({
        ...board,
        title: incoming.title ?? board.title,
        description: incoming.description,
        template: incoming.template ?? board.template,
      }));
    }
    function onBoardDeleted() {
      setAccessLost('deleted');
    }
    function refreshMembership() {
      invalidateBoard();
      void queryClient.invalidateQueries({ queryKey: membersKeys.list(boardId) });
      void queryClient.invalidateQueries({ queryKey: invitationsKeys.list(boardId) });
    }
    function onMemberRemoved(payload: SocketEventPayloads['member:removed']) {
      if (payload.userId === myUserId) {
        setAccessLost('removed');
        return;
      }
      refreshMembership();
    }
    function onActivityCreated() {
      void queryClient.invalidateQueries({ queryKey: activityKeys.board(boardId) });
    }
    function onPresenceUpdate(payload: SocketEventPayloads['presence:update']) {
      setPresence(payload.users);
    }

    socket.on('card:created', onCardCreated);
    socket.on('card:updated', onCardUpdated);
    socket.on('card:moved', onCardMoved);
    socket.on('card:deleted', onCardDeleted);
    socket.on('column:created', onColumnCreated);
    socket.on('column:updated', onColumnUpdated);
    socket.on('column:moved', onColumnMoved);
    socket.on('column:deleted', onColumnDeleted);
    socket.on('board:updated', onBoardUpdated);
    socket.on('board:deleted', onBoardDeleted);
    socket.on('member:joined', refreshMembership);
    socket.on('member:updated', refreshMembership);
    socket.on('member:removed', onMemberRemoved);
    socket.on('activity:created', onActivityCreated);
    socket.on('presence:update', onPresenceUpdate);

    function joinRoom() {
      socket.emit('board:join', { boardId });
    }

    function handleConnect() {
      setConnectionStatus('connected');
      joinRoom();
    }
    function handleDisconnect() {
      setConnectionStatus('offline');
    }
    function handleReconnectAttempt() {
      setConnectionStatus('reconnecting');
    }
    function handleReconnect() {
      setConnectionStatus('connected');
      joinRoom();
      // Recupera lo que se haya podido perder mientras estuvo desconectado.
      invalidateBoard();
      void queryClient.invalidateQueries({ queryKey: activityKeys.board(boardId) });
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.io.on('reconnect', handleReconnect);

    if (socket.connected) {
      joinRoom();
    } else {
      socket.connect();
    }

    return () => {
      socket.emit('board:leave', { boardId });
      socket.off('card:created', onCardCreated);
      socket.off('card:updated', onCardUpdated);
      socket.off('card:moved', onCardMoved);
      socket.off('card:deleted', onCardDeleted);
      socket.off('column:created', onColumnCreated);
      socket.off('column:updated', onColumnUpdated);
      socket.off('column:moved', onColumnMoved);
      socket.off('column:deleted', onColumnDeleted);
      socket.off('board:updated', onBoardUpdated);
      socket.off('board:deleted', onBoardDeleted);
      socket.off('member:joined', refreshMembership);
      socket.off('member:updated', refreshMembership);
      socket.off('member:removed', onMemberRemoved);
      socket.off('activity:created', onActivityCreated);
      socket.off('presence:update', onPresenceUpdate);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      socket.io.off('reconnect', handleReconnect);
    };
  }, [boardId, queryClient, myUserId, activeDragRef]);

  return { connectionStatus, presence, accessLost };
}
