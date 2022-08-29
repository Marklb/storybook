import { SimpleChanges } from '@angular/core';

function decorateNgAfterViewInit(
  ngAfterViewInit: (() => void) | null | undefined,
  preLog: string[]
) {
  return function (this: any) {
    // TODO: Should this be before or after original call?
    // setWrappedPropsValues(this)

    console.log(...preLog);

    // Invoke the original `ngAfterViewInit` if it exists
    if (ngAfterViewInit) {
      ngAfterViewInit.call(this);
    }
  };
}

function decorateProviderDirectiveOrComponent(type: any, style: string): void {
  const hooks = [
    'ngOnInit',
    'ngOnChanges',
    'ngDoCheck',
    'ngAfterContentInit',
    'ngAfterContentChecked',
    'ngAfterViewInit',
    'ngAfterViewChecked',
    'ngOnDestroy',
  ];
  hooks.forEach((hook) => {
    // eslint-disable-next-line no-param-reassign
    type.prototype[hook] = decorateNgAfterViewInit(type.prototype[hook], [
      `%c[${type.name}]`,
      style,
      hook,
    ]);
  });
}

/**
 * Use with `@Input()` to help keep the wrapper inputs in sync with the wrapped
 * component.
 *
 * Example:
 * ```ts
 * @Component({ template: '' })
 * class {
 *     @Input() @InputDatatableWrapped() b: number
 * }
 * ```
 *
 * NOTE: Not sure yet if this will help simplify the wrapped properies or just
 * add overhead.
 *
 * @experimental
 */
export function LifeCycleHooksLog(style: string): ClassDecorator {
  // tslint:disable-next-line: only-arrow-functions
  return function (type: any) {
    decorateProviderDirectiveOrComponent(type, style);
  };
}

export const BOUND_PROPS: unique symbol = Symbol('__boundProps');
export const CALLED_NG_ON_INIT: unique symbol = Symbol('__calledNgOnInit');
export const CALLED_NG_ON_CHANGES: unique symbol = Symbol('__calledNgOnChanges');
export const ORIGINAL_NG_ON_INIT: unique symbol = Symbol('__originalNgOnInit');
export const ORIGINAL_NG_ON_CHANGES: unique symbol = Symbol('__originalNgOnChanges');
export const HOOKED_NG_ON_CHANGES_CALLBACK: unique symbol = Symbol('__hookedNgOnChangesCallback');

export type HookedNgOnChangesCallback = (
  initialChanges: SimpleChanges | undefined,
  original: any
) => void;

function getBoundProps(instance: any): SimpleChanges | undefined {
  return instance[BOUND_PROPS];
}

function setBoundProps(instance: any, changes: SimpleChanges | undefined): void {
  // eslint-disable-next-line no-param-reassign
  instance[BOUND_PROPS] = changes;
}

export function hasCalledNgOnInit(instance: any): boolean {
  return instance[CALLED_NG_ON_INIT] || false;
}

function setCalledNgOnInit(instance: any): void {
  // eslint-disable-next-line no-param-reassign
  instance[CALLED_NG_ON_INIT] = true;
}

export function hasCalledNgOnChanges(instance: any): boolean {
  return instance[CALLED_NG_ON_CHANGES] || false;
}

export function setCalledNgOnChanges(instance: any, called: boolean): void {
  // eslint-disable-next-line no-param-reassign
  instance[CALLED_NG_ON_CHANGES] = called;
}

function getOriginalNgOnInit(component: any): any {
  return component[ORIGINAL_NG_ON_INIT];
}

function setOriginalNgOnInit(component: any): void {
  // eslint-disable-next-line no-param-reassign
  component[ORIGINAL_NG_ON_INIT] = component.prototype.ngOnInit;
}

export function getOriginalNgOnChanges(component: any): any {
  return component[ORIGINAL_NG_ON_CHANGES];
}

function setOriginalNgOnChanges(component: any): void {
  // eslint-disable-next-line no-param-reassign
  component[ORIGINAL_NG_ON_CHANGES] = component.prototype.ngOnChanges;
}

function isHooked(component: any): boolean {
  return getOriginalNgOnInit(component) !== undefined;
}

function setHookedNgOnChangesCallback(instance: any, callback: HookedNgOnChangesCallback): void {
  // eslint-disable-next-line no-param-reassign
  instance[HOOKED_NG_ON_CHANGES_CALLBACK] = callback;
}

function getHookedNgOnChangesCallback(instance: any): HookedNgOnChangesCallback | undefined {
  return instance[HOOKED_NG_ON_CHANGES_CALLBACK];
}

export function hookChanges(component: any) {
  if (isHooked(component)) {
    return;
  }

  setOriginalNgOnInit(component);
  setOriginalNgOnChanges(component);

  // eslint-disable-next-line no-param-reassign, func-names
  component.prototype.ngOnInit = function (this: any) {
    const boundProps = getBoundProps(this);
    const hasCalledNgOnInitTmp = hasCalledNgOnInit(this);
    const hookedNgOnChangesCallback = getHookedNgOnChangesCallback(this);
    const originalNgOnChanges = getOriginalNgOnChanges(component);
    console.log('~~boundProps', boundProps);
    // if (!hasCalledNgOnInitTmp && boundProps && hookedNgOnChangesCallback) {
    //   hookedNgOnChangesCallback.apply(null, [boundProps, originalNgOnChanges]);
    // }
    if (!hasCalledNgOnInitTmp && hookedNgOnChangesCallback) {
      hookedNgOnChangesCallback.apply(null, [boundProps, originalNgOnChanges]);
    }

    const originalNgOnInit = getOriginalNgOnInit(component);
    if (originalNgOnInit) {
      // console.log('hooked ngOnInit', this);
      console.log('hooked ngOnInit');
      originalNgOnInit.call(this);
    }

    // hasCalledNgOnInit = true;
    setCalledNgOnInit(this);
  };

  // eslint-disable-next-line no-param-reassign, func-names
  component.prototype.ngOnChanges = function (this: any, changes: SimpleChanges) {
    // boundProps = changes;
    setBoundProps(this, changes);
    setCalledNgOnChanges(this, true);
    // boundProps = {};
    // Object.keys(changes).forEach((propName: string) => {
    //   return {
    //     previousValue: changes[propName].previousValue,
    //     currentValue: changes[propName].currentValue,
    //     isFirstChange: changes[propName].isFirstChange,
    //   };
    // });
    console.log('%cchanges', 'color:cyan', changes.other?.currentValue, changes);

    // const hasCalledNgOnInitTmp = hasCalledNgOnInit(this);
    // const hookedNgOnChangesCallback = getHookedNgOnChangesCallback(this);
    // if (hasCalledNgOnInitTmp && changes && hookedNgOnChangesCallback) {
    //   // eslint-disable-next-line prefer-spread
    //   hookedNgOnChangesCallback.apply(null, [changes]);
    // }

    const originalNgOnChanges = getOriginalNgOnChanges(component);
    if (originalNgOnChanges) {
      // console.log('hooked ngOnChanges', this, changes);
      console.log('hooked ngOnChanges');
      originalNgOnChanges.call(this, changes);
    }
  };
}

export function hookedChangesCallback(instance: any, callback: HookedNgOnChangesCallback): void {
  setHookedNgOnChangesCallback(instance, callback);
}
