/**
 * `apna.widgets` — mini-app authored surfaces the shell may render outside the
 * app's main tab.
 *
 * This is the authoring contract only. Hosts can start by reading registered
 * metadata and later add remote rendering for widget entries.
 */

export type ApnaWidgetSurface =
  | 'home'
  | 'sidebar'
  | 'tab-preview'
  | 'mobile-dock';

export type ApnaWidgetSize = 'compact' | 'medium' | 'wide';

export interface ApnaWidgetEntry {
  /** Module Federation remote name that exposes the widget component. */
  name: string;
  /** Remote entry URL — an `mf-manifest.json` or `remoteEntry.js`. */
  entry: string;
  /** Exposed module path, e.g. `./WalletBalanceWidget`. */
  module: string;
}

export interface ApnaWidgetDefinition {
  /** Stable id scoped to the mini-app, e.g. `wallet.balance`. */
  id: string;
  /** Human-readable widget name shown by the shell. */
  name: string;
  /** Optional short description for picker/settings surfaces. */
  description?: string;
  /** Shell surfaces where this widget is allowed to appear. */
  surfaces: ApnaWidgetSurface[];
  /** Preferred widget size for layout. */
  preferredSize?: ApnaWidgetSize;
  /** Capabilities the widget expects before rendering interactive controls. */
  permissions?: string[];
  /** Optional remote component entry for future host-rendered widgets. */
  entry?: ApnaWidgetEntry;
}

export interface ApnaWidgets {
  /** Register widgets authored by this mini-app. Safe to call repeatedly. */
  register(widgets: ApnaWidgetDefinition[]): Promise<void>;
  /** Return widgets registered by this mini-app. */
  query(): Promise<ApnaWidgetDefinition[]>;
}
