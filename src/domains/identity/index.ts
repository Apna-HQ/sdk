import { ApnaIdentityV1 } from '../../interfaces/identity/v1';
import { CapabilityRuntime, createVersionedDomain } from '../version';
import { createIdentityV1 } from './v1';

export type ApnaIdentityDomain = ApnaIdentityV1 & {
  readonly v1: ApnaIdentityV1;
};

export function createIdentityDomain(
  runtime: CapabilityRuntime
): ApnaIdentityDomain {
  return createVersionedDomain(createIdentityV1(runtime));
}

export * from './v1';
