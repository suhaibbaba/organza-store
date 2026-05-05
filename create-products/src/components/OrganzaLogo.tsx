export function OrganzaLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="38" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <path
        d="M40 10 C52 10 62 20 62 32 C62 44 52 52 40 52 C28 52 18 44 18 32 C18 20 28 10 40 10Z"
        fill="rgba(255,255,255,0.15)"
      />
      <path
        d="M40 28 C52 28 62 38 62 50 C62 62 52 70 40 70 C28 70 18 62 18 50 C18 38 28 28 40 28Z"
        fill="rgba(255,255,255,0.15)"
      />
      <circle cx="40" cy="40" r="8" fill="rgba(255,255,255,0.9)" />
      <circle cx="40" cy="40" r="4" fill="rgba(35,92,99,0.8)" />
    </svg>
  );
}
