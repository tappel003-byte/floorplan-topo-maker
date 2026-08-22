/** Distress Survey yellow set-square — plan / measure glyph. */
export function SetSquareIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M8 56V12L52 56H8Z"
        fill="#F9D033"
        stroke="#1a1a1a"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M14 50H44" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M14 44H38" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M14 38H32" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M14 32H26" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path
        d="M16 20l3 3M22 26l3 3M28 32l3 3M34 38l3 3M40 44l3 3"
        stroke="#1a1a1a"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
