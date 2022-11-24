import reqAnimationFrame from './request-animation-frame';

export default function frame(func: any) {
  return (...args: any) => reqAnimationFrame(() => func(...args));
}
