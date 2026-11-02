import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePermission } from "@/features/auth/rbac";
import {
  ErrorState,
  EmptyState,
  Button,
  Table,
  Th,
  Td,
  Pagination,
  Badge,
  Modal,
  Field,
  Input,
  Skeleton,
} from "@/components";
import { fetchOffers, createOffer, updateOffer } from "@/features/offers";
import "./OffersPage.css";

const KNOWN_PAID_PLANS = [
  { id: "PRO", label: "Pro Plan ($29/mo)" },
  { id: "PRO_PLUS", label: "Pro Plus Plan ($79/mo)" },
];

function toDatetimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getOfferStatusInfo(offer) {
  const now = new Date();
  const startsAt = new Date(offer.startsAt);
  const endsAt = new Date(offer.endsAt);

  if (!offer.isActive) {
    return { label: "Inactive", variant: "default" };
  }
  if (endsAt <= now) {
    return { label: "Expired", variant: "danger" };
  }
  if (startsAt > now) {
    return { label: "Scheduled", variant: "warning" };
  }
  return { label: "Active", variant: "success" };
}

function defaultFormValues() {
  const start = new Date(Date.now() - 5 * 60 * 1000);
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return {
    name: "",
    promoCode: "",
    bannerText: "",
    discountPercent: "20",
    startsAt: toDatetimeLocalValue(start),
    endsAt: toDatetimeLocalValue(end),
    isActive: true,
    eligiblePlanIds: [],
    customPlanIdsText: "",
  };
}

