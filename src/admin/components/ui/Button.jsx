import "./Button.css";

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  fullWidth = false,
  iconOnly = false,
  leftIcon,
  rightIcon,
  children,
  className = "",
  disabled,
  ...rest
}) {
  const classes = [
    "btn",
    `btn--${variant}`,
    `btn--${size}`,
    isLoading && "btn--loading",
    fullWidth && "btn--full",
    iconOnly && "btn--icon-only",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={classes}
      disabled={disabled ?? isLoading}
      aria-disabled={disabled ?? isLoading}
      aria-busy={isLoading}
      {...rest}
    >
      {isLoading ? (
        <>
          <span className="btn__spinner" aria-hidden="true" />
          {children && !iconOnly && <span>{children}</span>}
        </>
      ) : (
        <>
          {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
          {children}
          {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
