import { useEffect } from 'react';

export function useAppEvents(eventNames: string[], callback: () => void): void {
  useEffect(() => {
    callback();
    eventNames.forEach(name => window.addEventListener(name, callback));
    return () => eventNames.forEach(name => window.removeEventListener(name, callback));
  }, [eventNames.join(',')]);
}
