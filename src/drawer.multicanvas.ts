import Drawer from './drawer';
import * as util from './util';
import CanvasEntry from './drawer.canvasentry';
import { WaveSurferParams } from './types';

export default class MultiCanvas extends Drawer {
  EntryClass: typeof CanvasEntry;
  barRadius: number;
  canvasContextAttributes: {
    desynchronized: boolean;
  };
  canvases: CanvasEntry[];
  halfPixel: number;
  hasProgressCanvas: boolean;
  maxCanvasElementWidth: number;
  maxCanvasWidth: number;
  overlap: number;
  progressWave: HTMLElement;
  vertical: boolean;

  constructor(container: HTMLElement, params: WaveSurferParams) {
    super(container, params);
    this.maxCanvasWidth = params.maxCanvasWidth!;
    this.maxCanvasElementWidth = Math.round(params.maxCanvasWidth! / params.pixelRatio!);
    this.hasProgressCanvas = params.waveColor != params.progressColor;
    this.halfPixel = 0.5 / params.pixelRatio!;
    this.canvases = [];
    this.progressWave = null as any;
    this.EntryClass = CanvasEntry;
    this.canvasContextAttributes = {
      desynchronized: false,
    };
    this.overlap = 2 * Math.ceil(params.pixelRatio! / 2);
    this.barRadius = params.barRadius || 0;
    this.vertical = params.vertical!;
  }

  init() {
    this.createWrapper();
    this.createElements();
  }

  createElements() {
    this.progressWave = util.withOrientation(
      this.wrapper.appendChild(document.createElement('wave')),
      this.params.vertical!,
    );
    this.style(this.progressWave, {
      position: 'absolute',
      zIndex: 3,
      left: 0,
      top: 0,
      bottom: 0,
      overflow: 'hidden',
      width: '0',
      display: 'none',
      boxSizing: 'border-box',
      borderRightStyle: 'solid',
      pointerEvents: 'none',
    });

    this.addCanvas();
    this.updateCursor();
  }

  updateCursor() {
    this.style(this.progressWave, {
      borderRightWidth: this.params.cursorWidth + 'px',
      borderRightColor: this.params.cursorColor,
    });
  }

  updateSize() {
    const totalWidth = Math.round(this.width / this.params.pixelRatio!);
    const requiredCanvases = Math.ceil(totalWidth / (this.maxCanvasElementWidth + this.overlap));

    // add required canvases
    while (this.canvases.length < requiredCanvases) {
      this.addCanvas();
    }

    // remove older existing canvases, if any
    while (this.canvases.length > requiredCanvases) {
      this.removeCanvas();
    }

    let canvasWidth = this.maxCanvasWidth + this.overlap;
    const lastCanvas = this.canvases.length - 1;
    this.canvases.forEach((entry, i) => {
      if (i == lastCanvas) {
        canvasWidth = this.width - this.maxCanvasWidth * lastCanvas;
      }
      this.updateDimensions(entry, canvasWidth, this.height);

      entry.clearWave();
    });
  }

  addCanvas() {
    const entry = new this.EntryClass();
    entry.canvasContextAttributes = this.canvasContextAttributes;
    entry.hasProgressCanvas = this.hasProgressCanvas;
    entry.halfPixel = this.halfPixel;
    const leftOffset = this.maxCanvasElementWidth * this.canvases.length;

    // wave
    const wave = util.withOrientation(
      this.wrapper.appendChild(document.createElement('canvas')),
      this.params.vertical!,
    );
    this.style(wave, {
      position: 'absolute',
      zIndex: 2,
      left: leftOffset + 'px',
      top: 0,
      bottom: 0,
      height: '100%',
      pointerEvents: 'none',
    });
    entry.initWave(wave);

    // progress
    if (this.hasProgressCanvas) {
      const progress = util.withOrientation(
        this.progressWave.appendChild(document.createElement('canvas')),
        this.params.vertical!,
      );
      this.style(progress, {
        position: 'absolute',
        left: leftOffset + 'px',
        top: 0,
        bottom: 0,
        height: '100%',
      });
      entry.initProgress(progress);
    }

    this.canvases.push(entry);
  }

