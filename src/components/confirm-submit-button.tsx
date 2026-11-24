"use client";

import { Button, type ButtonProps } from "@/components/ui/button";

/** Submit-Button mit Rückfrage. */
export function ConfirmSubmitButton({ confirmText, ...props }: ButtonProps & { confirmText: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    />
  );
}
