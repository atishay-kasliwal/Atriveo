export function Badge7_HexChevrons() {
  const hexOuter = "M48 4 L84 23.5 L84 64.5 L48 84 L12 64.5 L12 23.5 Z";
  const hexGap   = "M48 6.5 L81.5 25.5 L81.5 63.5 L48 81.5 L14.5 63.5 L14.5 25.5 Z";
  const hexRing  = "M48 8 L80 26 L80 62 L48 80 L16 62 L16 26 Z";
  const hexInner = "M48 11 L77 28 L77 60 L48 77 L19 60 L19 28 Z";

  const bars = [
    { color1: "#EF4444", color2: "#F97316", label: "b7-r" },
    { color1: "#F97316", color2: "#FBBF24", label: "b7-o" },
    { color1: "#FBBF24", color2: "#86EFAC", label: "b7-y" },
    { color1: "#4ADE80", color2: "#22D3EE", label: "b7-g" },
    { color1: "#22D3EE", color2: "#818CF8", label: "b7-c" },
    { color1: "#818CF8", color2: "#C084FC", label: "b7-p" },
  ];

  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b7-gold" x1="12" y1="4" x2="84" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8DC" />
          <stop offset="22%" stopColor="#F5D87A" />
          <stop offset="52%" stopColor="#B8860B" />
          <stop offset="82%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="b7-gold-i" x1="84" y1="4" x2="12" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B6914" />
          <stop offset="50%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#FFF8DC" />
        </linearGradient>
        {bars.map((b) => (
          <linearGradient key={b.label} id={b.label} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={b.color1} />
            <stop offset="100%" stopColor={b.color2} />
          </linearGradient>
        ))}
        <radialGradient id="b7-dome" cx="38%" cy="26%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
        <radialGradient id="b7-spec" cx="36%" cy="20%" r="36%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="b7-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="b7-drop">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#FBBF24" floodOpacity="0.4" />
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
        <clipPath id="b7-clip"><path d={hexInner} /></clipPath>
      </defs>

      {/* Outer glow */}
      <path d={hexOuter} fill="#FBBF24" opacity="0.15" filter="url(#b7-glow)" />
      <path d={hexRing} fill="#000" opacity="0.01" filter="url(b7-drop)" />

      {/* Gold outer */}
      <path d={hexOuter} fill="url(#b7-gold)" />
      <path d={hexGap} fill="#080600" />
      <path d={hexRing} fill="url(#b7-gold-i)" />
      <path d={hexInner} fill="#0d0c02" />

      <g clipPath="url(#b7-clip)">
        {bars.map((b, i) => {
          const barH = 8.6;
          const gap = 1.2;
          const y0 = 28 + i * (barH + gap);
          // Chevron shape: rect with pointed V cutout at bottom
          const midY = y0 + barH;
          return (
            <g key={b.label}>
              {/* Bar fill */}
              <path
                d={`M19 ${y0} L77 ${y0} L77 ${midY} L48 ${midY - 4} L19 ${midY} Z`}
                fill={`url(#${b.label})`}
              />
              {/* Shine on bar */}
              <path
                d={`M19 ${y0} L77 ${y0} L77 ${y0 + 3} L19 ${y0 + 3} Z`}
                fill="rgba(255,255,255,0.18)"
              />
              {/* Gap line */}
              <line x1="19" y1={midY + gap / 2} x2="77" y2={midY + gap / 2} stroke="#0d0c02" strokeWidth={gap + 0.5} />
            </g>
          );
        })}

        {/* Dome overlay */}
        <path d={hexInner} fill="url(#b7-dome)" />
      </g>

      {/* Inner ring stroke */}
      <path d={hexInner} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      {/* Specular */}
      <path d={hexRing} fill="url(#b7-spec)" />
    </svg>
  );
}
