import type { SortField, SortOrder } from "../../types";

type Props = {
  sortBy: SortField;
  sortOrder: SortOrder;
  sortConfig: { key: SortField; label: string }[];
  handleSort: (field: SortField) => void;
};

export default function JobsTableHead({ sortBy, sortOrder, sortConfig, handleSort }: Props) {
  return (
    <thead>
      <tr>
        <th>No.</th>
        <th>
          <button
            type="button"
            className="th-sort"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSort("applied_at"); }}
            title={sortBy === "applied_at" ? `${sortOrder === "asc" ? "A→Z" : "Z→A"} (click to reverse)` : "Sort by Applied At"}
          >
            {sortConfig.find((c) => c.key === "applied_at")?.label ?? "Applied At"}
            {sortBy === "applied_at" ? <span className="th-sort-icon" aria-hidden>{sortOrder === "asc" ? " ↑" : " ↓"}</span> : null}
          </button>
        </th>
        <th>
          <button
            type="button"
            className="th-sort"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSort("company"); }}
            title="Sort by Company / Position"
          >
            Company / Position
            {sortBy === "company" ? <span className="th-sort-icon" aria-hidden>{sortOrder === "asc" ? " ↑" : " ↓"}</span> : null}
          </button>
        </th>
        <th>
          <button
            type="button"
            className="th-sort"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSort("referral_status"); }}
            title="Sort by Referral"
          >
            Referral
            {sortBy === "referral_status" ? <span className="th-sort-icon" aria-hidden>{sortOrder === "asc" ? " ↑" : " ↓"}</span> : null}
          </button>
        </th>
        <th>Referral Name</th>
        <th>Keyword Match</th>
        <th>OA</th>
        <th>OA Deadline</th>
        <th>Job/App ID</th>
        <th>
          <button
            type="button"
            className="th-sort"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSort("job_link"); }}
            title="Sort by Link"
          >
            Link
            {sortBy === "job_link" ? <span className="th-sort-icon" aria-hidden>{sortOrder === "asc" ? " ↑" : " ↓"}</span> : null}
          </button>
        </th>
        <th>Application Status</th>
        <th>Actions</th>
      </tr>
    </thead>
  );
}
