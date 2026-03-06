export function Badge8_Social() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b8-gold" x1="4" y1="4" x2="92" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8DC" />
          <stop offset="22%" stopColor="#F5D87A" />
          <stop offset="52%" stopColor="#B8860B" />
          <stop offset="82%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="b8-gold-i" x1="92" y1="4" x2="4" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B6914" />
          <stop offset="50%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#FFF8DC" />
        </linearGradient>
        <linearGradient id="b8-pink" x1="10" y1="10" x2="86" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F472B6" />
          <stop offset="100%" stopColor="#9333EA" />
        </linearGradient>
        <linearGradient id="b8-red" x1="45" y1="45" x2="75" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
        <radialGradient id="b8-bg" cx="45%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#200d1e" />
          <stop offset="100%" stopColor="#0d0510" />
        </radialGradient>
        <radialGradient id="b8-dome" cx="38%" cy="26%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
        <radialGradient id="b8-spec" cx="36%" cy="20%" r="36%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="b8-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="b8-drop">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#EC4899" floodOpacity="0.5" />
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
        <clipPath id="b8-clip"><circle cx="48" cy="48" r="36" /></clipPath>
      </defs>

      {/* Outer glow */}
      <circle cx="48" cy="48" r="44" fill="#EC4899" opacity="0.18" filter="url(#b8-glow)" />
      <circle cx="48" cy="48" r="44" fill="#000" opacity="0.01" filter="url(#b8-drop)" />

      {/* Gold rings */}
      <circle cx="48" cy="48" r="46" fill="url(#b8-gold)" />
      <circle cx="48" cy="48" r="43" fill="#090408" />
      <circle cx="48" cy="48" r="41" fill="url(#b8-gold)" />
      <circle cx="48" cy="48" r="39" fill="#090408" />
      <circle cx="48" cy="48" r="37.5" fill="url(#b8-gold-i)" />
      <circle cx="48" cy="48" r="36" fill="url(#b8-bg)" />

      <g clipPath="url(#b8-clip)">
        {/* Left figure — large pink blob person */}
        {/* Body */}
        <ellipse cx="37" cy="64" rx="12" ry="8" fill="url(#b8-pink)" opacity="0.95" />
        {/* Neck */}
        <rect x="33.5" y="55" width="7" height="9" rx="3" fill="url(#b8-pink)" />
        {/* Head */}
        <circle cx="37" cy="46" r="10" fill="url(#b8-pink)" />
        {/* Head highlight */}
        <circle cx="34" cy="43" r="3.5" fill="rgba(255,255,255,0.22)" />

        {/* Right figure — red circle element */}
        <circle cx="61" cy="60" r="13" fill="url(#b8-red)" />
        {/* Circle ring detail */}
        <circle cx="61" cy="60" r="13" fill="none" stroke="rgba(255,182,193,0.5)" strokeWidth="1.2" />
        <circle cx="61" cy="60" r="9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.75" />

        {/* Sparkle - large, top left */}
        <g transform="translate(20,22)" stroke="#F5D87A" strokeWidth="1.5" strokeLinecap="round">
          <line x1="5" y1="0" x2="5" y2="10" />
          <line x1="0" y1="5" x2="10" y2="5" />
          <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" />
          <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
        </g>

        {/* Sparkle - small, top right */}
        <g transform="translate(66,20)" stroke="#F5D87A" strokeWidth="1.2" strokeLinecap="round">
          <line x1="4" y1="0" x2="4" y2="8" />
          <line x1="0" y1="4" x2="8" y2="4" />
        </g>

        {/* Tiny dot sparkles */}
        <circle cx="58" cy="30" r="1.5" fill="#F5D87A" opacity="0.8" />
        <circle cx="72" cy="36" r="1" fill="#F472B6" opacity="0.7" />
        <circle cx="26" cy="36" r="1" fill="#F5D87A" opacity="0.6" />

        {/* Dome overlay */}
        <circle cx="48" cy="48" r="36" fill="url(#b8-dome)" />
      </g>

      {/* Specular */}
      <circle cx="48" cy="48" r="36" fill="url(#b8-spec)" />
      <circle cx="48" cy="48" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
    </svg>
  );
}
