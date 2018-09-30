import accessor from 'accessor';
import { isAccessorDescriptor, isInitializerDescriptor } from 'helper/utils';
import initialize from 'initialize';
import { isObject, isPlainObject, isString } from 'lodash';
import { getDeepProperty } from 'toxic-utils';
import { DecoratorFunction } from 'typings/base';
const { getOwnPropertyDescriptor, defineProperty } = Object;
function setAlias(
  root: any,
  prop: string,
  { configurable, enumerable }: PropertyDescriptor,
  obj: object,
  key: string,
  { force, omit }: {force: boolean, omit: boolean},
): void {
  const originDesc = getOwnPropertyDescriptor(obj, key);
  if (originDesc !== undefined) {
    if (omit) { return; }
    // TODO: we should add an github link here
    if (!force) {
      // tslint:disable-next-line: max-line-length
      throw new Error(`"${prop}" is an existing property, if you want to override it, please set "force" true in @alias option.`);
    }
    if (!originDesc.configurable) {
      throw new Error(`property "${prop}" is unconfigurable.`);
    }
  }
  defineProperty(obj, key, {
    get() {
      return root[prop];
    },
    set(value) {
      root[prop] = value;
      // return prop;
    },
    configurable,
    enumerable,
  });
}
type AliasOption = { force?: boolean, omit?: boolean };
function alias(other: string, key?: AliasOption): DecoratorFunction;
function alias(other: any, key: string, option: AliasOption): DecoratorFunction;
function alias(other: any, key?: any, option?: any): DecoratorFunction {
  // set argument into right position
  if (arguments.length === 2) {
    if (isString(other)) {
      (option as AliasOption) = key;
      (key as string) = other;
      other = undefined;
    }
  } else if (arguments.length === 1) {
    (key as string) = other;
    other = undefined;
  }
  // argument validate
  if (!isString(key)) { throw new TypeError('@alias need a string as a key to find the porperty to set alias on'); }
  // tslint:disable-next-line: max-line-length
  const illegalObjErrorMsg = 'If you want to use @alias to set alias on other instance, you must pass in a legal instance';
  if (other !== undefined && !isObject(other)) { throw new TypeError(illegalObjErrorMsg); }
  const { force, omit } = isPlainObject(option) ? option : { force: false, omit: false };
  return function(obj: object, prop: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    descriptor = descriptor || {
      configurable: true,
      enumerable: true,
      value: undefined,
      writable: true,
    };
    function getTargetAndName(other: any, obj: any, key: string): {target: any, name: string} {
      let target = !isObject(other) ? obj : other;
      const keys = key.split('.');
      const [ name ] = keys.slice(-1);
      target = getDeepProperty(target, keys.slice(0, -1), { throwError: true });
      if (!isObject(target)) {
        throw new TypeError(illegalObjErrorMsg);
      }
      return {
        name,
        target,
      };
    }
    if (isInitializerDescriptor(descriptor)) {
      return initialize(function(value) {
        const { target, name } = getTargetAndName(other, this, key);
        setAlias(this, prop, descriptor, target, name, { force, omit });
        return value;
      })(obj, prop, descriptor);
    }
    if (isAccessorDescriptor(descriptor)) {
      let inited: boolean;
      const handler = function(value: any) {
        if (inited) { return value; }
        const { target, name } = getTargetAndName(other, this, key);
        setAlias(this, prop, descriptor, target, name, { force, omit });
        inited = true;
        return value;
      };
      return accessor({ get: handler, set: handler })(obj, prop, descriptor);
    }
    const { target, name } = getTargetAndName(other, obj, key);
    setAlias(obj, prop, descriptor, target, name, { force, omit });
    return descriptor;
  };
}

export default alias;
