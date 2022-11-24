const verticalPropMap = {
  width: 'height',
  height: 'width',

  overflowX: 'overflowY',
  overflowY: 'overflowX',

  clientWidth: 'clientHeight',
  clientHeight: 'clientWidth',

  clientX: 'clientY',
  clientY: 'clientX',

  scrollWidth: 'scrollHeight',
  scrollLeft: 'scrollTop',

  offsetLeft: 'offsetTop',
  offsetTop: 'offsetLeft',
  offsetHeight: 'offsetWidth',
  offsetWidth: 'offsetHeight',

  left: 'top',
  right: 'bottom',
  top: 'left',
  bottom: 'right',

  borderRightStyle: 'borderBottomStyle',
  borderRightWidth: 'borderBottomWidth',
  borderRightColor: 'borderBottomColor',
};

function mapProp(prop: any, vertical: boolean) {
  if (Object.prototype.hasOwnProperty.call(verticalPropMap, prop)) {
    return vertical ? (verticalPropMap as any)[prop] : prop;
  } else {
    return prop;
  }
}

const isProxy = Symbol('isProxy');

export default function withOrientation(target: any, vertical: boolean): any {
  if (target[isProxy]) {
    return target;
  } else {
    return new Proxy(target, {
      get: function (obj, prop, receiver) {
        if (prop === isProxy) {
          return true;
        } else if (prop === 'domElement') {
          return obj;
        } else if (prop === 'style') {
          return withOrientation(obj.style, vertical);
        } else if (prop === 'canvas') {
          return withOrientation(obj.canvas, vertical);
        } else if (prop === 'getBoundingClientRect') {
          return function (...args: any) {
            return withOrientation(obj.getBoundingClientRect(...args), vertical);
          };
        } else if (prop === 'getContext') {
          return function (...args: any) {
            return withOrientation(obj.getContext(...args), vertical);
          };
        } else {
          const value = obj[mapProp(prop, vertical)];
          return typeof value == 'function' ? value.bind(obj) : value;
        }
      },
      set: function (obj, prop, value) {
        obj[mapProp(prop, vertical)] = value;
        return true;
      },
    });
  }
}
