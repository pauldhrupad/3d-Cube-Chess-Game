/** Hand-drawn isometric cube mark: one face chequered, edges hairline. */
export function CubeMark({ className = "", size = 44 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 64 72"
      width={size}
      height={(size * 72) / 64}
      className={className}
      role="img"
      aria-label="4D Chess cube mark"
    >
      <defs>
        <g id="cc-edge">
          <path d="M32 8 L56 22 L56 50 L32 64 L8 50 L8 22 Z" />
        </g>
      </defs>
      {/* top face */}
      <path d="M32 8 L56 22 L32 36 L8 22 Z" fill="#EFE8D8" />
      {/* top checker, 2x2 */}
      <path d="M32 8 L44 15 L32 22 L20 15 Z" fill="#17140F" />
      <path d="M44 29 L56 22 L44 15 L32 22 Z" fill="#17140F" />
      <path d="M32 36 L44 29 L32 22 L20 29 Z" fill="#17140F" />
      {/* left face */}
      <path d="M8 22 L32 36 L32 64 L8 50 Z" fill="#D6402C" />
      {/* right face */}
      <path d="M32 36 L56 22 L56 50 L32 64 Z" fill="#24409A" />
      {/* hairline edges */}
      <g fill="none" stroke="#17140F" strokeWidth="1.6" strokeLinejoin="round">
        <use href="#cc-edge" />
        <path d="M8 22 L32 36 L56 22" />
        <path d="M32 36 L32 64" />
      </g>
    </svg>
  );
}
