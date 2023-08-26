import { Injector } from '@angular/core';

/**
 * .
 */
export function getBoundInputOutputNames(injector: Injector): string[] {
  // eslint-disable-next-line no-underscore-dangle
  const tNode = (injector as any)._tNode;
  if (!tNode || !Array.isArray(tNode.attrs)) {
    return [];
  }

  const inputs = Object.keys(tNode?.inputs ?? []);
  const outputs = Object.keys(tNode?.outputs ?? []);
  const ioNames = [...inputs, ...outputs];
  const attrIONames = getInputOutputNamesFromTNodeAttrs(tNode.attrs);
  return attrIONames.filter((x) => ioNames.indexOf(x) !== -1);
}

/**
 * .
 */
export function getInputOutputNamesFromTNodeAttrs(attrs: (string | number)[]): string[] {
  if (attrs.length < 2) {
    return [];
  }

  if (typeof attrs[0] !== 'string' && attrs[0] !== 3) {
    return [];
  }

  const io: string[] = [];
  let readingBindings = false;
  for (let i = 0; i < attrs.length; i += 1) {
    if (typeof attrs[i] !== 'string' && attrs[i] !== 3) {
      // eslint-disable-next-line no-continue
      continue;
    } else if (attrs[i] === 3) {
      readingBindings = true;
    } else if (readingBindings) {
      io.push(attrs[i] as string);
    } else {
      io.push(attrs[i] as string);
      i += 1;
    }
  }

  return io;
}
