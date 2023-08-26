import {
  ChangeDetectorRef,
  Directive,
  forwardRef,
  inject,
  Inject,
  Injector,
  OnDestroy,
  Optional,
  Self,
  SimpleChange,
  Type,
  ɵɵNgOnChangesFeature,
} from '@angular/core';
import { isObservable, Observable, Subscription } from 'rxjs';
import { NgComponentOutlet } from '@angular/common';

import { getBoundInputOutputNames } from './utils/TNodeAttrParser';
import {
  ComponentIORecord,
  getComponentDecoratorMetadata,
  getComponentInputsOutputs,
  isUsingOnPush,
} from './utils/NgComponentAnalyzer';
import { ICollection, Parameters } from '../types';
import { STORY_PARAMETERS, STORY_PROPS, STORY_PROPS_DIRECTIVE } from './InjectionTokens';

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
    declaredInputs: { x: '' },
  };
  ɵɵNgOnChangesFeature()(tmp);
  tmp.setInput(tmp, undefined, 'x', 'x');
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

export const createStorybookWrapperDirective = (
  storyComponent: Type<unknown> | undefined,
  hasTemplate: boolean
): Type<any> => {
  const ngComponentMetadata = getComponentDecoratorMetadata(storyComponent);
  const ngComponentInputsOutputs = getComponentInputsOutputs(storyComponent);

  const usingOnPush = isUsingOnPush(ngComponentMetadata);

  /**
   * Check if a property from Props is the input/output record.
   */
  const isPropIORecord = (record: ComponentIORecord, propName: string): boolean =>
    record.templateName === propName;

  /**
   * Get input/output information for prop.
   */
  const getPropIOInfo = (
    propName: string
  ): { ioType: 'input' | 'output'; record: ComponentIORecord } | undefined => {
    const inputRecord = ngComponentInputsOutputs.inputs.find((x) => isPropIORecord(x, propName));
    if (inputRecord !== undefined) {
      return { ioType: 'input', record: inputRecord };
    }

    const outputRecord = ngComponentInputsOutputs.outputs.find((x) => isPropIORecord(x, propName));
    if (outputRecord !== undefined) {
      return { ioType: 'output', record: outputRecord };
    }

    return undefined;
  };

  let selector = ngComponentMetadata?.selector;
  const hasSelector = selector !== undefined;
  if (!selector) {
    // Allow to add renderer component when NgComponent selector is undefined
    selector = '[ngComponentOutlet]';
  }

  @Directive({
    selector,
    providers: [
      {
        provide: STORY_PROPS_DIRECTIVE,
        useExisting: forwardRef(() => StorybookPropsDirective),
      },
    ],
    standalone: true,
  })
  class StorybookPropsDirective implements OnDestroy {
    /** Subscription to props changes. */
    private storyPropsSubscription = Subscription.EMPTY;

    /** Subscriptions to outputs in props. */
    private readonly propSubscriptions = new Map<any, { prop: any; sub: Subscription }>();

    /** Previous value of properties set by props. */
    private readonly previousValues: { [key: string]: any } = {};

    /**
     * Holds props that are ready to be bound during the next life-cycle step
     * that updates properties on the component instance, because Storybook
     * props don't emit based on Angular's life-cyle and may be set too early or
     * late if set immediately.
     */
    private propsToSet: ICollection | undefined;

    /** Names of bound properties, from the component's metadata. */
    private boundInputOutputNames: string[] = [];

    /**
     * Tracks whether the instance has been created.
     *
     * Initial props need to be set before the ngOnInit hook.
     */
    private hasCreated = false;

    private readonly storyProps$: Observable<ICollection | undefined> = inject(STORY_PROPS);

    private readonly storyParameters: Parameters | undefined = inject(STORY_PARAMETERS);

    private readonly changeDetectorRef = inject(ChangeDetectorRef);

    private readonly injector = inject(Injector);

    private readonly outlet = inject(NgComponentOutlet, { optional: true });

    readonly componentInstance? = inject(storyComponent, { optional: true, self: true });

    // constructor(
    //   // @Inject(STORY_PROPS) private readonly storyProps$: Observable<ICollection | undefined>,
    //   // @Inject(STORY_PARAMETERS) private readonly storyParameters: Parameters | undefined
    //   // private readonly changeDetectorRef: ChangeDetectorRef
    //   // private readonly injector: Injector,
    //   // @Optional() private readonly outlet: NgComponentOutlet,
    //   // @Optional() @Self() @Inject(storyComponent) readonly componentInstance?: any
    // ) {
    constructor() {
      this.boundInputOutputNames = getBoundInputOutputNames(this.injector);

      this.storyPropsSubscription = this.storyProps$.subscribe((storyProps = {}) => {
        this.propsToSet = storyProps;
        if (this.propsUpdatePending()) {
          this.setProps(this.getInstance(), this.propsToSet);
          this.propsToSet = null;
        }
      });
    }

    ngDoCheck() {
      if (!hasSelector && !this.hasCreated && this.getInstance() !== null) {
        this.hasCreated = true;
        if (this.propsUpdatePending()) {
          this.setProps(this.getInstance(), this.propsToSet);
          this.propsToSet = null;
        }
      }
    }

    ngAfterContentChecked() {
      if (usingOnPush) {
        // If the component is using OnPush then change detection needs to be
        // manually triggered, but this would cause a change detection to get
        // triggered twice if not using OnPush.
        this.changeDetectorRef.detectChanges();
      }
    }

    ngOnDestroy(): void {
      this.storyPropsSubscription.unsubscribe();

      this.propSubscriptions.forEach((v) => {
        if (!v.sub.closed) {
          v.sub.unsubscribe();
        }
      });
      this.propSubscriptions.clear();
    }

    /**
     * Returns if Storybook props have been changed and waiting to be processed
     * for instance property updates.
     */
    public propsUpdatePending(): boolean {
      if (this.propsToSet === undefined || this.propsToSet === null) {
        return false;
      }

      if (hasSelector) {
        return true;
      }

      return this.hasCreated;
    }

    /**
     * Set inputs and outputs.
     *
     * Properties that have already been bound will be ignored.
     */
    private setProps(instance: any, props: ICollection | undefined): void {
      Object.keys(props).forEach((key: string) => {
        // Don't touch a property if it is already bound. If Storybook updates a
        // property that is bound then the property may get unnecessarily set
        // twice or overwrite a calculated value, such as the story manually
        // binding an input to go through a pipe.
        if (this.isBoundProperty(key)) {
          return;
        }

        const info = getPropIOInfo(key);
        const value = props[key];
        const previousValue = this.previousValues[key];
        const instancePropName = info !== undefined ? info.record.propName : key;

        if (previousValue !== value) {
          if (info !== undefined) {
            if (this.emulateTemplateBinding(key)) {
              if (info.ioType === 'input') {
                ngOnChangesSetInput(instance, value, key, instancePropName);
              } else if (info.ioType === 'output') {
                const instanceProperty = instance[instancePropName];
                if (isObservable(instanceProperty)) {
                  this.setPropSubscription(key, instanceProperty, value);
                }
              }
            }
          } else if (this.isSetNonInputOutputPropertiesEnabled()) {
            // eslint-disable-next-line no-param-reassign
            instance[instancePropName] = value;
            if (usingOnPush) {
              this.changeDetectorRef.markForCheck();
            }
          }

          this.previousValues[key] = value;
        }
      });
    }

    private isEmulatePropBindingIfNotTemplateBoundEnabled(): boolean {
      return typeof this.storyParameters.emulatePropBindingIfNotTemplateBound === 'boolean'
        ? this.storyParameters.emulatePropBindingIfNotTemplateBound
        : true;
    }

    private isSetNonInputOutputPropertiesEnabled(): boolean {
      return typeof this.storyParameters.setNonInputOutputProperties === 'boolean'
        ? this.storyParameters.setNonInputOutputProperties
        : true;
    }

    /**
     * If a template is provided then updating props is emulated, to try and act
     * like the input or output is bound in the template.
     *
     * If a template is not provided then updating props is emulated for props
     * not in initial props, since Angular doesn't support dynamically adding
     * template bindings.
     */
    private emulateTemplateBinding(propName: string): boolean {
      return (
        this.isEmulatePropBindingIfNotTemplateBoundEnabled() &&
        (!hasSelector || hasTemplate || (!hasTemplate && !this.isBoundProperty(propName)))
      );
    }

    /**
     * Checks if the component's metadata specifies the property as a template
     * bound property.
     */
    public isBoundProperty(name: string): boolean {
      return this.boundInputOutputNames.indexOf(name) !== -1;
    }

    /**
     * Map a property name from Storybook props to Angular Directive instance
     * property name.
     *
     * In an Angular template, the templateName would be used for inputs/outputs.
     * To have an input trigger the ngOnChanges hook and an output get subscribed
     * for Storybook actions, the templateName should be used in props.
     *
     * A renamed input can still be set by using the property name, but
     * it would not trigger ngOnChanges.
     */
    public propNameToInstancePropertyName(propName: string): string {
      const info = getPropIOInfo(propName);
      return info !== undefined ? info.record.propName : propName;
    }

    /**
     * Subscribe to property.
     *
     * Subscription will be unsubscribed in 'ngOnDestroy'.
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

    /**
     * Get the component's instance.
     */
    private getInstance(): any {
      if (this.componentInstance !== null) {
        return this.componentInstance;
      }

      // I did not see a way to access the component instance with a public api.
      // eslint-disable-next-line no-underscore-dangle
      return (this.outlet as any)?._componentRef?.instance;
    }
  }

  return StorybookPropsDirective;
};
