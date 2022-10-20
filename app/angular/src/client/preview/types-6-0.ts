import {
  Args,
  Parameters as DefaultParameters,
  StoryContext as DefaultStoryContext,
  ComponentAnnotations,
  StoryAnnotations,
  AnnotatedStoryFn,
} from '@storybook/csf';

import { StoryFnAngularReturnType } from './types';

export type { Args, ArgTypes } from '@storybook/csf';

export type AngularFramework = {
  component: any;
  storyResult: StoryFnAngularReturnType;
};

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/formats/component-story-format/#default-export)
 */
export type Meta<TArgs = Args> = ComponentAnnotations<AngularFramework, TArgs>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/formats/component-story-format/#named-story-exports)
 */
export type StoryFn<TArgs = Args> = AnnotatedStoryFn<AngularFramework, TArgs>;

/**
 * Story function that represents a CSFv3 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/formats/component-story-format/#named-story-exports)
 */
export type StoryObj<TArgs = Args> = StoryAnnotations<AngularFramework, TArgs>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/formats/component-story-format/#named-story-exports)
 *
 * NOTE that in Storybook 7.0, this type will be renamed to `StoryFn` and replaced by the current `StoryObj` type.
 *
 */
export type Story<TArgs = Args> = StoryFn<TArgs>;

export type Parameters = DefaultParameters & {
  /** Uses legacy angular rendering engine that use dynamic component */
  angularLegacyRendering?: boolean;
  bootstrapModuleOptions?: unknown;
  /**
   * Toggle property updates for properties that are not bound in the template.
   *
   * By default, props changes for properties without a binding will be set on
   * the component instance in a way that input property changes will be in
   * ngOnChanges. Setting this to false will disable setting any properties or
   * subscribing to any output properties, unless they are bound in the
   * template.
   *
   * @default true
   */
  emulatePropBindingIfNotTemplateBound?: boolean;
  /**
   * Toggle setting properties on the component instance that are not an input.
   *
   * @default true
   */
  setNonInputOutputProperties?: boolean;
};

export type StoryContext = DefaultStoryContext<AngularFramework> & { parameters: Parameters };
