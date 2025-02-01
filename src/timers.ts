import * as abortctl from './abortctl';

export type Timer = ReturnType<typeof setTimeout>;

const timeoutIds = new Set<Timer>();

export function addTimeout<T extends unknown[]>(
  cb: (...args: T) => void,
  timeout?: number,
  ...args: T
) {
  abortctl.assert('timers.timeout');
  const id = setTimeout(
    () => {
      timeoutIds.delete(id);
      cb(...args);
    },
    timeout,
    ...args
  ) as unknown as Timer;
  timeoutIds.add(id);
  return id;
}

export function removeTimeout(id: Timer) {
  clearTimeout(id);
  timeoutIds.delete(id);
}

export function abortTimeouts() {
  abortctl.destroy('timers.timeout');
  for (const id of timeoutIds) {
    clearTimeout(id);
  }
  timeoutIds.clear();
}

export function enableTimeouts() {
  abortctl.create('timers.timeout');
}

const intervalIds = new Set<Timer>();

export function addInterval<T extends unknown[]>(
  cb: (...args: T) => void,
  interval?: number,
  ...args: T
) {
  abortctl.assert('timers.interval');
  const id = setInterval(
    () => {
      intervalIds.delete(id);
      cb(...args);
    },
    interval,
    ...args
  ) as unknown as Timer;
  intervalIds.add(id);
  return id;
}

export function removeInterval(id: Timer) {
  clearInterval(id);
  intervalIds.delete(id);
}

export function abortIntervals() {
  abortctl.destroy('timers.interval');
  for (const id of intervalIds) {
    clearInterval(id);
  }
  intervalIds.clear();
}

export function enableIntervals() {
  abortctl.create('timers.interval');
}

export function abort() {
  abortTimeouts();
  abortIntervals();
}

export function enable() {
  enableTimeouts();
  enableIntervals();
}
