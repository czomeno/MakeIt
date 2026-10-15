import { Board, type BoardRole } from '../models/Board.js';
import { User } from '../models/User.js';
import { AppError } from '../errors/AppError.js';
import { publish } from './events.service.js';
import { kickUserFromBoard } from './realtime.service.js';

export interface MemberDTO {
  userId: string;
  role: BoardRole;
  name: string;
  email: string;
}

export async function list(boardId: string): Promise<MemberDTO[]> {
  const board = await Board.findById(boardId).select('members').lean();
  if (!board) {
    throw AppError.notFound('Tablero no encontrado');
  }

  const users = await User.find({ _id: { $in: board.members.map((m) => m.user) } })
    .select('name email')
    .lean();
  const byId = new Map(users.map((user) => [user._id.toString(), user]));

  return board.members.map((member) => {
    const userId = member.user.toString();
    const user = byId.get(userId);
    return { userId, role: member.role, name: user?.name ?? '', email: user?.email ?? '' };
  });
}

function countAdmins(members: { role: BoardRole }[]): number {
  return members.filter((member) => member.role === 'admin').length;
}

// Compartida por updateRole y remove: ninguna de las dos puede dejar el
// tablero sin ningún admin.
function assertKeepsAdmin(members: { role: BoardRole }[], losingAdminRole: boolean): void {
  if (losingAdminRole && countAdmins(members) - 1 < 1) {
    throw AppError.conflict('El tablero debe conservar al menos un admin');
  }
}

export async function updateRole(
  boardId: string,
  targetUserId: string,
  role: BoardRole,
  actorId: string,
): Promise<MemberDTO> {
  const board = await Board.findById(boardId);
  if (!board) {
    throw AppError.notFound('Tablero no encontrado');
  }

  const member = board.members.find((m) => m.user.toString() === targetUserId);
  if (!member) {
    throw AppError.notFound('Ese usuario no es miembro de este tablero');
  }

  assertKeepsAdmin(board.members, member.role === 'admin' && role !== 'admin');

  member.role = role;
  await board.save();

  const user = await User.findById(targetUserId).select('name email').lean();
  const dto: MemberDTO = {
    userId: targetUserId,
    role,
    name: user?.name ?? '',
    email: user?.email ?? '',
  };

  await publish({
    board: boardId,
    activity: {
      actor: actorId,
      type: 'member.role_changed',
      data: { memberName: dto.name, newRole: role },
    },
    socket: { event: 'member:updated', payload: { member: dto, actorId } },
  });

  return dto;
}

export async function remove(
  boardId: string,
  targetUserId: string,
  actorId: string,
): Promise<void> {
  const board = await Board.findById(boardId);
  if (!board) {
    throw AppError.notFound('Tablero no encontrado');
  }

  if (board.owner.toString() === targetUserId) {
    throw AppError.conflict('El propietario del tablero no se puede expulsar');
  }

  const index = board.members.findIndex((m) => m.user.toString() === targetUserId);
  if (index === -1) {
    throw AppError.notFound('Ese usuario no es miembro de este tablero');
  }

  const member = board.members[index]!;
  assertKeepsAdmin(board.members, member.role === 'admin');

  board.members.splice(index, 1);
  await board.save();

  const user = await User.findById(targetUserId).select('name').lean();
  const isSelf = targetUserId === actorId;

  await publish({
    board: boardId,
    activity: {
      actor: actorId,
      type: isSelf ? 'member.left' : 'member.removed',
      data: { memberName: user?.name ?? '' },
    },
    socket: { event: 'member:removed', payload: { userId: targetUserId, actorId } },
  });

  // Después del emit, no antes: así el expulsado recibe el aviso member:removed
  // en su propio socket antes de que se le saque de la room del tablero.
  kickUserFromBoard(boardId, targetUserId);
}
