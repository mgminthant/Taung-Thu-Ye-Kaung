"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";
interface Toast { id: number; message: string; type: ToastType }

const ToastCtx = createContext<{ toast: (msg: string, type?: ToastType) => void }>({
  toast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-in slide-in-from-right-5 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
              t.type === "success" ? "bg-primary" : t.type === "error" ? "bg-danger" : "bg-foreground"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
