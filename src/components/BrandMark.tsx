/** MayAIStudio mark: an "M" drawn as two peaks (travel) with a rising sun, on a navy tile. Same art as app/icon.svg. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="bm-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset="1" stopColor="#0b1222" />
        </linearGradient>
        <linearGradient id="bm-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7aa2ff" />
          <stop offset="1" stopColor="#2c5fd6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#bm-tile)" />
      <circle cx="21.5" cy="7.5" r="2.6" fill="url(#bm-sun)" />
      <path
        d="M7.5 23V12.5l5.75 6.75L16 16l2.75 3.25L24.5 12.5V23"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