export function OffersPage() {
  const canRead = usePermission("offers:read");
  const canWrite = usePermission("offers:write");

  const [offers, setOffers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [form, setForm] = useState(defaultFormValues);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4500);
  }, []);

  const loadOffers = useCallback(async (targetPage = page) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetchOffers({ page: targetPage, limit: 20 });
      setOffers(Array.isArray(res?.items) ? res.items : []);
      if (res?.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setLoadError(err?.message || "Failed to load subscription offers.");
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (canRead) {
      loadOffers(page);
    }
  }, [canRead, page, loadOffers]);

  const activeLiveOffer = useMemo(() => {
    const now = new Date();
    return (
      offers.find(
        (o) =>
          o.isActive &&
          new Date(o.startsAt) <= now &&
          new Date(o.endsAt) > now
      ) || null
    );
  }, [offers]);

  const openCreateModal = () => {
    setEditingOffer(null);
    setForm(defaultFormValues());
    setFormError("");
    setFieldErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (offer) => {
    const knownSet = new Set(KNOWN_PAID_PLANS.map((p) => p.id));
    const existingIds = Array.isArray(offer.eligiblePlanIds)
      ? offer.eligiblePlanIds
      : [];
    const selectedKnown = existingIds
      .map((id) => String(id).toUpperCase())
      .filter((id) => knownSet.has(id));
    const extraCustom = existingIds.filter(
      (id) => !knownSet.has(String(id).toUpperCase())
    );

    setEditingOffer(offer);
    setForm({
      name: offer.name || "",
      promoCode: offer.promoCode || "",
      bannerText: offer.bannerText || "",
      discountPercent: String(offer.discountPercent ?? "20"),
      startsAt: toDatetimeLocalValue(offer.startsAt),
      endsAt: toDatetimeLocalValue(offer.endsAt),
      isActive: Boolean(offer.isActive),
      eligiblePlanIds: selectedKnown,
      customPlanIdsText: extraCustom.join(", "),
    });
    setFormError("");
    setFieldErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingOffer(null);
    setFormError("");
    setFieldErrors({});
  };

  const handleTogglePlanCheckbox = (planId) => {
    setForm((prev) => {
      const exists = prev.eligiblePlanIds.includes(planId);
      const next = exists
        ? prev.eligiblePlanIds.filter((id) => id !== planId)
        : [...prev.eligiblePlanIds, planId];
      return { ...prev, eligiblePlanIds: next };
    });
  };

  const handleSaveOffer = async (e) => {
    e?.preventDefault();
    setFormError("");
    setFieldErrors({});

    const nextFieldErrors = {};
    if (!form.name.trim()) nextFieldErrors.name = "Offer name is required";
    if (editingOffer && !form.promoCode.trim()) {
      nextFieldErrors.promoCode = "Redeem / Promo code is required";
    }
    if (!form.bannerText.trim()) {
      nextFieldErrors.bannerText = "Banner text is required";
    }
    if (!form.startsAt) nextFieldErrors.startsAt = "Start date is required";
    if (!form.endsAt) nextFieldErrors.endsAt = "End date is required";

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    const extraPlanIds = form.customPlanIdsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const combinedPlanIds = [
      ...new Set([...form.eligiblePlanIds, ...extraPlanIds]),
    ];

    const payload = {
      name: form.name.trim(),
      promoCode: form.promoCode.trim().toUpperCase(),
      bannerText: form.bannerText.trim(),
      discountPercent: Number(form.discountPercent),
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      isActive: Boolean(form.isActive),
      eligiblePlanIds: combinedPlanIds,
    };

    setIsSubmitting(true);
    try {
      if (editingOffer) {
        const updated = await updateOffer(editingOffer.id, payload);
        showToast(`Offer "${updated?.promoCode || payload.promoCode}" updated successfully.`);
      } else {
        const created = await createOffer(payload);
        showToast(`Offer created! Redeem Code: "${created?.promoCode || payload.promoCode}" (${payload.discountPercent}% OFF).`);
      }
      setIsModalOpen(false);
      setEditingOffer(null);
      await loadOffers(page);
    } catch (err) {
      setFormError(
        err?.message || "Failed to save offer. Please check your inputs."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickToggleActive = async (offer) => {
    setTogglingId(offer.id);
    try {
      const nextActive = !offer.isActive;
      await updateOffer(offer.id, { isActive: nextActive });
      showToast(
        `Offer "${offer.promoCode}" ${
          nextActive ? "activated" : "deactivated"
        }.`
      );
      await loadOffers(page);
    } catch (err) {
      showToast(
        err?.message || "Unable to update offer active status.",
        "error"
      );
    } finally {
      setTogglingId(null);
    }
  };

  if (!canRead) {
    return (
      <ErrorState
        title="Access Restricted"
        message="You do not have permission to view subscription offers."
      />
    );
  }

  return (
    <div className="offers-admin-page">
      <div className="offers-admin-header">
        <div>
          <h1 className="offers-admin-title">Subscription Offers &amp; Promo Codes</h1>
          <p className="offers-admin-subtitle">
            Create and manage promotional discounts, scrolling announcement banners, and plan eligibility rules.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreateModal}>+ Create Offer</Button>
        )}
      </div>

      {toast && (
        <div
          className={`offers-admin-toast offers-admin-toast--${toast.type}`}
          role="alert"
        >
          <span>{toast.message}</span>
          <button
            type="button"
            className="offers-admin-toast__close"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      )}

      {activeLiveOffer && (
        <div className="offers-live-preview-box">
          <div className="offers-live-preview-label">
            <span className="offers-live-dot" />
            <span>Live Public Banner Preview (Currently Active)</span>
          </div>
          <div className="offers-live-banner-marquee" role="status">
            <div className="offers-live-banner-track">
              <span>
                {activeLiveOffer.name}: {activeLiveOffer.bannerText}
              </span>
              <span>
                Save {Number(activeLiveOffer.discountPercent)}% with code{" "}
                <strong>{activeLiveOffer.promoCode}</strong>
              </span>
              <span aria-hidden="true">
                {activeLiveOffer.name}: {activeLiveOffer.bannerText}
              </span>
              <span aria-hidden="true">
                Save {Number(activeLiveOffer.discountPercent)}% with code{" "}
                <strong>{activeLiveOffer.promoCode}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {loadError ? (
        <ErrorState
          message={loadError}
          onRetry={() => loadOffers(page)}
        />
      ) : isLoading ? (
        <div className="offers-table-card">
          <Table aria-label="Subscription Offers">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Promo Code</Th>
                <Th>Discount</Th>
                <Th>Status</Th>
                <Th>Eligible Plans</Th>
                <Th>Validity Window</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <Td key={j}>
                      <Skeleton height={16} />
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : offers.length === 0 ? (
        <EmptyState
          title="No subscription offers found"
          description="Create a promotional offer to display a scrolling discount banner and allow users to apply a promo code at checkout."
        />
      ) : (
        <div className="offers-table-card">
          <Table aria-label="Subscription Offers">
            <thead>
              <tr>
                <Th>Name &amp; Banner</Th>
                <Th>Promo Code</Th>
                <Th>Discount</Th>
                <Th>Status</Th>
                <Th>Eligible Plans</Th>
                <Th>Validity Window</Th>
                <Th style={{ textAlign: "right" }}>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => {
                const statusInfo = getOfferStatusInfo(offer);
                const eligibleText =
                  Array.isArray(offer.eligiblePlanIds) &&
                  offer.eligiblePlanIds.length > 0
                    ? offer.eligiblePlanIds.join(", ")
                    : "All Paid Plans";

                return (
                  <tr key={offer.id}>
                    <Td primary>
                      <div className="offers-table__name">{offer.name}</div>
                      <div className="offers-table__banner-text">
                        {offer.bannerText}
                      </div>
                    </Td>
                    <Td>
                      <code className="offers-table__code">
                        {offer.promoCode}
                      </code>
                    </Td>
                    <Td>
                      <strong>{Number(offer.discountPercent)}% off</strong>
                    </Td>
                    <Td>
                      <Badge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </Badge>
                    </Td>
                    <Td>{eligibleText}</Td>
                    <Td>
                      <div className="offers-table__dates">
                        <div>
                          From: {new Date(offer.startsAt).toLocaleString()}
                        </div>
                        <div>
                          Until: {new Date(offer.endsAt).toLocaleString()}
                        </div>
                      </div>
                    </Td>
                    <Td style={{ textAlign: "right" }}>
                      <div className="offers-table__actions">
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => openEditModal(offer)}
                        >
                          {canWrite ? "Edit" : "View"}
                        </Button>
                        {canWrite && (
                          <Button
                            size="xs"
                            variant={offer.isActive ? "ghost" : "primary"}
                            isLoading={togglingId === offer.id}
                            onClick={() => handleQuickToggleActive(offer)}
                          >
                            {offer.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={setPage}
          />
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          editingOffer
            ? `Edit Offer: ${editingOffer.name}`
            : "Create Subscription Offer"
        }
        size="md"
      >
        <form onSubmit={handleSaveOffer} className="offers-modal-form">
          {formError && (
            <div className="offers-modal-error" role="alert">
              {formError}
            </div>
          )}

          <div className="offers-modal-grid-2">
            <Field label="Offer Name" required error={fieldErrors.name}>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Launch Special"
                disabled={!canWrite}
                hasError={!!fieldErrors.name}
              />
            </Field>

            <Field label="Redeem / Promo Code (Auto-generated if left blank)" error={fieldErrors.promoCode}>
              <div style={{ display: "flex", gap: "8px" }}>
                <Input
                  value={form.promoCode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      promoCode: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Leave blank for backend KAIROS-XXXX or enter code"
                  disabled={!canWrite}
                  hasError={!!fieldErrors.promoCode}
                />
                {canWrite && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const rand = Array.from({ length: 8 }, () =>
                        "0123456789ABCDEF"[Math.floor(Math.random() * 16)]
                      ).join("");
                      setForm((f) => ({ ...f, promoCode: `KAIROS-${rand}` }));
                    }}
                  >
                    Generate
                  </Button>
                )}
              </div>
            </Field>
          </div>

          <Field
            label="Scrolling Banner Text"
            required
            error={fieldErrors.bannerText}
          >
            <Input
              value={form.bannerText}
              onChange={(e) =>
                setForm((f) => ({ ...f, bannerText: e.target.value }))
              }
              placeholder="e.g. Limited-time offer: Upgrade to Pro or Pro Plus today!"
              disabled={!canWrite}
              hasError={!!fieldErrors.bannerText}
            />
          </Field>

          <div className="offers-modal-grid-2">
            <Field
              label="Discount Percentage (%)"
              required
              error={fieldErrors.discountPercent}
            >
              <Input
                type="number"
                min="1"
                max="100"
                step="0.01"
                value={form.discountPercent}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discountPercent: e.target.value }))
                }
                disabled={!canWrite}
                hasError={!!fieldErrors.discountPercent}
              />
            </Field>

            <Field label="Offer Status">
              <label className="offers-checkbox-row">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                  disabled={!canWrite}
                />
                <span>Active (display banner &amp; accept promo code)</span>
              </label>
            </Field>
          </div>

          <div className="offers-modal-grid-2">
            <Field label="Starts At" required error={fieldErrors.startsAt}>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startsAt: e.target.value }))
                }
                disabled={!canWrite}
                hasError={!!fieldErrors.startsAt}
              />
            </Field>

            <Field label="Ends At" required error={fieldErrors.endsAt}>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endsAt: e.target.value }))
                }
                disabled={!canWrite}
                hasError={!!fieldErrors.endsAt}
              />
            </Field>
          </div>

          <Field label="Eligible Plans (leave unchecked for all paid plans)">
            <div className="offers-plans-checkbox-group">
              {KNOWN_PAID_PLANS.map((plan) => (
                <label key={plan.id} className="offers-checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.eligiblePlanIds.includes(plan.id)}
                    onChange={() => handleTogglePlanCheckbox(plan.id)}
                    disabled={!canWrite}
                  />
                  <span>
                    <strong>{plan.id}</strong> &mdash; {plan.label}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: "8px" }}>
              <Input
                value={form.customPlanIdsText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customPlanIdsText: e.target.value }))
                }
                placeholder="Optional additional plan IDs (comma-separated, e.g. PRO, PRO_PLUS)"
                disabled={!canWrite}
              />
            </div>
          </Field>

          <div className="offers-modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={closeModal}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            {canWrite && (
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
              >
                {editingOffer ? "Save Changes" : "Create Offer"}
              </Button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
