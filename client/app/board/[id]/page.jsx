'use client'

import { List } from '@/components/List';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import ActivityLog from '@/components/ActivityLog';
import AddMemberForm from '@/components/AddMemberForm';
import PulseLogo from '@/components/PulseLogo';
import { boardColor } from '@/lib/colors';
import Link from 'next/link';


export default function BoardDetailsPage() {

    const { user, loading } = useAuth();
    const token = user?.token;
    const router = useRouter();
    const pathname = usePathname();
    const boardId = pathname.split('/').pop();

    const [board, setBoard] = useState(null);
    const [lists, setLists] = useState([]);
    const [newListTitle, setNewListTitle] = useState('');
    const [taskTitles, setTaskTitles] = useState({});
    const [assignedTo, setAssignedTo] = useState({});
    const [members, setMembers] = useState([]);
    const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
    const [error, setError] = useState('');
    const [addingList, setAddingList] = useState(false);

    const fetchBoardAndLists = async () => {
        try {
            const [boardRes, listRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards/${boardId}`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/lists/board/${boardId}`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` }
                }),
            ]);

            const boardData = await boardRes.json();
            const listData = await listRes.json();

            if (!boardRes.ok) throw new Error(boardData.message);
            if (!listRes.ok) throw new Error(listData.message);

            setBoard(boardData);
            setLists(listData);
            setMembers(boardData.members || []);

            const userId = user?.id || user?._id;

            const isAdmin = boardData.owner._id === userId ||
                boardData.members?.some((m) => m.user._id === userId && m.role === 'admin');

            setCurrentUserIsAdmin(isAdmin);

        } catch (err) {
            setError(err.message || 'Error fetching board')
        }
    };

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
            return;
        }
        if (token) fetchBoardAndLists();
    }, [loading, user, boardId, router]);

    const handleCreateList = async () => {
        if (!newListTitle.trim())
            return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lists`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ title: newListTitle, boardId })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            setLists((prev) => [...prev, data]);
            setNewListTitle('');
            setAddingList(false);
        } catch (err) {
            setError(err.message || 'Error creating list');
        }
    };

    const handleTaskInputChange = (listId, value) => {
        setTaskTitles((prev) => ({ ...prev, [listId]: value }));
    };

    const handleCreateTask = async (listId) => {
        const title = taskTitles[listId]?.trim();
        const assignedUserId = assignedTo[listId];
        if (!title)
            return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ title, listId, boardId, assignedTo: assignedUserId })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            setLists((prevLists) =>
                prevLists.map((list) =>
                    list._id === listId ? { ...list, tasks: [...(list.tasks || []), data] } : list)
            );
            setTaskTitles((prev) => ({ ...prev, [listId]: '' }));
        } catch (err) {
            setError(err.message || 'Error creating task');
        }
    };

    const updateRole = async (memberId, newRole) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards/${boardId}/members/${memberId}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ newRole })
            })

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            fetchBoardAndLists();
        } catch (err) {
            alert('Error updating role:' + err.message);
        }
    }

    const handleDropTask = async (taskId, targetListId) => {
        try {
            let sourceListId = null;
            let movedTask = null;

            const updatedLists = lists.map((list) => {
                const taskIndex = list.tasks.findIndex((task) => task._id === taskId);
                if (taskIndex !== -1) {
                    sourceListId = list._id;
                    movedTask = list.tasks[taskIndex];

                    const newTasks = [...list.tasks];
                    newTasks.splice(taskIndex, 1);

                    return { ...list, tasks: newTasks };
                }
                return list;
            });

            if (!movedTask || !sourceListId) return;
            if (sourceListId === targetListId) return;

            const finalLists = updatedLists.map((list) => {
                if (list._id === targetListId) {
                    return { ...list, tasks: [...list.tasks, movedTask] };
                }
                return list;
            });

            setLists(finalLists);

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}/move`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ listId: targetListId })
            });

            if (!res.ok) throw new Error('Failed to move task');

            const updatedRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lists/board/${boardId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const updatedLists2 = await updatedRes.json();
            setLists(updatedLists2);
        } catch (err) {
            console.error('Error moving task:', err.message);
            fetchBoardAndLists();
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token')
        router.push('/login');
    }

    const handleDeleteBoard = async () => {
        if (!confirm("Are you sure you want to delete this board? This action cannot be undone")) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards/${boardId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to delete board');
            }

            router.push('/dashboard');
        } catch (err) {
            alert(err.message)
        }
    };

    const handleDeleteTask = async (taskId) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to delete task')
            }

            const updateRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lists/board/${boardId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const updatedLists = await updateRes.json();
            setLists(updatedLists)
        } catch (err) {
            alert('Error deleting task:' + err.message)
        }
    };

    const handleDeleteList = async (listId) => {
        if (!confirm('Are you sure want to delete this list?')) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lists/${listId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to delete list');
            }

            setLists(prev => prev.filter(list => list._id !== listId));
        } catch (err) {
            alert(err.message);
        }
    };

    const c = boardColor(board?.color);

    return (
        <div className="min-h-screen" style={{ background: "var(--color-paper)" }}>

            <header className="border-b" style={{ borderColor: "var(--color-line)" }}>
                <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard"><PulseLogo size="sm" /></Link>
                        {board && (
                            <>
                                <span className="w-px h-5" style={{ background: "var(--color-line)" }} />
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.solid }} />
                                <h1 className="font-display text-lg font-semibold" style={{ color: "var(--color-ink)" }}>
                                    {board.title}
                                </h1>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {currentUserIsAdmin && (
                            <button
                                onClick={handleDeleteBoard}
                                className="text-sm font-medium px-3 py-1.5 rounded-lg cursor-pointer"
                                style={{ color: "var(--color-danger)" }}
                            >
                                Delete board
                            </button>
                        )}
                        <button
                            onClick={handleLogout}
                            className="text-sm font-medium px-3 py-1.5 rounded-lg cursor-pointer"
                            style={{ color: "var(--color-ink-muted)" }}
                        >
                            Log out
                        </button>
                    </div>
                </div>
            </header>

            {!board && !error && (
                <p className="text-center py-16 text-sm" style={{ color: "var(--color-ink-muted)" }}>Loading…</p>
            )}
            {error && !board && (
                <p className="text-center py-16 text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>
            )}

            {board && (
                <main className="max-w-[1400px] mx-auto px-6 py-6">

                    <AddMemberForm boardId={board._id} token={token} members={members} currentUserIsAdmin={currentUserIsAdmin} />

                    <div className="flex gap-4 overflow-x-auto pb-4 items-start">
                        {lists.map((list) => (
                            <div key={list._id} className="w-[280px] shrink-0">
                                <List list={list} onDropTask={handleDropTask} onDeleteTask={handleDeleteTask} onDeleteList={handleDeleteList} />

                                <div className="mt-2 space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Add a task…"
                                        value={taskTitles[list._id] || ''}
                                        onChange={(e) => handleTaskInputChange(list._id, e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateTask(list._id)}
                                        className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                                        style={{ borderColor: "var(--color-line)", background: "var(--color-surface)", color: "var(--color-ink)" }}
                                    />
                                    <select
                                        value={assignedTo[list._id] || ''}
                                        onChange={(e) =>
                                            setAssignedTo((prev) => ({ ...prev, [list._id]: e.target.value }))
                                        }
                                        className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                                        style={{ borderColor: "var(--color-line)", background: "var(--color-surface)", color: "var(--color-ink-muted)" }}
                                    >
                                        <option value="">Assign to…</option>
                                        {members.map(
                                            (member, index) =>
                                                member.user && (
                                                    <option key={index} value={member.user._id}>
                                                        {member.user.name}
                                                    </option>
                                                )
                                        )}
                                    </select>
                                    <button
                                        onClick={() => handleCreateTask(list._id)}
                                        className="w-full text-sm font-medium py-2 rounded-xl cursor-pointer"
                                        style={{ color: "var(--color-brand)", background: "var(--color-brand-soft)" }}
                                    >
                                        + Add task
                                    </button>
                                </div>
                            </div>
                        ))}

                        <div className="w-[280px] shrink-0">
                            {addingList ? (
                                <div
                                    className="rounded-2xl border p-3.5 space-y-2"
                                    style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
                                >
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="List name"
                                        value={newListTitle}
                                        onChange={(e) => setNewListTitle(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
                                        className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                                        style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCreateList}
                                            className="text-sm font-semibold text-white px-3 py-1.5 rounded-lg cursor-pointer"
                                            style={{ background: "var(--color-brand)" }}
                                        >
                                            Add list
                                        </button>
                                        <button
                                            onClick={() => { setAddingList(false); setNewListTitle(''); }}
                                            className="text-sm px-3 py-1.5 rounded-lg cursor-pointer"
                                            style={{ color: "var(--color-ink-muted)" }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setAddingList(true)}
                                    className="w-full rounded-2xl border-2 border-dashed py-4 text-sm font-medium transition-colors cursor-pointer"
                                    style={{ borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
                                >
                                    + Add another list
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 max-w-md">
                        <ActivityLog boardId={boardId} />
                    </div>
                </main>
            )}
        </div>
    );
}
