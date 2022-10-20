import { Component, forwardRef, Inject, OnDestroy, OnInit, Type } from '@angular/core';
import { Subscription, Observable } from 'rxjs';

import { ICollection } from '../types';
import { STORY_PROPS, STORY_WRAPPER_COMPONENT } from './InjectionTokens';

/**
 * Wraps the story template into a component
 */
export const createStorybookWrapperComponent = (
  selector: string,
  template: string,
  storyComponent: Type<unknown> | undefined,
  styles: string[]
): Type<any> => {
  @Component({
    selector,
    template,
    styles,
    providers: [
      {
        provide: STORY_WRAPPER_COMPONENT,
        // tslint:disable-next-line: no-use-before-declare
        useExisting: forwardRef(() => StorybookWrapperComponent),
      },
    ],
  })
  class StorybookWrapperComponent implements OnInit, OnDestroy {
    private storyWrapperPropsSubscription = Subscription.EMPTY;

    // Used in case of a component without selector
    storyComponent = storyComponent ?? '';

    // eslint-disable-next-line no-useless-constructor
    constructor(
      @Inject(STORY_PROPS) private readonly storyProps$: Observable<ICollection | undefined>
    ) {}

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
