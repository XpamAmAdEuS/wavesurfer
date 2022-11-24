import { EventHandler, ListenerDescriptor } from '../types';

export default class Observer {
  handlers: { [eventName: string]: EventHandler[] };
  _disabledEventEmissions: any[];
  controller: AbortController | undefined;
  response: Response | undefined;
  fetchRequest: Request | undefined;

  constructor() {
    this._disabledEventEmissions = [];
    this.handlers = null as any;
  }

  on(event: string, fn: EventHandler): ListenerDescriptor {
    if (!this.handlers) {
      this.handlers = {};
    }

    let handlers = this.handlers[event];
    if (!handlers) {
      handlers = this.handlers[event] = [];
    }
    handlers.push(fn);

    // Return an event descriptor
    return {
      name: event,
      callback: fn,
      un: (e, fn) => this.un(e, fn),
    };
  }

  un(event: string, fn: EventHandler): void {
    if (!this.handlers) {
      return;
    }

    const handlers = this.handlers[event];
    let i;
    if (handlers) {
      if (fn) {
        for (i = handlers.length - 1; i >= 0; i--) {
          if (handlers[i] == fn) {
            handlers.splice(i, 1);
          }
        }
      } else {
        handlers.length = 0;
      }
    }
  }

  unAll(): void {
    this.handlers = null as any;
  }

  once(event: string, handler: EventHandler): ListenerDescriptor {
    const fn = (...args: any) => {
      /*  eslint-disable no-invalid-this */
      handler.apply(this, args);
      /*  eslint-enable no-invalid-this */
      setTimeout(() => {
        this.un(event, fn);
      }, 0);
    };
    return this.on(event, fn);
  }

  setDisabledEventEmissions(eventNames: string[]): void {
    this._disabledEventEmissions = eventNames;
  }

  _isDisabledEventEmission(event: any) {
    return this._disabledEventEmissions && this._disabledEventEmissions.includes(event);
  }

  fireEvent(event: string, ...args: any[]): void {
    if (!this.handlers || this._isDisabledEventEmission(event)) {
      return;
    }

    const handlers = this.handlers[event];
    handlers &&
      handlers.forEach((fn) => {
        fn(...args);
      });
  }
}
