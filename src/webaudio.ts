import * as util from './util';
import { WaveSurferParams } from './types';
const PLAYING = 'playing';
const PAUSED = 'paused';
const FINISHED = 'finished';

export default class WebAudio extends util.Observer {
  ac: AudioContext;
  analyser: AnalyserNode | null;
  destroyed: boolean;
  gainNode: GainNode | null;
  scriptNode: ScriptProcessorNode;

  static scriptBufferSize = 16384;
  stateBehaviors = {
    [PLAYING]: {
      init(): any {
        // @ts-ignore
        this.addOnAudioProcess();
      },
      getPlayedPercents(): any {
        // @ts-ignore
        const duration = this.getDuration();
        return this.getCurrentTime() / duration || 0;
      },
      getCurrentTime(): any {
        // @ts-ignore
        return this.startPosition + this.getPlayedTime();
      },
    },
    [PAUSED]: {
      init() {
        // @ts-ignore
        this.removeOnAudioProcess();
      },
      getPlayedPercents(): any {
        // @ts-ignore
        const duration = this.getDuration();
        return this.getCurrentTime() / duration || 0;
      },
      getCurrentTime(): any {
        // @ts-ignore
        return this.startPosition;
      },
    },
    [FINISHED]: {
      init() {
        // @ts-ignore
        this.removeOnAudioProcess();
        // @ts-ignore
        this.fireEvent('finish');
      },
      getPlayedPercents() {
        return 1;
      },
      getCurrentTime(): any {
        // @ts-ignore
        return this.getDuration();
      },
    },
  };
  params: WaveSurferParams;
  lastPlay: number;
  startPosition: number;
  scheduledPause: number;
  states: any;
  buffer: any;
  mergedPeaks: any[] | null;
  offlineAc: OfflineAudioContext | null;
  peaks: any[] | null;
  playbackRate: number;
  source: AudioBufferSourceNode | null;
  splitPeaks: any[];
  state: any;

  getAudioContext() {
    if (!(window as any).WaveSurferAudioContext) {
      (window as any).WaveSurferAudioContext = new window.AudioContext();
    }
    return (window as any).WaveSurferAudioContext;
  }

  getOfflineAudioContext(sampleRate: any) {
    if (!(window as any).WaveSurferOfflineAudioContext) {
      (window as any).WaveSurferOfflineAudioContext = new window.OfflineAudioContext(1, 2, sampleRate);
    }
    return (window as any).WaveSurferOfflineAudioContext;
  }

  constructor(params: WaveSurferParams) {
    super();
    this.params = params;
    this.ac = this.getAudioContext();
    this.lastPlay = this.ac.currentTime;
    this.startPosition = 0;
    this.scheduledPause = null as any;
    this.states = {
      [PLAYING]: Object.create(this.stateBehaviors[PLAYING]),
      [PAUSED]: Object.create(this.stateBehaviors[PAUSED]),
      [FINISHED]: Object.create(this.stateBehaviors[FINISHED]),
    };
    this.buffer = null;
    this.gainNode = null;
    this.mergedPeaks = null;
    this.offlineAc = null;
    this.peaks = null;
    this.playbackRate = 1;
    this.analyser = null;
    this.scriptNode = null as any;
    this.source = null;
    this.splitPeaks = [];
    this.state = null;
    this.destroyed = false;
  }

  init() {
    this.createVolumeNode();
    this.createScriptNode();
    this.createAnalyserNode();
    this.setState(PAUSED);
    this.setLength(0);
  }

  setState(state: any) {
    if (this.state !== this.states[state]) {
      this.state = this.states[state];
      this.state.init.call(this);
    }
  }

  createScriptNode() {
    this.scriptNode = this.ac.createScriptProcessor(WebAudio.scriptBufferSize);
    this.scriptNode.connect(this.ac.destination);
  }

  addOnAudioProcess() {
    this.scriptNode.onaudioprocess = () => {
      const time = this.getCurrentTime();

      if (time >= this.getDuration()) {
        this.setState(FINISHED);
        this.fireEvent('pause');
      } else if (time >= this.scheduledPause) {
        this.pause();
      } else if (this.state === this.states[PLAYING]) {
        this.fireEvent('audioprocess', time);
      }
    };
  }

  removeOnAudioProcess() {
    this.scriptNode.onaudioprocess = null;
  }
  createAnalyserNode() {
    this.analyser = this.ac.createAnalyser();
    this.analyser.connect(this.gainNode!);
  }

  createVolumeNode() {
    // Create gain node using the AudioContext
    this.gainNode = this.ac.createGain();
    // Add the gain node to the graph
    this.gainNode.connect(this.ac.destination);
  }

  setVolume(value: number) {
    this.gainNode?.gain.setValueAtTime(value, this.ac.currentTime);
  }

  getVolume() {
    return this.gainNode?.gain.value;
  }

  decodeArrayBuffer(arraybuffer: any, callback: any, errback: any) {
    if (!this.offlineAc) {
      this.offlineAc = this.getOfflineAudioContext(
        this.ac && this.ac.sampleRate ? this.ac.sampleRate : 44100,
      );
    }
    if ('webkitAudioContext' in window) {
      // Safari: no support for Promise-based decodeAudioData enabled
      // Enable it in Safari using the Experimental Features > Modern WebAudio API option
      this.offlineAc!.decodeAudioData(arraybuffer, (data) => callback(data), errback);
    } else {
      this.offlineAc!
        .decodeAudioData(arraybuffer)
        .then((data) => callback(data))
        .catch((err) => errback(err));
    }
  }

