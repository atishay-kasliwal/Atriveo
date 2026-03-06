export function Badge10_Sunburst() {
  const shieldOuter = "M48 5 L85 19 L85 52 C85 71.5 68.5 84.5 48 92.5 C27.5 84.5 11 71.5 11 52 L11 19 Z";
  const shieldGap   = "M48 7.5 L82.5 20.5 L82.5 52 C82.5 70.5 67 82.5 48 90.5 C29 82.5 13.5 70.5 13.5 52 L13.5 20.5 Z";
  const shieldRing  = "M48 9 L81 21.5 L81 52 C81 69.5 66 81 48 89 C30 81 15 69.5 15 52 L15 21.5 Z";
  const shieldInner = "M48 11 L79 23 L79 52 C79 68 65 79 48 86.5 C31 79 17 68 17 52 L17 23 Z";

  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b10-gold" x1="11" y1="5" x2="85" y2="93" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8DC" />
          <stop offset="22%" stopColor="#F5D87A" />
          <stop offset="52%" stopColor="#B8860B" />
          <stop offset="82%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="b10-gold-i" x1="85" y1="5" x2="11" y2="93" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B6914" />
          <stop offset="50%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#FFF8DC" />
        </linearGradient>
        <linearGradient id="b10-bg" x1="11" y1="9" x2="81" y2="89" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6D28D9" />
          <stop offset="100%" stopColor="#0E4A6E" />
        </linearGradient>
        <linearGradient id="b10-ray" x1="48" y1="89" x2="48" y2="9" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#DDD6FE" />
          <stop offset="50%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#7DD3FC" />
        </linearGradient>
        <linearGradient id="b10-bar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="100%" stopColor="#7DD3FC" />
        </linearGradient>
        <radialGradient id="b10-dome" cx="38%" cy="25%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
        <radialGradient id="b10-spec" cx="36%" cy="20%" r="36%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="b10-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="b10-drop">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#7C3AED" floodOpacity="0.5" />
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
        <clipPath id="b10-clip"><path d={shieldRing} /></clipPath>
      </defs>

      {/* Outer glow */}
      <path d={shieldOuter} fill="#7C3AED" opacity="0.2" filter="url(#b10-glow)" />
      <path d={shieldRing} fill="#000" opacity="0.01" filter="url(b10-drop)" />

      {/* Gold rings */}
      <path d={shieldOuter} fill="url(#b10-gold)" />
      <path d={shieldGap} fill="#040208" />
      <path d={shieldRing} fill="url(#b10-gold-i)" />

      {/* Gradient background */}
      <path d={shieldInner} fill="url(#b10-bg)" />

      <g clipPath="url(#b10-clip)">
        {/* Sunburst rays from bottom */}
        {Array.from({ length: 17 }).map((_, i) => {
          const total = 17;
          const spreadDeg = 128;
          const startDeg = -90 - spreadDeg / 2;
          const angle = startDeg + (i / (total - 1)) * spreadDeg;
          const rad = (angle * Math.PI) / 180;
          const len = 90;
          const x2 = 48 + Math.cos(rad) * len;
          const y2 = 89 + Math.sin(rad) * len;
          const dist = Math.abs(i - 8);
          const isCenter = i === 8;
          const w = isCenter ? 5 : dist <= 1 ? 4 : dist <= 3 ? 3 : dist <= 5 ? 2.5 : 2;
          const opacity = Math.max(0.3, 1 - dist * 0.05);
          return (
            <line key={i} x1="48" y1="89" x2={x2} y2={y2}
              stroke="url(#b10-ray)" strokeWidth={w} strokeLinecap="round" opacity={opacity} />
          );
        })}

        {/* Horizontal band */}
        <rect x="15" y="68" width="66" height="1.5" fill="#F5D87A" opacity="0.5" />

        {/* Bottom bar stripes */}
        <rect x="15" y="69.5" width="66" height="20" fill="rgba(0,0,0,0.55)" />
        {Array.from({ length: 9 }).map((_, i) => (
          <rect key={i} x={21 + i * 6.6} y={72} width="4.5" height="14"
            fill="url(#b10-bar)" opacity="0.8" rx="1.5" />
        ))}

        {/* Dome overlay */}
        <path d={shieldRing} fill="url(#b10-dome)" />
      </g>

      {/* Inner ring stroke */}
      <path d={shieldInner} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      {/* Specular */}
      <path d={shieldRing} fill="url(#b10-spec)" />
    </svg>
  );
}
