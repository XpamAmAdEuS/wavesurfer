import * as util from './util';
import MultiCanvas from './drawer.multicanvas';
import WebAudio from './webaudio';
import { WaveSurferParams } from './types';

export default class WaveSurfer extends util.Observer {
  defaultParams = {
    autoCenter: true,
    autoCenterRate: 5,
    autoCenterImmediately: false,
    backend: 'WebAudio',
    backgroundColor: null,
    barHeight: 1,
    barRadius: 0,
    barGap: null,
    barMinHeight: null,
    container: null,
    cursorColor: '#333',
    cursorWidth: 1,
    dragSelection: true,
    duration: null,
    fillParent: true,
    height: 128,
    hideScrollbar: false,
    hideCursor: false,
    interact: true,
    loopSelection: true,
    maxCanvasWidth: 4000,
    minPxPerSec: 20,
    normalize: false,
    pixelRatio: window.devicePixelRatio || (screen as any).deviceXDPI / (screen as any).logicalXDPI,
    progressColor: '#555',
    renderer: MultiCanvas,
    responsive: true,
    rtl: false,
    scrollParent: false,
    skipLength: 2,
    vertical: false,
    waveColor: '#999',
    authToken: undefined,
  };

  params: WaveSurferParams;
  container: HTMLDivElement;
  savedVolume: number;
  isMuted: boolean;
  tmpEvents: any[];
  currentRequest: any;
  arraybuffer: null;
  drawer: MultiCanvas;
  backend: WebAudio;
  isDestroyed: boolean;
  isReady: boolean;
  _onResize: any;

  static create(params: WaveSurferParams): WaveSurfer {
    const wavesurfer = new WaveSurfer(params);
    return wavesurfer.init();
  }

  util = util;

  static util: WaveSurfer['util'] = util;

  constructor(params: WaveSurferParams) {
    super();

    this.params = Object.assign({}, this.defaultParams, params);

    this.container = this.params.container;

    if (!this.container) {
      throw new Error('Container element not found');
    }

    if (this.params.maxCanvasWidth! <= 1) {
      throw new Error('maxCanvasWidth must be greater than 1');
    } else if (this.params.maxCanvasWidth! % 2 == 1) {
      throw new Error('maxCanvasWidth must be an even number');
    }

    if (this.params.rtl === true) {
      if (this.params.vertical === true) {
        util.style(this.container, { transform: 'rotateX(180deg)' });
      } else {
        util.style(this.container, { transform: 'rotateY(180deg)' });
      }
    }

    if (this.params.backgroundColor) {
      this.setBackgroundColor(this.params.backgroundColor);
    }

    this.savedVolume = 0;

    this.isMuted = false;

    this.tmpEvents = [];

    this.currentRequest = null;
    this.arraybuffer = null;
    this.drawer = null as any;
    this.backend = null as any;

    this.isDestroyed = false;

    this.isReady = false;

    // responsive debounced event listener. If this.params.responsive is not
    // set, this is never called. Use 100ms or this.params.responsive as
    // timeout for the debounce function.
    let prevWidth = 0;
    this._onResize = util.debounce(
      () => {
        if (
          this.drawer.wrapper &&
          prevWidth != this.drawer.wrapper.clientWidth &&
          !this.params.scrollParent
        ) {
          prevWidth = this.drawer.wrapper.clientWidth;
          if (prevWidth) {
            // redraw only if waveform container is rendered and has a width
            this.drawer.fireEvent('redraw');
          }
        }
      },
      typeof this.params.responsive === 'number' ? this.params.responsive : 100,
    );

    return this;
  }

  init() {
    this.createDrawer();
    this.createBackend();
    // this.useStore = this.params.useStore().getState();
    return this;
  }

  createDrawer() {
    this.drawer = new MultiCanvas(this.container, this.params);
    this.drawer.init();
    this.fireEvent('drawer-created', this.drawer);

    if (this.params.responsive !== false) {
      window.addEventListener('resize', this._onResize, true);
      window.addEventListener('orientationchange', this._onResize, true);
    }

    this.drawer.on('redraw', () => {
      this.drawBuffer();
      this.drawer.progress(this.backend.getPlayedPercents());
    });

    // Click-to-seek
    this.drawer.on('click', (e: any, progress: number) => {
      setTimeout(() => this.seekTo(progress), 0);
    });

    // Relay the scroll event from the drawer
    this.drawer.on('scroll', (e: any) => {
      this.fireEvent('scroll', e);
    });
  }

