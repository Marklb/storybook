import {
  AfterViewInit,
  ChangeDetectorRef,
  ComponentRef,
  Directive,
  ElementRef,
  EventEmitter,
  Host,
  Inject,
  InjectFlags,
  Injector,
  OnDestroy,
  OnInit,
  Optional,
  Self,
  SimpleChange,
  SimpleChanges,
  SkipSelf,
  Type,
  ViewChild,
  ViewContainerRef,
  ɵɵNgOnChangesFeature,
} from '@angular/core';
import { isObservable, Observable, Subject, Subscription } from 'rxjs';
import { NgComponentOutlet } from '@angular/common';
import { take, tap } from 'rxjs/operators';

import {
  ComponentInputsOutputs,
  ComponentIORecord,
  getComponentDecoratorMetadata,
  getComponentInputsOutputs,
} from './utils/NgComponentAnalyzer';
import { ICollection, StoryFnAngularReturnType } from '../types';
import { Parameters } from '../types-6-0';
import { STORY_PROPS } from './StorybookProvider';
import {
  StoryWrapper,
  STORY_INITAL_PROPS,
  STORY_PARAMETERS,
  STORY_WRAPPER,
} from './StorybookWrapperComponent';

import {
  getOriginalNgOnChanges,
  hasCalledNgOnChanges,
  hasCalledNgOnInit,
  hookChanges,
  hookedChangesCallback,
  LifeCycleHooksLog,
  setCalledNgOnChanges,
} from './utils/LifeCycleHookWatcher';

/**
 * Return reference to internal EMPTY_OBJ. It is not exported and I did not see
 * a way to access it directly, but initially a component's __ngSimpleChanges__
 * is assigned a reference to EMPTY_OBJ as previous.
 *
 * Trying to mix Storybook props and Angular change detection was requiring
 * flakey logic and life-cycle hook proxies. To determine when Angular is
 * updating properties, I could determine approximately when Angular is updating
 * properties by determining the life-cycle hook called before and after the
 * properties get updated on the component instance. To avoid two calls to
 * ngOnChanges and merge Storybook's SimpleChanges into the SimpleChanges passed
 * to ngOnChanges, by Angular, I had to proxy the component's ngOnChanges and
 * merge Shorybook's changes into the SimpleChanges argument. Also, it needed to
 * be known when to directly call ngOnChanges if Angular will not be calling it.
 *
 * I realized I could drop a lot of my flakey code and just update the
 * component's __ngSimpleChanges__, which has checks for the internal EMPTY_OBJ.
 */
function getEmpty() {
  const tmp: any = {
    type: {
      prototype: {
        ngOnChanges: {},
      },
    },
    declaredInputs: { x: {} },
  };
  ɵɵNgOnChangesFeature()(tmp);
  tmp.setInput(tmp, undefined, 'x', 'x');
  // const store = getSimpleChangesStore(tmp);
  // eslint-disable-next-line no-underscore-dangle
  const store = tmp.__ngSimpleChanges__;
  const empty = store.previous;
  return empty;
}

const EMPTY_OBJ = getEmpty();
function ngOnChangesSetInput(
  instance: any,
  value: any,
  publicName: string,
  privateName: string
): void {
  const simpleChangesStore =
    getSimpleChangesStore(instance) ||
    setSimpleChangesStore(instance, { previous: EMPTY_OBJ, current: null });
  const current = simpleChangesStore.current || (simpleChangesStore.current = {});
  // eslint-disable-next-line prefer-destructuring
  const previous = simpleChangesStore.previous;
  // const declaredName = this.declaredInputs[publicName];
  const declaredName = privateName;
  const previousChange = previous[declaredName];
  current[declaredName] = new SimpleChange(
    previousChange && previousChange.currentValue,
    value,
    previous === EMPTY_OBJ
  );
  // eslint-disable-next-line no-param-reassign
  instance[privateName] = value;
}
const SIMPLE_CHANGES_STORE = '__ngSimpleChanges__';
function getSimpleChangesStore(instance: any): any {
  return instance[SIMPLE_CHANGES_STORE] || null;
}
function setSimpleChangesStore(instance: any, store: any) {
  // eslint-disable-next-line no-return-assign, no-param-reassign
  return (instance[SIMPLE_CHANGES_STORE] = store);
}

function simpleChangesPrevious(instance: any, propName: string) {
  const simpleChangesStore = getSimpleChangesStore(instance);
  if (simpleChangesStore?.previous) {
    return simpleChangesStore.previous[propName]?.currentValue;
  }
  return undefined;
}

