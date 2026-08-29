// Pulseboard shared color system for boards, lists, and avatars.
// Kept in one place so the UI (dashboard cards, board headers, list rails,
// avatar chips) and the "pick a color" control in Create Board all agree
// on the same five swatches.

export const BOARD_COLORS = {
  violet: { label: "Violet", solid: "#6D28F5", soft: "#EFE7FF", text: "#5416E0" },
  coral: { label: "Coral", solid: "#FF5A4E", soft: "#FFE6E2", text: "#D93C30" },
  teal: { label: "Teal", solid: "#0E9384", soft: "#DDF6F1", text: "#0B7A6E" },
  amber: { label: "Amber", solid: "#F79009", soft: "#FEF3E0", text: "#B45F06" },
  pink: { label: "Pink", solid: "#EE46BC", soft: "#FCE4F5", text: "#C22C97" },
};

export const BOARD_COLOR_KEYS = Object.keys(BOARD_COLORS);

export function boardColor(key) {
  return BOARD_COLORS[key] || BOARD_COLORS.violet;
}

// Deterministic color assignment for things that don't carry their own
// color (list rails, avatar chips) — same input always yields same color,
// so a list or person reads consistently across the whole board.
export function colorForString(input = "") {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  const key = BOARD_COLOR_KEYS[hash % BOARD_COLOR_KEYS.length];
  return boardColor(key);
}

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
