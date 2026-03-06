export function Badge2_Circle365() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b2-gold" x1="10" y1="10" x2="86" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8DC" />
          <stop offset="20%" stopColor="#F5D87A" />
          <stop offset="50%" stopColor="#B8860B" />
          <stop offset="80%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="b2-gold-inner" x1="86" y1="10" x2="10" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B6914" />
          <stop offset="50%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#FFF8DC" />
        </linearGradient>
        <linearGradient id="b2-purple" x1="10" y1="10" x2="86" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>
        <radialGradient id="b2-dome" cx="38%" cy="28%" r="62%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
        <radialGradient id="b2-spec" cx="36%" cy="24%" r="40%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="b2-drop">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#7C3AED" floodOpacity="0.55" />
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
        <filter id="b2-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <clipPath id="b2-clip"><circle cx="48" cy="48" r="36" /></clipPath>
        <clipPath id="b2-top"><rect x="12" y="12" width="72" height="37" /></clipPath>
        <clipPath id="b2-bot"><rect x="12" y="49" width="72" height="40" /></clipPath>
      </defs>

      {/* Outer glow */}
      <circle cx="48" cy="48" r="44" fill="#7C3AED" opacity="0.2" filter="url(#b2-glow)" />

      {/* Drop shadow */}
      <circle cx="48" cy="48" r="44" fill="#000" opacity="0.01" filter="url(#b2-drop)" />

      {/* Outer gold ring */}
      <circle cx="48" cy="48" r="45" fill="url(#b2-gold)" />
      {/* Dark recessed gap */}
      <circle cx="48" cy="48" r="42" fill="#06020e" />
      {/* Gold ring 2 */}
      <circle cx="48" cy="48" r="40" fill="url(#b2-gold)" />
      {/* Dark gap 2 */}
      <circle cx="48" cy="48" r="38" fill="#06020e" />
      {/* Gold ring 3 (thin) */}
      <circle cx="48" cy="48" r="37" fill="url(#b2-gold-inner)" />

      {/* Dark interior */}
      <circle cx="48" cy="48" r="36" fill="#0e0818" />

      <g clipPath="url(#b2-clip)">
        {/* Checkered top half */}
        <g clipPath="url(#b2-top)">
          {Array.from({ length: 5 }).map((_, row) =>
            Array.from({ length: 10 }).map((_, col) =>
              (row + col) % 2 === 0 ? (
                <rect key={`w-${row}-${col}`} x={12 + col * 7.2} y={12 + row * 7.5} width="7.2" height="7.5" fill="#E8E4F0" />
              ) : (
                <rect key={`d-${row}-${col}`} x={12 + col * 7.2} y={12 + row * 7.5} width="7.2" height="7.5" fill="#0e0818" />
              )
            )
          )}
        </g>

        {/* Divider line */}
        <line x1="12" y1="49" x2="84" y2="49" stroke="#F5D87A" strokeWidth="1.5" strokeOpacity="0.7" />

        {/* Purple lower half */}
        <rect x="12" y="49" width="72" height="36" fill="url(#b2-purple)" />

        {/* Gold label bar */}
        <rect x="12" y="68" width="72" height="18" fill="#06020e" />
        <line x1="12" y1="68" x2="84" y2="68" stroke="#F5D87A" strokeWidth="1" strokeOpacity="0.5" />

        {/* Checkmark */}
        <g stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <polyline points="33,44 43,55 63,31" />
        </g>
        {/* Checkmark glow */}
        <g stroke="rgba(200,180,255,0.4)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <polyline points="33,44 43,55 63,31" />
        </g>
        <g stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <polyline points="33,44 43,55 63,31" />
        </g>

        {/* "365" text */}
        <text x="48" y="82" textAnchor="middle" fill="#F5D87A" fontSize="13" fontFamily="Georgia, serif" fontWeight="bold" letterSpacing="2">365</text>

        {/* Dome overlay */}
        <circle cx="48" cy="48" r="36" fill="url(#b2-dome)" />
      </g>

      {/* Specular highlight */}
      <circle cx="48" cy="48" r="36" fill="url(#b2-spec)" />

      {/* Thin inner stroke */}
      <circle cx="48" cy="48" r="36" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
    </svg>
  );
}
