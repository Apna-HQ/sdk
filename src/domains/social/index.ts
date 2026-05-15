import { ApnaSocialV1 } from '../../interfaces/social/v1';
import { CapabilityRuntime, createVersionedDomain } from '../version';
import { createSocialV1 } from './v1';

export type ApnaSocialDomain = ApnaSocialV1 & {
  readonly v1: ApnaSocialV1;
};

export function createSocialDomain(
  runtime: CapabilityRuntime
): ApnaSocialDomain {
  return createVersionedDomain(createSocialV1(runtime));
}

export * from './v1';
