import { useEffect } from 'react';

interface HotkeyConfig {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

export function useHotkeys(configs: HotkeyConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger hotkeys if user is typing in an input or textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      configs.forEach(config => {
        const matchesKey = event.key.toLowerCase() === config.key.toLowerCase();
        const matchesAlt = !!config.altKey === event.altKey;
        const matchesCtrl = !!config.ctrlKey === event.ctrlKey;
        const matchesShift = !!config.shiftKey === event.shiftKey;

        if (matchesKey && matchesAlt && matchesCtrl && matchesShift) {
          event.preventDefault();
          config.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [configs]);
}
