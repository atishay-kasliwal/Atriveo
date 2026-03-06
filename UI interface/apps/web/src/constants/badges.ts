import { Badge1_Shield } from "../components/network/badges/Badge1_Shield";
import { Badge2_Circle365 } from "../components/network/badges/Badge2_Circle365";
import { Badge3_Flame } from "../components/network/badges/Badge3_Flame";
import { Badge4_RocketShield } from "../components/network/badges/Badge4_RocketShield";
import { Badge5_HexX } from "../components/network/badges/Badge5_HexX";
import { Badge6_Triangle } from "../components/network/badges/Badge6_Triangle";
import { Badge7_HexChevrons } from "../components/network/badges/Badge7_HexChevrons";
import { Badge8_Social } from "../components/network/badges/Badge8_Social";
import { Badge9_CircleMedal } from "../components/network/badges/Badge9_CircleMedal";
import { Badge10_Sunburst } from "../components/network/badges/Badge10_Sunburst";
import { Badge11_AudioCircle } from "../components/network/badges/Badge11_AudioCircle";
import { Badge12_HexStar } from "../components/network/badges/Badge12_HexStar";

export type BadgeCategory = "consistency" | "applications" | "rivalry";
export type BadgeTier = "bronze" | "silver" | "gold" | "platinum";

type BadgeIcon = () => JSX.Element;

export type BadgeDefinition = {
  id: string;
  category: BadgeCategory;
  tier: BadgeTier;
  name: string;
  description: string;
  Icon: BadgeIcon;
};

export const BADGE_TIERS: BadgeTier[] = ["bronze", "silver", "gold", "platinum"];

export const BADGE_CATEGORY_LABEL: Record<BadgeCategory, string> = {
  consistency: "Consistency",
  applications: "Applications",
  rivalry: "Rivalry",
};

export const BADGES: Record<BadgeCategory, Record<BadgeTier, BadgeDefinition>> = {
  consistency: {
    bronze: {
      id: "consistency-bronze",
      category: "consistency",
      tier: "bronze",
      name: "Consistency Bronze",
      description: "3-day application streak",
      Icon: Badge3_Flame,
    },
    silver: {
      id: "consistency-silver",
      category: "consistency",
      tier: "silver",
      name: "Consistency Silver",
      description: "5-day application streak",
      Icon: Badge2_Circle365,
    },
    gold: {
      id: "consistency-gold",
      category: "consistency",
      tier: "gold",
      name: "Consistency Gold",
      description: "6-day application streak",
      Icon: Badge6_Triangle,
    },
    platinum: {
      id: "consistency-platinum",
      category: "consistency",
      tier: "platinum",
      name: "Consistency Platinum",
      description: "7-day perfect streak",
      Icon: Badge10_Sunburst,
    },
  },
  applications: {
    bronze: {
      id: "applications-bronze",
      category: "applications",
      tier: "bronze",
      name: "Applications Bronze",
      description: "8 applications in a week",
      Icon: Badge1_Shield,
    },
    silver: {
      id: "applications-silver",
      category: "applications",
      tier: "silver",
      name: "Applications Silver",
      description: "14 applications in a week",
      Icon: Badge4_RocketShield,
    },
    gold: {
      id: "applications-gold",
      category: "applications",
      tier: "gold",
      name: "Applications Gold",
      description: "20 applications in a week",
      Icon: Badge5_HexX,
    },
    platinum: {
      id: "applications-platinum",
      category: "applications",
      tier: "platinum",
      name: "Applications Platinum",
      description: "28 applications in a week",
      Icon: Badge11_AudioCircle,
    },
  },
  rivalry: {
    bronze: {
      id: "rivalry-bronze",
      category: "rivalry",
      tier: "bronze",
      name: "Rivalry Bronze",
      description: "Win 1 daily rivalry",
      Icon: Badge8_Social,
    },
    silver: {
      id: "rivalry-silver",
      category: "rivalry",
      tier: "silver",
      name: "Rivalry Silver",
      description: "Win 3 daily rivalries",
      Icon: Badge7_HexChevrons,
    },
    gold: {
      id: "rivalry-gold",
      category: "rivalry",
      tier: "gold",
      name: "Rivalry Gold",
      description: "Win 5 daily rivalries",
      Icon: Badge9_CircleMedal,
    },
    platinum: {
      id: "rivalry-platinum",
      category: "rivalry",
      tier: "platinum",
      name: "Rivalry Platinum",
      description: "Win 7 daily rivalries",
      Icon: Badge12_HexStar,
    },
  },
};

export const BADGE_ORDER: BadgeDefinition[] = [
  BADGES.consistency.bronze,
  BADGES.applications.bronze,
  BADGES.rivalry.bronze,
  BADGES.consistency.silver,
  BADGES.applications.silver,
  BADGES.rivalry.silver,
  BADGES.consistency.gold,
  BADGES.applications.gold,
  BADGES.rivalry.gold,
  BADGES.consistency.platinum,
  BADGES.applications.platinum,
  BADGES.rivalry.platinum,
];
