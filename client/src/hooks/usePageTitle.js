import { useEffect } from 'react';

const APP_NAME = 'Elo League';

/** Keeps the browser tab title in step with the screen, which also helps screen reader users. */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
