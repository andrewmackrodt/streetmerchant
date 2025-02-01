const contexts = new Map<string, boolean>();

export class AsyncContextError extends Error {
  name = 'AsyncContextError';
}

export function available(name: string) {
  return contexts.get(name) ?? true;
}

export function create(name: string) {
  return contexts.set(name, true);
}

export function destroy(name: string) {
  return contexts.set(name, false);
}

export function assert(name: string) {
  if (!available(name)) {
    throw new AsyncContextError(`context ${name} is not available`);
  }
}
