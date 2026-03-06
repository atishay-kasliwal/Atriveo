export function Badge11_AudioCircle() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b11-gold" x1="4" y1="4" x2="92" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8DC" />
          <stop offset="22%" stopColor="#F5D87A" />
          <stop offset="52%" stopColor="#B8860B" />
          <stop offset="82%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="b11-gold-i" x1="92" y1="4" x2="4" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B6914" />
          <stop offset="50%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#FFF8DC" />
        </linearGradient>
        <linearGradient id="b11-bg" x1="10" y1="10" x2="86" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#4C1D95" />
        </linearGradient>
        <linearGradient id="b11-arc" x1="10" y1="10" x2="86" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E9D5FF" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
        <radialGradient id="b11-inner-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1e0d38" />
          <stop offset="100%" stopColor="#120828" />
        </radialGradient>
        <radialGradient id="b11-dome" cx="38%" cy="26%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
        <radialGradient id="b11-spec" cx="36%" cy="20%" r="36%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="b11-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="b11-drop">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#9333EA" floodOpacity="0.55" />
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
        <filter id="b11-arc-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <clipPath id="b11-clip"><circle cx="48" cy="48" r="36" /></clipPath>
      </defs>

      {/* Outer glow */}
      <circle cx="48" cy="48" r="46" fill="#9333EA" opacity="0.2" filter="url(#b11-glow)" />
      <circle cx="48" cy="48" r="44" fill="#000" opacity="0.01" filter="url(b11-drop)" />

      {/* Gold rings */}
      <circle cx="48" cy="48" r="46" fill="url(#b11-gold)" />
      <circle cx="48" cy="48" r="43.5" fill="#060210" />
      <circle cx="48" cy="48" r="42" fill="url(#b11-gold)" />
      <circle cx="48" cy="48" r="39.5" fill="#060210" />
      <circle cx="48" cy="48" r="38" fill="url(#b11-gold-i)" />

      {/* Purple body */}
      <circle cx="48" cy="48" r="36" fill="url(#b11-bg)" />

      <g clipPath="url(#b11-clip)">
        {/* Inner dark circle for icon area */}
        <circle cx="48" cy="48" r="24" fill="url(#b11-inner-bg)" />

        {/* Decorative ring between purple and inner */}
        <circle cx="48" cy="48" r="30" fill="none" stroke="#E9D5FF" strokeWidth="1" strokeOpacity="0.2" />
        <circle cx="48" cy="48" r="27" fill="none" stroke="#E9D5FF" strokeWidth="0.75" strokeOpacity="0.15" />

        {/* Audio arcs glow */}
        <path d="M29 48 C29 36.9 38 28 48 28" stroke="#C4B5FD" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.15" />
        <path d="M67 48 C67 36.9 58 28 48 28" stroke="#C4B5FD" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.15" />

        {/* Outer arcs */}
        <path d="M29 48 C29 36.9 38 28 48 28" stroke="url(#b11-arc)" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M67 48 C67 36.9 58 28 48 28" stroke="url(#b11-arc)" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Middle arcs */}
        <path d="M34 48 C34 39.4 40.5 33 48 33" stroke="url(#b11-arc)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.85" />
        <path d="M62 48 C62 39.4 55.5 33 48 33" stroke="url(#b11-arc)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.85" />

        {/* Inner arcs - bright white */}
        <path d="M39 48 C39 42 43.2 38 48 38" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M57 48 C57 42 52.8 38 48 38" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* Center dot ring */}
        <circle cx="48" cy="48" r="6" fill="none" stroke="url(#b11-arc)" strokeWidth="1.5" opacity="0.5" />
        {/* Center dot */}
        <circle cx="48" cy="48" r="4.5" fill="white" />
        <circle cx="48" cy="48" r="2.5" fill="url(#b11-bg)" />
        <circle cx="48" cy="48" r="1.2" fill="white" />

        {/* Dome overlay */}
        <circle cx="48" cy="48" r="36" fill="url(#b11-dome)" />
      </g>

      {/* Specular */}
      <circle cx="48" cy="48" r="36" fill="url(#b11-spec)" />
      <circle cx="48" cy="48" r="36" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.75" />
    </svg>
  );
}
