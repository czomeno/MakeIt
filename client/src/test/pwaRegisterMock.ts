import { useState } from 'react';

// Doble de `virtual:pwa-register/react` para jsdom (sin service worker). Los
// tests fijan `pwaMock.needRefresh` antes de renderizar y leen las llamadas.
export const pwaMock = {
  needRefresh: false,
  updateCalls: [] as boolean[],
  reset() {
    this.needRefresh = false;
    this.updateCalls = [];
  },
};

export function useRegisterSW() {
  const needRefresh = useState(pwaMock.needRefresh);
  const offlineReady = useState(false);
  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: async (reloadPage?: boolean) => {
      pwaMock.updateCalls.push(reloadPage ?? false);
    },
  };
}
