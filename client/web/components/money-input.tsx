"use client";

import { useEffect, useState } from "react";
import { rupeesToPaise, paiseToRupees, type Paise } from "@invoixe/core";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Currency input that speaks **integer paise** to its parent while showing rupees
 * to the user. Enforces the project money rule (never float currency): the value
 * in/out is always paise, and rupees→paise happens through `rupeesToPaise`.
 *
 * `value` is the source of truth (paise, or null for empty). A local text buffer
 * lets the user type intermediate states like "12." without the caret jumping.
 */
export function MoneyInput({
  value,
  onChange,
  id,
  placeholder = "0.00",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
}: {
  value: Paise | null;
  onChange: (paise: Paise | null) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
}) {
  const [text, setText] = useState(() => (value == null ? "" : String(paiseToRupees(value))));

  // Re-sync the buffer when the parent changes `value` to something the current
  // text doesn't already represent (e.g. form reset, external set).
  useEffect(() => {
    const parsed = parseRupees(text);
    const current = parsed == null ? null : rupeesToPaise(parsed);
    if (current !== value) {
      setText(value == null ? "" : String(paiseToRupees(value)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handle = (raw: string) => {
    // Allow only digits and a single decimal point (up to 2 fractional digits).
    const cleaned = raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    const capped = cleaned.replace(/(\.\d{2})\d+$/, "$1");
    setText(capped);
    const parsed = parseRupees(capped);
    onChange(parsed == null ? null : rupeesToPaise(parsed));
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
        ₹
      </span>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        onChange={(e) => handle(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        className={cn("pl-7 text-right tabular-nums", className)}
      />
    </div>
  );
}

/** Parse a rupee string to a number, or null if empty/invalid. */
function parseRupees(text: string): number | null {
  if (text.trim() === "" || text === ".") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}
