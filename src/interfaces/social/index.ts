/**
 * `apna.social` contract barrel. `Latest` always points at the newest version;
 * `apna.social.v1` etc. remain addressable as explicit pins.
 */
export * from './v1';

import { ApnaSocialV1 } from './v1';

/** The latest negotiated social contract version. */
export type ApnaSocialLatest = ApnaSocialV1;
