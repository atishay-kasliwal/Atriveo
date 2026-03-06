export function Badge1_Shield() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Metallic gold border gradient */}
        <linearGradient id="b1-gold-h" x1="12" y1="6" x2="84" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8DC" />
          <stop offset="20%" stopColor="#F5D87A" />
          <stop offset="50%" stopColor="#C9973A" />
          <stop offset="80%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="b1-gold-inner" x1="16" y1="10" x2="80" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B8860B" />
          <stop offset="40%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#FFF8DC" />
        </linearGradient>
        {/* Stripe gradients */}
        <linearGradient id="b1-teal" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#0891B2" />
        </linearGradient>
        <linearGradient id="b1-purple" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
        <linearGradient id="b1-white" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#F0F0F8" />
          <stop offset="100%" stopColor="#C8C8D8" />
        </linearGradient>
        {/* Dome radial for depth */}
        <radialGradient id="b1-dome" cx="40%" cy="30%" r="65%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
        </radialGradient>
        {/* Bevel inner shadow */}
        <linearGradient id="b1-bevel" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="rgba(0,0,0,0.5)" />
          <stop offset="40%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
        </linearGradient>
        {/* Specular highlight */}
        <radialGradient id="b1-spec" cx="38%" cy="22%" r="45%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="b1-glow">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="b1-drop">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#7C3AED" floodOpacity="0.6" />
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
        <clipPath id="b1-clip">
          <path d="M48 8.5 L82 21 L82 51 C82 69.5 66.5 81 48 89 C29.5 81 14 69.5 14 51 L14 21 Z" />
        </clipPath>
      </defs>

      {/* Outer glow */}
      <path d="M48 6 L84 19 L84 51 C84 71 68 83.5 48 91.5 C28 83.5 12 71 12 51 L12 19 Z"
        fill="#7C3AED" opacity="0.25" filter="url(#b1-glow)" />

      {/* Drop shadow */}
      <path d="M48 8.5 L82 21 L82 51 C82 69.5 66.5 81 48 89 C29.5 81 14 69.5 14 51 L14 21 Z"
        fill="#000" opacity="0.01" filter="url(#b1-drop)" />

      {/* Gold outer border */}
      <path d="M48 5 L86 18.5 L86 51 C86 72.5 69 85.5 48 94 C27 85.5 10 72.5 10 51 L10 18.5 Z"
        fill="url(#b1-gold-h)" />

      {/* Dark recessed gap */}
      <path d="M48 7.5 L83.5 20.5 L83.5 51 C83.5 70.5 67.5 82.5 48 90.5 C28.5 82.5 12.5 70.5 12.5 51 L12.5 20.5 Z"
        fill="#09050f" />

      {/* Gold inner border ring */}
      <path d="M48 8.5 L82 21 L82 51 C82 69.5 66.5 81 48 89 C29.5 81 14 69.5 14 51 L14 21 Z"
        fill="url(#b1-gold-inner)" />

      {/* Dark base fill */}
      <path d="M48 10.5 L80 22.5 L80 51 C80 68 65.5 79 48 86.5 C30.5 79 16 68 16 51 L16 22.5 Z"
        fill="#0e0818" />

      {/* Stripe content */}
      <g clipPath="url(#b1-clip)">
        {/* Teal left */}
        <rect x="14" y="9" width="17" height="80" fill="url(#b1-teal)" />
        {/* Purple center-left */}
        <rect x="31" y="9" width="17" height="80" fill="url(#b1-purple)" />
        {/* White/cream center */}
        <rect x="48" y="9" width="8" height="80" fill="url(#b1-white)" />
        {/* Purple center-right */}
        <rect x="56" y="9" width="13" height="80" fill="url(#b1-purple)" />
        {/* Teal right */}
        <rect x="69" y="9" width="14" height="80" fill="url(#b1-teal)" />

        {/* Checkered bottom overlay */}
        {Array.from({ length: 7 }).map((_, row) =>
          Array.from({ length: 10 }).map((_, col) =>
            (row + col) % 2 === 0 ? (
              <rect key={`${row}-${col}`}
                x={14 + col * 6.8} y={54 + row * 6.5}
                width="6.8" height="6.5"
                fill="rgba(0,0,0,0.6)" />
            ) : null
          )
        )}

        {/* Stripe divider lines */}
        <line x1="31" y1="9" x2="31" y2="89" stroke="rgba(0,0,0,0.4)" strokeWidth="0.75" />
        <line x1="48" y1="9" x2="48" y2="89" stroke="rgba(0,0,0,0.4)" strokeWidth="0.75" />
        <line x1="56" y1="9" x2="56" y2="89" stroke="rgba(0,0,0,0.4)" strokeWidth="0.75" />
        <line x1="69" y1="9" x2="69" y2="89" stroke="rgba(0,0,0,0.4)" strokeWidth="0.75" />

        {/* Dome depth overlay */}
        <rect x="14" y="9" width="68" height="80" fill="url(#b1-dome)" />

        {/* Bevel top edge shadow */}
        <path d="M48 8.5 L82 21 L82 51 C82 69.5 66.5 81 48 89 C29.5 81 14 69.5 14 51 L14 21 Z"
          fill="url(#b1-bevel)" opacity="0.7" />
      </g>

      {/* Inner gold ring on top */}
      <path d="M48 10.5 L80 22.5 L80 51 C80 68 65.5 79 48 86.5 C30.5 79 16 68 16 51 L16 22.5 Z"
        fill="none" stroke="#F5D87A" strokeWidth="0.75" strokeOpacity="0.5" />

      {/* Specular highlight */}
      <path d="M48 8.5 L82 21 L82 51 C82 69.5 66.5 81 48 89 C29.5 81 14 69.5 14 51 L14 21 Z"
        fill="url(#b1-spec)" />
    </svg>
  );
}
