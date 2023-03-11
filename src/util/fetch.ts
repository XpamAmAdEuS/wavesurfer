import Observer from './observer';
import {FetchOptions} from "../types";

class ProgressHandler {
  private instance: any;
  private total: number;
  private loaded: number;

  constructor(instance: any, contentLength: any, response: any) {
    this.instance = instance;
    this.instance._reader = response.body.getReader();

    this.total = parseInt(contentLength, 10);
    this.loaded = 0;
  }

  start(controller: any) {
    const read = () => {
      // instance._reader.read() returns a promise that resolves
      // when a value has been received
      this.instance._reader
        .read()
        .then(({ done, value }: any) => {
          // result objects contain two properties:
          // done  - true if the stream has already given you all its data.
          // value - some data. Always undefined when done is true.
          if (done) {
            // ensure onProgress called when content-length=0
            if (this.total === 0) {
              this.instance.onProgress.call(this.instance, {
                loaded: this.loaded,
                total: this.total,
                lengthComputable: false,
              });
            }
            // no more data needs to be consumed, close the stream
            controller.close();
            return;
          }

          this.loaded += value.byteLength;
          this.instance.onProgress.call(this.instance, {
            loaded: this.loaded,
            total: this.total,
            lengthComputable: !(this.total === 0),
          });
          // enqueue the next data chunk into our target stream
          controller.enqueue(value);
          read();
        })
        .catch((error: any) => {
          controller.error(error);
        });
    };

    read();
  }
}

export default function fetchFile(options: FetchOptions) {
  if (!options) {
    throw new Error('fetch options missing');
  } else if (!options.url) {
    throw new Error('fetch url missing');
  }
  const instance = new Observer();
  const fetchRequest = new Request(options.url);

  // add ability to abort
  instance.controller = new AbortController();

  // parse fetch options
  const responseType = options.responseType || 'json';
  const fetchOptions = {
    method: options.method || 'GET',
    headers: options.fetchHeaders || "",
    mode: options.mode || 'cors',
    credentials: options.credentials || 'same-origin',
    cache: options.cache || 'default',
    redirect: options.redirect || 'follow',
    referrer: options.referrer || 'client',
    signal: instance.controller.signal,
  };

  fetch(fetchRequest, fetchOptions)
    .then((response) => {
      // store response reference
      instance.response = response;

      let progressAvailable = true;
      if (!response.body) {
        // ReadableStream is not yet supported in this browser
        // see https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
        progressAvailable = false;
      }

      // Server must send CORS header "Access-Control-Expose-Headers: content-length"
      const contentLength = response.headers.get('content-length');
      if (contentLength === null) {
        // Content-Length server response header missing.
        // Don't evaluate download progress if we can't compare against a total size
        // see https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#Access-Control-Expose-Headers
        progressAvailable = false;
      }

      if (!progressAvailable) {
        // not able to check download progress so skip it
        return response;
      }

      // fire progress event when during load
      // @ts-ignore
      instance.onProgress = (e) => {
        instance.fireEvent('progress', e);
      };

      return new Response(
        new ReadableStream(new ProgressHandler(instance, contentLength, response)),
        fetchOptions,
      );
    })
    .then((response) => {
      let errMsg;
      if (response.ok) {
        switch (responseType) {
          case 'arraybuffer':
            return response.arrayBuffer();

          case 'json':
            return response.json();

          case 'blob':
            return response.blob();

          case 'text':
            return response.text();

          default:
            errMsg = 'Unknown responseType: ' + responseType;
            break;
        }
      }
      if (!errMsg) {
        errMsg = 'HTTP error status: ' + response.status;
      }
      throw new Error(errMsg);
    })
    .then((response) => {
      instance.fireEvent('success', response);
    })
    .catch((error) => {
      instance.fireEvent('error', error);
    });

  // return the fetch request
  instance.fetchRequest = fetchRequest;
  return instance;
}
