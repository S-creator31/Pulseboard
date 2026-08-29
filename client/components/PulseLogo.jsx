export default function PulseLogo({ size = "md", withWordmark = true, className = "" }) {
  const dims = { sm: 22, md: 28, lg: 36 }[size] ?? 28;
  const textSize = { sm: "text-base", md: "text-lg", lg: "text-2xl" }[size] ?? "text-lg";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={dims}
        height={dims}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="pulseMark" x1="2" y1="4" x2="30" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--color-brand)" />
            <stop offset="1" stopColor="var(--color-accent)" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="28" height="28" rx="9" fill="url(#pulseMark)" />
        <path
          d="M7 17.5H11.2L13.4 12L18 21L20.4 17.5H25"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {withWordmark && (
        <span className={`font-display font-semibold tracking-tight ${textSize}`} style={{ color: "var(--color-ink)" }}>
          Pulseboard
        </span>
      )}
    </span>
  );
}
