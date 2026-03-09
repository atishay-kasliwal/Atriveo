import { BADGES, BADGE_CATEGORY_LABEL, BADGE_TIERS } from "../../../constants/badges";
import type { ComponentType } from "react";
import type { BadgeCategoryList } from "../types";

type EarnedBadge = {
  id: string;
  tier: string;
  name: string;
  description: string;
  Icon: ComponentType;
};

type Props = {
  show: boolean;
  onClose: () => void;
  earnedBadges: EarnedBadge[];
  totalMedals: number;
  latestAchievement: EarnedBadge | null;
  badgeCategories: BadgeCategoryList;
  earnedBadgeIds: Set<string>;
};

export default function BadgeGalleryModal({
  show,
  onClose,
  earnedBadges,
  totalMedals,
  latestAchievement,
  badgeCategories,
  earnedBadgeIds,
}: Props) {
  if (!show) return null;

  return (
    <div className="modal-overlay network-badge-modal-overlay" onClick={onClose}>
      <div
        className="modal network-badge-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Badge gallery"
      >
        <div className="network-badge-modal-head">
          <h3>Achievements</h3>
          <button type="button" className="network-badge-modal-close" aria-label="Close achievements modal" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="network-badge-modal-hero">
          <p className="network-badge-modal-subtitle">
            {earnedBadges.length} of {totalMedals} medals earned
          </p>
          <section className="network-badge-latest" aria-label="Latest achievement">
            <p className="network-badge-latest-kicker">Latest Achievement</p>
            {latestAchievement ? (
              <div className={`network-badge-latest-row network-medal tier-${latestAchievement.tier} is-unlocked`}>
                <span className="network-badge-latest-icon">
                  <latestAchievement.Icon />
                </span>
                <div className="network-badge-latest-copy">
                  <p className="network-badge-latest-name">{latestAchievement.name}</p>
                  <p className="network-badge-latest-desc">{latestAchievement.description}</p>
                </div>
              </div>
            ) : (
              <p className="network-badge-latest-empty">No medals unlocked yet. Keep applying to unlock your first one.</p>
            )}
          </section>
        </div>
        <div className="network-badge-gallery">
          {badgeCategories.map((category) => {
            const unlockedCount = BADGE_TIERS.filter((tier) => earnedBadgeIds.has(BADGES[category][tier].id)).length;
            return (
              <section key={category} className="network-badge-gallery-section">
                <div className="network-badge-gallery-section-head">
                  <h4>{BADGE_CATEGORY_LABEL[category]}</h4>
                  <span>
                    {unlockedCount} / {BADGE_TIERS.length}
                  </span>
                </div>
                <div className="network-badge-gallery-shelf">
                  {BADGE_TIERS.map((tier) => {
                    const badge = BADGES[category][tier];
                    const Icon = badge.Icon;
                    const unlocked = earnedBadgeIds.has(badge.id);
                    return (
                      <article
                        key={badge.id}
                        className={`network-badge-gallery-item network-medal tier-${badge.tier}${unlocked ? " is-unlocked" : " is-locked"}`}
                        aria-label={`${badge.name}. ${badge.description}. ${unlocked ? "Unlocked" : "Locked"}.`}
                      >
                        <span className="network-badge-gallery-icon">
                          <Icon />
                        </span>
                        <p className="network-badge-gallery-name">{badge.name}</p>
                        <p className="network-badge-gallery-desc">{badge.description}</p>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
