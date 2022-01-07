import {
  AfterViewInit,
  ChangeDetectorRef,
  Directive,
  ElementRef,
  EventEmitter,
  Host,
  Inject,
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

  @Directive({ selector })
  class StorybookPropsDirective implements OnInit, AfterViewInit, OnDestroy {
    private subscription: Subscription | undefined;

    private readonly propSubscriptions = new Map<any, { prop: any; sub: Subscription }>();

    private readonly previousValues: { [key: string]: any } = {};

    // eslint-disable-next-line no-useless-constructor
    constructor(
      @Inject(STORY_PROPS) private readonly storyProps$: Subject<ICollection | undefined>,
      // @Inject(STORY) private story$: Observable<StoryFnAngularReturnType>,
      @Inject(STORY_WRAPPER) private readonly storyWrapper: StoryWrapper,
      @Inject(STORY_PARAMETERS) private readonly storyParameters: Parameters,
      @Inject(STORY_INITAL_PROPS) private readonly storyInitialProps: ICollection,
      private readonly changeDetectorRef: ChangeDetectorRef,
      private readonly vcr: ViewContainerRef,
      @Optional() private readonly outlet: NgComponentOutlet,
      @Optional() @SkipSelf() private readonly sbPropsDir?: StorybookPropsDirective,
      @Optional() @Self() @Inject(storyComponent) readonly componentInstance?: any
    ) {}

    ngOnInit(): void {
      let isFirst = true;
      this.subscription = this.storyProps$
        .pipe(
          tap((storyProps: ICollection | undefined) => {
            this.setProps(this.getInstance(), storyProps, isFirst);
            isFirst = false;

            this.changeDetectorRef.markForCheck();
            // Must detect changes on the current component in order to update any changes in child component's @HostBinding properties (angular/angular#22560)
            this.changeDetectorRef.detectChanges();
          })
        )
        .subscribe();
    }

    ngAfterViewInit(): void {
      const inst = this.getInstance();
    }

    ngOnDestroy(): void {
      if (this.subscription) {
        this.subscription.unsubscribe();
      }

      this.propSubscriptions.forEach((v) => {
        if (!v.sub.closed) {
          v.sub.unsubscribe();
        }
      });
      this.propSubscriptions.clear();
    }

    /**
     * Set inputs and outputs
     */
    private setProps(instance: any, props: ICollection | undefined, isFirst: boolean): void {
      const changes: SimpleChanges = {};
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
                instance[instancePropName] = value;
                if (hasNgOnChangesHook) {
                  changes[instancePropName] = new SimpleChange(
                    previousValue,
                    value,
                    !Object.prototype.hasOwnProperty.call(this.previousValues, key)
                  );
                }
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
          }

          this.previousValues[key] = value;
        }
      });

      this.callNgOnChangesHook(instance, changes);
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
     */
    private callNgOnChangesHook(instance: any, changes: SimpleChanges): void {
      if (Object.keys(changes).length) {
        instance.ngOnChanges(changes);
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
