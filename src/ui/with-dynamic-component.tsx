'use client';

import * as React from 'react';

import { loadRemote, registerRemotes } from './federation';

interface RemoteComponentModule<P> {
  default: React.ComponentType<P>;
}

interface RemoteSelection {
  name: string;
  entry: string;
}

const STORAGE_KEY = 'remoteComponentSelections';
const HIGHLIGHT_EVENT = 'apna:customise-highlight';

export function setCustomiseHighlight(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __APNA_CUSTOMISE_HIGHLIGHT__?: boolean }).__APNA_CUSTOMISE_HIGHLIGHT__ =
    enabled;
  window.dispatchEvent(
    new CustomEvent(HIGHLIGHT_EVENT, {
      detail: { enabled },
    })
  );
}

export function withDynamicComponent<P extends object>(
  remoteModuleName: string,
  DefaultComponent: React.ComponentType<P>
): any {
  function DynamicComponent(props: P) {
    const [isHighlighted, setIsHighlighted] = React.useState(false);
    const [isPickerOpen, setIsPickerOpen] = React.useState(false);
    const [remoteName, setRemoteName] = React.useState('');
    const [remoteEntry, setRemoteEntry] = React.useState('');
    const [RemoteComponent, setRemoteComponent] =
      React.useState<React.ComponentType<P> | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
      if (typeof window === 'undefined') return;
      const w = window as unknown as { __APNA_CUSTOMISE_HIGHLIGHT__?: boolean };
      setIsHighlighted(Boolean(w.__APNA_CUSTOMISE_HIGHLIGHT__));
      const onHighlight = (event: Event) => {
        setIsHighlighted(Boolean((event as CustomEvent).detail?.enabled));
      };
      window.addEventListener(HIGHLIGHT_EVENT, onHighlight);
      return () => window.removeEventListener(HIGHLIGHT_EVENT, onHighlight);
    }, []);

    React.useEffect(() => {
      const selection = readSelection(remoteModuleName);
      if (selection) {
        void loadComponent(selection, false);
      }
    }, []);

    async function loadComponent(
      selection: RemoteSelection,
      updateStorage = true
    ) {
      try {
        setError(null);
        registerRemotes(
          [
            {
              name: selection.name,
              entry: selection.entry,
            },
          ],
          { force: true }
        );
        const remoteModule = await loadRemote<RemoteComponentModule<P>>(
          `${selection.name}/${remoteModuleName}`
        );
        if (!remoteModule?.default) {
          throw new Error('Remote module does not contain a default export');
        }
        setRemoteComponent(() => remoteModule.default);
        setIsPickerOpen(false);
        if (updateStorage) writeSelection(remoteModuleName, selection);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load remote component'
        );
      }
    }

    const SelectedComponent = RemoteComponent || DefaultComponent;

    return (
      <>
        <div
          className={isHighlighted ? 'apna-dynamic-highlight' : undefined}
          onClick={
            isHighlighted
              ? (event) => {
                  event.stopPropagation();
                  setIsPickerOpen(true);
                }
              : undefined
          }
          style={
            isHighlighted
              ? { outline: '4px solid #368564', borderRadius: 6 }
              : undefined
          }
        >
          <SelectedComponent {...props} />
        </div>
        {isPickerOpen && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              display: 'flex',
              alignItems: 'flex-end',
              background: 'rgba(0,0,0,0.35)',
            }}
          >
            <div
              style={{
                width: '100%',
                background: 'white',
                color: 'black',
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                padding: 16,
                boxShadow: '0 -8px 30px rgba(0,0,0,0.15)',
              }}
            >
              <div style={{ display: 'grid', gap: 12 }}>
                <strong>Select Remote Component</strong>
                {error && <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>}
                <button
                  type="button"
                  onClick={() => {
                    setRemoteComponent(null);
                    clearSelection(remoteModuleName);
                    setIsPickerOpen(false);
                  }}
                >
                  Default
                </button>
                <input
                  value={remoteName}
                  onChange={(event) => setRemoteName(event.target.value)}
                  placeholder="Remote name"
                />
                <input
                  value={remoteEntry}
                  onChange={(event) => setRemoteEntry(event.target.value)}
                  placeholder="Remote entry URL"
                />
                <button
                  type="button"
                  onClick={() =>
                    void loadComponent({
                      name: remoteName,
                      entry: remoteEntry,
                    })
                  }
                  disabled={!remoteName || !remoteEntry}
                >
                  Load Remote
                </button>
                <button type="button" onClick={() => setIsPickerOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  DynamicComponent.displayName = `withDynamicComponent(${remoteModuleName})`;
  return DynamicComponent;
}

function readSelection(remoteModuleName: string): RemoteSelection | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const selections = JSON.parse(raw) as Record<string, RemoteSelection>;
  return selections[remoteModuleName] ?? null;
}

function writeSelection(
  remoteModuleName: string,
  selection: RemoteSelection
): void {
  if (typeof window === 'undefined') return;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const selections = raw ? JSON.parse(raw) : {};
  selections[remoteModuleName] = selection;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
}

function clearSelection(remoteModuleName: string): void {
  if (typeof window === 'undefined') return;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  const selections = JSON.parse(raw);
  delete selections[remoteModuleName];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
}
