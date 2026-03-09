import Spinner from "../../../components/Spinner";
import type { NetworkFieldVisibility } from "../../../lib/api";
import { formatTableDateTime } from "../../../lib/formatDate";
import { normalizeOaStatus } from "../utils";

type JobSnapshot = {
  company: string | null;
  role: string | null;
  date_saved: string | null;
  applied_at: string | null;
  job_link: string | null;
  job_application_id: string | null;
  oa_deadline_date: string | null;
  oa_status: string | null;
  referral_status: string | null;
  application_status: string | null;
  notes?: string | null;
};

type TodayApplicationRow = {
  job: {
    id: number;
    company: string | null;
    role: string | null;
    date_saved: string | null;
    applied_at: string | null;
    job_link: string | null;
    job_application_id: string | null;
    oa_deadline_date: string | null;
    oa_status: string | null;
    referral_status: string | null;
    application_status: string | null;
    notes?: string | null;
    can_view_company: boolean;
    can_view_role: boolean;
    can_view_applied_at: boolean;
    can_view_oa_status: boolean;
    can_view_oa_deadline: boolean;
    can_view_referral_used: boolean;
    can_view_notes: boolean;
    can_view_job_application_id: boolean;
  };
  friendName: string;
  friendId: number;
};

type Props = {
  isLoading: boolean;
  todayApplicationsFlat: TodayApplicationRow[];
  privacyHiddenLabel: (key: keyof NetworkFieldVisibility) => string;
  onSelectFriendJob: (friendDisplayName: string, job: JobSnapshot) => void;
};

export default function NetworkTodayApplicationsContent({
  isLoading,
  todayApplicationsFlat,
  privacyHiddenLabel,
  onSelectFriendJob,
}: Props) {
  if (isLoading) return <Spinner />;

  if (todayApplicationsFlat.length === 0) {
    return (
      <div className="network-card-content">
        <div className="network-empty-state network-empty-state--today" role="status" aria-live="polite">
          <div className="network-empty-state-icon" aria-hidden="true">
            ◌
          </div>
          <p className="network-empty-state-title">No applications logged today</p>
          <p className="network-empty-state-copy">When friends add applications, they appear here automatically.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="network-card-content">
      <div className="table-wrap network-today-wrap">
        <table className="network-today-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Company / Position</th>
              <th>Applied Date</th>
              <th>OA Status</th>
              <th>OA Deadline</th>
              <th>Job/Application ID</th>
              <th>Referral Used</th>
              <th>Notes</th>
              <th>Link</th>
              <th>Action</th>
              <th>Friend</th>
            </tr>
          </thead>
          <tbody>
            {todayApplicationsFlat.map((row, idx) => {
              const { job, friendName } = row;
              const canViewIdentity = Boolean(job.can_view_company && job.can_view_role);
              const canOpenLink = canViewIdentity && Boolean(job.job_link);
              const canPrefill = canViewIdentity;
              return (
                <tr
                  key={`${row.friendId}-${job.id}`}
                  className="network-job-row"
                  onClick={() => {
                    if (!canPrefill) return;
                    onSelectFriendJob(friendName, {
                      company: job.company ?? null,
                      role: job.role ?? null,
                      date_saved: job.date_saved ?? null,
                      applied_at: job.applied_at ?? null,
                      job_link: job.job_link ?? null,
                      job_application_id: job.job_application_id ?? null,
                      oa_deadline_date: job.oa_deadline_date ?? null,
                      oa_status: job.oa_status ?? null,
                      referral_status: job.referral_status ?? null,
                      application_status: job.application_status ?? null,
                      notes: job.notes ?? null,
                    });
                  }}
                >
                  <td className="network-cell-index" data-label="#">{idx + 1}</td>
                  <td className="network-cell-company-role" data-label="Company">
                    {canViewIdentity ? (
                      <div className="job-main">
                        <div className="job-company" title={String(job.company ?? "—")}>
                          {String(job.company ?? "—")}
                        </div>
                        <div className="job-role" title={String(job.role ?? "—")}>
                          {String(job.role ?? "—")}
                        </div>
                      </div>
                    ) : (
                      <span className="network-not-shared">Not shared</span>
                    )}
                  </td>
                  <td className="network-cell-date" data-label="Applied">
                    {job.can_view_applied_at ? (
                      formatTableDateTime(job.applied_at ?? job.date_saved)
                    ) : (
                      <span className="network-not-shared">{privacyHiddenLabel("share_applied_at")}</span>
                    )}
                  </td>
                  <td className="network-cell-oa" data-label="OA">
                    {job.can_view_oa_status ? (
                      normalizeOaStatus(job.oa_status)
                    ) : (
                      <span className="network-not-shared">{privacyHiddenLabel("share_oa_status")}</span>
                    )}
                  </td>
                  <td className="network-cell-deadline" data-label="Deadline">
                    {job.can_view_oa_deadline ? (
                      (String(job.oa_deadline_date ?? "-") || "-")
                    ) : (
                      <span className="network-not-shared">{privacyHiddenLabel("share_oa_deadline")}</span>
                    )}
                  </td>
                  <td className="network-cell-jobid" data-label="Job ID">
                    {job.can_view_job_application_id ? (
                      (String(job.job_application_id ?? "-") || "-")
                    ) : (
                      <span className="network-not-shared">{privacyHiddenLabel("share_job_application_id")}</span>
                    )}
                  </td>
                  <td className="network-cell-referral" data-label="Referral">
                    {job.can_view_referral_used ? (
                      (String(job.referral_status ?? "-") || "-")
                    ) : (
                      <span className="network-not-shared">{privacyHiddenLabel("share_referral_used")}</span>
                    )}
                  </td>
                  <td className="network-cell-notes">
                    {job.can_view_notes ? (
                      (String(job.notes ?? "-") || "-")
                    ) : (
                      <span className="network-not-shared">{privacyHiddenLabel("share_notes")}</span>
                    )}
                  </td>
                  <td className="network-cell-link" data-label="Link">
                    {canOpenLink ? (
                      <a
                        href={String(job.job_link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="network-link-chip"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open
                      </a>
                    ) : canViewIdentity ? (
                      "—"
                    ) : (
                      <span className="network-not-shared">Not shared</span>
                    )}
                  </td>
                  <td className="network-cell-action" data-label="">
                    <button
                      type="button"
                      className="action-btn network-add-btn"
                      disabled={!canPrefill}
                      title={canPrefill ? "Add this application to your list" : "Friend has not shared enough fields for prefill"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canPrefill) return;
                        onSelectFriendJob(friendName, {
                          company: job.company ?? null,
                          role: job.role ?? null,
                          date_saved: job.date_saved ?? null,
                          applied_at: job.applied_at ?? null,
                          job_link: job.job_link ?? null,
                          job_application_id: job.job_application_id ?? null,
                          oa_deadline_date: job.oa_deadline_date ?? null,
                          oa_status: job.oa_status ?? null,
                          referral_status: job.referral_status ?? null,
                          application_status: job.application_status ?? null,
                          notes: job.notes ?? null,
                        });
                      }}
                    >
                      <span className="network-add-btn-text">Add Application</span>
                      <span className="network-add-btn-text--short">Add</span>
                    </button>
                  </td>
                  <td className="network-cell-friend" data-label="Friend">{friendName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
