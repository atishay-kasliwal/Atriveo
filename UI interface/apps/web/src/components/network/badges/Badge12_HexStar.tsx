export function Badge12_HexStar() {
  const hexOuter = "M48 4 L84 23.5 L84 64.5 L48 84 L12 64.5 L12 23.5 Z";
  const hexGap   = "M48 6.5 L81.5 25.5 L81.5 63.5 L48 81.5 L14.5 63.5 L14.5 25.5 Z";
  const hexRing  = "M48 8 L80 26 L80 62 L48 80 L16 62 L16 26 Z";
  const hexInner = "M48 11 L77 28 L77 60 L48 77 L19 60 L19 28 Z";

  const CX = 48, CY = 45;

  // 6-point star arms
  const arms6 = Array.from({ length: 6 }).map((_, i) => {
    const angle = (i * 60 - 90) * Math.PI / 180;
    return { x: CX + Math.cos(angle) * 22, y: CY + Math.sin(angle) * 22, angle };
  });

  // Cross bars on each arm
  const crossbars = arms6.map(({ x, y, angle }) => {
    const perp = angle + Math.PI / 2;
    const mx = CX + Math.cos(angle) * 14;
    const my = CY + Math.sin(angle) * 14;
    return { x1: mx - Math.cos(perp) * 5.5, y1: my - Math.sin(perp) * 5.5, x2: mx + Math.cos(perp) * 5.5, y2: my + Math.sin(perp) * 5.5 };
  });

  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b12-gold" x1="12" y1="4" x2="84" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8DC" />
          <stop offset="22%" stopColor="#F5D87A" />
          <stop offset="52%" stopColor="#B8860B" />
          <stop offset="82%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="b12-gold-i" x1="84" y1="4" x2="12" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B6914" />
          <stop offset="50%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#FFF8DC" />
        </linearGradient>
        <linearGradient id="b12-cream" x1="12" y1="4" x2="84" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="100%" stopColor="#FDE68A" />
        </linearGradient>
        <linearGradient id="b12-star" x1="26" y1="23" x2="70" y2="67" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <radialGradient id="b12-bg" cx="50%" cy="46%" r="55%">
          <stop offset="0%" stopColor="#0e1626" />
          <stop offset="100%" stopColor="#060a10" />
        </radialGradient>
        <radialGradient id="b12-dome" cx="38%" cy="26%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
        <radialGradient id="b12-spec" cx="36%" cy="20%" r="36%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="b12-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="b12-drop">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#60A5FA" floodOpacity="0.45" />
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
        <filter id="b12-star-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <clipPath id="b12-clip"><path d={hexInner} /></clipPath>
      </defs>

      {/* Outer glow */}
      <path d={hexOuter} fill="#60A5FA" opacity="0.16" filter="url(#b12-glow)" />
      <path d={hexRing} fill="#000" opacity="0.01" filter="url(b12-drop)" />

      {/* Cream/beige outer hex ring */}
      <path d={hexOuter} fill="url(#b12-cream)" />
      {/* Dark gap */}
      <path d={hexGap} fill="#040608" />
      {/* Gold ring */}
      <path d={hexRing} fill="url(#b12-gold)" />
      {/* Dark interior */}
      <path d={hexInner} fill="url(#b12-bg)" />

      <g clipPath="url(#b12-clip)">
        {/* Star arm glow */}
        {arms6.map(({ x, y }, i) => (
          <line key={`gl-${i}`} x1={CX} y1={CY} x2={x} y2={y}
            stroke="#93C5FD" strokeWidth="9" strokeLinecap="round" opacity="0.18"
            filter="url(#b12-star-glow)" />
        ))}

        {/* Secondary 6 arms (offset 30deg) - gold */}
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i * 60 - 60) * Math.PI / 180;
          return (
            <line key={`s-${i}`} x1={CX} y1={CY}
              x2={CX + Math.cos(angle) * 15} y2={CY + Math.sin(angle) * 15}
              stroke="url(#b12-gold)" strokeWidth="2.5" strokeLinecap="round" />
          );
        })}

        {/* Main 6 star arms - blue */}
        {arms6.map(({ x, y }, i) => (
          <line key={`m-${i}`} x1={CX} y1={CY} x2={x} y2={y}
            stroke="url(#b12-star)" strokeWidth="3.5" strokeLinecap="round" />
        ))}

        {/* Crossbars on each arm */}
        {crossbars.map((cb, i) => (
          <line key={`cb-${i}`} x1={cb.x1} y1={cb.y1} x2={cb.x2} y2={cb.y2}
            stroke="url(#b12-star)" strokeWidth="2.5" strokeLinecap="round" />
        ))}

        {/* Second set of crossbars (inner) */}
        {arms6.map(({ angle }, i) => {
          const perp = angle + Math.PI / 2;
          const mx = CX + Math.cos(angle) * 8;
          const my = CY + Math.sin(angle) * 8;
          return (
            <line key={`cb2-${i}`}
              x1={mx - Math.cos(perp) * 3.5} y1={my - Math.sin(perp) * 3.5}
              x2={mx + Math.cos(perp) * 3.5} y2={my + Math.sin(perp) * 3.5}
              stroke="url(#b12-gold)" strokeWidth="1.75" strokeLinecap="round" />
          );
        })}

        {/* Center gold ring */}
        <circle cx={CX} cy={CY} r="6.5" fill="url(#b12-gold)" />
        <circle cx={CX} cy={CY} r="4.5" fill="url(#b12-bg)" />
        <circle cx={CX} cy={CY} r="2.5" fill="url(#b12-gold)" />

        {/* Vertex dots on hex inner */}
        {[[48,11],[77,28],[77,60],[48,77],[19,60],[19,28]].map(([x,y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="url(#b12-gold)" opacity="0.7" />
        ))}

        {/* Dome overlay */}
        <path d={hexInner} fill="url(#b12-dome)" />
      </g>

      {/* Inner ring stroke */}
      <path d={hexInner} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      {/* Specular */}
      <path d={hexRing} fill="url(#b12-spec)" />
    </svg>
  );
}
