'use client';

import * as React from 'react';

import { loadRemote, registerRemotes } from './federation';

export interface HostComponentProps<P extends object = Record<string, unknown>> {
  name: string;
  remote?: string;
  props?: P;
  fallback?: React.ReactNode;
}

export function useHostComponent<P extends object = Record<string, unknown>>(
  name: string,
  remote?: string
): React.ComponentType<P> | null {
  const [Component, setComponent] = React.useState<React.ComponentType<P> | null>(
    null
  );

  React.useEffect(() => {
    if (!remote) return;
    const remoteName = 'apna_host_design';
    registerRemotes([{ name: remoteName, entry: remote }], { force: true });
    let cancelled = false;
    void loadRemote<{ default: React.ComponentType<P> }>(
      `${remoteName}/${name}`
    ).then((module) => {
      if (!cancelled) setComponent(() => module.default);
    });
    return () => {
      cancelled = true;
    };
  }, [name, remote]);

  return Component;
}

export function HostComponent<P extends object = Record<string, unknown>>({
  name,
  remote,
  props,
  fallback = null,
}: HostComponentProps<P>) {
  const Component = useHostComponent<P>(name, remote);
  return Component ? <Component {...((props ?? {}) as P)} /> : <>{fallback}</>;
}
