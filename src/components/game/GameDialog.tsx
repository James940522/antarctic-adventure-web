"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./Menu.module.css";

export function GameDialog({ title, children, onClose, pause = false }: {
  title: string; children: ReactNode; onClose: () => void; pause?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);

  return <dialog ref={ref} aria-labelledby={titleId} className={`${styles.dialog} ${pause ? styles.pauseDialog : ""}`}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key === "Escape" && event.repeat) event.preventDefault();
      if (event.key !== "Tab") return;
      const items = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], [tabindex='0']");
      const first = items[0];
      const last = items[items.length - 1];
      const active = event.currentTarget.ownerDocument.activeElement;
      if (event.shiftKey && active === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first?.focus(); }
    }}
    onClick={event => {
      if (pause || event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <h2 id={titleId} className={styles.dialogTitle}>{title}</h2>
    {children}
  </dialog>;
}
