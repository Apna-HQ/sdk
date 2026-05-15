/**
 * `apna.identity` contract barrel. `Latest` always points at the newest
 * version; `apna.identity.v1` etc. remain addressable as explicit pins.
 */
export * from './v1';

import { ApnaIdentityV1 } from './v1';

/** The latest negotiated identity contract version. */
export type ApnaIdentityLatest = ApnaIdentityV1;
