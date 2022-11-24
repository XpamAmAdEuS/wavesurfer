export interface WaveSurferParams {
    /** If a scrollbar is present, center the waveform on current progress (default: true). */
    autoCenter?: boolean | undefined;
    /** If autoCenter is active, rate at which the waveform is centered (default: 5). */
    autoCenterRate?: number | undefined;
    /** If autoCenter is active, immediately center waveform on current progress (default: false). */
    autoCenterImmediately?: boolean | undefined;
    /**
     * Backend to use (default: 'WebAudio').
     *
     * MediaElement is a fallback for unsupported browsers.
     * MediaElementWebAudio allows to use WebAudio API also with big audio files, loading audio like with MediaElement backend (HTML5 audio tag).
     */
    backend?: 'WebAudio';
    /** Change background color of the waveform container (default: null). */
    backgroundColor?: string | undefined;
    /** The height of the wave bars (default: 1). */
    barHeight?: number | undefined;
    /** The radius of the wave bars (default: 0). Makes bars rounded. */
    barRadius?: number | undefined;
    /** The optional spacing between bars of the wave, if not provided will be calculated in legacy format (default: null). */
    barGap?: number | undefined;
    /** Draw the waveform using bars (default: null). */
    barWidth?: number | undefined;
    /** If specified, draw at least a bar of this height, eliminating waveform gaps (default: null). */
    barMinHeight?: number | undefined;
    /** CSS selector or HTML element where the waveform should be drawn. This is the only required parameter. */
    container: HTMLDivElement;
    /** The fill color of the cursor indicating the playhead position (default: '#333'). */
    cursorColor?: string | undefined;
    /** Measured in pixels (default: 1). */
    cursorWidth?: number | undefined;
    /** Optional audio length so pre-rendered peaks can be display immediately for example (default: null). */
    duration?: number | undefined;
    /** Whether to fill the entire container or draw only according to minPxPerSec (default: true). */
    fillParent?: boolean | undefined;
    /** The height of the waveform. Measured in pixels (default: 128). */
    height?: number | undefined;
    /** Whether to hide the mouse cursor when one would normally be shown by default (default: false). */
    hideCursor?: boolean | undefined;
    /** Whether to hide the horizontal scrollbar when one would normally be shown (default: false). */
    hideScrollbar?: boolean | undefined;
    /** Whether the mouse interaction will be enabled at initialization. You can switch this parameter at any time later on (default: true). */
    interact?: boolean | undefined;
    /** (Use with regions plugin) Enable looping of selected regions (default: false). */
    loopSelection?: boolean | undefined;
    /** Maximum width of a single canvas in pixels (default: 4000). */
    maxCanvasWidth?: number | undefined;
    /** Minimum number of pixels per second of audio (default: 20). */
    minPxPerSec?: number | undefined;
    /** If true, normalize by the maximum peak instead of 1.0 (default: false). */
    normalize?: boolean | undefined;
    /** The pixel ratio used to calculate display (default: window.deviceDixelRatio). */
    pixelRatio?: number | undefined;
    /** The fill color of the part of the waveform behind the cursor (default: '#555'). */
    progressColor?: string | undefined;
    /** Set to false to keep the media element in the DOM when the player is destroyed (default: true). */
    removeMediaElementOnDestroy?: boolean | undefined;
    /** Can be used to inject a custom renderer (default: MultiCanvas). */
    renderer?: any | undefined;
    /**
     * If set to true resize the waveform, when the window is resized (default: false).
     *
     * This is debounced with a 100ms timeout by default. If this parameter is a number it represents that timeout.
     */
    responsive?: boolean | number | undefined;
    /** If set to true, renders waveform from right-to-left (default: false). */
    rtl?: boolean | undefined;
    /** Whether to scroll the container with a lengthy waveform. Otherwise the waveform is shrunk to the container width (see fillParent) (default: false). */
    scrollParent?: boolean | undefined;
    /** Number of seconds to skip with the skipForward() and skipBackward() methods (default: 2). */
    skipLength?: number | undefined;
    /** Render the waveform vertically instead of horizontally. */
    vertical?: boolean | undefined;
    /** The fill color of the waveform after the cursor. */
    waveColor?: string | CanvasGradient | undefined;
    authToken: string;
}

export interface Styles {
    [styleName: string]: string;
}

export type EventHandler = (...args: any[]) => void;

export interface ListenerDescriptor {
    name: string;
    callback: (...args: any[]) => void;
    un: (e?: any, u?: any) => void;
}

