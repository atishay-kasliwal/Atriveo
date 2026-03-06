export function Badge5_HexX() {
  const hexOuter = "M48 4 L84 23.5 L84 64.5 L48 84 L12 64.5 L12 23.5 Z";
  const hexGap   = "M48 6.5 L81.5 25.5 L81.5 63.5 L48 81.5 L14.5 63.5 L14.5 25.5 Z";
  const hexRing  = "M48 8 L80 26 L80 62 L48 80 L16 62 L16 26 Z";
  const hexInner = "M48 11 L77 28 L77 60 L48 77 L19 60 L19 28 Z";

  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b5-gold" x1="12" y1="4" x2="84" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8DC" />
          <stop offset="22%" stopColor="#F5D87A" />
          <stop offset="52%" stopColor="#B8860B" />
          <stop offset="82%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="b5-gold-i" x1="84" y1="4" x2="12" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B6914" />
          <stop offset="50%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#FFF8DC" />
        </linearGradient>
        <linearGradient id="b5-teal" x1="16" y1="26" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#0891B2" />
        </linearGradient>
        <radialGradient id="b5-bg" cx="48%" cy="44%" r="56%">
          <stop offset="0%" stopColor="#0d1c24" />
          <stop offset="100%" stopColor="#060e12" />
        </radialGradient>
        <radialGradient id="b5-dome" cx="38%" cy="26%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.03)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
        <radialGradient id="b5-spec" cx="36%" cy="20%" r="36%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="b5-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="b5-drop">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#2DD4BF" floodOpacity="0.45" />
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
        <filter id="b5-line-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <clipPath id="b5-clip"><path d={hexInner} /></clipPath>
      </defs>

      {/* Outer glow */}
      <path d={hexOuter} fill="#2DD4BF" opacity="0.18" filter="url(#b5-glow)" />
      <path d={hexRing} fill="#000" opacity="0.01" filter="url(#b5-drop)" />

      {/* Gold outer */}
      <path d={hexOuter} fill="url(#b5-gold)" />
      {/* Dark gap */}
      <path d={hexGap} fill="#030a0c" />
      {/* Gold ring */}
      <path d={hexRing} fill="url(#b5-gold-i)" />
      {/* Dark interior */}
      <path d={hexInner} fill="url(#b5-bg)" />

      <g clipPath="url(#b5-clip)">
        {/* X glow lines */}
        <line x1="26" y1="29" x2="70" y2="60" stroke="#2DD4BF" strokeWidth="8" strokeLinecap="round" opacity="0.2" filter="url(#b5-line-glow)" />
        <line x1="70" y1="29" x2="26" y2="60" stroke="#2DD4BF" strokeWidth="8" strokeLinecap="round" opacity="0.2" filter="url(b5-line-glow)" />

        {/* X lines */}
        <line x1="26" y1="29" x2="70" y2="60" stroke="url(#b5-teal)" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="70" y1="29" x2="26" y2="60" stroke="url(#b5-teal)" strokeWidth="3.5" strokeLinecap="round" />

        {/* Center diamond */}
        <path d="M48 38 L56 44 L48 51 L40 44 Z" fill="none" stroke="url(#b5-teal)" strokeWidth="1.75" />
        {/* Center dot */}
        <circle cx="48" cy="44" r="4" fill="#2DD4BF" />
        <circle cx="48" cy="44" r="2.5" fill="#0d1c24" />
        <circle cx="48" cy="44" r="1.2" fill="#2DD4BF" />

        {/* Hexagon vertex dots */}
        {[[48,11],[77,28],[77,60],[48,77],[19,60],[19,28]].map(([x,y], i) => (
          <circle key={i} cx={x} cy={y} r="2" fill="#F5D87A" opacity="0.7" />
        ))}

        {/* Dome overlay */}
        <path d={hexInner} fill="url(#b5-dome)" />
      </g>

      {/* Inner ring stroke */}
      <path d={hexInner} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      {/* Specular */}
      <path d={hexRing} fill="url(#b5-spec)" />
    </svg>
  );
}
