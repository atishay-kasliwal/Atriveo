import type { Dispatch, SetStateAction } from "react";
import { getReferralInitials } from "../../utils/formatters";

type ReferralRow = { name: string; company: string; role: string };

type Props = {
  referralSearch: string;
  setReferralSearch: Dispatch<SetStateAction<string>>;
  filteredReferralRows: ReferralRow[];
};

export default function ActiveJobsReferralPanel({
  referralSearch,
  setReferralSearch,
  filteredReferralRows,
}: Props) {
  return (
    <section className="active-jobs-side-panel">
      <div className="active-jobs-side-heading">
        <h3>Referral Pulse</h3>
      </div>
      <label className="active-jobs-referral-search">
        <span className="active-jobs-referral-search-icon" aria-hidden>
          <svg viewBox="0 0 20 20" fill="none" role="presentation" focusable="false">
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          value={referralSearch}
          onChange={(e) => setReferralSearch(e.target.value)}
          placeholder="Search friend or company"
          aria-label="Search referral pulse"
        />
      </label>
      <div className="active-jobs-referral-table-wrap">
        <table className="active-jobs-referral-table">
          <thead>
            <tr>
              <th>Count</th>
              <th>Referral Name</th>
              <th>Company</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {filteredReferralRows.map((row, idx) => (
              <tr key={`${row.name}-${row.company}`}>
                <td className="active-jobs-referral-count">{idx + 1}</td>
                <td>
                  <div className="active-jobs-referral-person">
                    <span className="active-jobs-referral-avatar" aria-hidden>
                      <span className="active-jobs-referral-avatar-text">{getReferralInitials(row.name)}</span>
                    </span>
                    <div className="active-jobs-referral-name">
                      <strong>{row.name}</strong>
                    </div>
                  </div>
                </td>
                <td>{row.company}</td>
                <td>{row.role}</td>
              </tr>
            ))}
            {filteredReferralRows.length === 0 ? (
              <tr>
                <td className="active-jobs-referral-empty" colSpan={4}>
                  No matching friend or company.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
