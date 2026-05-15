/**
 * `apna.ui` — the design-customization contract.
 *
 * The runtime implementation (Module Federation runtime, `withDynamicComponent`,
 * `useHostComponent`) ships in the separate `@apna/sdk/ui` bundle entry
 * (APNA-RD-SDK-011) so its weight stays out of the 10 KB core. This file is the
 * shared shape only.
 */

/** A selected Module Federation remote for one customizable slot. */
export interface RemoteComponentSelection {
  /** Remote name, e.g. `apna_module_test`. */
  name: string;
  /** Remote entry URL — an `mf-manifest.json` or `remoteEntry.js`. */
  entry: string;
}

/**
 * The user's design-component selections for a mini-app, keyed by the
 * customizable component name the mini-app registered.
 */
export type RemoteComponentSelections = Record<
  string,
  RemoteComponentSelection
>;

/**
 * `apna.ui` — the design-customization surface exposed to mini-apps.
 * `selections` is host-synced (via the `design:selections` event); the
 * component helpers are implemented in `@apna/sdk/ui`.
 */
export interface ApnaUI {
  /** Design-component selections currently active for this mini-app. */
  readonly selections: RemoteComponentSelections;
  /** Subscribe to selection changes pushed by the host. */
  onSelectionsChanged(
    listener: (selections: RemoteComponentSelections) => void
  ): () => void;
}
