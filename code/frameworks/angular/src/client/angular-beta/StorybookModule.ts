import { Type } from '@angular/core';

import { StoryFnAngularReturnType } from '../types';
import { createStorybookWrapperDirective } from './StorybookPropsDirective';
import { createStorybookWrapperComponent } from './StorybookWrapperComponent';
import { computesTemplateFromComponent } from './ComputesTemplateFromComponent';
import { PropertyExtractor } from './utils/PropertyExtractor';

export const getApplication = ({
  storyFnAngular,
  component,
  targetSelector,
  analyzedMetadata,
}: {
  storyFnAngular: StoryFnAngularReturnType;
  component?: any;
  targetSelector: string;
  analyzedMetadata: PropertyExtractor;
}) => {
  const { props, styles, moduleMetadata = {} } = storyFnAngular;
  let { template } = storyFnAngular;

  const hasTemplate = !hasNoTemplate(template);
  if (!hasTemplate && component) {
    template = computesTemplateFromComponent(component, props, '');
  }

  /**
   * Create a directive that shares a selector with the story's component to
   * attach a directive to each instance for updating props.
   */
  const directiveToInject = hasNoComponent(component)
    ? null
    : createStorybookWrapperDirective(component, hasTemplate);

  /**
   * Create a component that wraps generated template and gives it props
   */
  return createStorybookWrapperComponent({
    moduleMetadata,
    selector: targetSelector,
    template,
    storyComponent: component,
    storyDirective: directiveToInject,
    styles,
    initialProps: props,
    analyzedMetadata,
  });
};

function hasNoTemplate(template: string | null | undefined): template is undefined {
  return template === null || template === undefined;
}

function hasNoComponent(component: Type<any> | null | undefined): component is undefined {
  return component === null || component === undefined;
}
