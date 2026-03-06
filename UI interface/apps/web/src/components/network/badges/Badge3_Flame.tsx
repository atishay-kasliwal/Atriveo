export function Badge3_Flame() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b3-gold" x1="10" y1="4" x2="86" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8DC" />
          <stop offset="25%" stopColor="#F5D87A" />
          <stop offset="55%" stopColor="#B8860B" />
          <stop offset="80%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="b3-gold-i" x1="86" y1="4" x2="10" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B6914" />
          <stop offset="50%" stopColor="#F5D87A" />
          <stop offset="100%" stopColor="#FFF8DC" />
        </linearGradient>
        <linearGradient id="b3-purple" x1="10" y1="10" x2="86" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>
        <linearGradient id="b3-flame" x1="48" y1="18" x2="48" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="40%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="b3-drop" x1="48" y1="34" x2="48" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#DBEAFE" />
          <stop offset="50%" stopColor="#EFF6FF" />
          <stop offset="100%" stopColor="#BFDBFE" />
        </linearGradient>
        <radialGradient id="b3-dome" cx="38%" cy="25%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
        <radialGradient id="b3-spec" cx="36%" cy="20%" r="38%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="b3-drop-shadow">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#F97316" floodOpacity="0.5" />
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
        <filter id="b3-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="b3-flame-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <clipPath id="b3-clip">
          <path d="M48 9 C48 9 81 33 81 58 C81 74 65.5 88 48 88 C30.5 88 15 74 15 58 C15 33 48 9 48 9Z" />
        </clipPath>
      </defs>

      {/* Outer glow */}
      <path d="M48 6 C48 6 84 30 84 58 C84 77 67 93 48 93 C29 93 12 77 12 58 C12 30 48 6 48 6Z"
        fill="#F97316" opacity="0.18" filter="url(#b3-glow)" />

      {/* Drop shadow */}
      <path d="M48 9 C48 9 81 33 81 58 C81 74 65.5 88 48 88 C30.5 88 15 74 15 58 C15 33 48 9 48 9Z"
        fill="#000" opacity="0.01" filter="url(#b3-drop-shadow)" />

      {/* Gold outer */}
      <path d="M48 4 C48 4 86 30 86 58 C86 77 68.5 93 48 93 C27.5 93 10 77 10 58 C10 30 48 4 48 4Z"
        fill="url(#b3-gold)" />

      {/* Dark recessed gap */}
      <path d="M48 7 C48 7 83 31.5 83 58 C83 75.5 66.5 91 48 91 C29.5 91 13 75.5 13 58 C13 31.5 48 7 48 7Z"
        fill="#0a0510" />

      {/* Gold inner ring */}
      <path d="M48 9 C48 9 81 33 81 58 C81 74 65.5 88 48 88 C30.5 88 15 74 15 58 C15 33 48 9 48 9Z"
        fill="url(#b3-gold-i)" />

      {/* Purple outer fill */}
      <path d="M48 11 C48 11 79 34 79 58 C79 73 64.5 86 48 86 C31.5 86 17 73 17 58 C17 34 48 11 48 11Z"
        fill="url(#b3-purple)" />

      <g clipPath="url(#b3-clip)">
        {/* Flame shape glow */}
        <path d="M48 19 C48 19 72 39 72 57 C72 70 61 80 48 80 C35 80 24 70 24 57 C24 39 48 19 48 19Z"
          fill="#F97316" opacity="0.3" filter="url(#b3-flame-glow)" />

        {/* Main flame fill */}
        <path d="M48 19 C48 19 72 39 72 57 C72 70 61 80 48 80 C35 80 24 70 24 57 C24 39 48 19 48 19Z"
          fill="url(#b3-flame)" />

        {/* Water drop highlight inner */}
        <path d="M48 35 C48 35 61 49 61 58 C61 64.9 55.2 70 48 70 C40.8 70 35 64.9 35 58 C35 49 48 35 48 35Z"
          fill="url(#b3-drop)" />

        {/* Drop highlight left edge */}
        <path d="M43 43 C40.5 48 40 53 41.5 57.5" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Dome overlay */}
        <path d="M48 9 C48 9 81 33 81 58 C81 74 65.5 88 48 88 C30.5 88 15 74 15 58 C15 33 48 9 48 9Z"
          fill="url(#b3-dome)" />
      </g>

      {/* Specular highlight */}
      <path d="M48 9 C48 9 81 33 81 58 C81 74 65.5 88 48 88 C30.5 88 15 74 15 58 C15 33 48 9 48 9Z"
        fill="url(#b3-spec)" />

      {/* Inner ring stroke */}
      <path d="M48 11 C48 11 79 34 79 58 C79 73 64.5 86 48 86 C31.5 86 17 73 17 58 C17 34 48 11 48 11Z"
        fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
    </svg>
  );
}
