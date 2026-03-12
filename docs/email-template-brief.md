# Atriveo Daily Network Stats Email - Design Brief

## Overview
A visual, engaging daily email that shows users:
1. Their own application activity & progress toward daily targets
2. Top 5 friends' activity (leaderboard style)
3. Target company breakdown

**Send Time**: Every day at 8:00 PM EST  
**Target Audience**: Job seekers tracking applications + network activity  
**Style**: Visual Heavy - cards, colors, gradients, emojis

---

## Email Structure & Sections

### 1. HEADER (Hero Section)
- **Background**: Purple gradient (left: `#667eea` → right: `#764ba2`)
- **Text Color**: White
- **Height**: ~120px padding top/bottom
- **Content**:
  - Large heading: "📊 Daily Network Stats"
  - Subtext: Date (e.g., "March 11, 2026")
- **Font**: Sans-serif (system fonts: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)

---

### 2. GREETING CARD
- **Background**: Light purple tint with border
  - `background: linear-gradient(135deg, #667eea15, #764ba215)`
  - `border: 1px solid #e0e7ff`
- **Content**: "✨ Hi [FirstName], here's what your network is up to today!"
- **Styling**: 18px font, bold "John" part
- **Padding**: 24px
- **Border Radius**: 12px

---

### 3. YOUR PROGRESS TODAY (Card)
Shows user's daily stats with progress bar toward target.

#### Layout:
```
🎯 Your Progress Today
[5 apps] [2 target companies]
Daily Target: 5 applications
[████████░] 100%
✅ Target achieved! Amazing work!
```

#### Components:
- **Stat Boxes** (2 side-by-side):
  - Background: Light gray (`#f3f4f6`)
  - Number: 28px bold, purple color (`#667eea`)
  - Label: 12px uppercase, muted gray
  - Padding: 16px
  - Border Radius: 8px
  - Margin: 8px between boxes

- **Progress Bar**:
  - Track: Light gray (`#e5e7eb`)
  - Fill: Purple gradient (`linear-gradient(90deg, #667eea, #764ba2)`)
  - Height: 8px
  - Border Radius: 8px
  - Width: Percentage based on `(apps_today / daily_target * 100)`

- **Status Message**:
  - If 100%: "✅ Target achieved! Amazing work!" (green `#10b981`)
  - If 50-99%: "🔥 You're almost there!" 
  - If <50%: "💪 Keep pushing!"
  - Font: 12px, bold, colored text

---

### 4. TOP 5 FRIENDS LEADERBOARD (Card)
Ranked list of top 5 friends by applications today.

#### Design:
- **Header**: "🏆 Your Friends on the Hunt (Top 5)"
- **List Items** (each is a row):
  ```
  [Medal] [Friend Name]          [App Count + Target Badge]  [Emoji]
  🥇     Alice Smith             3 applications today [1 target]    🔥
  🥈     Bob Johnson             2 applications today                💪
  🥉     Carol Lee               1 application today [1 target]     ✨
  4️⃣     David Chen              1 application today                👏
  5️⃣     Emma Wilson             1 application today                🎉
  ```

#### Styling:
- **Row Container**:
  - `display: flex; align-items: center`
  - `padding: 16px`
  - `border-bottom: 1px solid #e5e7eb` (remove on last item)
  - `min-height: 60px`

- **Medal Column**:
  - Font size: 24px
  - Margin right: 12px
  - Min width: 30px

- **Friend Info** (center, flex-grow):
  - **Name**: 14px bold, dark gray (`#1f2937`)
  - **Apps Count**: 14px lighter, gray `#6b7280`
    - Format: "3 applications today" + optional target badge

- **Target Badge** (inline):
  - Background: Light blue (`#dbeafe`)
  - Text: Dark blue (`#1e40af`)
  - Font: 12px bold
  - Padding: 4px 8px
  - Border Radius: 4px
  - Margin Left: 8px
  - Text: "1 target" or "X targets"

- **Right Emoji Column**:
  - Font size: 32px
  - Text align: right
  - Motivational emojis (🔥💪✨👏🎉)
  - Auto-selected based on app count (more apps = 🔥)

---

### 5. TARGET COMPANIES BREAKDOWN (Card)
Shows top 3 target companies they applied to today.

#### Design:
- **Header**: "🎯 Your Target Company Hits"
- **Layout**: 3 columns (responsive: stack on mobile)
- **Per Company**:
  ```
  [Colored Circle Emoji]
     Google
    2 apps
  ```

#### Company Card Styling:
- **Container**: `flex: 1; min-width: 140px`
- **Background**: Light gray (`#f3f4f6`)
- **Padding**: 12px
- **Border Radius**: 8px
- **Text Align**: Center
- **Emoji**: 24px font, margin-bottom: 4px
  - Different colored circles per company (🔵🟠🔴 etc.)
- **Company Name**: 12px bold, dark gray
- **App Count**: 18px bold `#667eea`
- **Margin Top**: 4px on count