  removeCanvas() {
    let lastEntry = this.canvases[this.canvases.length - 1];

    // wave
    lastEntry.wave!.parentElement!.removeChild((lastEntry.wave as any).domElement);

    // progress
    if (this.hasProgressCanvas) {
      lastEntry.progress!.parentElement!.removeChild((lastEntry.progress as any).domElement);
    }

    // cleanup
    if (lastEntry) {
      lastEntry.destroy();
      lastEntry = null as any;
    }

    this.canvases.pop();
  }

  updateDimensions(entry: CanvasEntry, width: number, height: number) {
    const elementWidth = Math.round(width / this.params.pixelRatio!);
    const totalWidth = Math.round(this.width / this.params.pixelRatio!);

    // update canvas dimensions
    entry.updateDimensions(elementWidth, totalWidth, width, height);

    // style element
    this.style(this.progressWave, { display: 'block' });
  }

  clearWave() {
    util.frame(() => {
      this.canvases.forEach((entry) => entry.clearWave());
    })();
  }

  drawBars(peaks: any[], channelIndex: number, start: number, end: number) {
    return this.prepareDraw(
      peaks,
      channelIndex,
      start,
      end,
      ({
        absmax,
        hasMinVals,
        height,
        offsetY,
        halfH,
        peaks,
        channelIndex: ch,
      }: {
        absmax: number;
        hasMinVals: boolean;
        height: number;
        offsetY: number;
        halfH: number;
        peaks: any[];
        channelIndex: number;
      }) => {
        // if drawBars was called within ws.empty we don't pass a start and
        // don't want anything to happen
        if (start === undefined) {
          return;
        }
        // Skip every other value if there are negatives.
        const peakIndexScale = hasMinVals ? 2 : 1;
        const length = peaks.length / peakIndexScale;
        const bar = this.params.barWidth! * this.params.pixelRatio!;
        const gap =
          this.params.barGap === null
            ? Math.max(this.params.pixelRatio!, ~~(bar / 2))
            : Math.max(this.params.pixelRatio!, this.params.barGap! * this.params.pixelRatio!);
        const step = bar + gap;

        const scale = length / this.width;
        const first = start;
        const last = end;
        let peakIndex = first;
        for (peakIndex; peakIndex < last; peakIndex += step) {
          // search for the highest peak in the range this bar falls into
          let peak = 0;
          let peakIndexRange = Math.floor(peakIndex * scale) * peakIndexScale; // start index
          const peakIndexEnd = Math.floor((peakIndex + step) * scale) * peakIndexScale;
          do {
            // do..while makes sure at least one peak is always evaluated
            const newPeak = Math.abs(peaks[peakIndexRange]); // for arrays starting with negative values
            if (newPeak > peak) {
              peak = newPeak; // higher
            }
            peakIndexRange += peakIndexScale; // skip every other value for negatives
          } while (peakIndexRange < peakIndexEnd);

          // calculate the height of this bar according to the highest peak found
          let h = Math.round((peak / absmax) * halfH);

          // raise the bar height to the specified minimum height
          // Math.max is used to replace any value smaller than barMinHeight (not just 0) with barMinHeight
          if (this.params.barMinHeight) {
            h = Math.max(h, this.params.barMinHeight);
          }

          this.fillRect(
            peakIndex + this.halfPixel,
            halfH - h + offsetY,
            bar + this.halfPixel,
            h * 2,
            this.barRadius,
            ch,
          );
        }
      },
    );
  }

