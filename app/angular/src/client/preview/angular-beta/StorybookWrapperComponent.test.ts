import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  DoCheck,
  ElementRef,
  EventEmitter,
  Inject,
  Injector,
  Input,
  NgZone,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ɵresetJitOptions,
} from '@angular/core';
import { platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { NgComponentOutlet } from '@angular/common';
import dedent from 'ts-dedent';

import { addons, mockChannel } from '@storybook/addons';

import { CanvasRenderer } from './CanvasRenderer';
import { AbstractRenderer } from './AbstractRenderer';
import {
  getComponentDecoratorMetadata,
  getComponentInputsOutputs,
} from './utils/NgComponentAnalyzer';
import { STORY_PROPS_DIRECTIVE } from './InjectionTokens';
import { DocsRenderer } from './DocsRenderer';
import { RendererFactory } from './RendererFactory';

jest.mock('@angular/platform-browser-dynamic');

// jest.mock('@storybook/addons');

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
//
// TODO: Test that inputs/outputs/ngOnChanges work with inheritance.
//
// TODO: Try to support pipes.
//   - Allow as the component and use it on an empty template ex: `{{ prop |
//     <pipe-selector> }}`.
//   - Allow applying pipes by specifying in args.
//
// TODO: Should Parameters be tested for updates? If so, should the component be
// fuly re-rendered.

// NOTE: Decided not to add option to update props on single instance, because I
// wasn't sure the best implementation. Ex. If the first instance is removed
// with NgIf and added back then we would only know it is the first if we add an
// attribute or something. Would Storybook auto add that attribute or leave that
// to the user? If Storybook was to do it thendo you use the first rendered
// instance or first listed in the template. If it is the first listed in the
// template then is it first based on the string or based on where it would be
// rendered, because an ng-template could cause the first instance in the
// template string to actually be rendered last and that can't be
// pre-determined.

// interface TestDirective extends OnInit, OnChanges {
//   simpleInp: string | undefined | null;
//   toReNamedInp: string | undefined | null;
//   fnInp: string | undefined | null;
//   thingInpValue: string | undefined | null;
//   metaInput: boolean | undefined | null;
//   metaOutput: EventEmitter<boolean>;
//   simpleOut: EventEmitter<boolean>;
//   toReNamedOut: EventEmitter<boolean>;
//   something(val: string | undefined | null): void;
// }

const TEST_INSTANCE_REF: unique symbol = Symbol('__test_instance_ref__');
const TEST_INSTANCE_REF2: unique symbol = Symbol('__test_instance_ref2__');

function getPropsDirectiveInstance(nativeElement: any) {
  const ref: any = nativeElement[TEST_INSTANCE_REF2] || nativeElement[TEST_INSTANCE_REF];
  if (!ref) {
    return null;
  }
  const instance = ref.injector.get(STORY_PROPS_DIRECTIVE);
  return instance;
}

function createGetComponentInstanceFn(component: any) {
  return (nativeElement: any) => {
    const ref: any = nativeElement[TEST_INSTANCE_REF];
    if (!ref) {
      return null;
    }
    const instance = ref.injector.get(component);
    return instance;
  };
}

/**
 * Since components are directives, this checks if it is just a directive.
 */
const isNonComponentDirective = (classType: any) => {
  const ngComponentMetadata = getComponentDecoratorMetadata(classType);
  return ngComponentMetadata instanceof Directive && !(ngComponentMetadata instanceof Component);
};

@Directive({
  selector: '[ngComponentOutlet]',
})
class TestAccessorDirective {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    private readonly outlet: NgComponentOutlet,
    @Inject(STORY_PROPS_DIRECTIVE) private readonly storyPropsDirective: any
  ) {}

  ngDoCheck() {
    // const nativeElement = document.querySelector('ng-component');
    const instance = (this.outlet as any)?._componentRef?.instance;
    const nativeElement = instance?.injector.get(ElementRef)?.nativeElement;
    if (nativeElement) {
      nativeElement[TEST_INSTANCE_REF2] = this.storyPropsDirective;
    }
  }
}

@Directive()
class BaseTestDirective implements OnInit, OnChanges {
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

  constructor(
    protected readonly elementRef: ElementRef,
    protected readonly ngZone: NgZone,
    public readonly injector: Injector
  ) {
    this.elementRef.nativeElement[TEST_INSTANCE_REF] = this;
    addTestOutputTrigger(this, this.elementRef.nativeElement, this.ngZone);
  }

  ngOnInit() {}

  ngOnChanges(changes: SimpleChanges) {}

  something(val: string | undefined | null) {}
}

@Component({
  selector: 'foo',
  template:
    '[{{simpleInp}}][{{toReNamedInp}}][{{fnInp}}][{{metaInput}}]{{misc}}<ng-content></ng-content>',
  inputs: ['metaInput'],
  outputs: ['metaOutput'],
})
class FooComponent extends BaseTestDirective {}

