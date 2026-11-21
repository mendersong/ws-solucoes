type LogoProps = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id="ws-grad" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#66C0FF" />
          <stop offset="0.55" stopColor="#1D8BF0" />
          <stop offset="1" stopColor="#0B4E92" />
        </linearGradient>
        <linearGradient id="ws-bolt" x1="30" y1="8" x2="44" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EAF6FF" />
          <stop offset="1" stopColor="#9BD3FF" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="61" height="61" rx="16" fill="#08121F" stroke="url(#ws-grad)" strokeWidth="2" />
      <path
        d="M13 19.5 20.5 45 27.8 28.5 35 45 42.5 19.5"
        stroke="url(#ws-grad)"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M46 11 37 30.5h6.4L35.5 53 52 28.6h-7.2L51.5 11z" fill="url(#ws-bolt)" opacity="0.95" />
      <circle cx="20.5" cy="49.5" r="2.3" fill="#4AA8FF" />
    </svg>
  );
}

export function WSLogo({ size = 40, withWordmark = true, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {withWordmark ? (
        <div className="leading-tight">
          <p className="text-[0.95rem] font-extrabold tracking-[0.16em] text-white">WS SOLUÇÕES</p>
          <p className="text-[0.58rem] font-medium uppercase tracking-[0.18em] text-brand-300">Gestão Empresarial</p>
        </div>
      ) : null}
    </div>
  );
}
