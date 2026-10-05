import { mockProvider } from './mock.js';
import { remoteProvider } from './remote.js';
export const ai = window.__ABLELAM_SESSION__ || import.meta.env.VITE_AI_PROVIDER === 'desktop'
  ? { mode: 'desktop' }
  : import.meta.env.VITE_AI_PROVIDER === 'remote' ? remoteProvider : mockProvider;
