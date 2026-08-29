import { colorForString, initials } from "@/lib/colors";

export default function PulseAvatar({ name, size = 28, ring = false }) {
  const c = colorForString(name || "?");
  return (
    <span
      title={name}
      className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${ring ? "ring-2" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.38),
        background: c.soft,
        color: c.text,
        ...(ring ? { boxShadow: `0 0 0 2px var(--color-surface)` } : {}),
      }}
    >
      {initials(name)}
    </span>
  );
}
