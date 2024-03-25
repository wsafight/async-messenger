const { hasOwnProperty: hasOwn } = Object.prototype;

/* eslint-disable no-bitwise */
/* eslint-disable no-shadow */
export const hash = (str = ''): number => {
  if (str.length === 0) {
    return 0;
  }
  let hash = 0;
  let i;
  let chr;
  let len;
  for (i = 0, len = str.length; i < len; i++) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

export function isFunction(fn: unknown): boolean {
  return typeof fn === 'function';
}

// eslint-disable-next-line  @typescript-eslint/no-empty-function
export const noop = () => {};

/**
 * 延时执行函数
 * @param fn
 * @param delay
 * @param context
 * @returns
 */
export function delay(
  fn = noop as (...args: any[]) => any,
  delay = 5000,
  context: unknown = null,
): {
  run: (...args: any[]) => Promise<any>;
  cancel: () => void;
} {
  if (!isFunction(fn)) {
    return {
      run: () => Promise.resolve(),
      cancel: noop,
    };
  }
  let ticket: any;
  let executed = false;
  return {
    run(...args: any) {
      return new Promise((resolve, reject) => {
        if (executed === true) {
          return;
        }
        executed = true;

        const runFunc = async () => {
          try {
            const res = await fn.apply(context, args);
            resolve(res);
          } catch (err) {
            reject(err);
          }
        };

        ticket = setTimeout(runFunc, delay);
      });
    },
    cancel: () => {
      clearTimeout(ticket);
    },
  };
}

export function hasOwnProperty(obj: any, property: PropertyKey): boolean {
  return hasOwn.call(obj, property);
}

export function isSameScope(
  scope1: string | undefined,
  scope2: string | undefined,
): boolean {
  return scope1 === scope2;
}

export function uuid() {
  let d = Date.now();
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    d += performance.now(); // use high-precision timer if available
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
