"use client";

// جایگزین window.confirm برای عملیات حساس در پنل مدیریت — تأیید درون‌خطی به‌جای پنجرهٔ مرورگر.

import { useState } from "react";

export default function ConfirmButton({
  label,
  confirmText = "مطمئن هستید؟",
  confirmLabel = "بله",
  cancelLabel = "انصراف",
  className = "btn-danger",
  disabled,
  onConfirm,
}: {
  label: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [armed, setArmed] = useState(false);

  if (armed) {
    return (
      <span className="confirm-dialog-backdrop" role="dialog" aria-modal="true" aria-label={confirmText}>
        <span className="confirm-dialog">
          <strong>{confirmText}</strong>
          <span className="confirm-dialog__actions">
            <button
              type="button"
              className={className}
              disabled={disabled}
              onClick={() => {
                setArmed(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setArmed(false)}>{cancelLabel}</button>
          </span>
        </span>
      </span>
    );
  }

  return (
    <button type="button" className={className} disabled={disabled} onClick={() => setArmed(true)}>
      {label}
    </button>
  );
}
