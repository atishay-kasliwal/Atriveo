export function Badge4_RocketShield() {
  const shieldOuter = "M48 5 L85 19 L85 52 C85 71.5 68.5 84.5 48 92.5 C27.5 84.5 11 71.5 11 52 L11 19 Z";
  const shieldGap   = "M48 7.5 L82.5 20.5 L82.5 52 C82.5 70.5 67 82.5 48 90.5 C29 82.5 13.5 70.5 13.5 52 L13.5 20.5 Z";
  const shieldRing  = "M48 9 L81 21.5 L81 52 C81 69.5 66 81 48 89 C30 81 15 69.5 15 52 L15 21.5 Z";
  const shieldInner = "M48 11 L79 23 L79 52 C79 68 65 79 48 86.5 C31 79 17 68 17 52 L17 23 Z";

  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b4-gold" x1="11" y1="5" x2="85" y2="93" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8DC" />
          <stop offset="22%" stopColor="#F5D87A" />
          <stop offset="52%" stopColor="#B8860B" />
          <stop offset="82%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="b4-gold-i" x1="85" y1="5" x2="11" y2="93" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B6914" />
          <stop offset="50%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#FFF8DC" />
        </linearGradient>
        <linearGradient id="b4-sky" x1="11" y1="9" x2="81" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="b4-teal" x1="11" y1="35" x2="81" y2="89" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0E7490" />
          <stop offset="100%" stopColor="#164E63" />
        </linearGradient>
        <linearGradient id="b4-dark" x1="48" y1="35" x2="81" y2="89" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0a1520" />
          <stop offset="100%" stopColor="#0d1c2a" />
        </linearGradient>
        <radialGradient id="b4-dome" cx="38%" cy="25%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
        </radialGradient>
        <radialGradient id="b4-spec" cx="36%" cy="20%" r="36%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="b4-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="b4-drop">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0891B2" floodOpacity="0.5" />
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
        <clipPath id="b4-clip"><path d={shieldRing} /></clipPath>
      </defs>

      {/* Outer glow */}
      <path d={shieldOuter} fill="#0891B2" opacity="0.2" filter="url(#b4-glow)" />
      <path d={shieldRing} fill="#000" opacity="0.01" filter="url(#b4-drop)" />

      {/* Gold outer */}
      <path d={shieldOuter} fill="url(#b4-gold)" />
      {/* Dark gap */}
      <path d={shieldGap} fill="#04090f" />
      {/* Gold inner ring */}
      <path d={shieldRing} fill="url(#b4-gold-i)" />
      {/* Dark base */}
      <path d={shieldInner} fill="#081218" />

      <g clipPath="url(#b4-clip)">
        {/* Sky top section */}
        <path d="M15 21.5 L81 21.5 L81 52 C81 52 65 42 48 38 C31 42 15 52 15 52 Z"
          fill="url(#b4-sky)" />

        {/* Teal left section */}
        <path d="M15 52 L48 38 L48 89 C30 81 15 69.5 15 52 Z"
          fill="url(#b4-teal)" />

        {/* Dark right section */}
        <path d="M48 38 L81 52 L81 52 C81 69.5 66 81 48 89 Z"
          fill="url(#b4-dark)" />

        {/* Curved divider horizon line */}
        <path d="M15 52 C15 52 31 42 48 38 C65 42 81 52 81 52"
          stroke="#F5D87A" strokeWidth="1.5" fill="none" strokeOpacity="0.7" />

        {/* Stars in dark section */}
        {[[62, 30], [70, 42], [66, 52], [74, 26]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === 3 ? 1.2 : 1} fill="white" opacity="0.7" />
        ))}

        {/* Orange planet */}
        <circle cx="68" cy="22" r="9" fill="#F97316" />
        <circle cx="68" cy="22" r="9" fill="none" stroke="#FED7AA" strokeWidth="1.2" strokeOpacity="0.7" />
        {/* Planet band */}
        <path d="M59 19 C61 22 75 22 77 19" stroke="#FB923C" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeOpacity="0.6" />
        {/* Planet ring */}
        <ellipse cx="68" cy="22" rx="14" ry="4.5" fill="none" stroke="#FDBA74" strokeWidth="1.5" transform="rotate(-18, 68, 22)" strokeOpacity="0.7" />

        {/* Dome overlay */}
        <path d={shieldRing} fill="url(#b4-dome)" />
      </g>

      {/* Inner ring stroke */}
      <path d={shieldInner} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      {/* Specular */}
      <path d={shieldRing} fill="url(#b4-spec)" />
    </svg>
  );
}
