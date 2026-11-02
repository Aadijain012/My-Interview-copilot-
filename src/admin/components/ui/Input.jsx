import { forwardRef } from "react";
import "./Input.css";

/* ── Field wrapper ── */

export function Field({
  label,
  hint,
  error,
  required = false,
  className = "",
  children,
  htmlFor,
}) {
  return (
    <div className={`field${className ? ` ${className}` : ""}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className={`field__label${required ? " field__label--required" : ""}`}
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

/* ── Input ── */

export const Input = forwardRef(function Input(
  { hasError = false, leftIcon, rightIcon, className = "", id, ...rest },
  ref,
) {
  const inputCls = ["input", hasError && "input--error", className]
    .filter(Boolean)
    .join(" ");

  if (leftIcon || rightIcon) {
    return (
      <div
        className={[
          "input-wrapper",
          leftIcon && "input-wrapper--left-icon",
          rightIcon && "input-wrapper--right-icon",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {leftIcon && (
          <span className="input-icon input-icon--left" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <input ref={ref} id={id} className={inputCls} {...rest} />
        {rightIcon && (
          <span className="input-icon input-icon--right" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }

  return <input ref={ref} id={id} className={inputCls} {...rest} />;
});

/* ── Select ── */

export function Select({ hasError = false, className = "", ...rest }) {
  return (
    <select
      className={["select", hasError && "input--error", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}

/* ── Textarea ── */

export function Textarea({ hasError = false, className = "", ...rest }) {
  return (
    <textarea
      className={["textarea", hasError && "input--error", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}
