import { useEffect, useRef, useCallback } from "react";
import { Button } from "./Button";
import "./Modal.css";

/* ── Size ── */

/* ── Base Modal ── */

function IconX() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = "md",
  children,
  footer,
  className = "",
  "aria-describedby": ariaDescribedby,
}) {
  const backdropRef = useRef(null);
  const titleId = `modal-title-${title.replace(/\s+/g, "-").toLowerCase()}`;

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const hasFocusedRef = useRef(false);

  // Focus trap + Escape key
  useEffect(() => {
    if (!isOpen) {
      hasFocusedRef.current = false;
      return;
    }

    const prevFocus = document.activeElement;

    // Focus first focusable element ONLY on initial open if not already focused inside modal
    let timer = null;
    if (!hasFocusedRef.current) {
      timer = setTimeout(() => {
        if (backdropRef.current?.contains(document.activeElement)) {
          hasFocusedRef.current = true;
          return;
        }
        // Prioritize inputs/selects inside the modal body, then other focusables
        const el =
          backdropRef.current?.querySelector(
            '.modal__body input:not([type="hidden"]):not(:disabled), .modal__body select:not(:disabled), .modal__body textarea:not(:disabled)',
          ) ??
          backdropRef.current?.querySelector(
            'button:not(.modal__close):not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
        el?.focus();
        hasFocusedRef.current = true;
      }, 50);
    }

    const handleKey = (e) => {
      if (e.key === "Escape") onCloseRef.current();

      if (e.key === "Tab") {
        const modal = backdropRef.current;
        if (!modal) return;
        const focusable = Array.from(
          modal.querySelectorAll(
            'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
      prevFocus?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={ariaDescribedby}
    >
      <div
        className={`modal modal--${size}${className ? ` ${className}` : ""}`}
      >
        {/* Header */}
        <div className="modal__header">
          <div>
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button
            className="modal__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <IconX />
          </button>
        </div>

        {/* Body */}
        <div className="modal__body">{children}</div>

        {/* Footer */}
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

/* ── Confirm Dialog ── */

function IconAlertTriangle() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isLoading = false,
}) {
  const descId = "confirm-modal-desc";

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      className="modal--confirm"
      aria-describedby={description ? descId : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={`modal__confirm-icon modal__confirm-icon--${variant}`}>
        <IconAlertTriangle />
      </div>
      {description && (
        <p className="modal__confirm-description" id={descId}>
          {description}
        </p>
      )}
    </Modal>
  );
}
