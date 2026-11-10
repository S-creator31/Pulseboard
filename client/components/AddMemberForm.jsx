import { useState } from "react";
import axios from 'axios';
import PulseAvatar from "./PulseAvatar";

const AddMemberForm = ({ boardId, token, members, currentUserIsAdmin }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('member');
    const [message, setMessage] = useState('');
    const [open, setOpen] = useState(false);

    const handleAddMember = async () => {
        try {
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/boards/${boardId}/members`,
                { email, role },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage('Member added successfully');
            setEmail('');
        } catch (err) {
            setMessage(err.response?.data?.message || 'Error adding member');
        }
    };

    return (
        <div className="mb-6">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex -space-x-2">
                    {members.map((member) => (
                        member.user && (
                            <PulseAvatar key={member.user._id} name={member.user.name} size={30} ring />
                        )
                    ))}
                </div>

                {currentUserIsAdmin && (
                    <button
                        onClick={() => setOpen((v) => !v)}
                        className="text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer"
                        style={{ borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
                    >
                        {open ? "Close" : "+ Add member"}
                    </button>
                )}
            </div>

            {open && (
                <div
                    className="mt-3 rounded-xl border p-4"
                    style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
                >
                    <div className="flex flex-wrap items-center gap-2.5">
                        <input
                            type="email"
                            placeholder="teammate@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] outline-none"
                            style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)", color: "var(--color-ink)" }}
                        />
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="themed-select border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)", color: "var(--color-ink)" }}
                        >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                        </select>
                        <button
                            onClick={handleAddMember}
                            className="text-sm font-semibold text-white px-3.5 py-2 rounded-lg cursor-pointer"
                            style={{ background: "var(--color-brand)" }}
                        >
                            Add
                        </button>
                    </div>
                    {message && (
                        <p className="text-xs mt-2.5" style={{ color: "var(--color-ink-muted)" }}>{message}</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default AddMemberForm
