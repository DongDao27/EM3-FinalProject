"use client";
import { useId, useState } from "react";

export function PasswordField({
  name = "password",
  label = "Mật khẩu",
  newPassword = false,
  error,
  disabled = false,
}: {
  name?: string;
  label?: string;
  newPassword?: boolean;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrap">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={newPassword ? "new-password" : "current-password"}
          required
          minLength={newPassword ? 12 : undefined}
          maxLength={128}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : newPassword ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={`${visible ? "Ẩn" : "Hiện"} ${label.toLowerCase()}`}
          aria-controls={id}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
          disabled={disabled}
        >
          {visible ? "Ẩn" : "Hiện"}
        </button>
      </div>
      {newPassword && (
        <small id={`${id}-hint`} className="muted">
          Từ 12 đến 128 ký tự.
        </small>
      )}
      {error && (
        <small id={`${id}-error`} className="field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
