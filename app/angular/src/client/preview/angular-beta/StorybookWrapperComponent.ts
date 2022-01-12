import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  forwardRef,
  Inject,
  InjectionToken,
  KeyValueDiffers,
  OnDestroy,
  OnInit,
  Type,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { map, skip, tap } from 'rxjs/operators';

import { ICollection } from '../types';
import { Parameters } from '../types-6-0';
import { STORY_PROPS } from './StorybookProvider';
import { ComponentInputsOutputs, getComponentInputsOutputs } from './utils/NgComponentAnalyzer';

export type StoryWrapper = {
  registerPropsDirectiveInstance(instance: any): boolean;
  unregisterPropsDirectiveInstance(instance: any): void;
};

export const STORY_WRAPPER = new InjectionToken<StoryWrapper>('STORY_WRAPPER');
export const STORY_PARAMETERS = new InjectionToken<Parameters>('STORY_PARAMETERS');
export const STORY_INITAL_PROPS = new InjectionToken<ICollection>('STORY_INITAL_PROPS');

const getNonInputsOutputsProps = (
  ngComponentInputsOutputs: ComponentInputsOutputs,
  props: ICollection = {}
) => {
  const inputs = ngComponentInputsOutputs.inputs
    .filter((i) => i.templateName in props)
    .map((i) => i.templateName);
  const outputs = ngComponentInputsOutputs.outputs
    .filter((o) => o.templateName in props)
    .map((o) => o.templateName);
  return Object.keys(props).filter((k) => ![...inputs, ...outputs].includes(k));
};

/**
 * Wraps the story template into a component
 *
 * @param storyComponent
 * @param initialProps
 */
export const createStorybookWrapperComponent = (
  selector: string,
  template: string,
  storyComponent: Type<unknown> | undefined,
  styles: string[],
  initialProps?: ICollection,
  parameters: Parameters = {}
): Type<any> => {
  // In ivy, a '' selector is not allowed, therefore we need to just set it to anything if
  // storyComponent was not provided.
  const viewChildSelector = storyComponent ?? '__storybook-noop';

  // const isTemplateStory = !!template;

  @Component({
    selector,
    template,
    styles,
    providers: [
      {
        provide: STORY_WRAPPER,
        // tslint:disable-next-line: no-use-before-declare
        useExisting: forwardRef(() => StorybookWrapperComponent),
      },
      {
        provide: STORY_PARAMETERS,
        useValue: parameters,
      },
      {
        provide: STORY_INITAL_PROPS,
        useValue: initialProps,
      },
    ],
  })
  class StorybookWrapperComponent implements OnInit, AfterViewInit, OnDestroy, StoryWrapper {
    private storyComponentPropsSubscription: Subscription;

    private storyWrapperPropsSubscription: Subscription;

    private componentInstances: any[] = [];

    @ViewChild(viewChildSelector, { static: true }) storyComponentElementRef: ElementRef;

    @ViewChild(viewChildSelector, { read: ViewContainerRef, static: true })
    storyComponentViewContainerRef: ViewContainerRef;

    // Used in case of a component without selector
    storyComponent = storyComponent ?? '';

    // eslint-disable-next-line no-useless-constructor
    constructor(
      @Inject(STORY_PROPS) private readonly storyProps$: Subject<ICollection | undefined>,
      private readonly changeDetectorRef: ChangeDetectorRef,
      private readonly differs: KeyValueDiffers
    ) {}

    ngOnInit(): void {
      console.log('[StorybookWrapperComponent] ngOnInit');
      // Subscribes to the observable storyProps$ to keep these properties up to date
      this.storyWrapperPropsSubscription = this.storyProps$.subscribe((storyProps = {}) => {
        console.log('[StorybookWrapperComponent] ngOnInit storyProps', storyProps);
        // All props are added as component properties
        Object.assign(this, storyProps);

        this.changeDetectorRef.detectChanges();
        this.changeDetectorRef.markForCheck();
      });
    }

    ngAfterViewInit(): void {
      console.log('ngAfterViewInit');
      // Bind properties to component, if the story have component
      // if (this.storyComponentElementRef) {
      //   const ngComponentInputsOutputs = getComponentInputsOutputs(storyComponent);

      //   const initialOtherProps = getNonInputsOutputsProps(ngComponentInputsOutputs, initialProps);

      //   // Initializes properties that are not Inputs | Outputs
      //   // Allows story props to override local component properties
      //   initialOtherProps.forEach((p) => {
      //     (this.storyComponentElementRef as any)[p] = initialProps[p];
      //   });
      //   // `markForCheck` the component in case this uses changeDetection: OnPush
      //   // And then forces the `detectChanges`
      //   this.storyComponentViewContainerRef.injector.get(ChangeDetectorRef).markForCheck();
      //   this.changeDetectorRef.detectChanges();

      //   // Once target component has been initialized, the storyProps$ observable keeps target component inputs up to date
      //   this.storyComponentPropsSubscription = this.storyProps$
      //     .pipe(
      //       tap(props => {
      //         console.log(props);
      //       }),
      //       // skip(isTemplateStory ? 0 : 1),
      //       skip(0),
      //       map((props) => {
      //         // removes component output in props
      //         const outputsKeyToRemove = ngComponentInputsOutputs.outputs.map(
      //           (o) => o.templateName
      //         );
      //         return Object.entries(props).reduce(
      //           (prev, [key, value]) => ({
      //             ...prev,
      //             ...(!outputsKeyToRemove.includes(key) && {
      //               [key]: value,
      //             }),
      //           }),
      //           {} as ICollection
      //         );
      //       }),
      //       map((props) => {
      //         // In case a component uses an input with `bindingPropertyName` (ex: @Input('name'))
      //         // find the value of the local propName in the component Inputs
      //         // otherwise use the input key
      //         return Object.entries(props).reduce((prev, [propKey, value]) => {
      //           const input = ngComponentInputsOutputs.inputs.find(
      //             (o) => o.templateName === propKey
      //           );

      //           return {
      //             ...prev,
      //             ...(input ? { [input.propName]: value } : { [propKey]: value }),
      //           };
      //         }, {} as ICollection);
      //       })
      //     )
      //     .subscribe((props) => {
      //       // Replace inputs with new ones from props
      //       Object.assign(this.storyComponentElementRef, props);

      //       // `markForCheck` the component in case this uses changeDetection: OnPush
      //       // And then forces the `detectChanges`
      //       this.storyComponentViewContainerRef.injector.get(ChangeDetectorRef).markForCheck();
      //       this.changeDetectorRef.detectChanges();
      //     });
      // }
    }

    ngOnDestroy(): void {
      if (this.storyComponentPropsSubscription != null) {
        this.storyComponentPropsSubscription.unsubscribe();
      }
      if (this.storyWrapperPropsSubscription != null) {
        this.storyWrapperPropsSubscription.unsubscribe();
      }
    }

    /**
     * Tracks the props directive instances.
     *
     * Returns true if this is the first registered instance.
     */
    public registerPropsDirectiveInstance(instance: any): boolean {
      if (this.componentInstances.findIndex((x) => x === instance) === -1) {
        this.componentInstances.push(instance);
      }

      return this.componentInstances.length === 1;
    }

    /**
     * Removes a tracked props directive instance.
     */
    public unregisterPropsDirectiveInstance(instance: any): void {
      this.componentInstances = this.componentInstances.filter((x) => x !== instance);
    }
  }
  return StorybookWrapperComponent;
};
