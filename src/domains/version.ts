export interface CapabilityRuntime {
  call(capability: string, args: unknown[]): Promise<unknown>;
  callSupported(
    capability: string,
    args: unknown[],
    fallbackCapability?: string,
    fallbackArgs?: unknown[]
  ): Promise<unknown>;
  subscribe?(
    capability: string,
    args: unknown[],
    onEvent: (data: unknown) => void
  ): () => void;
}

export type VersionedDomain<T> = T & {
  readonly v1: T;
};

/** Expose latest methods at the root while preserving explicit `.v1` pins. */
export function createVersionedDomain<T extends object>(
  v1: T
): VersionedDomain<T> {
  return Object.assign({}, v1, { v1 }) as VersionedDomain<T>;
}
