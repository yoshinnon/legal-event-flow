import { useEffect } from "react";

export type ToastType = "success" | "error";

interface ToastProps {
  message: string;
  type:    ToastType;
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg = type === "success" ? "bg-emerald-600" : "bg-red-600";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg text-white text-sm shadow-lg ${bg} animate-slide-up`}
      role="alert"
    >
      <span>{type === "success" ? "✓" : "✕"}</span>
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="閉じる"
      >
        ×
      </button>
    </div>
  );
}
