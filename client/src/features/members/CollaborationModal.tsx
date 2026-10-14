import { useState, type ReactNode } from 'react';
import { Modal } from '../../components/Modal';
import { MembersPanel } from './MembersPanel';
import { InviteForm } from './InviteForm';
import { ActivityPanel } from '../activity/ActivityPanel';

type Tab = 'members' | 'invite' | 'activity';

interface CollaborationModalProps {
  boardId: string;
  ownerId: string;
  isAdmin: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function CollaborationModal({
  boardId,
  ownerId,
  isAdmin,
  isOpen,
  onClose,
}: CollaborationModalProps) {
  const [tab, setTab] = useState<Tab>('members');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Colaboración">
      <div className="mb-4 flex gap-1 border-b border-border" role="tablist">
        <TabButton active={tab === 'members'} onClick={() => setTab('members')}>
          Miembros
        </TabButton>
        {isAdmin && (
          <TabButton active={tab === 'invite'} onClick={() => setTab('invite')}>
            Invitar
          </TabButton>
        )}
        <TabButton active={tab === 'activity'} onClick={() => setTab('activity')}>
          Actividad
        </TabButton>
      </div>

      {tab === 'members' && <MembersPanel boardId={boardId} isAdmin={isAdmin} ownerId={ownerId} />}
      {tab === 'invite' && isAdmin && <InviteForm boardId={boardId} />}
      <ActivityPanel boardId={boardId} enabled={tab === 'activity'} />
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active ? 'border-accent text-text' : 'border-transparent text-text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