  createBackend() {
    if (this.backend) {
      this.backend.destroy();
    }

    this.backend = new WebAudio(this.params);
    this.backend.init();
    this.fireEvent('backend-created', this.backend);

    this.backend.on('finish', () => {
      this.drawer.progress(this.backend.getPlayedPercents());
      this.fireEvent('finish');
    });
    this.backend.on('play', () => this.fireEvent('play'));
    this.backend.on('pause', () => this.fireEvent('pause'));

    this.backend.on('audioprocess', (time: number) => {
      this.drawer.progress(this.backend.getPlayedPercents());
      this.fireEvent('audioprocess', time);
    });
  }

  getDuration() {
    return this.backend.getDuration();
  }

  getCurrentTime() {
    return this.backend.getCurrentTime();
  }

  setCurrentTime(seconds: number) {
    if (seconds >= this.getDuration()) {
      this.seekTo(1);
    } else {
      this.seekTo(seconds / this.getDuration());
    }
  }

  play(start?: number, end?: number) {
    this.fireEvent('interaction', () => this.play(start, end));
    return this.backend.play(start, end);
  }

  pause() {
    if (!this.backend.isPaused()) {
      return this.backend.pause();
    }
  }

  playPause() {
    this.fireEvent('playPause', this.backend.isPaused());
    return this.backend.isPaused() ? this.play() : this.pause();
  }

  isPlaying() {
    return !this.backend.isPaused();
  }

  skipBackward(seconds: number) {
    this.skip(-seconds || -this.params.skipLength!);
  }

  skipForward(seconds: number) {
    this.skip(seconds || this.params.skipLength!);
  }

  skip(offset: number) {
    const duration = this.getDuration() || 1;
    let position = this.getCurrentTime() || 0;
    position = Math.max(0, Math.min(duration, position + (offset || 0)));
    this.seekAndCenter(position / duration);
  }

  seekAndCenter(progress: number) {
    this.seekTo(progress);
    this.drawer.recenter(progress);
  }

  seekTo(progress: number) {
    // return an error if progress is not a number between 0 and 1
    if (typeof progress !== 'number' || !isFinite(progress) || progress < 0 || progress > 1) {
      throw new Error(
        'Error calling wavesurfer.seekTo, parameter must be a number between 0 and 1!',
      );
    }
    this.fireEvent('interaction', () => this.seekTo(progress));

    const paused = this.backend.isPaused();

    if (!paused) {
      this.backend.pause();
    }

    // avoid small scrolls while paused seeking
    const oldScrollParent = this.params.scrollParent;
    this.params.scrollParent = false;
    this.backend.seekTo(progress * this.getDuration());
    this.drawer.progress(progress);

    if (!paused) {
      this.backend.play();
    }

    this.params.scrollParent = oldScrollParent;
    this.fireEvent('seek', progress);
  }

  stop() {
    this.pause();
    this.seekTo(0);
    this.drawer.progress(0);
  }

  setVolume(newVolume: number) {
    this.backend.setVolume(newVolume);
    this.fireEvent('volume', newVolume);
  }

  getVolume() {
    return this.backend.getVolume();
  }

  toggleMute() {
    this.setMute(!this.isMuted);
  }

  setMute(mute: boolean) {
    // ignore all muting requests if the audio is already in that state
    if (mute === this.isMuted) {
      this.fireEvent('mute', this.isMuted);
      return;
    }

    if (mute) {
      // If currently not muted then save current volume,
      // turn off the volume and update the mute properties
      this.savedVolume = this.backend.getVolume()!;
      this.backend.setVolume(0);
      this.isMuted = true;
      this.fireEvent('volume', 0);
    } else {
      // If currently muted then restore to the saved volume
      // and update the mute properties
      this.backend.setVolume(this.savedVolume);
      this.isMuted = false;
      this.fireEvent('volume', this.savedVolume);
    }

    this.fireEvent('mute', this.isMuted);
  }

  getMute() {
    return this.isMuted;
  }

  setBackgroundColor(color: any) {
    this.params.backgroundColor = color;
    util.style(this.container, { background: this.params.backgroundColor });
  }

