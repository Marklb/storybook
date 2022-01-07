import {
  Component,
  ElementRef,
  EventEmitter,
  getPlatform,
  Input,
  NgZone,
  OnChanges,
  Output,
  SimpleChanges,
  TemplateRef,
  ɵresetJitOptions,
} from '@angular/core';
import { platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import dedent from 'ts-dedent';

import { CanvasRenderer } from './CanvasRenderer';
import { AbstractRenderer } from './AbstractRenderer';

jest.mock('@angular/platform-browser-dynamic');

declare const document: Document;

// TODO: Repeat these tests for each of the following:
//   - Without template
//     - Normal component
//     - Component with multiple selectors
//     - Component with attribute only selector (This could introduce Directive
//       support)
//     - Component without a selector
//   - With template
//     - Normal component
//     - Component with multiple selectors
//     - Component with attribute only selector (This could introduce Directive
//       support)
//     - Component without a selector
//     - Multiple of the component in the same template
//     - Component in *ngIf
//     - Component with component as child
//
// TODO: Is ngOnChanges called at the right time/order?
//
// TODO: When a bound prop is removed should the story be fully recreated, since
// template binding can't be removed?

describe('StorybookWrapperComponent', () => {
  let rendererService: AbstractRenderer;
  let root: HTMLElement;
  let ngOnChangesSpy: jest.SpyInstance<void, [SimpleChanges]>;
  let fnInpSetSpy: jest.SpyInstance<void, [string]>;
  let somethingSpy: jest.SpyInstance<void, [string]>;
  let data: Parameters<AbstractRenderer['render']>[0];

  const setProps = async (props: typeof data['storyFnAngular']['props']): Promise<void> => {
    data.storyFnAngular.props = props;
    await rendererService.render(data);
  };

  const setTemplate = (template: string): void => {
    data.storyFnAngular.template = template;
  };

  beforeEach(async () => {
    ngOnChangesSpy = jest.spyOn(FooComponent.prototype, 'ngOnChanges');
    fnInpSetSpy = jest.spyOn(FooComponent.prototype, 'fnInp', 'set');
    somethingSpy = jest.spyOn(FooComponent.prototype, 'something');

    root = createRootElement();
    document.body.appendChild(root);
    (platformBrowserDynamic as any).mockImplementation(platformBrowserDynamicTesting);
    rendererService = new CanvasRenderer('storybook-wrapper');

    data = {
      storyFnAngular: {
        props: {},
      },
      forced: true,
      parameters: {},
      component: FooComponent,
      targetDOMNode: root,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();

    // Necessary to avoid this error "Provided value for `preserveWhitespaces` can not be changed once it has been set." :
    // Source: https://github.com/angular/angular/commit/e342ffd855ffeb8af7067b42307ffa320d82177e#diff-92b125e532cc22977b46a91f068d6d7ea81fd61b772842a4a0212f1cfd875be6R28
    ɵresetJitOptions();

    document.body.innerHTML = '';
  });

  describe('component', () => {
    describe('simple input', () => {
      describe('in inital props', () => {
        it('should set', async () => {
          await setProps({ simpleInp: 'a' });
          expect(getWrapperElement().innerHTML).toBe(
            '<foo ng-reflect-simple-inp="a">[a][][][]</foo><!--container-->'
          );
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            simpleInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'a',
              firstChange: true,
            }),
          });
        });

        it('should not set when prop does not change', async () => {
          await setProps({ simpleInp: 'a' });
          await setProps({ simpleInp: 'a' });
          expect(getWrapperElement().innerHTML).toBe(
            '<foo ng-reflect-simple-inp="a">[a][][][]</foo><!--container-->'
          );
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            simpleInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'a',
              firstChange: true,
            }),
          });
        });

        it('should set when prop changes', async () => {
          await setProps({ simpleInp: 'a' });
          await setProps({ simpleInp: 'b' });
          expect(getWrapperElement().innerHTML).toBe(
            '<foo ng-reflect-simple-inp="b">[b][][][]</foo><!--container-->'
          );
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            simpleInp: expect.objectContaining({
              previousValue: 'a',
              currentValue: 'b',
              firstChange: false,
            }),
          });
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should set', async () => {
          await setProps({ simpleInp: 'a' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[a][][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            simpleInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'a',
              firstChange: true,
            }),
          });
        });

        it('should not set when prop does not change', async () => {
          await setProps({ simpleInp: 'a' });
          await setProps({ simpleInp: 'a' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[a][][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            simpleInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'a',
              firstChange: true,
            }),
          });
        });

        it('should set when prop changes', async () => {
          await setProps({ simpleInp: 'a' });
          await setProps({ simpleInp: 'b' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[b][][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            simpleInp: expect.objectContaining({
              previousValue: 'a',
              currentValue: 'b',
              firstChange: false,
            }),
          });
        });
      });
    });

    // //////////

    describe('metadata input', () => {
      describe('in inital props', () => {
        it('should set', async () => {
          await setProps({ metaInput: 'm' });
          expect(getWrapperElement().innerHTML).toBe(
            '<foo ng-reflect-meta-input="m">[][][][m]</foo><!--container-->'
          );
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            metaInput: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'm',
              firstChange: true,
            }),
          });
        });

        it('should not set when prop does not change', async () => {
          await setProps({ metaInput: 'm' });
          await setProps({ metaInput: 'm' });
          expect(getWrapperElement().innerHTML).toBe(
            '<foo ng-reflect-meta-input="m">[][][][m]</foo><!--container-->'
          );
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            metaInput: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'm',
              firstChange: true,
            }),
          });
        });

        it('should set when prop changes', async () => {
          await setProps({ metaInput: 'm' });
          await setProps({ metaInput: 'n' });
          expect(getWrapperElement().innerHTML).toBe(
            '<foo ng-reflect-meta-input="n">[][][][n]</foo><!--container-->'
          );
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            metaInput: expect.objectContaining({
              previousValue: 'm',
              currentValue: 'n',
              firstChange: false,
            }),
          });
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should set', async () => {
          await setProps({ metaInput: 'm' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][m]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            metaInput: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'm',
              firstChange: true,
            }),
          });
        });

        it('should not set when prop does not change', async () => {
          await setProps({ metaInput: 'm' });
          await setProps({ metaInput: 'm' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][m]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            metaInput: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'm',
              firstChange: true,
            }),
          });
        });

        it('should set when prop changes', async () => {
          await setProps({ metaInput: 'm' });
          await setProps({ metaInput: 'n' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][n]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            metaInput: expect.objectContaining({
              previousValue: 'm',
              currentValue: 'n',
              firstChange: false,
            }),
          });
        });
      });
    });

    // //////////

    describe('renamed input', () => {
      describe('in inital props', () => {
        it('should set', async () => {
          await setProps({ reNamedInp: 'r' });
          expect(getWrapperElement().innerHTML).toBe(
            '<foo ng-reflect-to-re-named-inp="r">[][r][][]</foo><!--container-->'
          );
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            toReNamedInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'r',
              firstChange: true,
            }),
          });
        });

        it('should not set when prop does not change', async () => {
          await setProps({ reNamedInp: 'r' });
          await setProps({ reNamedInp: 'r' });
          expect(getWrapperElement().innerHTML).toBe(
            '<foo ng-reflect-to-re-named-inp="r">[][r][][]</foo><!--container-->'
          );
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            toReNamedInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'r',
              firstChange: true,
            }),
          });
        });

        it('should set when prop changes', async () => {
          await setProps({ reNamedInp: 'r' });
          await setProps({ reNamedInp: 's' });
          expect(getWrapperElement().innerHTML).toBe(
            '<foo ng-reflect-to-re-named-inp="s">[][s][][]</foo><!--container-->'
          );
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            toReNamedInp: expect.objectContaining({
              previousValue: 'r',
              currentValue: 's',
              firstChange: false,
            }),
          });
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should set', async () => {
          await setProps({ reNamedInp: 'r' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][r][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            toReNamedInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'r',
              firstChange: true,
            }),
          });
        });

        it('should not set when prop does not change', async () => {
          await setProps({ reNamedInp: 'r' });
          await setProps({ reNamedInp: 'r' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][r][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            toReNamedInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'r',
              firstChange: true,
            }),
          });
        });

        it('should set when prop changes', async () => {
          await setProps({ reNamedInp: 'r' });
          await setProps({ reNamedInp: 's' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][s][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            toReNamedInp: expect.objectContaining({
              previousValue: 'r',
              currentValue: 's',
              firstChange: false,
            }),
          });
        });
      });
    });

    // //////////

    describe('getter/setter input', () => {
      describe('in inital props', () => {
        it('should set', async () => {
          await setProps({ fnInp: 'f' });
          expect(getWrapperElement().innerHTML).toBe(
            '<foo ng-reflect-fn-inp="f">[][][f][]</foo><!--container-->'
          );
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            fnInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'f',
              firstChange: true,
            }),
          });
          expect(somethingSpy).toBeCalledTimes(1);
          expect(somethingSpy).toBeCalledWith('f');
        });

        it('should not set when prop does not change', async () => {
          await setProps({ fnInp: 'f' });
          await setProps({ fnInp: 'f' });
          expect(getWrapperElement().innerHTML).toBe(
            '<foo ng-reflect-fn-inp="f">[][][f][]</foo><!--container-->'
          );
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            fnInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'f',
              firstChange: true,
            }),
          });
          expect(somethingSpy).toBeCalledTimes(1);
          expect(somethingSpy).toBeCalledWith('f');
        });

        it('should set when prop changes', async () => {
          await setProps({ fnInp: 'f' });
          await setProps({ fnInp: 'g' });
          expect(getWrapperElement().innerHTML).toBe(
            '<foo ng-reflect-fn-inp="g">[][][g][]</foo><!--container-->'
          );
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            fnInp: expect.objectContaining({
              previousValue: 'f',
              currentValue: 'g',
              firstChange: false,
            }),
          });
          expect(somethingSpy).toBeCalledTimes(2);
          expect(somethingSpy).toBeCalledWith('g');
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should set', async () => {
          await setProps({ fnInp: 'f' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][f][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            fnInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'f',
              firstChange: true,
            }),
          });
          expect(somethingSpy).toBeCalledTimes(1);
          expect(somethingSpy).toBeCalledWith('f');
        });

        it('should not set when prop does not change', async () => {
          await setProps({ fnInp: 'f' });
          await setProps({ fnInp: 'f' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][f][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            fnInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'f',
              firstChange: true,
            }),
          });
          expect(somethingSpy).toBeCalledTimes(1);
          expect(somethingSpy).toBeCalledWith('f');
        });

        it('should set when prop changes', async () => {
          await setProps({ fnInp: 'f' });
          await setProps({ fnInp: 'g' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][g][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            fnInp: expect.objectContaining({
              previousValue: 'f',
              currentValue: 'g',
              firstChange: false,
            }),
          });
          expect(somethingSpy).toBeCalledTimes(2);
          expect(somethingSpy).toBeCalledWith('g');
        });
      });
    });

    // //////////

    describe('non-input input', () => {
      describe('in inital props', () => {
        it('should set', async () => {
          await setProps({ misc: 'x' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]x</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not set when prop does not change', async () => {
          await setProps({ misc: 'x' });
          await setProps({ misc: 'x' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]x</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should set when prop changes', async () => {
          await setProps({ misc: 'x' });
          await setProps({ misc: 'y' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]y</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should set', async () => {
          await setProps({ misc: 'x' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]x</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not set when prop does not change', async () => {
          await setProps({ misc: 'x' });
          await setProps({ misc: 'x' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]x</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should set when prop changes', async () => {
          await setProps({ misc: 'x' });
          await setProps({ misc: 'y' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]y</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });
    });

    // //////////

    describe('simple output', () => {
      describe('in inital props', () => {
        it('should emit', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ simpleOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('simpleOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not subscribe again when prop does not change', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ simpleOut: outSpy });
          await setProps({ simpleOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('simpleOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should unsubscribe previous when prop changes', async () => {
          const outSpy = createOutputPropSpy();
          const outSpy2 = createOutputPropSpy();
          await setProps({ simpleOut: outSpy });
          await setProps({ simpleOut: outSpy2 });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('simpleOut', eventData);
          expect(outSpy).toBeCalledTimes(0);
          expect(outSpy2).toBeCalledTimes(1);
          expect(outSpy2).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should emit', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ simpleOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('simpleOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not subscribe again when prop does not change', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ simpleOut: outSpy });
          await setProps({ simpleOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('simpleOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should unsubscribe previous when prop changes', async () => {
          const outSpy = createOutputPropSpy();
          const outSpy2 = createOutputPropSpy();
          await setProps({ simpleOut: outSpy });
          await setProps({ simpleOut: outSpy2 });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('simpleOut', eventData);
          expect(outSpy).toBeCalledTimes(0);
          expect(outSpy2).toBeCalledTimes(1);
          expect(outSpy2).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });
    });

    // //////////

    describe('metadata output', () => {
      describe('in inital props', () => {
        it('should emit', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ metaOutput: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('metaOutput', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not subscribe again when prop does not change', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ metaOutput: outSpy });
          await setProps({ metaOutput: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('metaOutput', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should unsubscribe previous when prop changes', async () => {
          const outSpy = createOutputPropSpy();
          const outSpy2 = createOutputPropSpy();
          await setProps({ metaOutput: outSpy });
          await setProps({ metaOutput: outSpy2 });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('metaOutput', eventData);
          expect(outSpy).toBeCalledTimes(0);
          expect(outSpy2).toBeCalledTimes(1);
          expect(outSpy2).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should emit', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ metaOutput: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('metaOutput', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not subscribe again when prop does not change', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ metaOutput: outSpy });
          await setProps({ metaOutput: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('metaOutput', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should unsubscribe previous when prop changes', async () => {
          const outSpy = createOutputPropSpy();
          const outSpy2 = createOutputPropSpy();
          await setProps({ metaOutput: outSpy });
          await setProps({ metaOutput: outSpy2 });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('metaOutput', eventData);
          expect(outSpy).toBeCalledTimes(0);
          expect(outSpy2).toBeCalledTimes(1);
          expect(outSpy2).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });
    });

    // //////////

    describe('renamed output', () => {
      describe('in inital props', () => {
        it('should emit', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ reNamedOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('toReNamedOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not subscribe again when prop does not change', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ reNamedOut: outSpy });
          await setProps({ reNamedOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('toReNamedOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should unsubscribe previous when prop changes', async () => {
          const outSpy = createOutputPropSpy();
          const outSpy2 = createOutputPropSpy();
          await setProps({ reNamedOut: outSpy });
          await setProps({ reNamedOut: outSpy2 });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('toReNamedOut', eventData);
          expect(outSpy).toBeCalledTimes(0);
          expect(outSpy2).toBeCalledTimes(1);
          expect(outSpy2).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should emit', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ reNamedOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('toReNamedOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not subscribe again when prop does not change', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ reNamedOut: outSpy });
          await setProps({ reNamedOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('toReNamedOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should unsubscribe previous when prop changes', async () => {
          const outSpy = createOutputPropSpy();
          const outSpy2 = createOutputPropSpy();
          await setProps({ reNamedOut: outSpy });
          await setProps({ reNamedOut: outSpy2 });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('toReNamedOut', eventData);
          expect(outSpy).toBeCalledTimes(0);
          expect(outSpy2).toBeCalledTimes(1);
          expect(outSpy2).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });
    });
  });

  describe('template', () => {
    beforeEach(() => {
      data.storyFnAngular.template = `<foo></foo>`;
    });

    describe('simple input', () => {
      describe('in inital props', () => {
        it('should set', async () => {
          await setProps({ simpleInp: 'a' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[a][][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            simpleInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'a',
              firstChange: true,
            }),
          });
        });

        it('should not set when prop does not change', async () => {
          await setProps({ simpleInp: 'a' });
          await setProps({ simpleInp: 'a' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[a][][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            simpleInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'a',
              firstChange: true,
            }),
          });
        });

        it('should set when prop changes', async () => {
          await setProps({ simpleInp: 'a' });
          await setProps({ simpleInp: 'b' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[b][][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            simpleInp: expect.objectContaining({
              previousValue: 'a',
              currentValue: 'b',
              firstChange: false,
            }),
          });
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should set', async () => {
          await setProps({ simpleInp: 'a' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[a][][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            simpleInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'a',
              firstChange: true,
            }),
          });
        });

        it('should not set when prop does not change', async () => {
          await setProps({ simpleInp: 'a' });
          await setProps({ simpleInp: 'a' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[a][][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            simpleInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'a',
              firstChange: true,
            }),
          });
        });

        it('should set when prop changes', async () => {
          await setProps({ simpleInp: 'a' });
          await setProps({ simpleInp: 'b' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[b][][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            simpleInp: expect.objectContaining({
              previousValue: 'a',
              currentValue: 'b',
              firstChange: false,
            }),
          });
        });
      });
    });

    // //////////

    describe('metadata input', () => {
      describe('in inital props', () => {
        it('should set', async () => {
          await setProps({ metaInput: 'm' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][m]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            metaInput: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'm',
              firstChange: true,
            }),
          });
        });

        it('should not set when prop does not change', async () => {
          await setProps({ metaInput: 'm' });
          await setProps({ metaInput: 'm' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][m]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            metaInput: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'm',
              firstChange: true,
            }),
          });
        });

        it('should set when prop changes', async () => {
          await setProps({ metaInput: 'm' });
          await setProps({ metaInput: 'n' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][n]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            metaInput: expect.objectContaining({
              previousValue: 'm',
              currentValue: 'n',
              firstChange: false,
            }),
          });
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should set', async () => {
          await setProps({ metaInput: 'm' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][m]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            metaInput: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'm',
              firstChange: true,
            }),
          });
        });

        it('should not set when prop does not change', async () => {
          await setProps({ metaInput: 'm' });
          await setProps({ metaInput: 'm' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][m]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            metaInput: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'm',
              firstChange: true,
            }),
          });
        });

        it('should set when prop changes', async () => {
          await setProps({ metaInput: 'm' });
          await setProps({ metaInput: 'n' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][n]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            metaInput: expect.objectContaining({
              previousValue: 'm',
              currentValue: 'n',
              firstChange: false,
            }),
          });
        });
      });
    });

    // //////////

    describe('renamed input', () => {
      describe('in inital props', () => {
        it('should set', async () => {
          await setProps({ reNamedInp: 'r' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][r][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            toReNamedInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'r',
              firstChange: true,
            }),
          });
        });

        it('should not set when prop does not change', async () => {
          await setProps({ reNamedInp: 'r' });
          await setProps({ reNamedInp: 'r' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][r][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            toReNamedInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'r',
              firstChange: true,
            }),
          });
        });

        it('should set when prop changes', async () => {
          await setProps({ reNamedInp: 'r' });
          await setProps({ reNamedInp: 's' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][s][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            toReNamedInp: expect.objectContaining({
              previousValue: 'r',
              currentValue: 's',
              firstChange: false,
            }),
          });
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should set', async () => {
          await setProps({ reNamedInp: 'r' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][r][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            toReNamedInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'r',
              firstChange: true,
            }),
          });
        });

        it('should not set when prop does not change', async () => {
          await setProps({ reNamedInp: 'r' });
          await setProps({ reNamedInp: 'r' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][r][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            toReNamedInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'r',
              firstChange: true,
            }),
          });
        });

        it('should set when prop changes', async () => {
          await setProps({ reNamedInp: 'r' });
          await setProps({ reNamedInp: 's' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][s][][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            toReNamedInp: expect.objectContaining({
              previousValue: 'r',
              currentValue: 's',
              firstChange: false,
            }),
          });
        });
      });
    });

    // //////////

    describe('getter/setter input', () => {
      describe('in inital props', () => {
        it('should set', async () => {
          await setProps({ fnInp: 'f' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][f][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            fnInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'f',
              firstChange: true,
            }),
          });
          expect(somethingSpy).toBeCalledTimes(1);
          expect(somethingSpy).toBeCalledWith('f');
        });

        it('should not set when prop does not change', async () => {
          await setProps({ fnInp: 'f' });
          await setProps({ fnInp: 'f' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][f][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            fnInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'f',
              firstChange: true,
            }),
          });
          expect(somethingSpy).toBeCalledTimes(1);
          expect(somethingSpy).toBeCalledWith('f');
        });

        it('should set when prop changes', async () => {
          await setProps({ fnInp: 'f' });
          await setProps({ fnInp: 'g' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][g][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            fnInp: expect.objectContaining({
              previousValue: 'f',
              currentValue: 'g',
              firstChange: false,
            }),
          });
          expect(somethingSpy).toBeCalledTimes(2);
          expect(somethingSpy).toBeCalledWith('g');
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should set', async () => {
          await setProps({ fnInp: 'f' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][f][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            fnInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'f',
              firstChange: true,
            }),
          });
          expect(somethingSpy).toBeCalledTimes(1);
          expect(somethingSpy).toBeCalledWith('f');
        });

        it('should not set when prop does not change', async () => {
          await setProps({ fnInp: 'f' });
          await setProps({ fnInp: 'f' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][f][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(1);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            fnInp: expect.objectContaining({
              previousValue: undefined,
              currentValue: 'f',
              firstChange: true,
            }),
          });
          expect(somethingSpy).toBeCalledTimes(1);
          expect(somethingSpy).toBeCalledWith('f');
        });

        it('should set when prop changes', async () => {
          await setProps({ fnInp: 'f' });
          await setProps({ fnInp: 'g' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][g][]</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(2);
          expect(ngOnChangesSpy).toHaveBeenCalledWith({
            fnInp: expect.objectContaining({
              previousValue: 'f',
              currentValue: 'g',
              firstChange: false,
            }),
          });
          expect(somethingSpy).toBeCalledTimes(2);
          expect(somethingSpy).toBeCalledWith('g');
        });
      });
    });

    // //////////

    describe('non-input props', () => {
      describe('in inital props', () => {
        it('should set', async () => {
          await setProps({ misc: 'x' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]x</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not set when prop does not change', async () => {
          await setProps({ misc: 'x' });
          await setProps({ misc: 'x' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]x</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should set when prop changes', async () => {
          await setProps({ misc: 'x' });
          await setProps({ misc: 'y' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]y</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });
      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should set', async () => {
          await setProps({ misc: 'x' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]x</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not set when prop does not change', async () => {
          await setProps({ misc: 'x' });
          await setProps({ misc: 'x' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]x</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should set when prop changes', async () => {
          await setProps({ misc: 'x' });
          await setProps({ misc: 'y' });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]y</foo><!--container-->');
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });
    });

    // //////////

    describe('simple output', () => {
      describe('in inital props', () => {
        it('should emit', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ simpleOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('simpleOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not subscribe again when prop does not change', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ simpleOut: outSpy });
          await setProps({ simpleOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('simpleOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should unsubscribe previous when prop changes', async () => {
          const outSpy = createOutputPropSpy();
          const outSpy2 = createOutputPropSpy();
          await setProps({ simpleOut: outSpy });
          await setProps({ simpleOut: outSpy2 });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('simpleOut', eventData);
          expect(outSpy).toBeCalledTimes(0);
          expect(outSpy2).toBeCalledTimes(1);
          expect(outSpy2).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should emit', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ simpleOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('simpleOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not subscribe again when prop does not change', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ simpleOut: outSpy });
          await setProps({ simpleOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('simpleOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should unsubscribe previous when prop changes', async () => {
          const outSpy = createOutputPropSpy();
          const outSpy2 = createOutputPropSpy();
          await setProps({ simpleOut: outSpy });
          await setProps({ simpleOut: outSpy2 });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('simpleOut', eventData);
          expect(outSpy).toBeCalledTimes(0);
          expect(outSpy2).toBeCalledTimes(1);
          expect(outSpy2).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });
    });

    // //////////

    describe('metadata output', () => {
      describe('in inital props', () => {
        it('should emit', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ metaOutput: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('metaOutput', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not subscribe again when prop does not change', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ metaOutput: outSpy });
          await setProps({ metaOutput: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('metaOutput', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should unsubscribe previous when prop changes', async () => {
          const outSpy = createOutputPropSpy();
          const outSpy2 = createOutputPropSpy();
          await setProps({ metaOutput: outSpy });
          await setProps({ metaOutput: outSpy2 });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('metaOutput', eventData);
          expect(outSpy).toBeCalledTimes(0);
          expect(outSpy2).toBeCalledTimes(1);
          expect(outSpy2).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should emit', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ metaOutput: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('metaOutput', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not subscribe again when prop does not change', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ metaOutput: outSpy });
          await setProps({ metaOutput: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('metaOutput', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should unsubscribe previous when prop changes', async () => {
          const outSpy = createOutputPropSpy();
          const outSpy2 = createOutputPropSpy();
          await setProps({ metaOutput: outSpy });
          await setProps({ metaOutput: outSpy2 });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('metaOutput', eventData);
          expect(outSpy).toBeCalledTimes(0);
          expect(outSpy2).toBeCalledTimes(1);
          expect(outSpy2).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });
    });

    // //////////

    describe('renamed output', () => {
      describe('in inital props', () => {
        it('should emit', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ reNamedOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('toReNamedOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not subscribe again when prop does not change', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ reNamedOut: outSpy });
          await setProps({ reNamedOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('toReNamedOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should unsubscribe previous when prop changes', async () => {
          const outSpy = createOutputPropSpy();
          const outSpy2 = createOutputPropSpy();
          await setProps({ reNamedOut: outSpy });
          await setProps({ reNamedOut: outSpy2 });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('toReNamedOut', eventData);
          expect(outSpy).toBeCalledTimes(0);
          expect(outSpy2).toBeCalledTimes(1);
          expect(outSpy2).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });

      describe('not in inital props', () => {
        beforeEach(async () => {
          await setProps({});
        });

        it('should emit', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ reNamedOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('toReNamedOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should not subscribe again when prop does not change', async () => {
          const outSpy = createOutputPropSpy();
          await setProps({ reNamedOut: outSpy });
          await setProps({ reNamedOut: outSpy });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('toReNamedOut', eventData);
          expect(outSpy).toBeCalledTimes(1);
          expect(outSpy).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });

        it('should unsubscribe previous when prop changes', async () => {
          const outSpy = createOutputPropSpy();
          const outSpy2 = createOutputPropSpy();
          await setProps({ reNamedOut: outSpy });
          await setProps({ reNamedOut: outSpy2 });
          expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
          const eventData = { a: 'b' };
          emitOutput('toReNamedOut', eventData);
          expect(outSpy).toBeCalledTimes(0);
          expect(outSpy2).toBeCalledTimes(1);
          expect(outSpy2).toBeCalledWith(eventData);
          expect(ngOnChangesSpy).toBeCalledTimes(0);
        });
      });
    });

    // //////////

    // it('should set inputs when component conditionally renders', async () => {
    //   setTemplate(`<ng-container *ngIf="active"><foo></foo><ng-container>`);
    //   // setTemplate(`<ng-container *ngIf="active"><foo [fnInp]="fnInp"></foo><ng-container>`);
    //   // await setProps({ fnInp: 'f' });
    //   await setProps({ fnInp: 'f', active: true });
    //   // expect(getWrapperElement().innerHTML).toBe(`<!--bindings={}-->`);
    //   await setProps({ fnInp: 'b', active: true });
    //   expect(getWrapperElement().innerHTML).toBe(
    //     // dedent`<foo>[][][][]</foo><!--ng-container--><!--ng-container--><!--bindings={
    //     //         "ng-reflect-ng-if": "true"
    //     //       }-->`
    //     dedent`<foo ng-reflect-fn-inp="b">[][][b][]</foo><!--ng-container--><!--bindings={
    //             "ng-reflect-ng-if": "true"
    //           }-->`
    //   );
    //   // expect(ngOnChangesSpy).toBeCalledTimes(1);
    //   expect(somethingSpy).toBeCalledTimes(1);
    // });

    // it('should set getter/setter input t', async () => {
    //   setTemplate(`<foo [fnInp]="fnInp"></foo>`);
    //   await setProps({ fnInp: 'f' });
    //   // expect(getWrapperElement().innerHTML).toBe('<foo>[][][f][]</foo><!--container-->');
    //   expect(getWrapperElement().innerHTML).toBe('<foo ng-reflect-fn-inp="f">[][][f][]</foo><!--container-->');
    //   // expect(ngOnChangesSpy).toBeCalledTimes(1);
    //   expect(somethingSpy).toBeCalledTimes(1);
    // });
  });

  describe('component initially not rendered in template', () => {
    beforeEach(() => {
      data.storyFnAngular.template = `<ng-container *ngIf="isVisible"><foo></foo></ng-container>`;
    });

    describe('with input prop', () => {
      describe('in initial props', () => {
        it('should render', async () => {
          await setProps({ simpleInp: 'a' });
          expect(getWrapperElement().innerHTML).toBe('<!--bindings={}-->');
          await setProps({ simpleInp: 'a', isVisible: true });
          expect(getWrapperElement().innerHTML).toBe(
            dedent`<foo>[a][][][]</foo><!--container--><!--ng-container--><!--bindings={
              "ng-reflect-ng-if": "true"
            }-->`
          );
        });
      });

      describe('not in initial props', () => {
        it('should render', async () => {
          await setProps({});
          expect(getWrapperElement().innerHTML).toBe('<!--bindings={}-->');
          await setProps({ isVisible: true, simpleInp: 'a' });
          expect(getWrapperElement().innerHTML).toBe(
            dedent`<foo>[a][][][]</foo><!--container--><!--ng-container--><!--bindings={
              "ng-reflect-ng-if": "true"
            }-->`
          );
        });
      });
    });
  });
});

function emitOutput(outputPropName: string, data: any): void {
  // eslint-disable-next-line no-underscore-dangle
  (getWrapperElement().querySelector('foo') as any).__testTrigger(outputPropName, data);
}

// function buildNgReflectBindingStr(propName: string, value: any): string {
//   // Simple came case to dash case. Doesn't handle all camel case string formats.
//   const name = !propName
//     ? null
//     : propName.replace(/([A-Z])/g, (g) => {
//         return `-${g[0].toLowerCase()}`;
//       });

//   return `ng-reflect-${name}="${value}"`;
// }

// function buildTemplate(props: { [name: string]: any }, addBindings = false): string {
//   let bindingsStr = '';
//   if (addBindings) {
//     const bindingStrs = Object.keys(props).map((key) => {
//       return buildNgReflectBindingStr(key, props[key]);
//     });
//     bindingsStr = bindingStrs.length === 0 ? '' : ` ${bindingStrs.join(' ')}`;
//   }
//   return `[{{simpleInp}}][{{toReNamedInp}}][{{fnInp}}][{{metaInput}}]{{misc}}`;
// }

@Component({
  selector: 'foo',
  template: '[{{simpleInp}}][{{toReNamedInp}}][{{fnInp}}][{{metaInput}}]{{misc}}',
  inputs: ['metaInput'],
  outputs: ['metaOutput'],
})
class FooComponent implements OnChanges {
  @Input() simpleInp: string | undefined | null;

  @Input('reNamedInp') toReNamedInp: string | undefined | null;

  @Input()
  get fnInp(): string | undefined | null {
    return this.thingInpValue;
  }

  set fnInp(value: string | undefined | null) {
    this.thingInpValue = value;
    this.something(value);
  }

  thingInpValue: string | undefined | null;

  metaInput: boolean | undefined | null;

  metaOutput = new EventEmitter<boolean>();

  @Output() simpleOut = new EventEmitter<boolean>();

  @Output('reNamedOut') toReNamedOut = new EventEmitter<boolean>();

  constructor(private readonly elementRef: ElementRef, private readonly ngZone: NgZone) {
    // eslint-disable-next-line no-underscore-dangle
    this.elementRef.nativeElement.__testTrigger = (outputPropName: string, data: any) => {
      const out = (this as any)[outputPropName];
      this.ngZone.run(() => {
        out.emit(data);
      });
    };
  }

  ngOnChanges(changes: SimpleChanges) {}

  something(val: string | undefined | null) {}
}

function createRootElement(): HTMLElement {
  const root = document.createElement('div');
  root.id = 'root';
  return root;
}

function getWrapperElement(): Element {
  return document.body.getElementsByTagName('storybook-wrapper')[0];
}

function createOutputPropSpy(): jest.Mock<any, any> {
  return jest.fn((e) => {
    // Storybook should bind outputs in NgZone.
    expect(NgZone.isInAngularZone()).toBe(true);
    return e;
  });
}
