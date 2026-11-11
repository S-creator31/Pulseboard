'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { io } from 'socket.io-client';

import { List } from '@/components/List';
import BoardNav from '@/components/BoardNav';
import BoardStatRail from '@/components/BoardStatRail';
import TaskDetailModal from '@/components/TaskDetailModal';
import ActivityLogDrawer from '@/components/ActivityLogDrawer';
import MembersPanel from '@/components/MembersPanel';
import CommandPalette from '@/components/CommandPalette';
import ShortcutsModal from '@/components/ShortcutsModal';

export default function BoardDetailsPage() {
  const { user, loading: authLoading } = useAuth();
  const token = user?.token;
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const boardId = params.id;

  // Board and Lists state
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const [newListTitle, setNewListTitle] = useState('');
  const [taskTitles, setTaskTitles] = useState({});
  const [assignedTo, setAssignedTo] = useState({});
  const [error, setError] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [activeSprint, setActiveSprint] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [syncConnected, setSyncConnected] = useState(false);

  // UI state & Modals
  const [selectedTask, setSelectedTask] = useState(null);
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [density, setDensity] = useState('comfortable');

  // Filter Bar state (driven by URL params)
  const assigneeFilter = searchParams.get('assignee') || '';
  const priorityFilter = searchParams.get('priority') || '';
  const blockedOnly = searchParams.get('blocked') === 'true';
  const searchQuery = searchParams.get('q') || '';

  // Density persistence
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pulseboard_density');
      if (saved) setDensity(saved);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  const handleToggleDensity = () => {
    const next = density === 'comfortable' ? 'compact' : 'comfortable';
    setDensity(next);
    try {
      localStorage.setItem('pulseboard_density', next);
    } catch (e) {
      console.warn(e);
    }
  };

  const updateFilters = (newParams) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([k, v]) => {
      if (v) sp.set(k, v);
      else sp.delete(k);
    });
    router.replace(`/board/${boardId}?${sp.toString()}`);
  };

  const fetchBoardAndLists = useCallback(async () => {
    if (!token || !boardId) return;

    try {
      const [boardRes, listRes, sprintRes, depRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards/${boardId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/lists/board/${boardId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/sprints/board/${boardId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards/${boardId}/graph`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (boardRes.ok) {
        const bData = await boardRes.json();
        setBoard(bData);
      }
      if (listRes.ok) {
        const lData = await listRes.json();
        listsRef.current = lData;
        setLists(lData);
      }
      if (sprintRes.ok) {
        const sData = await sprintRes.json();
        setSprints(sData);
        const active = sData.find(s => s.status === 'active') || sData[0];
        setActiveSprint(active);
      }
      if (depRes.ok) {
        const gData = await depRes.json();
        setDependencies(gData.edges || []);
      }
    } catch (err) {
      setError(err.message || 'Error fetching board data');
    }
  }, [boardId, token]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (token) fetchBoardAndLists();
  }, [authLoading, user, token, fetchBoardAndLists, router]);

  // A single authenticated socket per board handles live card moves and presence.
  useEffect(() => {
    if (!token || !boardId) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const socket = io(new URL(apiUrl).origin, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true
    });
    let connectedOnce = false;

    socket.on('connect', () => {
      if (connectedOnce) fetchBoardAndLists();
      connectedOnce = true;
      setSyncConnected(true);
      socket.emit('board:join', boardId, (result) => {
        if (!result?.ok) {
          setActiveUsers([]);
          toast.error(result?.message || 'Could not join live board sync');
          return;
        }
        setActiveUsers(result.activeUsers || []);
      });
    });
    socket.on('disconnect', () => {
      setSyncConnected(false);
      setActiveUsers([]);
    });
    socket.on('connect_error', () => {
      setSyncConnected(false);
      setActiveUsers([]);
    });
    socket.on('board:presence', setActiveUsers);
    socket.on('task:moved', ({ task, toListId }) => {
      setLists((current) => {
        let movedTask = task;
        const withoutTask = current.map((list) => ({
          ...list,
          tasks: (list.tasks || []).filter((item) => {
            if (item._id !== task?._id) return true;
            movedTask = item;
            return false;
          })
        }));
        if (!movedTask || !withoutTask.some((list) => list._id === toListId)) return current;
        const nextLists = withoutTask.map((list) => list._id === toListId
          ? { ...list, tasks: [...(list.tasks || []), { ...movedTask, ...task, list: toListId }] }
          : list);
        listsRef.current = nextLists;
        return nextLists;
      });
    });
    socket.on('task:status', ({ task }) => {
      setLists((current) => current.map((list) => ({
        ...list,
        tasks: (list.tasks || []).map((item) => item._id === task?._id
          ? { ...item, ...task }
          : item)
      })));
    });
    socket.on('task:deleted', ({ taskId }) => {
      setLists((current) => current.map((list) => ({
        ...list,
        tasks: (list.tasks || []).filter((item) => item._id !== taskId)
      })));
    });
    socket.on('list:deleted', ({ listId }) => {
      setLists((current) => current.filter((list) => list._id !== listId));
    });
    socket.on('board:member-role-updated', ({ memberId, role }) => {
      setBoard((current) => current ? {
        ...current,
        members: (current.members || []).map((member) => {
          const user = member.user || member;
          return String(user._id || user) === String(memberId) ? { ...member, role } : member;
        })
      } : current);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [boardId, token, fetchBoardAndLists]);

  // Keyboard shortcut listener (? for shortcuts, ⌘K for command palette)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowActivityDrawer(false);
        setShowMembersPanel(false);
        setShowCommandPalette(false);
        setShowShortcuts(false);
        setSelectedTask(null);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        return;
      }

      const target = e.target;
      if (
        target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA'].includes(target.tagName)
      ) return;

      if (e.key === '?') {
        setShowShortcuts(prev => !prev);
      } else if (e.key === 'd' || e.key === 'D') {
        handleToggleDensity();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [density]);

  const userId = user?.id || user?._id;
  const currentUserIsAdmin = String(board?.owner?._id || board?.owner || '') === String(userId || '') ||
    board?.members?.some((member) =>
      String(member.user?._id || member.user) === String(userId || '') && member.role === 'admin'
    );

  // Identify blocked tasks
  const blockedTaskIds = useMemo(() => {
    const allTasks = lists.flatMap(l => l.tasks || []);
    const taskIds = new Set(allTasks.map(t => t._id.toString()));
    const doneTaskIds = new Set(allTasks.filter(t => t.status === 'done').map(t => t._id.toString()));
    const blocked = new Set();

    dependencies.forEach(dep => {
      const pred = (dep.predecessor?._id || dep.predecessor).toString();
      const succ = (dep.successor?._id || dep.successor).toString();
      if (taskIds.has(pred) && taskIds.has(succ) && !doneTaskIds.has(pred)) {
        blocked.add(succ);
      }
    });

    return blocked;
  }, [lists, dependencies]);

  // Filtered lists based on filter bar
  const displayedLists = useMemo(() => {
    return lists.map(list => {
      let tasks = list.tasks || [];

      if (assigneeFilter) {
        tasks = tasks.filter(t => (t.assignedTo?._id || t.assignedTo) === assigneeFilter);
      }

      if (priorityFilter) {
        tasks = tasks.filter(t => t.priority === priorityFilter);
      }

      if (blockedOnly) {
        tasks = tasks.filter(t => blockedTaskIds.has(t._id));
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        tasks = tasks.filter(t => (t.title || '').toLowerCase().includes(q));
      }

      return { ...list, tasks };
    });
  }, [lists, assigneeFilter, priorityFilter, blockedOnly, searchQuery, blockedTaskIds]);

  // Card Move with Optimistic update + Undo toast
  const handleDropTask = async (taskId, targetListId, expectedSourceListId = null) => {
    let sourceListId = null;
    let movedTask = null;
    const currentLists = listsRef.current;

    const updatedLists = currentLists.map((list) => {
      const taskIndex = (list.tasks || []).findIndex((task) => task._id === taskId);
      if (taskIndex !== -1) {
        sourceListId = list._id;
        movedTask = list.tasks[taskIndex];
        const newTasks = [...list.tasks];
        newTasks.splice(taskIndex, 1);
        return { ...list, tasks: newTasks };
      }
      return list;
    });

    if (!movedTask || !sourceListId || sourceListId === targetListId) return;
    if (expectedSourceListId && sourceListId !== expectedSourceListId) {
      toast.error('This card has moved since this undo action was created.');
      await fetchBoardAndLists();
      return;
    }

    const finalLists = updatedLists.map((list) => {
      if (list._id === targetListId) {
        return { ...list, tasks: [...(list.tasks || []), { ...movedTask, list: targetListId }] };
      }
      return list;
    });

    // Update the ref immediately so a following drop/undo uses this move.
    listsRef.current = finalLists;
    setLists(finalLists);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}/move`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ listId: targetListId })
      });

      if (res.status === 409) {
        await fetchBoardAndLists();
        throw new Error('This card was moved concurrently. The board has been refreshed.');
      }
      if (!res.ok) throw new Error('Failed to move task');

      const targetList = currentLists.find(l => l._id === targetListId);
      toast.success(`Moved "${movedTask.title}" to ${targetList?.title || 'column'}`, {
        action: {
          label: 'Undo',
          onClick: () => handleDropTask(taskId, sourceListId, targetListId)
        }
      });
    } catch (err) {
      toast.error('Could not move task: ' + err.message);
      // A refresh avoids rolling another user's already-committed move back locally.
      await fetchBoardAndLists();
    }
  };

  // Toggle status checkbox
  const handleToggleStatus = async (taskId, newStatus) => {
    const prevLists = lists;
    setLists((prev) =>
      prev.map((list) => ({
        ...list,
        tasks: (list.tasks || []).map((task) =>
          task._id === taskId ? { ...task, status: newStatus } : task
        ),
      }))
    );

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error('Failed to update status');
      toast.success(newStatus === 'done' ? 'Card completed!' : 'Card reopened');
    } catch (err) {
      toast.error('Error updating status');
      setLists(prevLists);
    }
  };

  // Create Task
  const handleCreateTask = async (listId) => {
    const title = taskTitles[listId]?.trim();
    const assignedUserId = assignedTo[listId];
    if (!title) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          listId,
          boardId,
          assignedTo: assignedUserId || null,
          sprint: activeSprint?._id || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }

      const newTask = await res.json();
      setLists(prev =>
        prev.map(l => l._id === listId ? { ...l, tasks: [...(l.tasks || []), newTask] } : l)
      );
      setTaskTitles(prev => ({ ...prev, [listId]: '' }));
      toast.success(`Task "${title}" created`);
    } catch (err) {
      toast.error('Error creating task: ' + err.message);
    }
  };

  // Delete Task with Undo toast
  const handleDeleteTask = async (taskId) => {
    const taskToDelete = lists.flatMap(l => l.tasks || []).find(t => t._id === taskId);
    const prevLists = lists;

    setLists(prev =>
      prev.map(l => ({ ...l, tasks: (l.tasks || []).filter(t => t._id !== taskId) }))
    );

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete task');

      toast.success(`Deleted task "${taskToDelete?.title || ''}"`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            if (taskToDelete) {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                  title: taskToDelete.title,
                  listId: taskToDelete.list,
                  boardId,
                  assignedTo: taskToDelete.assignedTo?._id || null
                })
              });
              fetchBoardAndLists();
            }
          }
        }
      });
    } catch (err) {
      toast.error('Error deleting task');
      setLists(prevLists);
    }
  };

  // Create List
  const handleCreateList = async () => {
    if (!newListTitle.trim()) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: newListTitle.trim(), boardId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setLists(prev => [...prev, data]);
      setNewListTitle('');
      setAddingList(false);
      toast.success(`List "${data.title}" added`);
    } catch (err) {
      toast.error(err.message || 'Error creating list');
    }
  };

  // Delete List
  const handleDeleteList = async (listId) => {
    if (!confirm('Are you sure want to delete this list and all its cards?')) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lists/${listId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete list');
      setLists(prev => prev.filter(l => l._id !== listId));
      toast.success('List deleted');
    } catch (err) {
      toast.error(err.message || 'Error deleting list');
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--color-paper)" }}>
      
      {/* 1. SHARED TOP NAVIGATION */}
      <BoardNav
        board={board}
        activeTab="board"
        members={board?.members || []}
        onOpenMembers={() => setShowMembersPanel(true)}
        onOpenActivity={() => setShowActivityDrawer(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        activeAssigneeFilter={assigneeFilter}
        density={density}
        onToggleDensity={handleToggleDensity}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4">

        <div className="flex items-center justify-end gap-2 text-xs" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${syncConnected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          <span style={{ color: 'var(--color-ink-muted)' }}>
            {syncConnected ? 'Live sync' : 'Reconnecting'}
          </span>
          {activeUsers.length > 0 && (
            <span className="rounded-full px-2 py-1" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}>
              {activeUsers.length} active: {activeUsers.map((activeUser) => activeUser.name).join(', ')}
            </span>
          )}
        </div>

        {/* 2. BOARD STAT RAIL DIRECTLY UNDER HEADER */}
        {activeSprint && (
          <BoardStatRail
            boardId={boardId}
            activeSprint={{
              name: activeSprint.name,
              daysRemaining: Math.max(0, Math.ceil((new Date(activeSprint.endsOn) - new Date()) / (1000 * 60 * 60 * 24))),
              committedPoints: activeSprint.committedPoints || 36,
              completedPoints: lists.find(l => l.statusKey === 'done')?.tasks?.reduce((sum, t) => sum + (t.storyPoints || 0), 0) || 23,
              blockedCount: blockedTaskIds.size
            }}
          />
        )}

        {/* 3. FILTER BAR: Assignees, Priority, Blocked Only, Search */}
        <div
          className="rounded-xl border px-3.5 py-2 flex items-center justify-between gap-3 text-xs flex-wrap"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        >
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="font-semibold text-[11px] uppercase tracking-wider mr-1" style={{ color: "var(--color-ink-muted)" }}>
              Filter:
            </span>

            {/* Assignee Filter Pills */}
            <button
              type="button"
              onClick={() => updateFilters({ assignee: '' })}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                !assigneeFilter ? 'border text-[#6d28f5]' : 'text-gray-500'
              }`}
              style={{
                background: !assigneeFilter ? "var(--color-brand-soft)" : "transparent",
                borderColor: !assigneeFilter ? "var(--color-brand)" : "transparent"
              }}
            >
              Everyone
            </button>

            {(board?.members || []).map((m, idx) => {
              const u = m.user || m;
              const isSelected = assigneeFilter === u._id;
              return (
                <button
                  key={u._id || idx}
                  type="button"
                  onClick={() => updateFilters({ assignee: isSelected ? '' : u._id })}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                    isSelected ? 'shadow-sm' : ''
                  }`}
                  style={{
                    background: isSelected ? "var(--color-brand-soft)" : "var(--color-surface-2)",
                    borderColor: isSelected ? "var(--color-brand)" : "var(--color-line)",
                    color: isSelected ? "var(--color-brand)" : "var(--color-ink)"
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: isSelected ? "var(--color-brand)" : "gray" }} />
                  <span>{u.name}</span>
                </button>
              );
            })}

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => updateFilters({ priority: e.target.value })}
              className="themed-select px-2 py-1 rounded-lg border outline-none text-xs cursor-pointer ml-1"
              style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)", color: "var(--color-ink)" }}
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Blocked Only Toggle */}
            <label className="inline-flex items-center gap-1.5 ml-1 px-2.5 py-1 rounded-lg border cursor-pointer select-none" style={{ borderColor: "var(--color-line)", background: blockedOnly ? "var(--color-danger-soft)" : "transparent" }}>
              <input
                type="checkbox"
                checked={blockedOnly}
                onChange={(e) => updateFilters({ blocked: e.target.checked ? 'true' : '' })}
                className="rounded accent-[#f04438] cursor-pointer"
              />
              <span className="text-[11px] font-semibold" style={{ color: blockedOnly ? "var(--color-danger)" : "var(--color-ink-muted)" }}>
                Blocked Only ({blockedTaskIds.size})
              </span>
            </label>
          </div>

          {/* Quick search input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter tasks…"
              value={searchQuery}
              onChange={(e) => updateFilters({ q: e.target.value })}
              className="px-2.5 py-1 rounded-lg border outline-none text-xs w-36 sm:w-44"
              style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)" }}
            />
            {(assigneeFilter || priorityFilter || blockedOnly || searchQuery) && (
              <button
                type="button"
                onClick={() => router.replace(`/board/${boardId}`)}
                className="text-[11px] underline cursor-pointer text-gray-500 hover:text-black"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* 4. KANBAN BOARD COLUMNS */}
        <div className="flex gap-4 overflow-x-auto pb-6 items-start">
          {displayedLists.map((list) => (
            <div key={list._id} className="w-[300px] shrink-0">
              <List
                list={list}
                onDropTask={handleDropTask}
                onDeleteTask={handleDeleteTask}
                onDeleteList={handleDeleteList}
                onToggleStatus={handleToggleStatus}
                onClickTask={(task) => setSelectedTask(task)}
                density={density}
                blockedTaskIds={blockedTaskIds}
              />

              {/* Task Creation in Column Footer */}
              <div className="mt-2.5 space-y-2 p-2 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
                <input
                  type="text"
                  placeholder="Task title…"
                  value={taskTitles[list._id] || ''}
                  onChange={(e) => setTaskTitles(prev => ({ ...prev, [list._id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTask(list._id)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none"
                  style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)" }}
                />

                <div className="flex items-center gap-2">
                  <select
                    value={assignedTo[list._id] || ''}
                    onChange={(e) => setAssignedTo(prev => ({ ...prev, [list._id]: e.target.value }))}
                    className="themed-select flex-1 text-[11px] px-2 py-1 rounded-lg border outline-none cursor-pointer"
                    style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)", color: "var(--color-ink)" }}
                  >
                    <option value="">Assign to…</option>
                    {(board?.members || []).map((m, idx) => {
                      const u = m.user || m;
                      return (
                        <option key={u._id || idx} value={u._id}>
                          {u.name}
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleCreateTask(list._id)}
                    className="px-3 py-1 text-xs font-semibold rounded-lg text-white cursor-pointer"
                    style={{ background: "var(--color-brand)" }}
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add Another List Column */}
          <div className="w-[300px] shrink-0">
            {addingList ? (
              <div className="rounded-2xl border p-4 space-y-2 shadow-sm" style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="List name (e.g. Review, QA)…"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
                  className="w-full text-xs px-3 py-2 rounded-lg border outline-none"
                  style={{ borderColor: "var(--color-line)" }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateList}
                    className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg cursor-pointer"
                    style={{ background: "var(--color-brand)" }}
                  >
                    Add Column
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingList(false); setNewListTitle(''); }}
                    className="text-xs px-3 py-1.5 rounded-lg cursor-pointer text-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingList(true)}
                className="w-full rounded-2xl border-2 border-dashed py-6 text-xs font-semibold transition-colors cursor-pointer"
                style={{ borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
              >
                + Add another list
              </button>
            )}
          </div>
        </div>

      </main>

      {/* MODALS & DRAWERS */}
      <TaskDetailModal
        task={selectedTask}
        boardId={boardId}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={fetchBoardAndLists}
        members={board?.members || []}
        allTasks={lists.flatMap(l => l.tasks || [])}
        sprints={sprints}
      />

      <ActivityLogDrawer
        boardId={boardId}
        isOpen={showActivityDrawer}
        onClose={() => setShowActivityDrawer(false)}
        members={board?.members || []}
      />

      <MembersPanel
        board={board}
        isOpen={showMembersPanel}
        onClose={() => setShowMembersPanel(false)}
        currentUserIsAdmin={currentUserIsAdmin}
        onMembersUpdated={fetchBoardAndLists}
      />

      <CommandPalette
        boardId={boardId}
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onOpenNewTask={() => {
          if (lists.length > 0) {
            setTaskTitles(prev => ({ ...prev, [lists[0]._id]: 'New task ' }));
          }
        }}
        onOpenShortcuts={() => setShowShortcuts(true)}
      />

      <ShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

    </div>
  );
}
