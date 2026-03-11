export type PreviewRow = {
  company: string;
  role: string;
  referral: "Yes" | "No";
  status: string;
  applied: string;
  oa: string;
  deadline: string;
};

export const PREVIEW_ROWS: PreviewRow[] = [
  { company: "Google", role: "Software Engineer", referral: "Yes", status: "Interview", applied: "Mar 1, 2026", oa: "Yes", deadline: "Mar 15" },
  { company: "Meta", role: "Backend Engineer", referral: "Yes", status: "Applied", applied: "Mar 3, 2026", oa: "Pending", deadline: "Mar 20" },
  { company: "Apple", role: "iOS Engineer", referral: "No", status: "OA", applied: "Mar 4, 2026", oa: "Yes", deadline: "Mar 18" },
  { company: "Amazon", role: "SDE Intern", referral: "Yes", status: "Applied", applied: "Mar 5, 2026", oa: "Pending", deadline: "Mar 22" },
];

export const FEATURES = [
  { icon: "◎", title: "Track Applications", description: "Keep every application organized in one place with role, company, date, and status context." },
  { icon: "◍", title: "Manage Referrals", description: "Track referral requests and outcomes so warm intros never get lost during busy weeks." },
  { icon: "◉", title: "Never Miss Deadlines", description: "Stay ahead of OA deadlines and interviews with clear visibility into what needs action next." },
];

export const STEP_ITEMS = [
  { step: "Step 1", title: "Add Applications", description: "Add each application in seconds with company, role, and referral context." },
  { step: "Step 2", title: "Track Progress", description: "Move applications through OA, interview, and final outcome states." },
  { step: "Step 3", title: "Stay Consistent", description: "Review momentum and keep follow-ups moving every day." },
  { step: "Step 4", title: "Compete with Friends", description: "Compare progress with friends to stay accountable and keep momentum high." },
];

export const LEADERBOARD = [
  { rank: 1, name: "You", score: 10, leader: true },
  { rank: 2, name: "Ethan", score: 8, leader: false },
  { rank: 3, name: "Olivia", score: 7, leader: false },
  { rank: 4, name: "Mason", score: 6, leader: false },
];

export const COMPANY_SIGNALS = [
  { company: "Google", role: "Software Engineer", friends: 2, by: "Ethan", status: "Hot" },
  { company: "Meta", role: "Backend Engineer", friends: 1, by: "Olivia", status: "Warm" },
  { company: "Stripe", role: "Product Engineer", friends: 1, by: "You", status: "New" },
  { company: "Amazon", role: "SDE Intern", friends: 2, by: "Mason", status: "Hot" },
];

export const COMPETE_KPIS = [
  { label: "Your Rank", value: "#1", delta: "+2 this week" },
  { label: "Apps This Week", value: "10", delta: "2 ahead of avg" },
  { label: "Gap to #2", value: "2", delta: "Strong lead" },
  { label: "Streak", value: "6 days", delta: "Best in group" },
];

export const VELOCITY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const VELOCITY_SERIES = {
  you: [2, 3, 4, 3, 5, 4, 6],
  friends: [1, 2, 2, 3, 2, 3, 3],
};

export const FUNNEL_STAGES = [
  { label: "Applied", value: 28 },
  { label: "OA", value: 16 },
  { label: "Interview", value: 9 },
  { label: "Offer", value: 2 },
];

export const REFERRAL_IMPACT = [
  { label: "With Referral", value: 38, note: "+14% conversion" },
  { label: "Direct Apply", value: 24, note: "Baseline conversion" },
];

export const TRUST_LOGOS = [
  { name: "Google", src: "/company-logos/google.svg" },
  { name: "Amazon", src: "/company-logos/amazon.svg", darkSrc: "/company-logos/amazon-dark.svg" },
  { name: "Meta", src: "/company-logos/meta.svg", darkSrc: "/company-logos/meta-dark.svg" },
  { name: "NVIDIA", src: "/company-logos/nvidia.svg", darkSrc: "/company-logos/nvidia-dark.svg" },
  { name: "Apple", src: "/company-logos/apple.svg", darkSrc: "/company-logos/apple-dark.svg" },
  { name: "Microsoft", src: "/company-logos/microsoft.svg", darkSrc: "/company-logos/microsoft-dark.svg" },
  { name: "Netflix", src: "/company-logos/netflix.svg" },
];

export const TESTIMONIALS = [
  { name: "Emma Carter", role: "CS Student at MIT", quote: "Atriveo turned my search from random tabs into one clear weekly system. I landed 3 interviews in 2 weeks.", initials: "EC", metric: "3 interviews" },
  { name: "Olivia Reed", role: "New Grad Applicant", quote: "I finally stopped missing follow-ups. The timeline and reminders keep me consistent, and I got an offer in 6 weeks.", initials: "OR", metric: "6 weeks to offer" },
  { name: "Ethan Brooks", role: "Software Intern Candidate", quote: "My referrals, deadlines, and interviews are in one place. This helped me track 40+ applications without stress.", initials: "EB", metric: "40+ applications tracked" },
  { name: "Sophie Chen", role: "Recent Graduate", quote: "The referral tracking feature helped me stay top-of-mind. Got my current role through a warm intro I tracked on Atriveo.", initials: "SC", metric: "Got job via referral" },
];

export const FREE_TIER_FEATURES = [
  "✓ Track unlimited job applications",
  "✓ Monitor referral requests and outcomes",
  "✓ Set daily/weekly/monthly targets",
  "✓ Track OA deadlines & interview dates",
  "✓ Build follow-up reminders",
  "✓ Chrome extension (25+ ATS platforms)",
  "✓ CSV import/export for data portability",
  "✓ Mobile-responsive dashboard",
];

export const TRUST_SIGNALS = [
  { icon: "🔒", label: "Your data is private", detail: "End-to-end encryption. We never sell data." },
  { icon: "⚡", label: "100% free forever", detail: "All core features are free. No credit card required." },
  { icon: "📱", label: "Works everywhere", detail: "Browser, mobile, Chrome extension. Pick your tool." },
  { icon: "🤝", label: "Join 1000+ users", detail: "Trusted by students and professionals." },
];

export const EXTENSION_INSTALL_PATH = "/extension-install";

export const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: `${(i * 17) % 100}%`,
  top: `${(i * 29) % 100}%`,
  size: `${1 + (i % 3)}px`,
  duration: `${16 + (i % 7)}s`,
  delay: `${-(i % 9)}s`,
}));
