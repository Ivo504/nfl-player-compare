/* Natural AI voice for Luna: the open-source Kokoro-82M text-to-speech model (Apache-2.0), run in the
   visitor's browser with kokoro-js. Nothing is sent to a server. The model (about 90 MB) downloads once
   from Hugging Face and is cached by the browser. Runs in a worker so the page stays responsive. */
(function () {
  'use strict';
  // window.KOKORO_LIB lets local tests load a stand-in library
  var LIB = window.KOKORO_LIB || 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
  var MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
  var VOICES = [
    { id: 'af_heart', name: 'Heart', accent: 'American', gender: 'female' },
    { id: 'af_bella', name: 'Bella', accent: 'American', gender: 'female' },
    { id: 'af_nicole', name: 'Nicole', accent: 'American', gender: 'female', note: 'soft' },
    { id: 'am_michael', name: 'Michael', accent: 'American', gender: 'male' },
    { id: 'am_fenrir', name: 'Fenrir', accent: 'American', gender: 'male' },
    { id: 'am_puck', name: 'Puck', accent: 'American', gender: 'male' },
    { id: 'bf_emma', name: 'Emma', accent: 'British', gender: 'female' },
    { id: 'bm_george', name: 'George', accent: 'British', gender: 'male' }
  ];
  var WORKER = [
    'import { KokoroTTS } from "' + LIB + '";',
    'let tts = null;',
    'self.onmessage = async (e) => {',
    '  const m = e.data;',
    '  if (m.type === "load") {',
    '    try {',
    '      tts = await KokoroTTS.from_pretrained("' + MODEL + '", { dtype: "q8", device: "wasm",',
    '        progress_callback: (p) => { if (p && p.status === "progress") self.postMessage({ type: "progress", file: p.file, loaded: p.loaded, total: p.total }); } });',
    '      self.postMessage({ type: "ready" });',
    '    } catch (err) { self.postMessage({ type: "error", message: String(err && err.message || err) }); }',
    '  } else if (m.type === "gen") {',
    '    try {',
    '      const a = await tts.generate(m.text, { voice: m.voice, speed: m.speed || 1 });',
    '      const data = a.audio instanceof Float32Array ? a.audio : new Float32Array(a.audio);',
    '      self.postMessage({ type: "audio", id: m.id, audio: data, rate: a.sampling_rate || 24000 }, [data.buffer]);',
    '    } catch (err) { self.postMessage({ type: "genError", id: m.id, message: String(err && err.message || err) }); }',
    '  }',
    '};'
  ].join('\n');

  var worker = null, state = 'off', loadPromise = null, ctx = null, listeners = {}, nextId = 1;
  var pending = {}, playing = [], session = 0, files = {};

  function supported() {
    return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext) && typeof Blob !== 'undefined';
  }
  function emit(type, data) { (listeners[type] || []).forEach(function (fn) { try { fn(data); } catch (e) { /* listener error */ } }); }
  function on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }
  function audio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function load() {
    if (loadPromise) return loadPromise;
    state = 'loading';
    emit('state', state);
    loadPromise = new Promise(function (resolve, reject) {
      try {
        var url = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }));
        worker = new Worker(url, { type: 'module' });
      } catch (e) { fail(e); return; }
      var timer = setTimeout(function () { fail(new Error('Timed out loading the voice model')); }, 300000);
      function fail(err) {
        clearTimeout(timer);
        state = 'error'; loadPromise = null;
        if (worker) { worker.terminate(); worker = null; }
        emit('state', state);
        reject(err);
      }
      worker.onerror = function (e) { fail(new Error(e.message || 'The voice could not start')); };
      worker.onmessage = function (e) {
        var m = e.data;
        if (m.type === 'progress') {
          files[m.file] = { loaded: m.loaded || 0, total: m.total || 0 };
          var loaded = 0, total = 0;
          Object.keys(files).forEach(function (k) { loaded += files[k].loaded; total += files[k].total; });
          emit('progress', { loaded: loaded, total: total });
        } else if (m.type === 'ready') {
          clearTimeout(timer); state = 'ready'; emit('state', state); resolve();
        } else if (m.type === 'error') {
          fail(new Error(m.message));
        } else if (m.type === 'audio' || m.type === 'genError') {
          var cb = pending[m.id];
          delete pending[m.id];
          if (cb) cb(m);
        }
      };
      worker.postMessage({ type: 'load' });
    });
    return loadPromise;
  }
  function generate(text, voice) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      pending[id] = function (m) { if (m.type === 'audio') resolve(m); else reject(new Error(m.message)); };
      worker.postMessage({ type: 'gen', id: id, text: text, voice: voice });
    });
  }
  function stop() {
    session++;
    playing.forEach(function (src) { try { src.stop(); } catch (e) { /* already stopped */ } });
    playing = [];
    emit('end');
  }
  // Speak sentence by sentence: the next sentence is generated while the current one plays.
  function speak(sentences, voice) {
    stop();
    var my = session, ac = audio(), at = ac.currentTime + 0.05, started = false;
    sentences = sentences.filter(function (s) { return /\w/.test(s); });
    if (!sentences.length) return Promise.resolve();
    var gens = sentences.map(function () { return null; });
    function gen(i) { if (i < sentences.length && !gens[i]) gens[i] = generate(sentences[i], voice); return gens[i]; }
    gen(0);
    return sentences.reduce(function (p, s, i) {
      return p.then(function () {
        if (my !== session) return;
        gen(i + 1);
        return gen(i).then(function (m) {
          if (my !== session) return;
          var buf = ac.createBuffer(1, m.audio.length, m.rate);
          buf.copyToChannel ? buf.copyToChannel(m.audio, 0) : buf.getChannelData(0).set(m.audio);
          var src = ac.createBufferSource();
          src.buffer = buf; src.connect(ac.destination);
          at = Math.max(at, ac.currentTime + 0.02);
          src.start(at);
          at += buf.duration + 0.12;
          playing.push(src);
          if (!started) { started = true; emit('start'); }
          if (i === sentences.length - 1) src.onended = function () { if (my === session) { playing = []; emit('end'); } };
        });
      });
    }, Promise.resolve()).catch(function (e) { if (my === session) { emit('end'); throw e; } });
  }

  window.NaturalVoice = {
    supported: supported, load: load, speak: speak, stop: stop, on: on, voices: VOICES, unlock: audio,
    get state() { return state; }
  };
})();
