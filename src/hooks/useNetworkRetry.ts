import { useRef, useCallback } from "react";
import { toast } from "sonner";

interface RetryState {
  toastId: string | number | null;
  isRetrying: boolean;
}

export const useNetworkRetry = () => {
  const retryStateRef = useRef<RetryState>({ toastId: null, isRetrying: false });

  const showRetrying = useCallback((context: string = "conexión") => {
    // Don't show duplicate toasts
    if (retryStateRef.current.isRetrying) return;
    
    retryStateRef.current.isRetrying = true;
    retryStateRef.current.toastId = toast.loading(
      `Reintentando ${context}...`,
      {
        description: "Problema de red temporal detectado",
        duration: Infinity,
      }
    );
  }, []);

  const showSuccess = useCallback(() => {
    if (retryStateRef.current.toastId) {
      toast.dismiss(retryStateRef.current.toastId);
      toast.success("Conexión restablecida", { duration: 2000 });
    }
    retryStateRef.current.isRetrying = false;
    retryStateRef.current.toastId = null;
  }, []);

  const showError = useCallback((message: string = "Error de conexión") => {
    if (retryStateRef.current.toastId) {
      toast.dismiss(retryStateRef.current.toastId);
    }
    toast.error(message, {
      description: "Por favor, verifica tu conexión a internet",
      duration: 5000,
    });
    retryStateRef.current.isRetrying = false;
    retryStateRef.current.toastId = null;
  }, []);

  const hideRetrying = useCallback(() => {
    if (retryStateRef.current.toastId) {
      toast.dismiss(retryStateRef.current.toastId);
    }
    retryStateRef.current.isRetrying = false;
    retryStateRef.current.toastId = null;
  }, []);

  return {
    showRetrying,
    showSuccess,
    showError,
    hideRetrying,
    isRetrying: retryStateRef.current.isRetrying,
  };
};

// Global singleton for app-wide network status
let globalRetryToastId: string | number | null = null;
let globalIsRetrying = false;

export const showGlobalRetrying = (context: string = "conexión") => {
  if (globalIsRetrying) return;
  
  globalIsRetrying = true;
  globalRetryToastId = toast.loading(
    `Reintentando ${context}...`,
    {
      description: "Problema de red temporal detectado",
      duration: Infinity,
    }
  );
};

export const showGlobalSuccess = () => {
  if (globalRetryToastId) {
    toast.dismiss(globalRetryToastId);
    toast.success("Conexión restablecida", { duration: 2000 });
  }
  globalIsRetrying = false;
  globalRetryToastId = null;
};

export const showGlobalError = (message: string = "Error de conexión") => {
  if (globalRetryToastId) {
    toast.dismiss(globalRetryToastId);
  }
  toast.error(message, {
    description: "Por favor, verifica tu conexión a internet",
    duration: 5000,
  });
  globalIsRetrying = false;
  globalRetryToastId = null;
};

export const hideGlobalRetrying = () => {
  if (globalRetryToastId) {
    toast.dismiss(globalRetryToastId);
  }
  globalIsRetrying = false;
  globalRetryToastId = null;
};