  drawWave(peaks: any[], channelIndex: number, start: number, end: number) {
    return this.prepareDraw(
      peaks,
      channelIndex,
      start,
      end,
      ({
        absmax,
        hasMinVals,
        height,
        offsetY,
        halfH,
        peaks,
        channelIndex,
      }: {
        absmax: number;
        hasMinVals: boolean;
        height: number;
        offsetY: number;
        halfH: number;
        peaks: any[];
        channelIndex: number;
      }) => {
        if (!hasMinVals) {
          const reflectedPeaks: any[] = [];
          const len = peaks.length;
          let i = 0;
          for (i; i < len; i++) {
            reflectedPeaks[2 * i] = peaks[i];
            reflectedPeaks[2 * i + 1] = -peaks[i];
          }
          peaks = reflectedPeaks;
        }

        // if drawWave was called within ws.empty we don't pass a start and
        // end and simply want a flat line
        if (start !== undefined) {
          this.drawLine(peaks, absmax, halfH, offsetY, start, end, channelIndex);
        }

        // always draw a median line
        this.fillRect(
          0,
          halfH + offsetY - this.halfPixel,
          this.width,
          this.halfPixel,
          this.barRadius,
          channelIndex,
        );
      },
    );
  }

  drawLine(
    peaks: any[],
    absmax: number,
    halfH: number,
    offsetY: number,
    start: number,
    end: number,
    channelIndex: number,
  ) {
    const { waveColor, progressColor } = {} as any;
    this.canvases.forEach((entry, i) => {
      this.setFillStyles(entry, waveColor, progressColor);
      this.applyCanvasTransforms(entry, this.params.vertical);
      entry.drawLines(peaks, absmax, halfH, offsetY, start, end);
    });
  }

  fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    channelIndex: number,
  ) {
    const startCanvas = Math.floor(x / this.maxCanvasWidth);
    const endCanvas = Math.min(
      Math.ceil((x + width) / this.maxCanvasWidth) + 1,
      this.canvases.length,
    );
    let i = startCanvas;
    for (i; i < endCanvas; i++) {
      const entry = this.canvases[i];
      const leftOffset = i * this.maxCanvasWidth;

      const intersection = {
        x1: Math.max(x, i * this.maxCanvasWidth),
        y1: y,
        x2: Math.min(x + width, i * this.maxCanvasWidth + entry.wave!.width),
        y2: y + height,
      };

      if (intersection.x1 < intersection.x2) {
        const { waveColor, progressColor } = {} as any;
        this.setFillStyles(entry, waveColor, progressColor);
        this.applyCanvasTransforms(entry, this.params.vertical);

        entry.fillRects(
          intersection.x1 - leftOffset,
          intersection.y1,
          intersection.x2 - intersection.x1,
          intersection.y2 - intersection.y1,
          radius,
        );
      }
    }
  }

  prepareDraw(
    peaks: any[],
    channelIndex: number,
    start: number,
    end: number,
    fn: any,
    drawIndex?: any,
    normalizedMax?: any,
  ) {
    return util.frame(() => {
      if (peaks[0] instanceof Array) {
        const channels = peaks;
        peaks = channels[0];
      }

      let absmax = 1 / this.params.barHeight!;
      if (this.params.normalize) {
        absmax = normalizedMax === undefined ? util.absMax(peaks) : normalizedMax;
      }

      const hasMinVals = ([] as any[]).some.call(peaks, (val) => val < 0);
      const height = this.params.height! * this.params.pixelRatio!;
      const halfH = height / 2;

      const offsetY = height * drawIndex || 0;

      return fn({
        absmax: absmax,
        hasMinVals: hasMinVals,
        height: height,
        offsetY: offsetY,
        halfH: halfH,
        peaks: peaks,
        channelIndex: channelIndex,
      });
    })();
  }

  setFillStyles(
    entry: CanvasEntry,
    waveColor: any = this.params.waveColor,
    progressColor: any = this.params.progressColor,
  ) {
    entry.setFillStyles(waveColor, progressColor);
  }

  applyCanvasTransforms(entry: CanvasEntry, vertical = false) {
    entry.applyCanvasTransforms(vertical);
  }

  updateProgress(position: number) {
    this.style(this.progressWave, { width: position + 'px' });
  }
}
