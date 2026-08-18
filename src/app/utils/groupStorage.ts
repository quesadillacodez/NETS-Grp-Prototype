import { lastInsertId, query, run } from './db';
import { getAllUsers } from './userStorage';

export interface ContactGroupMember {
  id: string;
  name: string;
  phone: string;
  avatar: string;
}

export interface ContactGroup {
  id: number;
  ownerUserId: string;
  name: string;
  createdAt: number;
  members: ContactGroupMember[];
}

function loadGroups(ownerUserId: string): ContactGroup[] {
  const groupRows = query(
    'SELECT id, name, created_at FROM contact_groups WHERE owner_user_id = ? ORDER BY created_at DESC',
    [ownerUserId]
  );
  const users = getAllUsers();

  return groupRows.map((g) => {
    const memberRows = query('SELECT user_id FROM contact_group_members WHERE group_id = ?', [g.id]);
    const members = memberRows
      .map((m) => users.find((u) => u.id === String(m.user_id)))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .map((u) => ({ id: u.id, name: u.name, phone: u.phone, avatar: u.avatar }));

    return {
      id: Number(g.id),
      ownerUserId,
      name: String(g.name),
      createdAt: Number(g.created_at),
      members,
    };
  });
}

/** Saved group templates (e.g. "Secondary School Friends") for the current user. */
export function getContactGroups(ownerUserId: string): ContactGroup[] {
  return loadGroups(ownerUserId);
}

export function createContactGroup(ownerUserId: string, name: string, memberIds: string[]): ContactGroup {
  const trimmedName = name.trim() || 'Untitled Group';
  run('INSERT INTO contact_groups (owner_user_id, name, created_at) VALUES (?, ?, ?)',
    [ownerUserId, trimmedName, Date.now()]);
  const groupId = lastInsertId();

  for (const userId of Array.from(new Set(memberIds))) {
    run('INSERT OR IGNORE INTO contact_group_members (group_id, user_id) VALUES (?, ?)', [groupId, userId]);
  }

  return loadGroups(ownerUserId).find((g) => g.id === groupId)!;
}

export function renameContactGroup(groupId: number, name: string): void {
  const trimmedName = name.trim();
  if (!trimmedName) return;
  run('UPDATE contact_groups SET name = ? WHERE id = ?', [trimmedName, groupId]);
}

export function deleteContactGroup(groupId: number): void {
  run('DELETE FROM contact_groups WHERE id = ?', [groupId]);
}
