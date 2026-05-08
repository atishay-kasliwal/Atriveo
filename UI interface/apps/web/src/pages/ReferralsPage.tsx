import { useCallback, useEffect, useMemo, useState } from "react";
import useConfirmDialog from "../components/ui/useConfirmDialog";
import { getLocalISODate } from "../lib/formatDate";
import {
  createReferral,
  createJob,
  deleteReferral,
  getReferrals,
  getReferralsTrend,
  updateReferral,
  type ReferralsTrendData,
} from "../lib/api";
import { CREATE_REFERRAL_INITIAL, JOB_STATUSES, LIMIT } from "./referrals/constants";
import CreateRecordModal from "./referrals/components/CreateRecordModal";
import CreateReferralModal from "./referrals/components/CreateReferralModal";
import EditReferralModal from "./referrals/components/EditReferralModal";
import ReferralsTableCard from "./referrals/components/ReferralsTableCard";
import ReferralsTrendCard from "./referrals/components/ReferralsTrendCard";
import type { CreateRecordForm, CreateReferralForm } from "./referrals/types";
import { formatDayShort, padReferralsWithDummyRows } from "./referrals/utils";

export default function ReferralsPage() {
  const [openData, setOpenData] = useState<Array<Record<string, unknown>>>([]);
  const [appliedData, setAppliedData] = useState<Array<Record<string, unknown>>>([]);
  const [page, setPage] = useState(1);
  const [appliedPage, setAppliedPage] = useState(1);
  const [error, setError] = useState("");
  const [isLoadingOpen, setIsLoadingOpen] = useState(true);
  const [isLoadingApplied, setIsLoadingApplied] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateReferralForm>(CREATE_REFERRAL_INITIAL);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editReferredByName, setEditReferredByName] = useState("");
  const [showCreateRecordModal, setShowCreateRecordModal] = useState(false);
  const [isCreatingRecord, setIsCreatingRecord] = useState(false);
  const [createRecordError, setCreateRecordError] = useState("");
  const [createRecordForm, setCreateRecordForm] = useState<CreateRecordForm>({
    company: "",
    request_log: "",
    request_date: getLocalISODate(),
    request_link: "",
    referred_by_name: "",
    comment: "",
  });
  const [trendData, setTrendData] = useState<ReferralsTrendData>([]);
  const [isLoadingTrend, setIsLoadingTrend] = useState(true);
  const { confirm, confirmDialog } = useConfirmDialog();

  const loadOpen = useCallback(async () => {
    try {
      setError("");
      setIsLoadingOpen(true);
      const res = await getReferrals({ page, limit: LIMIT, filter: "open" });
      setOpenData(res.data ?? []);
    } catch (e) {
      setError((e as Error).message);
      setOpenData([]);
    } finally {
      setIsLoadingOpen(false);
    }
  }, [page]);

  const loadApplied = useCallback(async () => {
    try {
      setError("");
      setIsLoadingApplied(true);
      const res = await getReferrals({ page: appliedPage, limit: LIMIT, filter: "applied" });
      setAppliedData(res.data ?? []);
    } catch (e) {
      setError((e as Error).message);
      setAppliedData([]);
    } finally {
      setIsLoadingApplied(false);
    }
  }, [appliedPage]);

  const loadTrend = useCallback(async () => {
    try {
      setIsLoadingTrend(true);
      const res = await getReferralsTrend(30);
      setTrendData(res.data ?? []);
    } catch (e) {
      console.error("Failed to load referrals trend:", e);
      setTrendData([]);
    } finally {
      setIsLoadingTrend(false);
    }
  }, []);

  useEffect(() => {
    loadOpen();
  }, [loadOpen]);

  useEffect(() => {
    loadApplied();
  }, [loadApplied]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  useEffect(() => {
    const onRefresh = () => {
      loadOpen();
      loadApplied();
      loadTrend();
    };
    window.addEventListener("dashboard-refresh", onRefresh);
    return () => window.removeEventListener("dashboard-refresh", onRefresh);
  }, [loadOpen, loadApplied, loadTrend]);

  const chartData = useMemo(
    () =>
      trendData.map((row) => ({
        ...row,
        dayLabel: formatDayShort(row.day),
        referralReceived: row.received,
      })),
    [trendData],
  );

  const chartInsights = useMemo(() => {
    if (!chartData.length) {
      return {
        peakRequested: null as { day: string; value: number } | null,
        receivedDays: 0,
      };
    }
    const maxRequested = Math.max(...chartData.map((d) => d.requested), 0);
    const peakDay = chartData.find((d) => d.requested === maxRequested) ?? null;
    const receivedDays = chartData.filter((d) => d.referralReceived > 0).length;
    return {
      peakRequested: peakDay ? { day: peakDay.dayLabel, value: maxRequested } : null,
      receivedDays,
    };
  }, [chartData]);

  const openRows = useMemo(
    () => padReferralsWithDummyRows(openData, page, LIMIT, "open"),
    [openData, page],
  );
  const appliedRows = useMemo(
    () => padReferralsWithDummyRows(appliedData, appliedPage, LIMIT, "applied"),
    [appliedData, appliedPage],
  );

  function openEdit(r: Record<string, unknown>) {
    setEditing(r);
    setEditStatus(String(r.referral_received ?? ""));
    setEditReferredByName(String(r.referred_by_name ?? ""));
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.id) return;
    const newStatus = editStatus.trim();
    try {
      setIsSaving(true);
      await updateReferral(String(editing.id), {
        referral_received: newStatus || null,
        referred_by_name: editReferredByName.trim() || null,
      });
      const movesToJobs = JOB_STATUSES.includes(newStatus as (typeof JOB_STATUSES)[number]);
      if (movesToJobs) {
        let jobLink: string | undefined;
        try {
          const link = (editing.request_link as string)?.trim();
          if (link && new URL(link).href) jobLink = link;
        } catch {
          /* omit invalid URL */
        }
        await createJob({
          company: String(editing.company ?? "").trim(),
          role: (editing.request_log as string)?.trim() || "(From referral)",
          job_link: jobLink,
          keyword_matching: String((editing as any).keyword_matching ?? "Medium"),
          referral_status: newStatus,
          referred_by_name: editReferredByName.trim() || undefined,
          notes: (editing.comment as string)?.trim() || undefined,
        });
      }
      setEditing(null);
      if (newStatus === "Yes") {
        const [openRes, appliedRes] = await Promise.all([
          getReferrals({ page, limit: LIMIT, filter: "open" }),
          getReferrals({ page: 1, limit: LIMIT, filter: "applied" }),
        ]);
        setOpenData(openRes.data ?? []);
        setAppliedData(appliedRes.data ?? []);
        setAppliedPage(1);
      } else {
        await Promise.all([loadOpen(), loadApplied()]);
      }
      await loadTrend();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  const hasNext = openData.length === LIMIT;
  const hasPrev = page > 1;
  const hasNextApplied = appliedData.length === LIMIT;
  const hasPrevApplied = appliedPage > 1;
  async function onDelete(row: Record<string, unknown>) {
    const id = row.id as number | string | undefined;
    if (id === undefined || id === null) return;
    const company = String(row.company ?? "").trim();
    const position = String(row.request_log ?? "").trim();
    const label = [company, position].filter(Boolean).join(" — ");
    const confirmed = await confirm({
      title: "Delete Referral",
      message: `You're going to delete this referral${label ? ` (${label})` : ""}. This cannot be undone.`,
      confirmText: "Confirm Delete",
      cancelText: "No, Keep it",
    });
    if (!confirmed) return;
    try {
      setError("");
      setDeletingId(id);
      await deleteReferral(id);
      await Promise.all([loadOpen(), loadApplied()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  function openCreateRecordModal() {
    setCreateRecordError("");
    setCreateRecordForm({
      company: "",
      request_log: "",
      request_date: getLocalISODate(),
      request_link: "",
      referred_by_name: "",
      comment: "",
    });
    setShowCreateRecordModal(true);
  }

  async function onCreateRecord(e: React.FormEvent) {
    e.preventDefault();
    const company = createRecordForm.company.trim();
    if (!company) {
      setCreateRecordError("Company is required.");
      return;
    }
    try {
      setCreateRecordError("");
      setIsCreatingRecord(true);
      await createReferral({
        company,
        request_log: createRecordForm.request_log.trim() || undefined,
        request_date: createRecordForm.request_date || undefined,
        request_link: createRecordForm.request_link.trim() || undefined,
        referral_received: "Yes",
        keyword_matching: "Medium",
        referred_by_name: createRecordForm.referred_by_name.trim() || undefined,
        comment: createRecordForm.comment.trim() || undefined,
      });
      setShowCreateRecordModal(false);
      await Promise.all([loadOpen(), loadApplied()]);
    } catch (err) {
      setCreateRecordError((err as Error).message);
    } finally {
      setIsCreatingRecord(false);
    }
  }

  function openCreateReferral() {
    setError("");
    setCreateForm({
      ...CREATE_REFERRAL_INITIAL,
      request_date: getLocalISODate(),
    });
    setShowCreateModal(true);
  }

  function closeCreateReferral() {
    if (isCreating) return;
    setShowCreateModal(false);
  }

  async function onCreateReferralRequest(e: React.FormEvent) {
    e.preventDefault();
    const company = createForm.company.trim();
    const requestLog = createForm.request_log.trim();
    if (!company || !requestLog) return;
    try {
      setError("");
      setIsCreating(true);
      await createReferral({
        company,
        request_log: requestLog,
        request_date: createForm.request_date || getLocalISODate(),
        request_link: createForm.request_link.trim() || undefined,
        referral_received: "Requested",
        referred_by_name: createForm.referred_by_name.trim() || undefined,
        keyword_matching: createForm.keyword_matching || "Medium",
        comment: createForm.comment.trim() || undefined,
        source: createForm.source?.trim() || undefined,
      });
      setShowCreateModal(false);
      await Promise.all([loadOpen(), loadApplied(), loadTrend()]);
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      {error ? <div className="error">{error}</div> : null}

      <ReferralsTrendCard
        isLoadingTrend={isLoadingTrend}
        chartData={chartData as Array<Record<string, unknown>>}
        chartInsights={chartInsights}
      />

      <ReferralsTableCard
        title="Open Referrals"
        addButtonLabel="+ Referral Request"
        onAddClick={openCreateReferral}
        isLoading={isLoadingOpen}
        hasData={openData.length > 0}
        emptyText="No referrals with status Requested."
        rows={openRows}
        page={page}
        limit={LIMIT}
        hasPrev={hasPrev}
        hasNext={hasNext}
        setPage={setPage}
        deletingId={deletingId}
        openEdit={openEdit}
        onDelete={onDelete}
        dateHeader="Referral date"
      />

      <ReferralsTableCard
        title="Referral Records"
        addButtonLabel="Add Record"
        onAddClick={openCreateRecordModal}
        isLoading={isLoadingApplied}
        hasData={appliedData.length > 0}
        emptyText="No referral records yet."
        rows={appliedRows}
        page={appliedPage}
        limit={LIMIT}
        hasPrev={hasPrevApplied}
        hasNext={hasNextApplied}
        setPage={setAppliedPage}
        deletingId={deletingId}
        openEdit={openEdit}
        onDelete={onDelete}
        dateHeader="Updated"
        rowClassName="tr-hover data-referral"
        cardStyle={{ marginTop: "24px" }}
      />

      <EditReferralModal
        editing={editing}
        isSaving={isSaving}
        editStatus={editStatus}
        setEditStatus={setEditStatus}
        editReferredByName={editReferredByName}
        setEditReferredByName={setEditReferredByName}
        setEditing={setEditing}
        onSaveEdit={onSaveEdit}
      />

      <CreateRecordModal
        showCreateRecordModal={showCreateRecordModal}
        isCreatingRecord={isCreatingRecord}
        createRecordError={createRecordError}
        createRecordForm={createRecordForm}
        setCreateRecordForm={setCreateRecordForm}
        setShowCreateRecordModal={setShowCreateRecordModal}
        onCreateRecord={onCreateRecord}
      />

      <CreateReferralModal
        showCreateModal={showCreateModal}
        isCreating={isCreating}
        createForm={createForm}
        setCreateForm={setCreateForm}
        closeCreateReferral={closeCreateReferral}
        onCreateReferralRequest={onCreateReferralRequest}
      />
      {confirmDialog}
    </>
  );
}
