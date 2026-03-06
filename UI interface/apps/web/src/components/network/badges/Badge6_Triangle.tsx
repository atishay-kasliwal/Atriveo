export function Badge6_Triangle() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b6-gold" x1="10" y1="9" x2="86" y2="89" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8DC" />
          <stop offset="22%" stopColor="#F5D87A" />
          <stop offset="52%" stopColor="#B8860B" />
          <stop offset="82%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="b6-gold-i" x1="86" y1="9" x2="10" y2="89" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B6914" />
          <stop offset="50%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#FFF8DC" />
        </linearGradient>
        <linearGradient id="b6-ray-c" x1="48" y1="84" x2="48" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
        <radialGradient id="b6-bg" cx="50%" cy="60%" r="55%">
          <stop offset="0%" stopColor="#130d24" />
          <stop offset="100%" stopColor="#080510" />
        </radialGradient>
        <radialGradient id="b6-dome" cx="40%" cy="28%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
        <radialGradient id="b6-spec" cx="40%" cy="20%" r="38%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="b6-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="b6-drop">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#8B5CF6" floodOpacity="0.55" />
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
        <clipPath id="b6-clip">
          <polygon points="48,84 10,14 86,14" />
        </clipPath>
      </defs>

      {/* Outer glow */}
      <polygon points="48,89 6,10 90,10" fill="#8B5CF6" opacity="0.2" filter="url(#b6-glow)" />
      <polygon points="48,84 10,14 86,14" fill="#000" opacity="0.01" filter="url(#b6-drop)" />

      {/* Gold outer */}
      <polygon points="48,90 5,9 91,9" fill="url(#b6-gold)" />
      {/* Dark gap */}
      <polygon points="48,87 7.5,11 88.5,11" fill="#06030e" />
      {/* Gold inner ring */}
      <polygon points="48,84 10,14 86,14" fill="url(#b6-gold-i)" />
      {/* Dark interior */}
      <polygon points="48,81 13,17 83,17" fill="url(#b6-bg)" />

      <g clipPath="url(#b6-clip)">
        {/* Radiating rays from bottom tip */}
        {Array.from({ length: 15 }).map((_, i) => {
          const total = 15;
          const spreadDeg = 110;
          const startDeg = -90 - spreadDeg / 2;
          const angle = startDeg + (i / (total - 1)) * spreadDeg;
          const rad = (angle * Math.PI) / 180;
          const len = 76;
          const x2 = 48 + Math.cos(rad) * len;
          const y2 = 84 + Math.sin(rad) * len;
          const dist = Math.abs(i - 7);
          const isCenter = i === 7;
          const w = isCenter ? 4 : dist <= 1 ? 3 : dist <= 3 ? 2.5 : 2;
          const opacity = 1 - dist * 0.055;
          const color = isCenter ? "#EDE9FE" : dist <= 2 ? "#C4B5FD" : "#8B5CF6";
          return (
            <line key={i}
              x1="48" y1="84" x2={x2} y2={y2}
              stroke={color} strokeWidth={w} strokeLinecap="round" opacity={opacity}
            />
          );
        })}

        {/* Divider bar */}
        <line x1="10" y1="65" x2="86" y2="65" stroke="#F5D87A" strokeWidth="1.2" strokeOpacity="0.5" />

        {/* Bottom stripes */}
        {[0,1,2,3,4,5,6,7].map((i) => (
          <rect key={i} x={18 + i * 8} y={67} width="5" height="12"
            fill={i % 2 === 0 ? "#8B5CF6" : "#A78BFA"} rx="1" opacity="0.8" />
        ))}

        {/* Dome overlay */}
        <polygon points="48,84 10,14 86,14" fill="url(#b6-dome)" />
      </g>

      {/* Inner stroke */}
      <polygon points="48,81 13,17 83,17" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      {/* Specular */}
      <polygon points="48,84 10,14 86,14" fill="url(#b6-spec)" />
    </svg>
  );
}
