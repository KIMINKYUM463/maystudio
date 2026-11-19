/** Hand-drawn character face for a voice, derived from its id so each voice keeps the same face. */
export function VoiceAvatar({ seed, gender, size = 72 }: { seed: string; gender: "female" | "male"; size?: number }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hues = [214, 262, 190, 330, 24, 150, 280, 200];
  const bg = hues[h % hues.length];
  const skin = ["#F6D7C3", "#F1C9AE", "#EBC0A0", "#F8E0CF"][(h >> 3) % 4];
  const hair = ["#2B2522", "#3B2A22", "#5A3B2C", "#1E1C24", "#6B4A35"][(h >> 5) % 5];
  const style = (h >> 7) % 3;
  const id = `va-${seed.replace(/[^\w]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${bg} 85% 88%)`} />
          <stop offset="1" stopColor={`hsl(${bg} 70% 72%)`} />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="40" fill={`url(#${id})`} />
      {/* Long hair sits behind the face */}
      {gender === "female" ? <path d={style === 1 ? "M20 48c0-19 9-29 20-29s20 10 20 29v6H20z" : "M18 44c0-18 9-28 22-28s22 10 22 28v22H18z"} fill={hair} /> : null}
      {/* Shoulders */}
      <path d="M14 80c2-14 13-20 26-20s24 6 26 20z" fill={`hsl(${bg} 45% 40%)`} />
      <rect x="35" y="52" width="10" height="10" rx="4" fill={skin} />
      <ellipse cx="40" cy="40" rx="15" ry="17" fill={skin} />
      {/* Fringe / short hair */}
      {gender === "male" ? (
        <path d="M24 38c0-12 7-19 16-19s16 6 16 17c-4-5-10-7-16-7s-11 3-16 9z" fill={hair} />
      ) : style === 1 ? (
        // Side-parted fringe, sweeping to one side so both eyes stay visible.
        <path d="M24 37c1-10 8-16 16-16s15 6 16 16c-4-4-9-6-14-6-3 3-6 5-10 6-3 0-5 1-8 0z" fill={hair} />
      ) : style === 2 ? (
        // Straight bangs ending above the brows.
        <path d="M25 35c1-9 7-14 15-14s14 5 15 14c-5-2-10-3-15-3s-10 1-15 3z" fill={hair} />
      ) : (
        <path d="M25 37c1-10 7-16 15-16s14 6 15 16c-6-6-12-9-19-9-4 3-7 6-11 9z" fill={hair} />
      )}
      <circle cx="34" cy="41" r="1.8" fill="#2B2522" />
      <circle cx="46" cy="41" r="1.8" fill="#2B2522" />
      <ellipse cx="31" cy="46" rx="2.6" ry="1.5" fill="#F2A3A3" opacity="0.55" />
      <ellipse cx="49" cy="46" rx="2.6" ry="1.5" fill="#F2A3A3" opacity="0.55" />
      <path d="M36 48c2 2.2 6 2.2 8 0" fill="none" stroke="#B5615A" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
