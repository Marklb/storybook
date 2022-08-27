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

const EMPTY_OBJ = {};
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
  const declaredName = this.declaredInputs[publicName];
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
  if (!ngComponentMetadata.selector) {
    // Allow to add renderer component when NgComponent selector is undefined
    selector = '[ngComponentOutlet]';
  }

  // let startPropSetFn:
  //   | ((
  //       initialChanges: SimpleChanges | undefined,
  //       originalNgOnChanges: (changes: SimpleChanges) => void
  //     ) => void)
  //   | undefined;
  if (storyComponent) {
    hookChanges(storyComponent);
    // hookChanges(storyComponent, (boundProps: any, originalNgOnChanges: any) => {
    //   console.log('~~callback', boundProps);
    //   if (startPropSetFn) {
    //     startPropSetFn.call(null, boundProps, originalNgOnChanges);
    //   }
    // });
  }

  const preLog = [
    '%c[StorybookPropsDirective]', 'color:violet'
  ]
  
  // @LifeCycleHooksLog('color:violet')
  @Directive({ selector })
  class StorybookPropsDirective implements OnInit, AfterViewInit, OnDestroy {
    private subscription: Subscription | undefined;

    private readonly propSubscriptions = new Map<any, { prop: any; sub: Subscription }>();

    private readonly previousValues: { [key: string]: any } = {};

    private hasInitialized = false;

    private setPropsEnabled = false;

    private propsUpdatingStarted = false;

    private templateBoundProps: string[] = [];

    private initialChanges: SimpleChanges | undefined;

    private originalNgOnChanges: ((changes: SimpleChanges) => void) | undefined;

    private propsToSet: ICollection | undefined;

    private isSettingProps = false;

    private settedProps: string[] = [];

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
      // console.log('[StorybookPropsDirective] constructor');
      console.log(...preLog, 'constructor');

      const startPropSetFn = (initialChanges: SimpleChanges | undefined, original: any) => {
        if (initialChanges) {
          this.initialChanges = initialChanges;
          this.templateBoundProps = Object.keys(initialChanges);
          // this.templateBoundProps.forEach((propName: string) => {
          //   this.previousValues[propName] = initialChanges[propName].currentValue;
          // });
          this.originalNgOnChanges = original
        }
        console.log('~~~~~~~startPropSetFn', initialChanges, this.templateBoundProps);

        // this.startPropsUpdating();
        
        // if (!this.isSettingProps) {
        //   this.isSettingProps = true;
        //   this.isSettingProps = false;
        // }
        this.setProps(this.getInstance(), this.propsToSet, initialChanges);
        // this.changeDetectorRef.markForCheck();
        // this.changeDetectorRef.detectChanges();
      };
      hookedChangesCallback(this.getInstance(), startPropSetFn);

      this.startPropsUpdating();

      this.setPropsEnabled = this.storyWrapper.registerPropsDirectiveInstance(this);
      // this.startPropsUpdating();

      this.storyWrapper.ngOnInitSubject.subscribe(() => {
        console.log('ngOnInitSubject');
        // this.startPropsUpdating();
      });

      this.storyWrapper.ngOnContentCheckedSubject.subscribe(() => {
        console.log('ngOnContentCheckedSubject');
        // this.startPropsUpdating();
        // if (!hasCalledNgOnInit(this.getInstance()) && hasCalledNgOnChanges(this.getInstance())) {
        //   this.setProps(this.getInstance(), this.propsToSet, this.initialChanges);
        // }
        if (this.propsToSet) {
          this.setProps(this.getInstance(), this.propsToSet, null);
          this.propsToSet = null
        }
        setCalledNgOnChanges(this.getInstance(), false)
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

      // let isFirst = true;
      // this.subscription = this.storyProps$
      //   .pipe(
      //     tap((storyProps: ICollection | undefined) => {
      //       console.log('[StorybookPropsDirective] ngOnInit storyProps', storyProps);
      //       this.setProps(this.getInstance(), storyProps, isFirst);
      //       isFirst = false;

      //       this.changeDetectorRef.markForCheck();
      //       // Must detect changes on the current component in order to update any changes in child component's @HostBinding properties (angular/angular#22560)
      //       this.changeDetectorRef.detectChanges();
      //     })
      //   )
      //   .subscribe();

      // this.startPropsUpdating();

      this.hasInitialized = true;
    }

    ngOnChanges(changes: SimpleChanges) {
      console.log(...preLog, 'ngOnChanges', changes);
    }
  
    ngDoCheck() {
      console.log(...preLog, 'ngDoCheck');
      this.settedProps = [];
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
      console.log('startPropsUpdating')
      if (this.propsUpdatingStarted) {
        return;
      }
      this.propsUpdatingStarted = true;

      const setPropsOnAllComponentInstances =
        this.storyParameters.setPropsOnAllComponentInstances ?? true;

      if (setPropsOnAllComponentInstances || this.setPropsEnabled) {
        // this.setProps(this.getInstance(), { other: 'InitOther' }, true);

        // Subscribing in constructor to update initial props and call manual
        // ngOnChanges before ngOnInit.
        this.subscription = this.storyProps$.subscribe((storyProps = {}) => {
          console.log('[StorybookPropsDirective] storyProps$', storyProps);
          
          this.propsToSet = storyProps;

          // All props are added as component properties
          // Object.assign(this, storyProps);
          // this.setProps(this.getInstance(), storyProps, true);

          // // this.changeDetectorRef.detectChanges();
          // this.changeDetectorRef.markForCheck();

          // // Check if ngOnInit has been called, because detectChanges shouldn't be
          // // called until UPDATE mode.
          // if (this.hasInitialized) {
          //   this.changeDetectorRef.detectChanges();
          // }
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
            // if (hasTemplate || !isFirst) {
            if (this.emulateTemplateBinding(key)) {
              if (info.ioType === 'input') {
                // eslint-disable-next-line no-param-reassign
                // instance[instancePropName] = value;
                // if (hasNgOnChangesHook) {
                //   changes[instancePropName] = new SimpleChange(
                //     previousValue,
                //     value,
                //     !Object.prototype.hasOwnProperty.call(this.previousValues, key)
                //   );
                // }
                // __ngSimpleChanges__
                // eslint-disable-next-line no-underscore-dangle
                // const simpleChangesStore = (this.getInstance() as any).__ngSimpleChanges__;
                ngOnChangesSetInput(this.getInstance(), value, key, instancePropName);
              } else if (info.ioType === 'output') {
                const instanceProperty = instance[instancePropName];
                // if (instanceProperty instanceof EventEmitter) {
                if (isObservable(instanceProperty)) {
                  this.setPropSubscription(key, instanceProperty, value);
                }
                // TODO: What to do if this isn't an EventEmitter? Does Angular support Observable?
              }
            }
          } else {
            // eslint-disable-next-line no-param-reassign
            instance[instancePropName] = value;
            this.settedProps.push(key);
          }

          this.previousValues[key] = value;
        }
      });

      // this.callNgOnChangesHook(instance, changes);
      this.setNgModel(instance, props);
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
     * Manually call 'ngOnChanges' hook because angular doesn't do that for dynamic components
     * Issue: [https://github.com/angular/angular/issues/8903]
     *
     * NOTE: If directives are attached to the same instance, their inputs/outputs will not be set.
     */
    private callNgOnChangesHook(instance: any, changes: SimpleChanges): void {
      console.log('~!~ callNgOnChangesHook', instance, changes);
      if (Object.keys(changes).length) {
        // if (this.originalNgOnChanges) {
        if (storyComponent) {
          const originalNgOnChanges = getOriginalNgOnChanges(storyComponent);
          // this.originalNgOnChanges.call(instance, changes);
          originalNgOnChanges.call(instance, changes);
        } else {
          instance.ngOnChanges(changes);
        }
      }
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
