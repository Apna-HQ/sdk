import { Bridge } from '../core/bridge';
import { ApnaPermissions, Permission } from '../interfaces/permissions';

export interface PermissionsClientOptions {
  bridge: Bridge;
  call: (capability: string, args: unknown[]) => Promise<unknown>;
}

/** Create the client-side permissions convenience module. */
export function createPermissionsClient(
  options: PermissionsClientOptions
): ApnaPermissions {
  return {
    request: (capabilities: string[]) =>
      options.bridge.requestPermission(capabilities) as Promise<Permission[]>,
    query: () =>
      options.call('permissions.query', []) as Promise<Permission[]>,
    revoke: (capability: string) =>
      options.call('permissions.revoke', [capability]) as Promise<void>,
  };
}

export * from '../interfaces/permissions';
