'use client';

import React, { useState } from 'react';
import PulseAvatar from './PulseAvatar';
import { toast } from 'sonner';

export default function MembersPanel({
  board,
  isOpen,
  onClose,
  currentUserIsAdmin = false,
  onMembersUpdated
}) {
  const [showPermissionMatrix, setShowPermissionMatrix] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');
  const [submitting, setSubmitting] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const members = board?.members || [];
  const owner = board?.owner;

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards/${board._id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: newMemberEmail.trim(), role: newMemberRole })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add member');

      toast.success(`Member ${newMemberEmail} added!`);
      setNewMemberEmail('');
      if (onMembersUpdated) onMembersUpdated();
    } catch (err) {
      toast.error(err.message || 'Error adding member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeRole = async (memberUserId, newRole) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards/${board._id}/members/${memberUserId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newRole })
      });

      if (res.ok) {
        toast.success('Member role updated');
        if (onMembersUpdated) onMembersUpdated();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to update role');
      }
    } catch (e) {
      toast.error('Error updating role');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="rounded-2xl border w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-line)" }}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--color-brand)" }} />
            <h3 className="font-display text-base font-bold" style={{ color: "var(--color-ink)" }}>
              Team Members & Roles
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPermissionMatrix(true)}
              className="text-xs px-2.5 py-1 rounded-lg border font-medium cursor-pointer"
              style={{ borderColor: "var(--color-line)", color: "var(--color-brand)", background: "var(--color-brand-soft)" }}
            >
              Role Matrix
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-bold cursor-pointer"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Members List */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3 text-xs">
          {/* Owner row */}
          {owner && (
            <div className="p-3 rounded-xl border flex items-center justify-between" style={{ background: "var(--color-surface-2)", borderColor: "var(--color-line)" }}>
              <div className="flex items-center gap-2.5">
                <PulseAvatar name={owner.name} size={32} />
                <div>
                  <strong className="block font-semibold" style={{ color: "var(--color-ink)" }}>{owner.name}</strong>
                  <span className="text-[11px]" style={{ color: "var(--color-ink-muted)" }}>{owner.email}</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white uppercase tracking-wider" style={{ background: "var(--color-brand)" }}>
                👑 Owner
              </span>
            </div>
          )}

          {/* Members rows */}
          {members.map((m, idx) => {
            const u = m.user || m;
            const role = m.role || 'member';
            return (
              <div
                key={u._id || idx}
                className="p-3 rounded-xl border flex items-center justify-between"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
              >
                <div className="flex items-center gap-2.5">
                  <PulseAvatar name={u.name} size={32} />
                  <div>
                    <strong className="block font-semibold" style={{ color: "var(--color-ink)" }}>{u.name}</strong>
                    <span className="text-[11px]" style={{ color: "var(--color-ink-muted)" }}>{u.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentUserIsAdmin ? (
                    <select
                      value={role}
                      onChange={(e) => handleChangeRole(u._id, e.target.value)}
                      className="themed-select px-2 py-1 rounded-lg border text-xs font-medium outline-none capitalize cursor-pointer"
                      style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)", color: "var(--color-ink)" }}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                        role === 'admin' ? 'bg-[#ffe6e2] text-[#d93c30]' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {role}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Embedded Add Member Form */}
        {currentUserIsAdmin && (
          <form onSubmit={handleAddMember} className="p-4 border-t space-y-2" style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)" }}>
            <span className="text-xs font-semibold block" style={{ color: "var(--color-ink)" }}>Add Team Member</span>
            <div className="flex items-center gap-2">
              <input
                type="email"
                placeholder="User email address…"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border outline-none"
                style={{ borderColor: "var(--color-line)", background: "var(--color-surface)", color: "var(--color-ink)" }}
              />
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                className="themed-select px-2.5 py-1.5 text-xs rounded-xl border outline-none"
                style={{ borderColor: "var(--color-line)", background: "var(--color-surface)", color: "var(--color-ink)" }}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl text-white cursor-pointer"
                style={{ background: "var(--color-brand)" }}
              >
                {submitting ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Permission Matrix Modal */}
      {showPermissionMatrix && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowPermissionMatrix(false)}
        >
          <div
            className="rounded-2xl border p-6 max-w-lg w-full shadow-2xl space-y-4"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-display text-base font-bold" style={{ color: "var(--color-ink)" }}>
                Role Permissions Matrix
              </h4>
              <button
                type="button"
                onClick={() => setShowPermissionMatrix(false)}
                className="text-xs font-bold text-gray-500 hover:text-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--color-line)" }}>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--color-ink)" }}>Capability</th>
                    <th className="py-2 px-2 font-semibold">Viewer</th>
                    <th className="py-2 px-2 font-semibold">Member</th>
                    <th className="py-2 px-2 font-semibold">Admin</th>
                    <th className="py-2 px-2 font-semibold" style={{ color: "var(--color-brand)" }}>Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[11px]" style={{ borderColor: "var(--color-line)" }}>
                  <tr>
                    <td className="text-left py-2 px-2 font-medium">View board & analytics</td>
                    <td className="text-green-600 font-bold">✓</td>
                    <td className="text-green-600 font-bold">✓</td>
                    <td className="text-green-600 font-bold">✓</td>
                    <td className="text-green-600 font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="text-left py-2 px-2 font-medium">Move cards / Toggle status</td>
                    <td className="text-red-400 font-bold">-</td>
                    <td className="text-green-600 font-bold">✓</td>
                    <td className="text-green-600 font-bold">✓</td>
                    <td className="text-green-600 font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="text-left py-2 px-2 font-medium">Log effort time entries</td>
                    <td className="text-red-400 font-bold">-</td>
                    <td className="text-green-600 font-bold">✓</td>
                    <td className="text-green-600 font-bold">✓</td>
                    <td className="text-green-600 font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="text-left py-2 px-2 font-medium">Create & edit tasks</td>
                    <td className="text-red-400 font-bold">-</td>
                    <td className="text-green-600 font-bold">✓</td>
                    <td className="text-green-600 font-bold">✓</td>
                    <td className="text-green-600 font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="text-left py-2 px-2 font-medium">Manage lists & sprints</td>
                    <td className="text-red-400 font-bold">-</td>
                    <td className="text-red-400 font-bold">-</td>
                    <td className="text-green-600 font-bold">✓</td>
                    <td className="text-green-600 font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="text-left py-2 px-2 font-medium">Manage team & roles</td>
                    <td className="text-red-400 font-bold">-</td>
                    <td className="text-red-400 font-bold">-</td>
                    <td className="text-green-600 font-bold">✓</td>
                    <td className="text-green-600 font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="text-left py-2 px-2 font-medium">Delete board</td>
                    <td className="text-red-400 font-bold">-</td>
                    <td className="text-red-400 font-bold">-</td>
                    <td className="text-red-400 font-bold">-</td>
                    <td className="text-green-600 font-bold">✓</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-gray-500 pt-1">
              * Viewers have read-only affordances. Disabled controls carry explanatory tooltips.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
