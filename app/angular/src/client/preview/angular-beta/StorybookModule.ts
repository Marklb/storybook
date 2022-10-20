import { NgModule, Provider, Type } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import dedent from 'ts-dedent';

import { Subject } from 'rxjs';
import deprecate from 'util-deprecate';
import { ICollection, StoryFnAngularReturnType } from '../types';
import { Parameters } from '../types-6-0';
import { storyPropsProvider } from './StorybookProvider';
import { isComponentAlreadyDeclaredInModules } from './utils/NgModulesAnalyzer';
import { isDeclarable } from './utils/NgComponentAnalyzer';
import { createStorybookWrapperComponent } from './StorybookWrapperComponent';
import { computesTemplateFromComponent } from './ComputesTemplateFromComponent';
import { createStorybookWrapperDirective } from './StorybookPropsDirective';
import { STORY_PARAMETERS } from './InjectionTokens';

const deprecatedStoryComponentWarning = deprecate(
  () => {},
  dedent`\`component\` story return value is deprecated, and will be removed in Storybook 7.0.
        Instead, use \`export const default = () => ({ component: AppComponent });\`
        or
        \`\`\`
        export const Primary: Story = () => ({});
        Primary.parameters = { component: AppComponent };
        \`\`\`
        Read more at 
        - https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#deprecated-angular-story-component).
        - https://storybook.js.org/docs/angular/writing-stories/parameters
      `
);

export const getStorybookModuleMetadata = (
  {
    storyFnAngular,
    component: annotatedComponent,
    targetSelector,
  }: {
    storyFnAngular: StoryFnAngularReturnType;
    component?: any;
    targetSelector: string;
  },
  storyProps$: Subject<ICollection>,
  parameters: Parameters = {}
): NgModule => {
  const { component: storyComponent, props, styles, moduleMetadata = {} } = storyFnAngular;
  let { template } = storyFnAngular;

  if (storyComponent) {
    deprecatedStoryComponentWarning();
  }
  const component = storyComponent ?? annotatedComponent;

  const hasTemplate = !hasNoTemplate(template);
  if (!hasTemplate && component) {
    template = computesTemplateFromComponent(component, props, '');
  }

  /**
   * Create a component that wraps generated template and adds props to the
   * template context.
   */
  const ComponentToInject = createStorybookWrapperComponent(
    targetSelector,
    template,
    component,
    styles
  );

  /**
   * Create a directive that shares a selector with the story's component to
   * attach a directive to each instance for updating props.
   */
  const DirectiveToInject = hasNoComponent(component)
    ? null
    : createStorybookWrapperDirective(component, hasTemplate);

  // Look recursively (deep) if the component is not already declared by an import module
  const requiresComponentDeclaration =
    isDeclarable(component) &&
    !isComponentAlreadyDeclaredInModules(
      component,
      moduleMetadata.declarations,
      moduleMetadata.imports
    );

  const storyProviders: Provider[] = [
    storyPropsProvider(storyProps$),
    {
      provide: STORY_PARAMETERS,
      useValue: parameters,
    },
  ];

  return {
    declarations: [
      ...(requiresComponentDeclaration ? [component] : []),
      ComponentToInject,
      ...(DirectiveToInject ? [DirectiveToInject] : []),
      ...(moduleMetadata.declarations ?? []),
    ],
    imports: [BrowserModule, ...(moduleMetadata.imports ?? [])],
    providers: [...storyProviders, ...(moduleMetadata.providers ?? [])],
    entryComponents: [...(moduleMetadata.entryComponents ?? [])],
    schemas: [...(moduleMetadata.schemas ?? [])],
    bootstrap: [ComponentToInject],
  };
};

export const createStorybookModule = (ngModule: NgModule): Type<unknown> => {
  @NgModule(ngModule)
  class StorybookModule {}
  return StorybookModule;
};

function hasNoTemplate(template: string | null | undefined): template is undefined {
  return template === null || template === undefined;
}

function hasNoComponent(component: Type<any> | null | undefined): component is undefined {
  return component === null || component === undefined;
}
