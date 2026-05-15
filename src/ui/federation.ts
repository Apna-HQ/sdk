import {
  init,
  loadRemote as loadRemoteModule,
  registerRemotes as registerRemoteModules,
} from '@module-federation/enhanced/runtime';

let initialized = false;

export function initFederation(name = 'apna_mini_app'): void {
  if (initialized) return;
  init({
    name,
    remotes: [],
    shared: {
      react: { singleton: true },
      'react-dom': { singleton: true },
    },
  } as any);
  initialized = true;
}

export function registerRemotes(...args: Parameters<typeof registerRemoteModules>) {
  initFederation();
  return registerRemoteModules(...args);
}

export function loadRemote<T = unknown>(...args: Parameters<typeof loadRemoteModule>) {
  initFederation();
  return loadRemoteModule(...args) as Promise<T>;
}
