type Listener = (event: MediaQueryListEvent) => void;

const listeners = new Map<string, Set<Listener>>();
let viewportWidth = 1440;

function matches(query: string): boolean {
  const minWidth = /\(min-width:\s*(\d+)px\)/.exec(query);
  if (!minWidth) {
    throw new Error(`Заглушка matchMedia не поддерживает запрос «${query}»`);
  }
  return viewportWidth >= Number(minWidth[1]);
}

export function installMatchMedia(width = 1440) {
  viewportWidth = width;
  listeners.clear();
  window.matchMedia = (query: string): MediaQueryList => {
    const queryListeners = listeners.get(query) ?? new Set<Listener>();
    listeners.set(query, queryListeners);
    return {
      media: query,
      get matches() {
        return matches(query);
      },
      onchange: null,
      addEventListener: (_type: string, listener: Listener) =>
        queryListeners.add(listener),
      removeEventListener: (_type: string, listener: Listener) =>
        queryListeners.delete(listener),
      addListener: (listener: Listener) => queryListeners.add(listener),
      removeListener: (listener: Listener) => queryListeners.delete(listener),
      dispatchEvent: () => true,
    } as MediaQueryList;
  };
}

export function setViewportWidth(width: number) {
  viewportWidth = width;
  for (const [query, queryListeners] of listeners) {
    const event = {
      matches: matches(query),
      media: query,
    } as MediaQueryListEvent;
    for (const listener of queryListeners) listener(event);
  }
}
