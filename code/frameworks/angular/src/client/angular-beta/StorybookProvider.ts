import { Provider, NgZone } from '@angular/core';
import { Subject, Subscriber, Observable } from 'rxjs';
import { ICollection, Parameters } from '../types';
import { STORY_PARAMETERS, STORY_PROPS } from './InjectionTokens';

export const storyPropsProvider = (storyProps$: Subject<ICollection | undefined>): Provider => ({
  provide: STORY_PROPS,
  useFactory: storyDataFactory(storyProps$.asObservable()),
  deps: [NgZone],
});

export const storyParametersProvider = (storyParameters: Parameters | undefined): Provider => ({
  provide: STORY_PARAMETERS,
  useValue: storyParameters,
});

function storyDataFactory<T>(data: Observable<T>) {
  return (ngZone: NgZone) =>
    new Observable((subscriber: Subscriber<T>) => {
      const sub = data.subscribe(
        (v: T) => {
          ngZone.run(() => subscriber.next(v));
        },
        (err) => {
          ngZone.run(() => subscriber.error(err));
        },
        () => {
          ngZone.run(() => subscriber.complete());
        }
      );

      return () => {
        sub.unsubscribe();
      };
    });
}