  setLength(length: number) {
    // No resize, we can preserve the cached peaks.
    if (this.mergedPeaks && length == 2 * this.mergedPeaks.length - 1 + 2) {
      return;
    }

    this.splitPeaks = [];
    this.mergedPeaks = [];
    // Set the last element of the sparse array so the peak arrays are
    // appropriately sized for other calculations.
    const channels = this.buffer ? this.buffer.numberOfChannels : 1;
    let c;
    for (c = 0; c < channels; c++) {
      this.splitPeaks[c] = [];
      this.splitPeaks[c][2 * (length - 1)] = 0;
      this.splitPeaks[c][2 * (length - 1) + 1] = 0;
    }
    this.mergedPeaks[2 * (length - 1)] = 0;
    this.mergedPeaks[2 * (length - 1) + 1] = 0;
  }

  getPeaks(length: number, first: number, last: number) {
    if (this.peaks) {
      return this.peaks;
    }
    if (!this.buffer) {
      return [];
    }

    first = first || 0;
    last = last || length - 1;

    this.setLength(length);

    if (!this.buffer) {
      return this.mergedPeaks;
    }

    const sampleSize = this.buffer.length / length;
    const sampleStep = ~~(sampleSize / 10) || 1;
    const channels = this.buffer.numberOfChannels;
    let c;

    for (c = 0; c < channels; c++) {
      const peaks = this.splitPeaks[c];
      const chan = this.buffer.getChannelData(c);
      let i;

      for (i = first; i <= last; i++) {
        const start = ~~(i * sampleSize);
        const end = ~~(start + sampleSize);
        let min = chan[start];
        let max = min;
        let j;

        for (j = start; j < end; j += sampleStep) {
          const value = chan[j];

          if (value > max) {
            max = value;
          }

          if (value < min) {
            min = value;
          }
        }

        peaks[2 * i] = max;
        peaks[2 * i + 1] = min;

        if (c == 0 || max > this.mergedPeaks![2 * i]) {
          this.mergedPeaks![2 * i] = max;
        }

        if (c == 0 || min < this.mergedPeaks![2 * i + 1]) {
          this.mergedPeaks![2 * i + 1] = min;
        }
      }
    }

    return this.mergedPeaks;
  }

  getPlayedPercents() {
    return this.state.getPlayedPercents.call(this);
  }

  disconnectSource() {
    if (this.source) {
      this.source.disconnect();
    }
  }

  destroyWebAudio() {
    this.disconnectSource();
    this.gainNode?.disconnect();
    this.scriptNode.disconnect();
    this.analyser?.disconnect();
  }

  destroy() {
    if (!this.isPaused()) {
      this.pause();
    }
    this.unAll();
    this.buffer = null;
    this.destroyed = true;

    this.destroyWebAudio();
  }

  load(buffer: any) {
    this.startPosition = 0;
    this.lastPlay = this.ac.currentTime;
    this.buffer = buffer;
    this.createSource();
  }

  createSource() {
    this.disconnectSource();
    this.source = this.ac.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.analyser!);
  }

  resumeAudioContext() {
    if (this.ac.state == 'suspended') {
      this.ac.resume && this.ac.resume();
    }
  }

  isPaused() {
    return this.state !== this.states[PLAYING];
  }

  getDuration() {
    if (!this.buffer) {
      return 0;
    }
    return this.buffer.duration;
  }

  seekTo(start: number, end?: number) {
    if (!this.buffer) {
      return;
    }

    this.scheduledPause = null as any;

    if (start == null) {
      start = this.getCurrentTime();
      if (start >= this.getDuration()) {
        start = 0;
      }
    }
    if (end == null) {
      end = this.getDuration();
    }

    this.startPosition = start;
    this.lastPlay = this.ac.currentTime;

    if (this.state === this.states[FINISHED]) {
      this.setState(PAUSED);
    }

    return {
      start: start,
      end: end,
    };
  }

  getPlayedTime() {
    return (this.ac.currentTime - this.lastPlay) * this.playbackRate;
  }

  play(start?: number, end?: number) {
    if (!this.buffer) {
      return;
    }

    // need to re-create source on each playback
    this.createSource();

    const adjustedTime = this.seekTo(start!, end);

    start = adjustedTime?.start;
    end = adjustedTime?.end;

    this.scheduledPause = end!;

    this.source!.start(0, start);

    this.resumeAudioContext();

    this.setState(PLAYING);

    this.fireEvent('play');
  }

  pause() {
    this.scheduledPause = null as any;

    this.startPosition += this.getPlayedTime();
    try {
      this.source && this.source.stop(0);
    } catch (err) {
      // Calling stop can throw the following 2 errors:
      // - RangeError (The value specified for when is negative.)
      // - InvalidStateNode (The node has not been started by calling start().)
      // We can safely ignore both errors, because:
      // - The range is surely correct
      // - The node might not have been started yet, in which case we just want to carry on without causing any trouble.
    }

    this.setState(PAUSED);

    this.fireEvent('pause');
  }

  getCurrentTime() {
    return this.state.getCurrentTime.call(this);
  }

  setPlayEnd(end: number) {
    this.scheduledPause = end;
  }
}