  drawBuffer() {
    const nominalWidth = Math.round(
      this.getDuration() * this.params.minPxPerSec! * this.params.pixelRatio!,
    );
    const parentWidth = this.drawer.getWidth();
    let width = nominalWidth;
    // always start at 0 after zooming for scrolling : issue redraw left part
    let start = 0;
    let end = Math.max(start + parentWidth, width);
    // Fill container
    if (this.params.fillParent && (!this.params.scrollParent || nominalWidth < parentWidth)) {
      width = parentWidth;
      start = 0;
      end = width;
    }

    const peaks = this.backend.getPeaks(width, start, end);
    this.drawer.drawPeaks(peaks!, width, start, end);

    this.fireEvent('redraw', peaks, width);
  }

  loadArrayBuffer(arraybuffer: any) {
    this.decodeArrayBuffer(arraybuffer, (data: any) => {
      if (!this.isDestroyed) {
        this.loadDecodedBuffer(data);
      }
    });
  }

  loadDecodedBuffer(buffer: any) {
    this.backend.load(buffer);
    this.drawBuffer();
    this.isReady = true;
    this.fireEvent('ready');
  }

  load(url: string) {
    this.empty();

    return this.loadBuffer(url);
  }

  loadBuffer(url: string) {
    return this.getArrayBuffer(url, (data: any) => this.loadArrayBuffer(data));
  }

  decodeArrayBuffer(arraybuffer: any, callback: any) {
    if (!this.isDestroyed) {
      this.arraybuffer = arraybuffer;
      this.backend.decodeArrayBuffer(
        arraybuffer,
        (data: any) => {
          // Only use the decoded data if we haven't been destroyed or
          // another decode started in the meantime
          if (!this.isDestroyed && this.arraybuffer == arraybuffer) {
            callback(data);
            this.arraybuffer = null;
          }
        },
        () => this.fireEvent('error', 'Error decoding audiobuffer'),
      );
    }
  }

  getArrayBuffer(url: string, callback: any) {
    const options = Object.assign({
      url: url,
      responseType: 'arraybuffer',
      fetchHeaders: this.params.fetchHeaders,
    });
    const request = util.fetchFile(options);

    this.currentRequest = request;

    this.tmpEvents.push(
      request.on('progress', (e: number) => {
        this.onProgress(e);
      }),
      request.on('success', (data: any) => {
        callback(data);
        this.currentRequest = null;
      }),
      request.on('error', (e: any) => {
        this.fireEvent('error', e);
        this.currentRequest = null;
      }),
    );

    return request;
  }

  onProgress(e: any) {
    let percentComplete;
    if (e.lengthComputable) {
      percentComplete = e.loaded / e.total;
    } else {
      // Approximate progress with an asymptotic
      // function, and assume downloads in the 1-3 MB range.
      percentComplete = e.loaded / (e.loaded + 1000000);
    }
    this.fireEvent('loading', Math.round(percentComplete * 100), e.target);
  }

  cancelAjax() {
    if (this.currentRequest && this.currentRequest.controller) {
      if (this.currentRequest._reader) {
        this.currentRequest._reader.cancel().catch(() => {});
      }
      this.currentRequest.controller.abort();
      this.currentRequest = null;
    }
  }

  clearTmpEvents() {
    this.tmpEvents.forEach((e) => e.un());
  }

  empty() {
    if (!this.backend.isPaused()) {
      this.stop();
      this.backend.disconnectSource();
    }
    this.isReady = false;
    this.cancelAjax();
    this.clearTmpEvents();

    // empty drawer
    this.drawer.progress(0);
    this.drawer.setWidth(0);
    // @ts-ignore
    this.drawer.drawPeaks({ length: this.drawer.getWidth() }, 0);
  }

  destroy() {
    this.fireEvent('destroy');
    this.cancelAjax();
    this.clearTmpEvents();
    this.unAll();
    if (this.params.responsive !== false) {
      window.removeEventListener('resize', this._onResize, true);
      window.removeEventListener('orientationchange', this._onResize, true);
    }
    if (this.backend) {
      this.backend.destroy();
      this.backend = null as any;
    }
    if (this.drawer) {
      this.drawer.destroy();
    }
    this.isDestroyed = true;
    this.isReady = false;
    this.arraybuffer = null;
  }
}
