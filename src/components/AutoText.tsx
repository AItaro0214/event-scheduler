import { useLayoutEffect, useRef } from "preact/hooks";
import type { TextareaHTMLAttributes } from "preact";

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onInput"> {
  value: string;
  onInput: (value: string) => void;
  /** Render a static div instead of a textarea (used for PDF export). */
  static?: boolean;
  minRows?: number;
}

/** Textarea that grows with its content (no scrollbars inside table cells). */
export function AutoText({ value, onInput, static: isStatic, minRows = 1, class: cls, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, isStatic]);

  if (isStatic) {
    if (!value) return null;
    return <div class={`text-static ${cls ?? ""}`}>{value}</div>;
  }
  return (
    <textarea
      ref={ref}
      class={cls}
      rows={minRows}
      value={value}
      onInput={(e) => onInput((e.currentTarget as HTMLTextAreaElement).value)}
      {...rest}
    />
  );
}
