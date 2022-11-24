import * as util from './util';
import { WaveSurferParams } from './types';

export default class Drawer extends util.Observer {
  container: HTMLElement;
  height: number;
  lastPos: number;
  params: WaveSurferParams;
  width: number;
  wrapper: HTMLElement;

  constructor(container: HTMLElement, params: WaveSurferParams) {
    super();

    this.container = util.withOrientation(container, params.vertical!);
    this.params = params;
    this.width = 0;
    this.height = params.height! * this.params.pixelRatio!;
    this.lastPos = 0;
    this.wrapper = null as unknown as HTMLElement;
  }

  style(el: any, styles: any) {
    return util.style(el, styles);
  }

  createWrapper() {
    this.wrapper = util.withOrientation(
      this.container.appendChild(document.createElement('wave')),
      this.params.vertical!,
    );

    this.style(this.wrapper, {
      display: 'block',
      position: 'relative',
      userSelect: 'none',
      webkitUserSelect: 'none',
      height: this.params.height + 'px',
    });

    if (this.params.fillParent || this.params.scrollParent) {
      this.style(this.wrapper, {
        width: '100%',
        cursor: this.params.hideCursor ? 'none' : 'auto',
        overflowX: this.params.hideScrollbar ? 'hidden' : 'auto',
        overflowY: 'hidden',
      });
    }

    this.setupWrapperEvents();
  }

  handleEvent(e: any, noPrevent?: any) {
    !noPrevent && e.preventDefault();

    const clientX = util.withOrientation(
      e.targetTouches ? e.targetTouches[0] : e,
      this.params.vertical!,
    ).clientX;
    const bbox = this.wrapper.getBoundingClientRect();

    const nominalWidth = this.width;
    const parentWidth = this.getWidth();
    const progressPixels = this.getProgressPixels(bbox, clientX);

    let progress;
    if (!this.params.fillParent && nominalWidth < parentWidth) {
      progress = progressPixels * (this.params.pixelRatio! / nominalWidth) || 0;
    } else {
      progress = (progressPixels + this.wrapper.scrollLeft) / this.wrapper.scrollWidth || 0;
    }

    return util.clamp(progress, 0, 1);
  }

  getProgressPixels(wrapperBbox: any, clientX: number) {
    if (this.params.rtl) {
      return wrapperBbox.right - clientX;
    } else {
      return clientX - wrapperBbox.left;
    }
  }

  setupWrapperEvents() {
    this.wrapper.addEventListener('click', (e) => {
      const orientedEvent = util.withOrientation(e, this.params.vertical!);
      const scrollbarHeight = this.wrapper.offsetHeight - this.wrapper.clientHeight;

      if (scrollbarHeight !== 0) {
        // scrollbar is visible.  Check if click was on it
        const bbox = this.wrapper.getBoundingClientRect();
        if (orientedEvent.clientY >= bbox.bottom - scrollbarHeight) {
          // ignore mousedown as it was on the scrollbar
          return;
        }
      }

      if (this.params.interact) {
        this.fireEvent('click', e, this.handleEvent(e));
      }
    });

    this.wrapper.addEventListener('dblclick', (e) => {
      if (this.params.interact) {
        this.fireEvent('dblclick', e, this.handleEvent(e));
      }
    });

    this.wrapper.addEventListener('scroll', (e) => this.fireEvent('scroll', e));
  }

  drawPeaks(peaks: any[], length: any, start?: number, end?: number) {
    if (!this.setWidth(length)) {
      this.clearWave();
    }

    this.params.barWidth
      ? this.drawBars(peaks, 0, start!, end!)
      : this.drawWave(peaks, 0, start!, end!);
  }

  recenter(percent: number) {
    const position = this.wrapper.scrollWidth * percent;
    this.recenterOnPosition(position, true);
  }

  recenterOnPosition(position: number, immediate: boolean) {
    const scrollLeft = this.wrapper.scrollLeft;
    const half = ~~(this.wrapper.clientWidth / 2);
    const maxScroll = this.wrapper.scrollWidth - this.wrapper.clientWidth;
    let target = position - half;
    let offset = target - scrollLeft;

    if (maxScroll == 0) {
      // no need to continue if scrollbar is not there
      return;
    }

    // if the cursor is currently visible...
    if (!immediate && -half <= offset && offset < half) {
      // set rate at which waveform is centered
      let rate = this.params.autoCenterRate!;

      // make rate depend on width of view and length of waveform
      rate /= half;
      rate *= maxScroll;

      offset = Math.max(-rate, Math.min(rate, offset));
      target = scrollLeft + offset;
    }

    // limit target to valid range (0 to maxScroll)
    target = Math.max(0, Math.min(maxScroll, target));
    // no use attempting to scroll if we're not moving
    if (target != scrollLeft) {
      this.wrapper.scrollLeft = target;
    }
  }

  getWidth() {
    return Math.round(this.container.clientWidth * this.params.pixelRatio!);
  }

  setWidth(width: number) {
    if (this.width == width) {
      return false;
    }

    this.width = width;

    if (this.params.fillParent || this.params.scrollParent) {
      this.style(this.wrapper, {
        width: '',
      });
    } else {
      const newWidth = ~~(this.width / this.params.pixelRatio!) + 'px';
      this.style(this.wrapper, {
        width: newWidth,
      });
    }

    this.updateSize();
    return true;
  }

  progress(progress: number) {
    const minPxDelta = 1 / this.params.pixelRatio!;
    const pos = Math.round(progress * this.width) * minPxDelta;

    if (pos < this.lastPos || pos - this.lastPos >= minPxDelta) {
      this.lastPos = pos;

      if (this.params.scrollParent && this.params.autoCenter) {
        const newPos = ~~(this.wrapper.scrollWidth * progress);
        this.recenterOnPosition(newPos, this.params.autoCenterImmediately!);
      }

      this.updateProgress(pos);
    }
  }

  destroy() {
    this.unAll();
    if (this.wrapper) {
      if (this.wrapper.parentNode == (this.container as any).domElement) {
        this.container.removeChild((this.wrapper as any).domElement);
      }
      this.wrapper = null as any;
    }
  }

  updateCursor() {}

  updateSize() {}

  drawBars(peaks: any[], channelIndex: number, start: number, end: number) {}

  drawWave(peaks: any[], channelIndex: number, start: number, end: number) {}

  clearWave() {}

  updateProgress(position: number) {}
}
