export function Badge9_CircleMedal() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b9-gold" x1="4" y1="4" x2="92" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8DC" />
          <stop offset="20%" stopColor="#F5D87A" />
          <stop offset="45%" stopColor="#D4A017" />
          <stop offset="65%" stopColor="#F5D87A" />
          <stop offset="85%" stopColor="#C9973A" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="b9-gold-i" x1="92" y1="4" x2="4" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B6914" />
          <stop offset="50%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#FFF8DC" />
        </linearGradient>
        <linearGradient id="b9-bar" x1="48" y1="30" x2="48" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
        <radialGradient id="b9-bg" cx="48%" cy="45%" r="52%">
          <stop offset="0%" stopColor="#0e0a1c" />
          <stop offset="100%" stopColor="#060410" />
        </radialGradient>
        <radialGradient id="b9-dome" cx="38%" cy="26%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
        <radialGradient id="b9-spec" cx="36%" cy="20%" r="36%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="b9-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="b9-drop">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#D4A017" floodOpacity="0.5" />
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
        <filter id="b9-bar-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <clipPath id="b9-clip"><circle cx="48" cy="48" r="28" /></clipPath>
      </defs>

      {/* Outer glow */}
      <circle cx="48" cy="48" r="46" fill="#D4A017" opacity="0.18" filter="url(#b9-glow)" />
      <circle cx="48" cy="48" r="44" fill="#000" opacity="0.01" filter="url(#b9-drop)" />

      {/* Concentric gold rings — the key effect */}
      <circle cx="48" cy="48" r="46" fill="url(#b9-gold)" />
      <circle cx="48" cy="48" r="43.5" fill="#040208" />
      <circle cx="48" cy="48" r="42" fill="url(#b9-gold)" />
      <circle cx="48" cy="48" r="39.5" fill="#040208" />
      <circle cx="48" cy="48" r="38" fill="url(#b9-gold)" />
      <circle cx="48" cy="48" r="35.5" fill="#040208" />
      <circle cx="48" cy="48" r="34" fill="url(#b9-gold-i)" />
      <circle cx="48" cy="48" r="31.5" fill="#040208" />
      <circle cx="48" cy="48" r="30" fill="url(#b9-gold)" />

      {/* Dark interior */}
      <circle cx="48" cy="48" r="28" fill="url(#b9-bg)" />

      {/* Dashed ring accent inside */}
      <circle cx="48" cy="48" r="26" fill="none" stroke="#F5D87A" strokeWidth="0.75" strokeDasharray="3 3.5" strokeOpacity="0.4" />

      <g clipPath="url(#b9-clip)">
        {/* Icon bar glow (bloom) */}
        <path d="M36 34 C31.5 40 31.5 56 36 62" stroke="#A78BFA" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.25" filter="url(#b9-bar-glow)" />
        <path d="M60 34 C64.5 40 64.5 56 60 62" stroke="#A78BFA" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.25" filter="url(#b9-bar-glow)" />
        <line x1="48" y1="32" x2="48" y2="64" stroke="#A78BFA" strokeWidth="9" strokeLinecap="round" opacity="0.2" />

        {/* Icon bars */}
        <path d="M36 34 C31.5 40 31.5 56 36 62" stroke="url(#b9-bar)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M60 34 C64.5 40 64.5 56 60 62" stroke="url(#b9-bar)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <line x1="48" y1="32" x2="48" y2="64" stroke="url(#b9-bar)" strokeWidth="3.5" strokeLinecap="round" />

        {/* Dome overlay */}
        <circle cx="48" cy="48" r="28" fill="url(#b9-dome)" />
      </g>

      {/* Specular */}
      <circle cx="48" cy="48" r="28" fill="url(#b9-spec)" />
      <circle cx="48" cy="48" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.75" />
    </svg>
  );
}
