import style from './util/style';
import getId from './util/get-id';

export default class CanvasEntry {
  wave: HTMLCanvasElement | null;
  waveCtx: CanvasRenderingContext2D | null;
  progress: HTMLCanvasElement | null;
  progressCtx: CanvasRenderingContext2D | null;
  start: number;
  end: number;
  id: string;
  canvasContextAttributes: {};
  hasProgressCanvas: any;
  halfPixel: number | undefined;
  constructor() {
    this.wave = null;
    this.waveCtx = null;
    this.progress = null;
    this.progressCtx = null;
    this.start = 0;
    this.end = 1;
    this.id = getId(
      typeof this.constructor.name !== 'undefined'
        ? this.constructor.name.toLowerCase() + '_'
        : 'canvasentry_',
    );
    this.canvasContextAttributes = {};
  }

  initWave(element: HTMLCanvasElement) {
    this.wave = element;
    this.waveCtx = this.wave.getContext(
      '2d',
      this.canvasContextAttributes,
    ) as CanvasRenderingContext2D;
  }

  initProgress(element: HTMLCanvasElement) {
    this.progress = element;
    this.progressCtx = this.progress.getContext(
      '2d',
      this.canvasContextAttributes,
    ) as CanvasRenderingContext2D;
  }

  updateDimensions(elementWidth: number, totalWidth: number, width: number, height: number) {
    // where the canvas starts and ends in the waveform, represented as a
    // decimal between 0 and 1
    this.start = this.wave!.offsetLeft / totalWidth || 0;
    this.end = this.start + elementWidth / totalWidth;

    // set wave canvas dimensions
    this.wave!.width = width;
    this.wave!.height = height;
    const elementSize = { width: elementWidth + 'px' };
    style(this.wave, elementSize);

    if (this.hasProgressCanvas) {
      // set progress canvas dimensions
      this.progress!.width = width;
      this.progress!.height = height;
      style(this.progress, elementSize);
    }
  }

  clearWave() {
    // wave

    this.waveCtx!.clearRect(0, 0, this.waveCtx!.canvas.width, this.waveCtx!.canvas.height);

    // progress
    if (this.hasProgressCanvas) {
      this.progressCtx!.clearRect(
        0,
        0,
        this.progressCtx!.canvas.width,
        this.progressCtx!.canvas.height,
      );
    }
  }

  setFillStyles(waveColor: string, progressColor: string) {
    this.waveCtx!.fillStyle = this.getFillStyle(this.waveCtx!, waveColor);

    if (this.hasProgressCanvas) {
      this.progressCtx!.fillStyle = this.getFillStyle(this.progressCtx!, progressColor);
    }
  }

  getFillStyle(ctx: CanvasRenderingContext2D, color: any) {
    if (typeof color == 'string' || color instanceof CanvasGradient) {
      return color;
    }

    const waveGradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    color.forEach((value: any, index: any) =>
      waveGradient.addColorStop(index / color.length, value),
    );

    return waveGradient;
  }

  applyCanvasTransforms(vertical: boolean) {
    if (vertical) {
      // Reflect the waveform across the line y = -x
      if ('setTransform' in this.waveCtx!) {
        this.waveCtx.setTransform(0, 1, 1, 0, 0, 0);
      }

      if (this.hasProgressCanvas) {
        if ('setTransform' in this.progressCtx!) {
          this.progressCtx.setTransform(0, 1, 1, 0, 0, 0);
        }
      }
    }
  }

  fillRects(x: number, y: number, width: number, height: number, radius: number) {
    this.fillRectToContext(this.waveCtx, x, y, width, height, radius);

    if (this.hasProgressCanvas) {
      this.fillRectToContext(this.progressCtx, x, y, width, height, radius);
    }
  }

  fillRectToContext(
    ctx: CanvasRenderingContext2D | null,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    if (!ctx) {
      return;
    }

    if (radius) {
      this.drawRoundedRect(ctx, x, y, width, height, radius);
    } else {
      ctx.fillRect(x, y, width, height);
    }
  }

  drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    if (height === 0) {
      return;
    }
    // peaks are float values from -1 to 1. Use absolute height values in
    // order to correctly calculate rounded rectangle coordinates
    if (height < 0) {
      height *= -1;
      y -= height;
    }

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  drawLines(
    peaks: any[],
    absmax: number,
    halfH: number,
    offsetY: number,
    start: number,
    end: number,
  ) {
    this.drawLineToContext(this.waveCtx!, peaks, absmax, halfH, offsetY, start, end);

    if (this.hasProgressCanvas) {
      this.drawLineToContext(this.progressCtx!, peaks, absmax, halfH, offsetY, start, end);
    }
  }

  drawLineToContext(
    ctx: CanvasRenderingContext2D,
    peaks: any[],
    absmax: number,
    halfH: number,
    offsetY: number,
    start: number,
    end: number,
  ) {
    if (!ctx) {
      return;
    }

    const length = peaks.length / 2;
    const first = Math.round(length * this.start);

    // use one more peak value to make sure we join peaks at ends -- unless,
    // of course, this is the last canvas
    const last = Math.round(length * this.end) + 1;

    const canvasStart = first;
    const canvasEnd = last;
    const scale = this.wave!.width / (canvasEnd - canvasStart - 1);

    // optimization
    const halfOffset = halfH + offsetY;
    const absmaxHalf = absmax / halfH;

    ctx.beginPath();
    ctx.moveTo((canvasStart - first) * scale, halfOffset);

    ctx.lineTo(
      (canvasStart - first) * scale,
      halfOffset - Math.round((peaks[2 * canvasStart] || 0) / absmaxHalf),
    );

    let i, peak, h;
    for (i = canvasStart; i < canvasEnd; i++) {
      peak = peaks[2 * i] || 0;
      h = Math.round(peak / absmaxHalf);
      ctx.lineTo((i - first) * scale + this.halfPixel!, halfOffset - h);
    }

    // draw the bottom edge going backwards, to make a single
    // closed hull to fill
    let j = canvasEnd - 1;
    for (j; j >= canvasStart; j--) {
      peak = peaks[2 * j + 1] || 0;
      h = Math.round(peak / absmaxHalf);
      ctx.lineTo((j - first) * scale + this.halfPixel!, halfOffset - h);
    }

    ctx.lineTo(
      (canvasStart - first) * scale,
      halfOffset - Math.round((peaks[2 * canvasStart + 1] || 0) / absmaxHalf),
    );

    ctx.closePath();
    ctx.fill();
  }

  destroy() {
    this.waveCtx = null;
    this.wave = null;
    this.progressCtx = null;
    this.progress = null;
  }
}