@Component({
  selector: 'foo',
  template:
    '[{{simpleInp}}][{{toReNamedInp}}][{{fnInp}}][{{metaInput}}]{{misc}}<ng-content></ng-content>',
  inputs: ['metaInput'],
  outputs: ['metaOutput'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class FooOnPushComponent extends BaseTestDirective {}

@Directive({
  selector: 'foo',
  inputs: ['metaInput'],
  outputs: ['metaOutput'],
})
class FooDirective extends BaseTestDirective implements DoCheck {
  ngDoCheck() {
    const tplVal = (x: any) => (x === undefined || x === null ? '' : x);
    this.elementRef.nativeElement.innerHTML = `[${tplVal(this.simpleInp)}][${tplVal(
      this.toReNamedInp
    )}][${tplVal(this.fnInp)}][${tplVal(this.metaInput)}]${tplVal((this as any).misc)}`;
  }
}

@Component({
  template:
    '[{{simpleInp}}][{{toReNamedInp}}][{{fnInp}}][{{metaInput}}]{{misc}}<ng-content></ng-content>',
  inputs: ['metaInput'],
  outputs: ['metaOutput'],
})
class NoSelectorComponent extends BaseTestDirective {}

@Directive({ selector: 'simpleInp' })
class SimpleInpDirective implements OnChanges {
  @Input() simpleInp: string | undefined | null;

  ngOnChanges(changes: SimpleChanges) {}
}

type ComponentTypes = typeof FooComponent | typeof FooOnPushComponent | typeof FooDirective;
const commonComponents: [ComponentTypes, string, boolean][] = [
  [FooComponent, 'foo', false],
  [FooOnPushComponent, 'foo', false],
  [FooDirective, 'foo', false],
  [NoSelectorComponent, 'ng-component', true],
];

type ComponentExpectationProps = {
  [prop: string]: { value: any; binding: boolean; attribute?: boolean };
};

describe('StorybookWrapperComponent', () => {
  describe.each(commonComponents)('Base', (component, componentSelector, noSelector) => {
    describe(`Type ${component.name}`, () => {
      let rendererFactory: RendererFactory;
      let rendererService: AbstractRenderer;
      let root: HTMLElement;
      let ngOnChangesSpy: jest.SpyInstance<void, [SimpleChanges]>;
      let ngOnInitSpy: jest.SpyInstance<void, []>;
      let somethingSpy: jest.SpyInstance<void, [string | null | undefined]>;
      let data: Parameters<AbstractRenderer['render']>[0];

      function getComponentNativeElement(selector: string = componentSelector): HTMLElement {
        const element: HTMLElement | null = getWrapperElement().querySelector(selector);
        if (!element) {
          throw Error(`component nativeElement not found, with selector '${selector}'.`);
        }
        return element;
      }

      const getComponentInstance = createGetComponentInstanceFn(component);

      const getOutputSubscribersCount = (outputName: string) => {
        const nativeElement = getComponentNativeElement();
        const directiveInstance = getPropsDirectiveInstance(nativeElement);
        const propertyName = directiveInstance.propNameToInstancePropertyName(outputName);
        const componentInstance = getComponentInstance(nativeElement);
        return componentInstance[propertyName].observers.length;
      };

      const setProps = async (props: typeof data['storyFnAngular']['props']): Promise<void> => {
        data.storyFnAngular.props = props;
        await rendererService.render(data);
      };

      const setTemplate = (template: string): void => {
        data.storyFnAngular.template = template;
      };

      const buildExpectationBindings = (props: ComponentExpectationProps) => {
        if (noSelector) {
          return '';
        }

        const ngComponentInputsOutputs = getComponentInputsOutputs(component);

        const attrs = Object.keys(props)
          .map((prop) => {
            let s = '';
            const propName = ngComponentInputsOutputs.inputs.find((x) => x.templateName === prop)
              ?.propName;
            if (propName) {
              if (props[prop].attribute) {
                s += `${propName.toLowerCase()}="${props[prop].value.toString()}"`;
              }
              if (props[prop].binding) {
                s += ` ${buildNgReflectBindingStr(propName, props[prop].value.toString())}`;
              }
            }

            return s.length > 0 ? s.trim() : undefined;
          })
          .filter((x) => x !== undefined);
        if (attrs.length === 0) {
          return '';
        }

        return ` ${attrs.join(' ')}`;
      };

      const buildExpectationContent = (props: ComponentExpectationProps) => {
        const simpleInp = Object.prototype.hasOwnProperty.call(props, 'simpleInp')
          ? props.simpleInp.value
          : '';
        const toReNamedInp = Object.prototype.hasOwnProperty.call(props, 'reNamedInp')
          ? props.reNamedInp.value
          : '';
        const fnInp = Object.prototype.hasOwnProperty.call(props, 'fnInp') ? props.fnInp.value : '';
        const metaInput = Object.prototype.hasOwnProperty.call(props, 'metaInput')
          ? props.metaInput.value
          : '';
        const misc = Object.prototype.hasOwnProperty.call(props, 'misc') ? props.misc.value : '';
        return `[${simpleInp}][${toReNamedInp}][${fnInp}][${metaInput}]${misc}`;
      };

      const buildComponentExpectation = (props: ComponentExpectationProps) => {
        const bindingsStr = buildExpectationBindings(props);
        const outputPostfix = noSelector
          ? `<!--bindings={\n  "ng-reflect-ng-component-outlet": "function ${component.name}()"\n}-->`
          : ``;
        const content = buildExpectationContent(props);
        return `<${componentSelector}${bindingsStr}>${content}</${componentSelector}>${outputPostfix}`;
      };

      beforeEach(async () => {
        addons.setChannel(mockChannel());

        ngOnChangesSpy = jest.spyOn(component.prototype, 'ngOnChanges');
        ngOnInitSpy = jest.spyOn(component.prototype, 'ngOnInit');
        somethingSpy = jest.spyOn(component.prototype, 'something');

        root = createRootElement();
        document.body.appendChild(root);
        (platformBrowserDynamic as any).mockImplementation(platformBrowserDynamicTesting);
        // rendererService = new CanvasRenderer('storybook-wrapper');
        rendererService = new DocsRenderer('storybook-wrapper');

        // root.id = 'root-docs';
        // rendererFactory = new RendererFactory();
        // rendererService = (await rendererFactory.getRendererInstance('storybook-wrapper', root))!;

        data = {
          storyFnAngular: {
            props: {},
            moduleMetadata: {
              declarations: [TestAccessorDirective],
            },
          },
          forced: true,
          parameters: {},
          component,
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
                buildComponentExpectation({ simpleInp: { value: 'a', binding: true } })
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
                buildComponentExpectation({ simpleInp: { value: 'a', binding: true } })
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
                buildComponentExpectation({ simpleInp: { value: 'b', binding: true } })
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
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ simpleInp: { value: 'a', binding: false } })
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
                buildComponentExpectation({ simpleInp: { value: 'a', binding: false } })
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
                buildComponentExpectation({ simpleInp: { value: 'b', binding: false } })
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
        });

        describe('metadata input', () => {
          describe('in inital props', () => {
            it('should set', async () => {
              await setProps({ metaInput: 'm' });
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ metaInput: { value: 'm', binding: true } })
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
                buildComponentExpectation({ metaInput: { value: 'm', binding: true } })
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
                buildComponentExpectation({ metaInput: { value: 'n', binding: true } })
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
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ metaInput: { value: 'm', binding: false } })
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
                buildComponentExpectation({ metaInput: { value: 'm', binding: false } })
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
                buildComponentExpectation({ metaInput: { value: 'n', binding: false } })
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
        });

        describe('renamed input', () => {
          describe('in inital props', () => {
            it('should set', async () => {
              await setProps({ reNamedInp: 'r' });
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ reNamedInp: { value: 'r', binding: true } })
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
                buildComponentExpectation({ reNamedInp: { value: 'r', binding: true } })
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
                buildComponentExpectation({ reNamedInp: { value: 's', binding: true } })
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
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ reNamedInp: { value: 'r', binding: false } })
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
                buildComponentExpectation({ reNamedInp: { value: 'r', binding: false } })
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
                buildComponentExpectation({ reNamedInp: { value: 's', binding: false } })
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
        });

        describe('getter/setter input', () => {
          describe('in inital props', () => {
            it('should set', async () => {
              await setProps({ fnInp: 'f' });
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ fnInp: { value: 'f', binding: true } })
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
                buildComponentExpectation({ fnInp: { value: 'f', binding: true } })
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
                buildComponentExpectation({ fnInp: { value: 'g', binding: true } })
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
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ fnInp: { value: 'f', binding: false } })
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
                buildComponentExpectation({ fnInp: { value: 'f', binding: false } })
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
                buildComponentExpectation({ fnInp: { value: 'g', binding: false } })
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
        });

        describe('non-input props', () => {
          describe('in inital props', () => {
            it('should set', async () => {
              await setProps({ misc: 'x' });
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ misc: { value: 'x', binding: false } })
              );
              expect(ngOnChangesSpy).toBeCalledTimes(0);
            });

            it('should not set when prop does not change', async () => {
              await setProps({ misc: 'x' });
              await setProps({ misc: 'x' });
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ misc: { value: 'x', binding: false } })
              );
              expect(ngOnChangesSpy).toBeCalledTimes(0);
            });

            it('should set when prop changes', async () => {
              await setProps({ misc: 'x' });
              await setProps({ misc: 'y' });
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ misc: { value: 'y', binding: false } })
              );
              expect(ngOnChangesSpy).toBeCalledTimes(0);
            });
          });

          describe('not in inital props', () => {
            beforeEach(async () => {
              await setProps({});
            });

            it('should set', async () => {
              await setProps({ misc: 'x' });
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ misc: { value: 'x', binding: false } })
              );
              expect(ngOnChangesSpy).toBeCalledTimes(0);
            });

            it('should not set when prop does not change', async () => {
              await setProps({ misc: 'x' });
              await setProps({ misc: 'x' });
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ misc: { value: 'x', binding: false } })
              );
              expect(ngOnChangesSpy).toBeCalledTimes(0);
            });

            it('should set when prop changes', async () => {
              await setProps({ misc: 'x' });
              await setProps({ misc: 'y' });
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ misc: { value: 'y', binding: false } })
              );
              expect(ngOnChangesSpy).toBeCalledTimes(0);
            });
          });
        });

        describe('simple output', () => {
          describe('in inital props', () => {
            it('should emit', async () => {
              const outSpy = createOutputPropSpy();
              await setProps({ simpleOut: outSpy });
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('simpleOut')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('simpleOut')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('simpleOut')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('simpleOut')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('simpleOut')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('simpleOut')).toBe(1);
              const eventData = { a: 'b' };
              emitOutput('simpleOut', eventData);
              expect(outSpy).toBeCalledTimes(0);
              expect(outSpy2).toBeCalledTimes(1);
              expect(outSpy2).toBeCalledWith(eventData);
              expect(ngOnChangesSpy).toBeCalledTimes(0);
            });
          });
        });

        describe('metadata output', () => {
          describe('in inital props', () => {
            it('should emit', async () => {
              const outSpy = createOutputPropSpy();
              await setProps({ metaOutput: outSpy });
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('metaOutput')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('metaOutput')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('metaOutput')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('metaOutput')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('metaOutput')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('metaOutput')).toBe(1);
              const eventData = { a: 'b' };
              emitOutput('metaOutput', eventData);
              expect(outSpy).toBeCalledTimes(0);
              expect(outSpy2).toBeCalledTimes(1);
              expect(outSpy2).toBeCalledWith(eventData);
              expect(ngOnChangesSpy).toBeCalledTimes(0);
            });
          });
        });

        describe('renamed output', () => {
          describe('in inital props', () => {
            it('should emit', async () => {
              const outSpy = createOutputPropSpy();
              await setProps({ reNamedOut: outSpy });
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('reNamedOut')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('reNamedOut')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('reNamedOut')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('reNamedOut')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('reNamedOut')).toBe(1);
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
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('reNamedOut')).toBe(1);
              const eventData = { a: 'b' };
              emitOutput('toReNamedOut', eventData);
              expect(outSpy).toBeCalledTimes(0);
              expect(outSpy2).toBeCalledTimes(1);
              expect(outSpy2).toBeCalledWith(eventData);
              expect(ngOnChangesSpy).toBeCalledTimes(0);
            });
          });
        });

        describe('ngOnChanges', () => {
          it('should call before ngOnInit', async () => {
            await setProps({ simpleInp: 'a' });
            expect(ngOnChangesSpy).toBeCalledTimes(1);
            expect(ngOnChangesSpy).toHaveBeenCalledWith({
              simpleInp: expect.objectContaining({
                previousValue: undefined,
                currentValue: 'a',
                firstChange: true,
              }),
            });
            expect(ngOnInitSpy).toBeCalledTimes(1);
            const ngOnChangesOrder = ngOnChangesSpy.mock.invocationCallOrder[0];
            const ngOnInitOrder = ngOnInitSpy.mock.invocationCallOrder[0];
            expect(ngOnChangesOrder).toBeLessThan(ngOnInitOrder);
          });
        });

        // Without a selector there isn't a tag to add bindings to.
        if (!noSelector) {
          describe('bindings', () => {
            it('should know bound inputs and outputs', async () => {
              await setProps({ simpleInp: 'a', simpleOut: () => {} });
              const inst = getPropsDirectiveInstance(
                getWrapperElement().querySelector(`${componentSelector}`)
              );
              expect(inst.boundInputOutputNames as string[]).toHaveLength(2);
              expect(inst.boundInputOutputNames as string[]).toContain('simpleInp');
              expect(inst.boundInputOutputNames as string[]).toContain('simpleOut');
            });
          });
        }

        describe('parameters', () => {
          describe('emulatePropBindingIfNotTemplateBound', () => {
            describe('true', () => {
              beforeEach(async () => {
                data.parameters.emulatePropBindingIfNotTemplateBound = true;
              });

              it('should set when in initial props', async () => {
                await setProps({ simpleInp: 'a' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ simpleInp: { value: 'a', binding: true } })
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

              it('should set when not in initial props', async () => {
                await setProps({});
                await setProps({ simpleInp: 'a' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ simpleInp: { value: 'a', binding: false } })
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
            });

            describe('false', () => {
              beforeEach(async () => {
                data.parameters.emulatePropBindingIfNotTemplateBound = false;
              });

              if (noSelector) {
                // Without a selector there will not be bindings.
                it('should not set when in initial props', async () => {
                  await setProps({ simpleInp: 'a' });
                  expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                  expect(ngOnChangesSpy).toBeCalledTimes(0);
                });
              } else {
                it('should set when in initial props', async () => {
                  await setProps({ simpleInp: 'a' });
                  expect(getWrapperElement().innerHTML).toBe(
                    buildComponentExpectation({ simpleInp: { value: 'a', binding: true } })
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
              }

              it('should not set when not in initial props', async () => {
                await setProps({});
                await setProps({ simpleInp: 'a' });
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(ngOnChangesSpy).toBeCalledTimes(0);
              });
            });
          });

          describe('setNonInputOutputProperties', () => {
            describe('true', () => {
              beforeEach(async () => {
                data.parameters.setNonInputOutputProperties = true;
              });

              it('should set input', async () => {
                await setProps({ simpleInp: 'a' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ simpleInp: { value: 'a', binding: true } })
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

              it('should set non-input', async () => {
                await setProps({ misc: 'x' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ misc: { value: 'x', binding: false } })
                );
                expect(ngOnChangesSpy).toBeCalledTimes(0);
              });
            });

            describe('false', () => {
              beforeEach(async () => {
                data.parameters.setNonInputOutputProperties = false;
              });

              it('should set input', async () => {
                await setProps({ simpleInp: 'a' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ simpleInp: { value: 'a', binding: true } })
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

              it('should not set non-input', async () => {
                await setProps({ misc: 'x' });
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(ngOnChangesSpy).toBeCalledTimes(0);
              });
            });
          });
        });
      });

      // Without a selector there isn't a tag to use in a template.
      if (!noSelector) {
        describe('template', () => {
          beforeEach(() => {
            setTemplate(`<${componentSelector}></${componentSelector}>`);
          });

          describe('simple input', () => {
            describe('in inital props', () => {
              it('should set', async () => {
                await setProps({ simpleInp: 'a' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ simpleInp: { value: 'a', binding: false } })
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
                  buildComponentExpectation({ simpleInp: { value: 'a', binding: false } })
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
                  buildComponentExpectation({ simpleInp: { value: 'b', binding: false } })
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

              describe('manual binding', () => {
                it('without brackets', async () => {
                  setTemplate(`<${componentSelector} simpleInp="a"></${componentSelector}>`);
                  await setProps({ simpleInp: 'b' });
                  expect(getWrapperElement().innerHTML).toBe(
                    buildComponentExpectation({
                      simpleInp: { value: 'a', binding: true, attribute: true },
                    })
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

                it('with brackets', async () => {
                  setTemplate(`<${componentSelector} [simpleInp]="'a'"></${componentSelector}>`);
                  await setProps({ simpleInp: 'b' });
                  expect(getWrapperElement().innerHTML).toBe(
                    buildComponentExpectation({ simpleInp: { value: 'a', binding: true } })
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
              });
            });

            describe('not in inital props', () => {
              beforeEach(async () => {
                await setProps({});
              });

              it('should set', async () => {
                await setProps({ simpleInp: 'a' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ simpleInp: { value: 'a', binding: false } })
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
                  buildComponentExpectation({ simpleInp: { value: 'a', binding: false } })
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
                  buildComponentExpectation({ simpleInp: { value: 'b', binding: false } })
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
          });

          describe('metadata input', () => {
            describe('in inital props', () => {
              it('should set', async () => {
                await setProps({ metaInput: 'm' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ metaInput: { value: 'm', binding: false } })
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
                  buildComponentExpectation({ metaInput: { value: 'm', binding: false } })
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
                  buildComponentExpectation({ metaInput: { value: 'n', binding: false } })
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
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ metaInput: { value: 'm', binding: false } })
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
                  buildComponentExpectation({ metaInput: { value: 'm', binding: false } })
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
                  buildComponentExpectation({ metaInput: { value: 'n', binding: false } })
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
          });

          describe('renamed input', () => {
            describe('in inital props', () => {
              it('should set', async () => {
                await setProps({ reNamedInp: 'r' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ reNamedInp: { value: 'r', binding: false } })
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
                  buildComponentExpectation({ reNamedInp: { value: 'r', binding: false } })
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
                  buildComponentExpectation({ reNamedInp: { value: 's', binding: false } })
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
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ reNamedInp: { value: 'r', binding: false } })
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
                  buildComponentExpectation({ reNamedInp: { value: 'r', binding: false } })
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
                  buildComponentExpectation({ reNamedInp: { value: 's', binding: false } })
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
          });

          describe('getter/setter input', () => {
            describe('in inital props', () => {
              it('should set', async () => {
                await setProps({ fnInp: 'f' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ fnInp: { value: 'f', binding: false } })
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
                  buildComponentExpectation({ fnInp: { value: 'f', binding: false } })
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
                  buildComponentExpectation({ fnInp: { value: 'g', binding: false } })
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
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ fnInp: { value: 'f', binding: false } })
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
                  buildComponentExpectation({ fnInp: { value: 'f', binding: false } })
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
                  buildComponentExpectation({ fnInp: { value: 'g', binding: false } })
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
          });

          describe('non-input props', () => {
            describe('in inital props', () => {
              it('should set', async () => {
                await setProps({ misc: 'x' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ misc: { value: 'x', binding: false } })
                );
                expect(ngOnChangesSpy).toBeCalledTimes(0);
              });

              it('should not set when prop does not change', async () => {
                await setProps({ misc: 'x' });
                await setProps({ misc: 'x' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ misc: { value: 'x', binding: false } })
                );
                expect(ngOnChangesSpy).toBeCalledTimes(0);
              });

              it('should set when prop changes', async () => {
                await setProps({ misc: 'x' });
                await setProps({ misc: 'y' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ misc: { value: 'y', binding: false } })
                );
                expect(ngOnChangesSpy).toBeCalledTimes(0);
              });
            });
            describe('not in inital props', () => {
              beforeEach(async () => {
                await setProps({});
              });

              it('should set', async () => {
                await setProps({ misc: 'x' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ misc: { value: 'x', binding: false } })
                );
                expect(ngOnChangesSpy).toBeCalledTimes(0);
              });

              it('should not set when prop does not change', async () => {
                await setProps({ misc: 'x' });
                await setProps({ misc: 'x' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ misc: { value: 'x', binding: false } })
                );
                expect(ngOnChangesSpy).toBeCalledTimes(0);
              });

              it('should set when prop changes', async () => {
                await setProps({ misc: 'x' });
                await setProps({ misc: 'y' });
                expect(getWrapperElement().innerHTML).toBe(
                  buildComponentExpectation({ misc: { value: 'y', binding: false } })
                );
                expect(ngOnChangesSpy).toBeCalledTimes(0);
              });
            });
          });

          describe('simple output', () => {
            describe('in inital props', () => {
              it('should emit', async () => {
                const outSpy = createOutputPropSpy();
                await setProps({ simpleOut: outSpy });
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('simpleOut')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('simpleOut')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('simpleOut')).toBe(1);
                const eventData = { a: 'b' };
                emitOutput('simpleOut', eventData);
                expect(outSpy).toBeCalledTimes(0);
                expect(outSpy2).toBeCalledTimes(1);
                expect(outSpy2).toBeCalledWith(eventData);
                expect(ngOnChangesSpy).toBeCalledTimes(0);
              });

              // describe('manual binding', () => {
              //   it('with brackets', async () => {
              //     setTemplate(`<foo (simpleInp)="'a'"></foo>`);
              //     const outSpy = createOutputPropSpy();
              //     await setProps({ simpleOut: outSpy });
              //     expect(getWrapperElement().innerHTML).toBe('<foo>[][][][]</foo><!--container-->');
              //     const eventData = { a: 'b' };
              //     emitOutput('simpleOut', eventData);
              //     expect(outSpy).toBeCalledTimes(1);
              //     expect(outSpy).toBeCalledWith(eventData);
              //     expect(ngOnChangesSpy).toBeCalledTimes(0);
              //   });
              // });
            });

            describe('not in inital props', () => {
              beforeEach(async () => {
                await setProps({});
              });

              it('should emit', async () => {
                const outSpy = createOutputPropSpy();
                await setProps({ simpleOut: outSpy });
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('simpleOut')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('simpleOut')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('simpleOut')).toBe(1);
                const eventData = { a: 'b' };
                emitOutput('simpleOut', eventData);
                expect(outSpy).toBeCalledTimes(0);
                expect(outSpy2).toBeCalledTimes(1);
                expect(outSpy2).toBeCalledWith(eventData);
                expect(ngOnChangesSpy).toBeCalledTimes(0);
              });
            });
          });

          describe('metadata output', () => {
            describe('in inital props', () => {
              it('should emit', async () => {
                const outSpy = createOutputPropSpy();
                await setProps({ metaOutput: outSpy });
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('metaOutput')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('metaOutput')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('metaOutput')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('metaOutput')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('metaOutput')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('metaOutput')).toBe(1);
                const eventData = { a: 'b' };
                emitOutput('metaOutput', eventData);
                expect(outSpy).toBeCalledTimes(0);
                expect(outSpy2).toBeCalledTimes(1);
                expect(outSpy2).toBeCalledWith(eventData);
                expect(ngOnChangesSpy).toBeCalledTimes(0);
              });
            });
          });

          describe('renamed output', () => {
            describe('in inital props', () => {
              it('should emit', async () => {
                const outSpy = createOutputPropSpy();
                await setProps({ reNamedOut: outSpy });
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('reNamedOut')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('reNamedOut')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('reNamedOut')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('reNamedOut')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('reNamedOut')).toBe(1);
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
                expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                expect(getOutputSubscribersCount('reNamedOut')).toBe(1);
                const eventData = { a: 'b' };
                emitOutput('toReNamedOut', eventData);
                expect(outSpy).toBeCalledTimes(0);
                expect(outSpy2).toBeCalledTimes(1);
                expect(outSpy2).toBeCalledWith(eventData);
                expect(ngOnChangesSpy).toBeCalledTimes(0);
              });
            });
          });

          describe('ngOnChanges', () => {
            it('should call before ngOnInit', async () => {
              await setProps({ simpleInp: 'a' });
              expect(ngOnChangesSpy).toBeCalledTimes(1);
              expect(ngOnChangesSpy).toHaveBeenCalledWith({
                simpleInp: expect.objectContaining({
                  previousValue: undefined,
                  currentValue: 'a',
                  firstChange: true,
                }),
              });
              expect(ngOnInitSpy).toBeCalledTimes(1);
              const ngOnChangesOrder = ngOnChangesSpy.mock.invocationCallOrder[0];
              const ngOnInitOrder = ngOnInitSpy.mock.invocationCallOrder[0];
              expect(ngOnChangesOrder).toBeLessThan(ngOnInitOrder);
            });
          });

          describe('bindings', () => {
            it('should know bound non-bracket inputs and outputs', async () => {
              setTemplate(
                `<${componentSelector} simpleInp="{{simpleInp}}" (simpleOut)="simpleOut"></${componentSelector}>`
              );
              await setProps({ simpleInp: 'a', simpleOut: () => {} });
              const inst = getPropsDirectiveInstance(
                getWrapperElement().querySelector(componentSelector)
              );
              expect(inst.boundInputOutputNames as string[]).toHaveLength(2);
              expect(inst.boundInputOutputNames as string[]).toContain('simpleInp');
              expect(inst.boundInputOutputNames as string[]).toContain('simpleOut');
            });

            it('should know bound bracket inputs and outputs', async () => {
              setTemplate(
                `<${componentSelector} [simpleInp]="simpleInp" (simpleOut)="simpleOut"></${componentSelector}>`
              );
              await setProps({ simpleInp: 'a', simpleOut: () => {} });
              const inst = getPropsDirectiveInstance(
                getWrapperElement().querySelector(componentSelector)
              );
              expect(inst.boundInputOutputNames as string[]).toHaveLength(2);
              expect(inst.boundInputOutputNames as string[]).toContain('simpleInp');
              expect(inst.boundInputOutputNames as string[]).toContain('simpleOut');
            });

            it('should not set bound input from props', async () => {
              setTemplate(`<${componentSelector} simpleInp="a"></${componentSelector}>`);
              await setProps({ simpleInp: 'b' });
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({
                  simpleInp: { value: 'a', binding: true, attribute: true },
                })
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

            it('should not set bound bracket input from props', async () => {
              setTemplate(`<${componentSelector} [simpleInp]="'a'"></${componentSelector}>`);
              await setProps({ simpleInp: 'b' });
              expect(getWrapperElement().innerHTML).toBe(
                buildComponentExpectation({ simpleInp: { value: 'a', binding: true } })
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

            it('should not set bound output from props', async () => {
              setTemplate(
                `<${componentSelector} (simpleOut)="out($event)"></${componentSelector}>`
              );
              const outSpy1 = createOutputPropSpy();
              const outSpy2 = createOutputPropSpy();
              await setProps({ simpleOut: outSpy1, out: outSpy2 });
              expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
              expect(getOutputSubscribersCount('simpleOut')).toBe(1);
              const eventData = { a: 'b' };
              emitOutput('simpleOut', eventData);
              expect(outSpy1).toBeCalledTimes(0);
              expect(outSpy2).toBeCalledTimes(1);
              expect(outSpy2).toBeCalledWith(eventData);
              expect(ngOnChangesSpy).toBeCalledTimes(0);
            });
          });

          describe('parameters', () => {
            describe('emulatePropBindingIfNotTemplateBound', () => {
              describe('true', () => {
                beforeEach(async () => {
                  data.parameters.emulatePropBindingIfNotTemplateBound = true;
                });

                it('should set when in initial props', async () => {
                  await setProps({ simpleInp: 'a' });
                  expect(getWrapperElement().innerHTML).toBe(
                    buildComponentExpectation({ simpleInp: { value: 'a', binding: false } })
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

                it('should set when not in initial props', async () => {
                  await setProps({});
                  await setProps({ simpleInp: 'a' });
                  expect(getWrapperElement().innerHTML).toBe(
                    buildComponentExpectation({ simpleInp: { value: 'a', binding: false } })
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
              });

              describe('false', () => {
                beforeEach(async () => {
                  data.parameters.emulatePropBindingIfNotTemplateBound = false;
                });

                it('should not set when in initial props', async () => {
                  await setProps({ simpleInp: 'a' });
                  expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                  expect(ngOnChangesSpy).toBeCalledTimes(0);
                });

                it('should not set when not in initial props', async () => {
                  await setProps({});
                  await setProps({ simpleInp: 'a' });
                  expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                  expect(ngOnChangesSpy).toBeCalledTimes(0);
                });
              });
            });

            describe('setNonInputOutputProperties', () => {
              describe('true', () => {
                beforeEach(async () => {
                  data.parameters.setNonInputOutputProperties = true;
                });

                it('should set input', async () => {
                  await setProps({ simpleInp: 'a' });
                  expect(getWrapperElement().innerHTML).toBe(
                    buildComponentExpectation({ simpleInp: { value: 'a', binding: false } })
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

                it('should set non-input', async () => {
                  await setProps({ misc: 'x' });
                  expect(getWrapperElement().innerHTML).toBe(
                    buildComponentExpectation({ misc: { value: 'x', binding: false } })
                  );
                  expect(ngOnChangesSpy).toBeCalledTimes(0);
                });
              });

              describe('false', () => {
                beforeEach(async () => {
                  data.parameters.setNonInputOutputProperties = false;
                });

                it('should set input', async () => {
                  await setProps({ simpleInp: 'a' });
                  expect(getWrapperElement().innerHTML).toBe(
                    buildComponentExpectation({ simpleInp: { value: 'a', binding: false } })
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

                it('should not set non-input', async () => {
                  await setProps({ misc: 'x' });
                  expect(getWrapperElement().innerHTML).toBe(buildComponentExpectation({}));
                  expect(ngOnChangesSpy).toBeCalledTimes(0);
                });
              });
            });
          });
        });

        describe('component initially not rendered in template', () => {
          beforeEach(() => {
            setTemplate(
              `<ng-container *ngIf="isVisible"><${componentSelector}></${componentSelector}></ng-container>`
            );
          });

          describe('with input prop', () => {
            describe('in initial props', () => {
              it('should render', async () => {
                await setProps({ simpleInp: 'a' });
                expect(getWrapperElement().innerHTML).toBe('<!--bindings={}-->');
                await setProps({ simpleInp: 'a', isVisible: true });
                expect(getWrapperElement().innerHTML).toBe(
                  dedent`<${componentSelector}>[a][][][]</${componentSelector}><!--ng-container--><!--bindings={
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
                  dedent`<${componentSelector}>[a][][][]</${componentSelector}><!--ng-container--><!--bindings={
                    "ng-reflect-ng-if": "true"
                  }-->`
                );
              });
            });
          });
        });

        describe('multiple instances of component', () => {
          describe('sibling', () => {
            beforeEach(() => {
              data.storyFnAngular.template = `<${componentSelector}></${componentSelector}><${componentSelector}></${componentSelector}>`;
            });

            it('should set props on all instances', async () => {
              await setProps({ simpleInp: 'a' });
              expect(getWrapperElement().innerHTML).toBe(
                `<${componentSelector}>[a][][][]</${componentSelector}><${componentSelector}>[a][][][]</${componentSelector}>`
              );
            });
          });

          // Directive doesn't have a template, so it is up to the directive to
          // handle content.
          if (!isNonComponentDirective(component)) {
            describe('child', () => {
              beforeEach(() => {
                data.storyFnAngular.template = `<${componentSelector}><${componentSelector}></${componentSelector}></${componentSelector}>`;
              });

              it('should set props on all instances', async () => {
                await setProps({ simpleInp: 'a' });
                expect(getWrapperElement().innerHTML).toBe(
                  `<${componentSelector}>[a][][][]<${componentSelector}>[a][][][]</${componentSelector}></${componentSelector}>`
                );
              });
            });
          }
        });
      }

      it('should re-render when parameter change', async () => {
        data.parameters.emulatePropBindingIfNotTemplateBound = true;
        await rendererService.render(data);
        expect(ngOnInitSpy).toBeCalledTimes(1);
        await rendererService.render(data);
        expect(ngOnInitSpy).toBeCalledTimes(1);
        data.parameters.emulatePropBindingIfNotTemplateBound = false;
        await rendererService.render(data);
        expect(ngOnInitSpy).toBeCalledTimes(2);
      });
    });
  });
});

function emitOutput(outputPropName: string, data: any): void {
  const element1 = getWrapperElement().querySelector('foo') as any;
  const element2 = getWrapperElement().querySelector('ng-component') as any;
  // eslint-disable-next-line no-underscore-dangle
  (element1 || element2).__testTrigger(outputPropName, data);
}

function addTestOutputTrigger(instance: any, nativeElement: any, ngZone: NgZone): void {
  // eslint-disable-next-line no-underscore-dangle, no-param-reassign
  nativeElement.__testTrigger = (outputPropName: string, data: any) => {
    const out = instance[outputPropName];
    ngZone.run(() => {
      out.emit(data);
    });
  };
}

function buildNgReflectBindingStr(propName: string, value: any): string {
  // Simple came case to dash case. Doesn't handle all camel case string formats.
  const name = !propName
    ? null
    : propName
        .replace(/([A-Z])/g, (g) => {
          return `-${g[0].toLowerCase()}`;
        })
        .replace(/[$@]/g, '_');

  return `ng-reflect-${name}="${value}"`;
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
