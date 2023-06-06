import { InjectionToken, Type } from '@angular/core';
import { Subject } from 'rxjs';

import { ICollection, Parameters } from '../types';

/**
 * Used to access the story's Props from an injector.
 */
export const STORY_PROPS = new InjectionToken<Subject<ICollection | undefined>>('STORY_PROPS');

/**
 * Used to access the story's Parameters from an injector.
 */
export const STORY_PARAMETERS = new InjectionToken<Parameters>('STORY_PARAMETERS');

/**
 * The story's wrapper component is created in a function, so there isn't a type
 * to export. This token can be used instead to get the wrapper component
 * instance from an injector.
 */
export const STORY_WRAPPER_COMPONENT = new InjectionToken<Type<unknown>>('STORY_WRAPPER_COMPONENT');

/**
 * The story's props directive is created in a function, so there isn't a type
 * to export. This token can be used instead to get the directive instance from
 * an injector.
 */
export const STORY_PROPS_DIRECTIVE = new InjectionToken<Type<unknown>>('STORY_PROPS_DIRECTIVE');
