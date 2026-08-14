import { useCallback, useRef, useState } from 'react';

export function useToast() {
  const [toast, setToast] = useState(null); // { message, isError } | null
  const timerRef = useRef(null);

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 4200);
  }, []);

  return { toast, showToast };
}