#### Example Companies:
- Google: 🔵 Blue circle
- Amazon: 🟠 Orange circle  
- Meta: 🔴 Red circle

---

### 6. CTA BUTTON
Single button centered below content.

- **Text**: "View Full Dashboard →"
- **Link**: `https://www.atriveo.com/dashboard`
- **Style**:
  - Background: Purple gradient (`linear-gradient(135deg, #667eea 0%, #764ba2 100%)`)
  - Color: White
  - Padding: 14px 40px
  - Border Radius: 8px
  - Font Weight: 600
  - Text Decoration: None
  - Display: Inline-block
  - Margin Top: 20px
  - **Hover**: Slight opacity/brightness reduction (if supported)

---

### 7. FOOTER
- **Background**: Light gray (`#f9fafb`)
- **Text Color**: Muted gray (`#6b7280`)
- **Font Size**: 12px
- **Padding**: 24px
- **Text Align**: Center
- **Content**:
  ```
  You received this because you're subscribed to daily network stats.
  
  [Manage Preferences] | [Unsubscribe]
  ```
- **Links**: Purple color (`#667eea`), underlined

---

## Design System

### Colors
- **Primary Gradient**: `#667eea` → `#764ba2` (purple)
- **Success**: `#10b981` (green)
- **Background**: `#f9fafb` (light gray)
- **Card BG**: `#ffffff` (white)
- **Borders**: `#e5e7eb` (light gray)
- **Text Primary**: `#1f2937` (dark gray)
- **Text Secondary**: `#6b7280` (medium gray)
- **Accent**: `#667eea` (purple blue)

### Typography
- **Font Family**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Headings**: Bold (weight 700)
- **Labels**: Bold (weight 600)
- **Body**: Regular (weight 400)

### Spacing
- **Card Padding**: 24px
- **Element Margin**: 16px
- **Small Gap**: 8px
- **Container Max Width**: 600px

### Border Radius
- **Large**: 12px (cards)
- **Medium**: 8px (buttons, badges, stat boxes)
- **Small**: 4px (badges)

---

## Responsive Behavior

### Mobile (< 480px)
- Single column layout
- Max width: 100% with 16px padding
- Cards stack vertically
- Button full width
- Company cards: Stack or 2 columns max

### Tablet (480px - 768px)
- Similar to mobile but more breathing room
- Max width: 500px

### Desktop (> 768px)
- Max width: 600px
- All layouts as designed

---

## Dynamic Content Placeholders

Replace with actual values:
- `[FirstName]`: User's first name or "Friend"
- `[5]`: Count of applications today
- `[2]`: Count from target companies
- `[DATE]`: Today's date formatted as "March 11, 2026"
- Friend names, counts, and emojis from database
- Company names and app counts from analytics

---

## Technical Requirements

### HTML/CSS
- Responsive email-safe HTML (inline CSS preferred)
- Fallback fonts (no custom web fonts if possible)
- All colors as hex codes
- All sizing in px (not em/rem for email consistency)
- Test in popular email clients: Gmail, Apple Mail, Outlook

### Email Client Compatibility
- Outlook (desktop)
- Gmail (web + mobile)
- Apple Mail
- Yahoo Mail
- Mobile clients (iOS Mail, Gmail Mobile)

### Accessibility
- High contrast text (WCAG AA minimum)
- Descriptive alt text for emojis
- Semantic HTML structure
- Readable font sizes (min 14px for body)

---

## Files to Generate

1. **HTML Template**: `/email-templates/daily-stats.html`
   - Full responsive HTML email
   - Inline CSS
   - Template variables marked as `{{variable}}`

2. **Text Fallback**: `/email-templates/daily-stats.txt`
   - Plain text version for email clients that don't support HTML
   - Keep the same info, just text-based

3. **Preview Images**: 
   - Desktop screenshot
   - Mobile screenshot
   - Dark mode screenshot (if applicable)

---

## Testing Checklist

- [ ] Render in Gmail (web)
- [ ] Render in Gmail (mobile)
- [ ] Render in Apple Mail
- [ ] Render in Outlook
- [ ] Render in Apple Mail (mobile)
- [ ] Check all links are clickable
- [ ] Verify images load (logo, company icons)
- [ ] Test with long names (Alice Smithsonton-Williams)
- [ ] Test with 0 target companies
- [ ] Test with >5 friends (should truncate to 5)
- [ ] Test with 0 applications
- [ ] Mobile: Buttons are tappable (48px min height)
- [ ] Mobile: Text is readable without zoom

---

## Notes for Design/Development

- Keep emojis consistent across email clients (use standard Unicode)
- Avoid JavaScript (email doesn't support it)
- Use `display: block` for better email compatibility
- Test with `margin: 0` on all base elements to prevent rendering issues
- Use `mso-` properties for Outlook compatibility if needed
- Ensure all colors have sufficient contrast for readability
- Make unsubscribe link visible and easy to find (spam law requirement)
