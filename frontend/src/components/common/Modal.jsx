import { useEffect, useEffectEvent, useRef } from "react";
import { X } from "lucide-react";

// Provide the shared dialog markup, close behavior, and keyboard focus handling.
export function Modal({ title, description, children, onClose }) {
  const ref = useRef(null);
  // Let the Escape handler call the latest close callback without rebuilding the focus effect.
  const close = useEffectEvent(onClose);
  useEffect(() => {
    // Keep Tab inside the pop-up. On close, move back to the previous control.
    const previous = document.activeElement;
    const focusable = () => [
      ...ref.current.querySelectorAll(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
      ),
    ];
    const items = focusable();
    const firstInput = items.find((element) => element.tagName === "INPUT");
    (firstInput || items[0])?.focus();
    const handler = (event) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const items = focusable();
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0]?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    // Pause background scrolling while the dialog is open and restore it on cleanup.
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        // Close on a click on the overlay. Clicks inside the dialog leave it open.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