export const createStorybookWrapperDirective = (
  storyComponent: Type<unknown> | undefined,
  hasTemplate: boolean
): Type<any> => {
  const ngComponentMetadata = getComponentDecoratorMetadata(storyComponent);
  const ngComponentInputsOutputs = getComponentInputsOutputs(storyComponent);

  const isRecord = (record: ComponentIORecord, name: string): boolean =>
    record.templateName === name;

  const getIOInfo = (
    name: string
  ): { ioType: 'input' | 'output'; record: ComponentIORecord } | undefined => {
    const inputRecord = findInput(name);
    if (inputRecord !== undefined) {
      return { ioType: 'input', record: inputRecord };
    }

    const outputRecord = findOutput(name);
    if (outputRecord !== undefined) {
      return { ioType: 'output', record: outputRecord };
    }

    return undefined;
  };

  // TODO: Should this also recognize non-mapped names?
  const findInput = (name: string): ComponentIORecord | undefined => {
    return ngComponentInputsOutputs.inputs.find((x) => isRecord(x, name));
  };

  // TODO: Should this also recognize non-mapped names?
  const findOutput = (name: string): ComponentIORecord | undefined => {
    return ngComponentInputsOutputs.outputs.find((x) => isRecord(x, name));
  };

  let { selector } = ngComponentMetadata;
  if (!selector) {
    // Allow to add renderer component when NgComponent selector is undefined
    selector = '[ngComponentOutlet]';
  }

  const preLog = ['%c[StorybookPropsDirective]', 'color:violet'];

  // @LifeCycleHooksLog('color:violet')
  @Directive({ selector })
  class StorybookPropsDirective implements OnInit, AfterViewInit, OnDestroy {
    private subscription: Subscription | undefined;

    private readonly propSubscriptions = new Map<any, { prop: any; sub: Subscription }>();

    private readonly previousValues: { [key: string]: any } = {};

    private setPropsEnabled = false;

    private propsUpdatingStarted = false;

    private propsToSet: ICollection | undefined;

    constructor(
      @Inject(STORY_PROPS) private readonly storyProps$: Subject<ICollection | undefined>,
      // @Inject(STORY) private story$: Observable<StoryFnAngularReturnType>,
      @Inject(STORY_WRAPPER) private readonly storyWrapper: StoryWrapper,
      @Inject(STORY_PARAMETERS) private readonly storyParameters: Parameters,
      @Inject(STORY_INITAL_PROPS) private readonly storyInitialProps: ICollection,
      private readonly changeDetectorRef: ChangeDetectorRef,
      private readonly vcr: ViewContainerRef,
      // private readonly compRef: ComponentRef<any>,
      private readonly injector: Injector,
      @Optional() private readonly outlet: NgComponentOutlet,
      @Optional() @SkipSelf() private readonly sbPropsDir?: StorybookPropsDirective,
      @Optional() @Self() @Inject(storyComponent) readonly componentInstance?: any
    ) {
      console.log(...preLog, 'constructor');

      this.startPropsUpdating();

      this.setPropsEnabled = this.storyWrapper.registerPropsDirectiveInstance(this);
      // this.startPropsUpdating();

      this.storyWrapper.ngOnInitSubject.subscribe(() => {
        console.log('ngOnInitSubject');
        // this.startPropsUpdating();
      });

      this.storyWrapper.ngOnContentCheckedSubject.subscribe(() => {
        console.log('ngOnContentCheckedSubject');
        if (this.propsToSet) {
          this.setProps(this.getInstance(), this.propsToSet, null);
          this.propsToSet = null;
        }
        setCalledNgOnChanges(this.getInstance(), false);
      });
    }

    ngOnInit(): void {
      // console.log('[StorybookPropsDirective] ngOnInit');
      console.log(...preLog, 'ngOnInit');

      const directives = this.injector.get(
        Directive,
        false,
        // eslint-disable-next-line no-bitwise
        InjectFlags.Self | InjectFlags.Optional
      );
      console.log('directives', directives);
    }

    ngOnChanges(changes: SimpleChanges) {
      console.log(...preLog, 'ngOnChanges', changes);
    }

    ngDoCheck() {
      console.log(...preLog, 'ngDoCheck');
    }

    ngAfterContentInit() {
      console.log(...preLog, 'ngAfterContentInit');
    }

    ngAfterContentChecked() {
      console.log(...preLog, 'ngAfterContentChecked');
    }

    ngAfterViewInit() {
      console.log(...preLog, 'ngAfterViewInit');
    }

    ngAfterViewChecked() {
      console.log(...preLog, 'ngAfterViewChecked');
    }

    ngOnDestroy(): void {
      console.log(...preLog, 'ngOnDestroy');
      if (this.subscription) {
        this.subscription.unsubscribe();
      }

      this.propSubscriptions.forEach((v) => {
        if (!v.sub.closed) {
          v.sub.unsubscribe();
        }
      });
      this.propSubscriptions.clear();

      this.storyWrapper.unregisterPropsDirectiveInstance(this);
    }

    private startPropsUpdating() {
      console.log('startPropsUpdating');
      if (this.propsUpdatingStarted) {
        return;
      }
      this.propsUpdatingStarted = true;

      const setPropsOnAllComponentInstances =
        this.storyParameters.setPropsOnAllComponentInstances ?? true;

      if (setPropsOnAllComponentInstances || this.setPropsEnabled) {
        this.subscription = this.storyProps$.subscribe((storyProps = {}) => {
          console.log('[StorybookPropsDirective] storyProps$', storyProps);
          this.propsToSet = storyProps;
        });
      }
    }

    /**
     * Set inputs and outputs
     */
    private setProps(
      instance: any,
      props: ICollection | undefined,
      originalChanges: SimpleChanges | undefined
    ): void {
      console.log('setProps', props, originalChanges);
      const changes: SimpleChanges = originalChanges ?? {};
      const hasNgOnChangesHook = !!instance.ngOnChanges;

      Object.keys(props).forEach((key: string) => {
        const info = getIOInfo(key);
        const value = props[key];
        const previousValue = this.previousValues[key];
        const instancePropName = info !== undefined ? info.record.propName : key;

        if (previousValue !== value) {
          if (info !== undefined) {
            if (this.emulateTemplateBinding(key)) {
              if (info.ioType === 'input') {
                ngOnChangesSetInput(this.getInstance(), value, key, instancePropName);
              } else if (info.ioType === 'output') {
                const instanceProperty = instance[instancePropName];
                if (isObservable(instanceProperty)) {
                  this.setPropSubscription(key, instanceProperty, value);
                }
                // TODO: What to do if this isn't an Observable?
              }
            }
          } else {
            // eslint-disable-next-line no-param-reassign
            instance[instancePropName] = value;
          }

          this.previousValues[key] = value;
        }
      });

      // TODO: Check if the component is a form control.
      // this.setNgModel(instance, props);
    }

    /**
     * If a template is provided then updating props is emulated, to try and act
     * like the input is bound in the template.
     *
     * If a template is not provided then updating props is emulated for props
     * not in initial props, since template binding can't be dynamically added
     */
    private emulateTemplateBinding(propName: string): boolean {
      return (
        (this.storyParameters.emulatePropBindingIfNotInInitialProps ?? true) &&
        (hasTemplate || (!hasTemplate && !this.isTemplateBoundProp(propName)))
      );
    }

    /**
     * Is the prop bound in the template.
     *
     * If the story does not provide a template then Storybook adds a template
     * binding for inputs/outputs in props when the template is created.
     *
     * If the story provides a template then no template bindings will be known.
     */
    private isTemplateBoundProp(propName: string): boolean {
      return Object.prototype.hasOwnProperty.call(this.storyInitialProps, propName);
    }

    /**
     * If component implements ControlValueAccessor interface try to set ngModel
     */
    private setNgModel(instance: any, props: ICollection): void {
      if (props.ngModel) {
        instance.writeValue(props.ngModel);
      }

      if (typeof props.ngModelChange === 'function') {
        instance.registerOnChange(props.ngModelChange);
      }
    }

    /**
     * Store ref to subscription for cleanup in 'ngOnDestroy' and check if
     * observable needs to be resubscribed to, before creating a new subscription.
     */
    private setPropSubscription(key: string, instanceProperty: Observable<any>, value: any): void {
      if (this.propSubscriptions.has(key)) {
        const v = this.propSubscriptions.get(key);
        if (v.prop === value) {
          // Prop hasn't changed, so the existing subscription can stay.
          return;
        }

        // Now that the value has changed, unsubscribe from the previous value's subscription.
        if (!v.sub.closed) {
          v.sub.unsubscribe();
        }
      }

      const sub = instanceProperty.subscribe(value);
      this.propSubscriptions.set(key, { prop: value, sub });
    }

    private getInstance(): any {
      if (this.componentInstance !== null) {
        return this.componentInstance;
      }

      // NOTE: I am not sure of a good way to get the instance with a public api, yet.
      return (this.outlet as any)?._componentRef?.instance;
    }
  }

  return StorybookPropsDirective;
};
