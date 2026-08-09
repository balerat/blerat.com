/*!
 * mla-bg.js — Milton Library Assistant ASCII eye, as a page background.
 * No dependencies.
 *
 *   <script src="mla-bg.js"></script>
 *   <script>MLABackground();</script>
 *
 * Returns a handle with .destroy(). Pass an options object to override any
 * of the DEFAULTS below.
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    mount: null,              // element to fill; null = fixed full-viewport layer
    fontSize: 10,             // px — bigger = coarser grid = cheaper
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    color: 'currentColor',
    opacity: 0.5,
    zIndex: '0',
    fps: 60,
    ease: 0.2,               // gaze smoothing, 0..1 per frame
    pow: 1.5,                // lid curve: 1 = parabola, <1 = almond
    blinkSplit: 0.8,         // share of the closure done by the upper lid
    fill: 0.28,               // eye size as a fraction of the grid
    shape: 2.2,               // eye width : height, in physical px
    offsetX: -155,               // -1 = hard left, 0 = centred, +1 = hard right
    offsetY: 25,               // -1 = hard top,  0 = centred, +1 = hard bottom
    sclera: '.',
    spokes: '|/-\\',
    pupil: '@',
    limbus: '#',
    idleAfter: 2.5,           // s without pointer motion before it drifts
    reducedMotion: true,      // honour prefers-reduced-motion

    // --- iris ------------------------------------------------------------
    irisScale: 0.62,          // 1.0 = old size; smaller iris = more travel
    travel: 0.85,             // multiplier on how far the iris can roam (1.0 = to the corners)
    irisFit: 1.25,            // lid opening must stay this x the iris diameter

    // --- blink -----------------------------------------------------------
    blinkDurMin: 0.55,        // s
    blinkDurMax: 0.90,
    blinkClose: 0.32          // fraction of the blink spent closing (rest opens)
  };

  var RIM_HALF    = 0.85;     // rows — half-thickness of the socket outline
  var CREASE_HALF = 0.75;     // rows — half-thickness of the moving lid edge
  var LID_RAMP    = '.:=#';   // lid skin, light (socket) -> heavy (crease)

  function charWidth(size, family) {
    var c = document.createElement('canvas').getContext('2d');
    c.font = size + 'px ' + family;
    return c.measureText('M').width || size * 0.6;
  }

  // Fast close, slow open — deliberately asymmetric.
  function blinkCurve(p, closeFrac) {
    var q;
    if (p < closeFrac) { q = p / closeFrac; }
    else { q = 1 - (p - closeFrac) / (1 - closeFrac); }
    return q * q * (3 - 2 * q);
  }

  function MLABackground(options) {
    var o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in (options || {})) o[k] = options[k];

    var still = o.reducedMotion &&
      global.matchMedia &&
      global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var host = o.mount;
    var layer = document.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText =
      'pointer-events:none;user-select:none;overflow:hidden;' +
      'display:flex;align-items:center;justify-content:center;' +
      'z-index:' + o.zIndex + ';opacity:' + o.opacity + ';' +
      (host ? 'position:absolute;inset:0;'
            : 'position:fixed;inset:0;');

    var pre = document.createElement('pre');
    pre.style.cssText =
      'margin:0;white-space:pre;font-family:' + o.fontFamily + ';' +
      'font-size:' + o.fontSize + 'px;color:' + o.color + ';' +
      'letter-spacing:0;font-variant-ligatures:none;';
    layer.appendChild(pre);
    (host || document.body).appendChild(layer);

    // ---- geometry, recomputed on resize -------------------------------
    var COLS, ROWS, CX, CY, EYE_W, LID_UP, LID_DN, IRIS_R, PUPIL_R,
        GLINT_O, GLINT_R, ASPECT, ROAM_X, ROAM_Y, IRIS_ROWS, cw, lh;

    function layout() {
      var w = layer.clientWidth, h = layer.clientHeight;
      cw = charWidth(o.fontSize, o.fontFamily);
      lh = Math.round(o.fontSize * 1.15);
      pre.style.lineHeight = lh + 'px';
      ASPECT = lh / cw;

      COLS = Math.max(24, Math.floor(w / cw) - 1);
      ROWS = Math.max(11, Math.floor(h / lh) - 1);
      // Shift the eye's centre cell; x = i - CX, so a larger CX moves right.
      CX = (COLS - 1) / 2 + o.offsetX;
      CY = (ROWS - 1) / 2 + o.offsetY;

      EYE_W = COLS * 0.5 * o.fill;
      var half = Math.min(ROWS * 0.5 * o.fill, (EYE_W * cw) / (o.shape * lh));
      LID_UP = half * 1.08;
      LID_DN = half * 0.92;

      IRIS_R = Math.min((LID_UP + LID_DN) * ASPECT * 0.42, EYE_W * 0.34)
             * o.irisScale;
      PUPIL_R = IRIS_R * 0.46;
      GLINT_O = -IRIS_R * 0.26;
      GLINT_R = PUPIL_R * 0.40;

      // Horizontal reach stops where the almond narrows to irisFit x the
      // iris diameter — past that point the iris would be mostly hidden.
      IRIS_ROWS = IRIS_R / ASPECT;
      var need = (2 * IRIS_ROWS * o.irisFit) / (LID_UP + LID_DN);
      var uMax = need >= 1 ? 0
               : Math.sqrt(Math.max(0, 1 - Math.pow(need, 1 / o.pow)));
      ROAM_X = Math.min(EYE_W * uMax, EYE_W - IRIS_R - 1) * o.travel;
      ROAM_Y = Math.max(0, (LID_UP - IRIS_ROWS - 1)) * o.travel;
    }

    // Pull a target gaze inside the socket: the vertical range available
    // shrinks with the lid opening at that horizontal offset.
    function clampGaze(px, py) {
      if (px >  ROAM_X) px =  ROAM_X;
      if (px < -ROAM_X) px = -ROAM_X;
      var u = px / EYE_W;
      if (u >  0.999) u =  0.999;
      if (u < -0.999) u = -0.999;
      var kk = Math.pow(1 - u * u, o.pow);
      var loY = -LID_UP * kk + IRIS_ROWS;
      var hiY =  LID_DN * kk - IRIS_ROWS;
      if (loY > hiY) { loY = hiY = (loY + hiY) / 2; }
      if (py < loY) py = loY;
      if (py > hiY) py = hiY;
      return [px, py];
    }

    function edge(s, flat) {
      var a = s < 0 ? -s : s;
      if (a < 0.5) return flat;
      if (a < 1.8) return s < 0 ? '/' : '\\';
      return '|';
    }

    function render(gx, gy, b) {
      var buf = [], j, i, y, x, um, ul, ur, k0, k1,
          rt0, rt1, rb0, rb1, h0, h1, lt0, lt1, lb0, lb1,
          rtM, rbM, ltM, lbM, lo, hi, p, n,
          dx, dy, d, gd, ringW, ang, row;

      n = LID_RAMP.length;

      for (j = 0; j < ROWS; j++) {
        y = j - CY;
        row = '';
        for (i = 0; i < COLS; i++) {
          x = i - CX;
          um = x / EYE_W;
          ul = (x - 0.5) / EYE_W;
          ur = (x + 0.5) / EYE_W;
          if (ur <= -1 || ul >= 1) { row += ' '; continue; }
          if (ul < -0.999) ul = -0.999;
          if (ur > 0.999) ur = 0.999;

          k0 = Math.pow(1 - ul * ul, o.pow);
          k1 = Math.pow(1 - ur * ur, o.pow);

          rt0 = -LID_UP * k0; rt1 = -LID_UP * k1;
          rb0 =  LID_DN * k0; rb1 =  LID_DN * k1;
          h0 = rb0 - rt0; h1 = rb1 - rt1;

          lt0 = rt0 + b * h0 * o.blinkSplit;
          lt1 = rt1 + b * h1 * o.blinkSplit;
          lb0 = rb0 - b * h0 * (1 - o.blinkSplit);
          lb1 = rb1 - b * h1 * (1 - o.blinkSplit);

          rtM = (rt0 + rt1) / 2; rbM = (rb0 + rb1) / 2;
          ltM = (lt0 + lt1) / 2; lbM = (lb0 + lb1) / 2;

          // --- socket outline ---
          lo = y - RIM_HALF; hi = y + RIM_HALF;
          if (Math.min(rt0, rt1) <= hi && Math.max(rt0, rt1) >= lo) {
            row += edge(rt1 - rt0, '='); continue;
          }
          if (Math.min(rb0, rb1) <= hi && Math.max(rb0, rb1) >= lo) {
            row += edge(rb1 - rb0, '='); continue;
          }

          // --- moving lid edge ---
          if (b > 0.002) {
            lo = y - CREASE_HALF; hi = y + CREASE_HALF;
            if (Math.min(lt0, lt1) <= hi && Math.max(lt0, lt1) >= lo) {
              row += edge(lt1 - lt0, '~'); continue;
            }
            if (Math.min(lb0, lb1) <= hi && Math.max(lb0, lb1) >= lo) {
              row += edge(lb1 - lb0, '~'); continue;
            }
          }

          // --- lid skin sweeping across the eyeball ---
          if (y > rtM && y < ltM) {
            p = (y - rtM) / Math.max(1e-6, ltM - rtM);
            row += LID_RAMP.charAt(Math.min(n - 1, (p * n) | 0)); continue;
          }
          if (y > lbM && y < rbM) {
            p = (rbM - y) / Math.max(1e-6, rbM - lbM);
            row += LID_RAMP.charAt(Math.min(n - 1, (p * n) | 0)); continue;
          }

          if (!(y >= ltM && y <= lbM)) { row += ' '; continue; }

          // --- eyeball ---
          dx = x - gx;
          dy = (y - gy) * ASPECT;
          d = Math.sqrt(dx * dx + dy * dy);

          if (d <= PUPIL_R) {
            gd = Math.sqrt((dx - GLINT_O) * (dx - GLINT_O) +
                           (dy - GLINT_O) * (dy - GLINT_O));
            row += (gd < GLINT_R) ? ' ' : o.pupil;
            continue;
          }

          if (d <= IRIS_R) {
            ringW = 0.85 + 1.15 * (dy < 0 ? -dy : dy) / d;
            if (d >= IRIS_R - ringW) { row += o.limbus; continue; }
            ang = Math.atan2(dy, dx) % Math.PI;
            if (ang < 0) ang += Math.PI;
            row += o.spokes.charAt(((ang / Math.PI * 4) | 0) % o.spokes.length);
            continue;
          }

          // --- sclera: one shadow step under the lids, flat elsewhere ---
          p = Math.min(y - ltM, lbM - y) / Math.max(1e-6, (lbM - ltM) * 0.5);
          row += (p < 0.22) ? ':' : o.sclera;
        }
        buf.push(row);
      }
      pre.textContent = buf.join('\n');
    }

    // ---- state ---------------------------------------------------------
    var gx = 0, gy = 0, tx = 0, ty = 0,
        b = 0, bStart = null, bDur = 0.2,
        next = 2, lastMove = -1e9, prev = 0, acc = 0,
        pgx = 1e9, pgy = 1e9, pb = -1, raf = null, resizeTimer = null;

    function onMove(ev) {
      var r = pre.getBoundingClientRect();
      // Measure from where the eye actually sits, not the grid centre.
      var ex = r.left + (CX + 0.5) * cw;
      var ey = r.top + (CY + 0.5) * lh;
      var nx = (ev.clientX - ex) / (r.width * 0.55);
      var ny = (ev.clientY - ey) / (r.height * 0.85);
      var m = Math.sqrt(nx * nx + ny * ny);
      if (m > 1) { nx /= m; ny /= m; }
      var c = clampGaze(nx * ROAM_X, ny * ROAM_Y);
      tx = c[0]; ty = c[1];
      lastMove = performance.now() / 1000;
    }

    function frame(ts) {
      raf = requestAnimationFrame(frame);
      var now = ts / 1000;
      var dt = prev ? Math.min(now - prev, 0.1) : 0;
      prev = now;
      acc += dt;
      if (acc < 1 / o.fps) return;
      acc = 0;

      if (now - lastMove > o.idleAfter) {
        var w = clampGaze(
          Math.sin(now * 0.31) * Math.cos(now * 0.17) * ROAM_X * 0.85,
          Math.sin(now * 0.23) * ROAM_Y * 0.7);
        tx = w[0]; ty = w[1];
      }
      gx += (tx - gx) * o.ease;
      gy += (ty - gy) * o.ease;

      if (bStart === null) {
        if (now >= next) {
          bStart = now;
          bDur = o.blinkDurMin + Math.random() * (o.blinkDurMax - o.blinkDurMin);
        }
      } else {
        var e = now - bStart;
        if (e >= bDur) {
          b = 0; bStart = null;
          next = now + (Math.random() < 0.18
            ? 0.15 + Math.random() * 0.15
            : 2.5 + Math.random() * 4);
        } else {
          b = blinkCurve(e / bDur, o.blinkClose);
        }
      }

      if (Math.abs(gx - pgx) < 0.04 && Math.abs(gy - pgy) < 0.04 &&
          Math.abs(b - pb) < 0.01) return;
      pgx = gx; pgy = gy; pb = b;
      render(gx, gy, b);
    }

    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        layout();
        pgx = 1e9;
        render(gx, gy, b);
      }, 120);
    }

    layout();
    render(0, 0, 0);
    if (!still) {
      global.addEventListener('mousemove', onMove, { passive: true });
      raf = requestAnimationFrame(frame);
    }
    global.addEventListener('resize', onResize);

    return {
      element: layer,
      destroy: function () {
        if (raf) cancelAnimationFrame(raf);
        clearTimeout(resizeTimer);
        global.removeEventListener('mousemove', onMove);
        global.removeEventListener('resize', onResize);
        if (layer.parentNode) layer.parentNode.removeChild(layer);
      }
    };
  }

  global.MLABackground = MLABackground;
})(window);
