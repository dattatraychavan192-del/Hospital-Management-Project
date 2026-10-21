declare global {
  interface Window {
    CAREPOINT_API_URL?: string;
  }
}

export const API_BASE_URL = (window.CAREPOINT_API_URL || '/api').replace(/\/+$/, '');
