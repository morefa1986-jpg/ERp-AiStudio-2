import { useEffect } from 'react';
import { isSmartEditableTarget, prepareFieldForTyping } from '../utils/smartInputFocus';

export function useSmartInputFocus(): void {
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (!isSmartEditableTarget(event.target)) return;
      prepareFieldForTyping(event.target);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);
}
