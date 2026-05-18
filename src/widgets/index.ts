import {
  ApnaWidgetDefinition,
  ApnaWidgets,
} from '../interfaces/widgets';

export interface WidgetsClientOptions {
  call: (capability: string, args: unknown[]) => Promise<unknown>;
  isCapabilitySupported?: (capability: string) => boolean;
}

const REGISTER_CAPABILITY = 'widgets.register';
const QUERY_CAPABILITY = 'widgets.query';

/** Convenience helper for mini-app authors declaring widget metadata. */
export function defineWidget(
  definition: ApnaWidgetDefinition
): ApnaWidgetDefinition {
  return definition;
}

/** Create the client-side widgets module. */
export function createWidgetsClient(
  options: WidgetsClientOptions
): ApnaWidgets {
  let localDefinitions: ApnaWidgetDefinition[] = [];

  const supports = (capability: string) =>
    options.isCapabilitySupported?.(capability) === true;

  return {
    async register(widgets: ApnaWidgetDefinition[]) {
      localDefinitions = mergeWidgets(localDefinitions, widgets);
      if (supports(REGISTER_CAPABILITY)) {
        await options.call(REGISTER_CAPABILITY, [widgets]);
      }
    },

    async query() {
      if (supports(QUERY_CAPABILITY)) {
        return options.call(QUERY_CAPABILITY, []) as Promise<
          ApnaWidgetDefinition[]
        >;
      }
      return [...localDefinitions];
    },
  };
}

function mergeWidgets(
  current: ApnaWidgetDefinition[],
  next: ApnaWidgetDefinition[]
): ApnaWidgetDefinition[] {
  const merged = new Map<string, ApnaWidgetDefinition>();
  current.forEach((widget) => merged.set(widget.id, widget));
  next.forEach((widget) => merged.set(widget.id, widget));
  return Array.from(merged.values());
}

export * from '../interfaces/widgets';
