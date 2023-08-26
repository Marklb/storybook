import {
  Component,
  Inject,
  NgModule,
  OnDestroy,
  OnInit,
  Type,
  forwardRef,
  inject,
} from '@angular/core';
import { Observable, Subscription } from 'rxjs';

import { ICollection, NgModuleMetadata } from '../types';
import { STORY_PROPS, STORY_WRAPPER_COMPONENT } from './InjectionTokens';
import { PropertyExtractor } from './utils/PropertyExtractor';

// component modules cache
export const componentNgModules = new Map<any, Type<any>>();

/**
 * Wraps the story template into a component
 */
export const createStorybookWrapperComponent = ({
  selector,
  template,
  storyComponent,
  storyDirective,
  styles,
  moduleMetadata,
  initialProps,
  analyzedMetadata,
}: {
  selector: string;
  template: string;
  storyComponent: Type<unknown> | undefined;
  storyDirective: Type<unknown> | undefined;
  styles: string[];
  moduleMetadata: NgModuleMetadata;
  initialProps?: ICollection;
  analyzedMetadata: PropertyExtractor;
}): Type<any> => {
  const { imports, declarations, providers } = analyzedMetadata;

  // Only create a new module if it doesn't already exist
  // This is to prevent the module from being recreated on every story change
  // Declarations & Imports are only added once
  // Providers are added on every story change to allow for story-specific providers
  let ngModule = componentNgModules.get(storyComponent);

  if (!ngModule) {
    @NgModule({
      declarations,
      imports,
      exports: [...declarations, ...imports],
    })
    class StorybookComponentModule {}

    componentNgModules.set(storyComponent, StorybookComponentModule);
    ngModule = componentNgModules.get(storyComponent);
  }

  PropertyExtractor.warnImportsModuleWithProviders(analyzedMetadata);

  const componentImports = [ngModule];
  if (storyDirective) {
    componentImports.push(storyDirective);
  }

  @Component({
    selector,
    template,
    standalone: true,
    imports: componentImports,
    providers: [
      ...providers,
      {
        provide: STORY_WRAPPER_COMPONENT,
        useExisting: forwardRef(() => StorybookWrapperComponent),
      },
    ],
    styles,
    schemas: moduleMetadata.schemas,
  })
  class StorybookWrapperComponent implements OnInit, OnDestroy {
    private storyWrapperPropsSubscription = Subscription.EMPTY;

    // Used in case of a component without selector
    storyComponent = storyComponent ?? '';

    private readonly storyProps$: Observable<ICollection | undefined> = inject(STORY_PROPS);

    // constructor(
    //   @Inject(STORY_PROPS) private readonly storyProps$: Observable<ICollection | undefined>
    // ) {}

    ngOnInit(): void {
      // Subscribes to the observable storyProps$ to keep these properties up to date
      this.storyWrapperPropsSubscription = this.storyProps$.subscribe((storyProps = {}) => {
        // All props are added as component properties, so they can be used in
        // the template binding context.
        Object.assign(this, storyProps);
      });
    }

    ngOnDestroy(): void {
      this.storyWrapperPropsSubscription.unsubscribe();
    }
  }
  return StorybookWrapperComponent;
};
