/* MOA Village — canvas village scene (2D, no external assets) */
(function () {
  'use strict';
  window.MV = window.MV || {};
  const C = () => MV.Catalog;

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const imgCache = {};
  function sprite(key, dataUrl) {
    if (!dataUrl) return null;
    let im = imgCache[key];
    if (!im) {
      im = new Image();
      im.decoding = 'async';
      im.src = dataUrl;
      imgCache[key] = im;
    }
    return im;
  }
  function ready(im) { return im && im.complete && im.naturalWidth > 0; }

  const Scene = {
    canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
    village: null, weatherMode: 'auto', phase: 'clear',
    t: 0, last: 0, raf: 0,
    hot: [],
    mode: 'idle',          // idle | place | move
    pendingItem: null,
    dragUid: null, dragging: false,
    avatar: { x: .5, y: .8, tx: .5, ty: .8, dir: 1, moving: false, bob: 0 },
    pets: [], rides: [],
    sparkles: [], particles: [], birds: [],
    callbacks: {},
    placements: [],

    init(canvas, callbacks) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.callbacks = callbacks || {};
      this.avatar.nickname = '';
      this.bindPointer();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
      this.last = performance.now();
      this.loop();
    },

    on(name, fn) { this.callbacks[name] = fn; },

    /* ------------------------- geometry ------------------------- */
    resize() {
      const c = this.canvas;
      if (!c) return;
      const w = c.clientWidth || window.innerWidth;
      const h = c.clientHeight || window.innerHeight;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.W = w; this.H = h;
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.layout();
      this.buildParticles();
      this.buildBirds();
    },

    layout() {
      const W = this.W, H = this.H;
      const narrow = W < 720;
      const rx = Math.min(W * (narrow ? .47 : .44), H * .58);
      const ry = Math.min(H * (narrow ? .30 : .27), W * .42);
      const cy = H * (narrow ? .62 : .60);
      const cx = W / 2;
      this.g = {
        cx, cy, rx, ry,
        top: cy - ry, bottom: cy + ry,
        horizon: cy - ry * 1.18,
        ornH: clamp(H * .105, 54, 122),
        avH: clamp(H * .095, 52, 94)
      };
      // keep avatar inside
      const a = this.avatar;
      a.x = clamp(a.x, .1, .9); a.y = clamp(a.y, .1, .92);
    },

    groundPoint(nx, ny) {
      const g = this.g;
      return {
        x: g.cx + (nx - .5) * 2 * g.rx * .92,
        y: g.top + ny * (g.ry * 2) * .94
      };
    },

    /* ------------------------- data ------------------------- */
    setVillage(v) {
      this.village = v;
      this.placements = (MV.Store.state.deco[v.id] || []).slice();
      this.syncPets(true);
      this.syncRides(true);
      this.avatar.nickname = MV.Store.state.nickname || '';
      this.buildParticles();
      this.buildBirds();
      // reset avatar to centre path
      this.avatar.x = .5; this.avatar.y = .78; this.avatar.tx = .5; this.avatar.ty = .78;
    },

    refreshPlacements() {
      if (!this.village) return;
      this.placements = (MV.Store.state.deco[this.village.id] || []).slice();
    },

    setWeather(mode) {
      this.weatherMode = mode || 'auto';
      this.resolvePhase();
      this.buildParticles();
    },

    resolvePhase() {
      const h = new Date().getHours();
      let auto = 'clear';
      if (h >= 20 || h < 6) auto = 'night';
      else if (h >= 17) auto = 'sunset';
      else if (h < 8) auto = 'sunset';
      let mode = this.weatherMode === 'auto' ? auto : this.weatherMode;
      if (this.weatherMode === 'auto' && this.village) {
        if (this.village.id === 'lumen') mode = 'night';
        else if (this.village.id === 'snowbell' && mode !== 'night') mode = 'snow';
      }
      this.phase = mode;
    },

    phaseInfo() {
      const p = this.phase;
      return {
        night: p === 'night',
        sunset: p === 'sunset',
        rain: p === 'rain',
        snow: p === 'snow',
        dark: p === 'night' ? .62 : p === 'sunset' ? .16 : p === 'rain' ? .30 : 0
      };
    },

    /* ------------------------- entities ------------------------- */
    syncPets(reset) {
      const st = MV.Store.state;
      const active = st.activePets || [];
      if (reset) this.pets = [];
      else this.pets = this.pets.filter(p => active.indexOf(p.id) >= 0);
      active.forEach((id, i) => {
        if (this.pets.some(p => p.id === id)) return;
        const cfg = C().pet(id) || { speed: 24 };
        this.pets.push({
          id, t: (cfg.start || (i * .33 + .2)) % 1 + .001 * i,
          speed: cfg.speed / 100, dir: 1, bob: Math.random() * TAU,
          pause: 0, sayUntil: 0, line: 0
        });
      });
    },

    syncRides(reset) {
      const st = MV.Store.state;
      const active = st.activeRides || [];
      if (reset) this.rides = [];
      else this.rides = this.rides.filter(r => active.indexOf(r.id) >= 0);
      active.forEach((id, i) => {
        if (this.rides.some(r => r.id === id)) return;
        const cfg = C().ride(id) || { speed: 30, path: 'road' };
        this.rides.push({
          id, t: (i * .37 + .12) % 1, speed: cfg.speed / 900,
          path: cfg.path || 'road', dir: 1, bob: Math.random() * TAU
        });
      });
    },

    buildBirds() {
      this.birds = [];
      const n = this.phase === 'night' ? 0 : 4;
      for (let i = 0; i < n; i++) {
        this.birds.push({ x: rand(0, 1), y: rand(.08, .26), sp: rand(.012, .03), ph: rand(0, TAU), s: rand(.6, 1.1) });
      }
    },

    buildParticles() {
      const W = this.W, H = this.H;
      this.particles = [];
      const p = this.phase;
      if (p === 'rain') {
        const n = Math.round(clamp(W / 7, 70, 220));
        for (let i = 0; i < n; i++) this.particles.push({ x: rand(-.2, 1.2) * W, y: rand(0, H), v: rand(600, 1050), l: rand(10, 22), a: rand(.18, .5) });
      } else if (p === 'snow') {
        const n = Math.round(clamp(W / 9, 55, 170));
        for (let i = 0; i < n; i++) this.particles.push({ x: rand(0, W), y: rand(0, H), r: rand(1.1, 3.4), v: rand(16, 46), d: rand(.2, 1), ph: rand(0, TAU), a: rand(.4, .95) });
      } else if (p === 'night') {
        for (let i = 0; i < 26; i++) this.particles.push({ x: rand(0, W), y: rand(H * .35, H * .92), r: rand(1, 2.4), ph: rand(0, TAU), v: rand(.2, .7), a: rand(.3, .9) });
      } else {
        for (let i = 0; i < 18; i++) this.particles.push({ x: rand(0, W), y: rand(H * .25, H), r: rand(1, 2.2), ph: rand(0, TAU), v: rand(.2, .6), a: rand(.2, .6) });
      }
    },

    /* ------------------------- loop ------------------------- */
    loop() {
      this.raf = requestAnimationFrame(() => this.loop());
      const now = performance.now();
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > .12) dt = .12;
      this.t += dt;
      this.update(dt);
      this.render();
    },

    update(dt) {
      const st = MV.Store.state;
      // avatar movement
      const a = this.avatar;
      const dx = a.tx - a.x, dy = a.ty - a.y;
      const dist = Math.hypot(dx, dy);
      a.moving = dist > .004;
      if (a.moving) {
        const sp = .55 * dt;
        a.x += dx * Math.min(1, sp * 3.4);
        a.y += dy * Math.min(1, sp * 3.4);
        a.dir = dx > .002 ? 1 : dx < -.002 ? -1 : a.dir;
        a.bob += dt * 9;
      } else {
        a.bob += dt * 2.2;
      }

      // pets
      this.pets.forEach(p => {
        if (p.pause > 0) { p.pause -= dt; return; }
        p.t += p.speed * dt * p.dir;
        if (p.t > 1) { p.t = 1; p.dir = -1; p.pause = rand(.4, 1.4); }
        if (p.t < 0) { p.t = 0; p.dir = 1; p.pause = rand(.4, 1.4); }
        p.bob += dt * 6;
        if (Math.random() < dt * .06) p.pause = rand(.5, 1.6);
      });

      // rides
      this.rides.forEach(r => {
        r.t += r.speed * dt;
        if (r.t > 1.06) r.t = -.06;
        r.bob += dt * 2;
      });

      // sparkles
      if (!this._sparkTimer) this._sparkTimer = rand(3, 6);
      this._sparkTimer -= dt;
      if (this._sparkTimer <= 0 && this.sparkles.length < 4) {
        this._sparkTimer = rand(5, 9);
        this.spawnSparkle();
      }
      this.sparkles.forEach(s => { s.life -= dt; s.ph += dt * 2.4; });
      this.sparkles = this.sparkles.filter(s => s.life > 0);

      // particles
      if (this.phase === 'rain') {
        this.particles.forEach(p => {
          p.y += p.v * dt; p.x -= p.v * .18 * dt;
          if (p.y > this.H + 20) { p.y = -20; p.x = rand(-.2, 1.2) * this.W; }
        });
      } else if (this.phase === 'snow') {
        this.particles.forEach(p => {
          p.ph += dt * 1.4;
          p.y += p.v * dt;
          p.x += Math.sin(p.ph) * 18 * dt;
          if (p.y > this.H + 8) { p.y = -8; p.x = rand(0, this.W); }
        });
      } else {
        this.particles.forEach(p => { p.ph += dt * (p.v || .4); p.y -= 6 * dt; if (p.y < this.H * .2) p.y = this.H * .95; });
      }
      this.birds.forEach(b => {
        b.x += b.sp * dt; b.ph += dt * 4;
        if (b.x > 1.15) { b.x = -.15; b.y = rand(.06, .24); }
      });
    },

    spawnSparkle() {
      const nx = rand(.16, .84), ny = rand(.18, .82);
      this.sparkles.push({ nx, ny, ph: rand(0, TAU), life: rand(16, 26), born: 0 });
    },

    collectSparkle(i) {
      const s = this.sparkles[i];
      if (!s) return null;
      this.sparkles.splice(i, 1);
      const gp = this.groundPoint(s.nx, s.ny);
      return gp;
    },

    /* ------------------------- drawing ------------------------- */
    render() {
      const ctx = this.ctx, W = this.W, H = this.H, g = this.g;
      if (!ctx || !this.village) return;
      const pal = this.village.palette;
      const info = this.phaseInfo();
      this.hot.length = 0;
      this._lights = [];
      ctx.clearRect(0, 0, W, H);

      /* sky */
      const sky = ctx.createLinearGradient(0, 0, 0, g.bottom);
      if (info.night) {
        sky.addColorStop(0, '#0a0d20'); sky.addColorStop(.5, pal.skyTop); sky.addColorStop(1, pal.skyMid);
      } else if (this.phase === 'rain') {
        sky.addColorStop(0, '#6d7a91'); sky.addColorStop(.55, '#9aa6bb'); sky.addColorStop(1, '#cdd4dd');
      } else if (info.sunset) {
        sky.addColorStop(0, '#6b4f86'); sky.addColorStop(.42, pal.skyTop); sky.addColorStop(.78, pal.skyMid); sky.addColorStop(1, pal.skyLow);
      } else {
        sky.addColorStop(0, pal.skyTop); sky.addColorStop(.55, pal.skyMid); sky.addColorStop(1, pal.skyLow);
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      this.drawSkyObjects(ctx, info);
      this.drawDistant(ctx, info);

      /* ground */
      const gg = ctx.createRadialGradient(g.cx, g.cy - g.ry * .35, g.rx * .15, g.cx, g.cy, g.rx);
      gg.addColorStop(0, pal.ground);
      gg.addColorStop(.62, pal.ground);
      gg.addColorStop(1, pal.ground2);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(g.cx, g.cy, g.rx, g.ry, 0, 0, TAU);
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.restore();

      this.drawGroundTexture(ctx, pal, info);
      this.drawPath(ctx, pal, info);
      this.drawBackProps(ctx, pal, info);

      /* collectables behind? draw as objects in list */
      const list = [];

      // fixed props
      (this.village.props || []).forEach((art, i) => {
        const pos = this.propPos(this.village.id, i + 1, art);
        if (!pos) return;
        list.push({ y: pos.y, draw: () => this.drawProp(ctx, art, pos, pal, info) });
      });

      // placed ornaments
      this.placements.forEach(p => {
        const gp = this.groundPoint(p.nx, p.ny);
        list.push({
          y: gp.y, uid: p.uid,
          draw: () => this.drawOrnament(ctx, p, gp, info)
        });
      });

      // pets
      this.pets.forEach(p => {
        const t = p.t;
        const pt = this.pathPoint(t, p.dir, 0.10);
        list.push({
          y: pt.y, pet: p,
          draw: () => {
            const h = clamp(this.g.ornH * .62, 36, 72);
            const im = sprite('pet:' + p.id, C().petData(p.id));
            const crouch = Math.abs(Math.sin(p.bob)) * 2;
            ctx.save();
            ctx.translate(pt.x, pt.y - crouch);
            ctx.scale(p.dir < 0 ? -1 : 1, 1);
            if (ready(im)) ctx.drawImage(im, -h * .62, -h * .84, h * 1.24, h * 1.08);
            else this.dot(ctx, 0, -h * .3, h * .3, '#e8c39a');
            ctx.restore();
            this.hot.push({ type: 'pet', id: p.id, x: pt.x, y: pt.y - h * .45, r: h * .7 });
            // sparkle collect hint
          }
        });
      });

      // rides
      this.rides.forEach(r => {
        let pt;
        if (r.path === 'air') {
          const ang = r.t * TAU;
          pt = { x: this.g.cx + Math.sin(ang) * this.g.rx * .62, y: this.g.top + this.g.ry * .55 + Math.cos(ang * 1.02) * this.g.ry * .40 };
        } else {
          const tt = .26 + (r.t % 1) * .70;
          pt = this.pathPoint(tt, 1, 0.26);
        }
        list.push({
          y: pt.y + (r.path === 'air' ? -40 : 0), ride: r,
          draw: () => {
            const h = r.id === 'balloon' ? clamp(this.g.ornH * 1.12, 60, 140) : clamp(this.g.ornH * .56, 34, 70);
            const im = sprite('ride:' + r.id, C().rideData(r.id));
            const bob = r.path === 'air' ? Math.sin(r.bob) * 5 : Math.abs(Math.sin(r.bob * 2)) * 1.5;
            ctx.save();
            ctx.translate(pt.x, pt.y - bob);
            if (r.path !== 'air') ctx.scale(r.dir < 0 ? -1 : 1, 1);
            if (ready(im)) ctx.drawImage(im, -h * .5, -h * .82, h * (r.id === 'balloon' ? .75 : 1.5), h * (r.id === 'balloon' ? 1.0 : 1.5));
            else this.dot(ctx, 0, -h * .3, h * .3, '#f0a55f');
            ctx.restore();
            this.hot.push({ type: 'ride', id: r.id, x: pt.x, y: pt.y - h * .5, r: h * .8 });
          }
        });
      });

      // avatar
      const ap = this.groundPoint(this.avatar.x, this.avatar.y);
      list.push({
        y: ap.y, avatar: true,
        draw: () => this.drawAvatar(ctx, ap, info)
      });

      // sparkles (top-most interactive)
      this.sparkles.forEach((s, i) => {
        const gp = this.groundPoint(s.nx, s.ny);
        list.push({
          y: gp.y + 8, spark: s,
          draw: () => this.drawSparkle(ctx, gp, s)
        });
      });

      // depth sort
      list.sort((a, b) => a.y - b.y);
      list.forEach(o => { try { o.draw(); } catch (e) { console.warn('draw', e); } });

      // foreground grass tufts
      this.drawForeground(ctx, pal, info);

      // weather
      this.drawWeather(ctx, info);

      // light overlay
      this.drawLight(ctx, pal, info);
      if (info.night) this.drawNightLights(ctx, info);

      // reset hot list each frame before building (build during draw above)
      // (hot is rebuilt below via a second pass)
    },

    dot(ctx, x, y, r, color) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = color; ctx.fill();
    },

    propPos(villageId, i, art) {
      const layouts = {
        snowbell: [[.5, .17, 1.55], [.25, .43, .9], [.77, .52, .82], [.69, .33, .78], [.13, .60, .95], [.88, .66, .9], [.09, .83, .8], [.87, .84, .8], [.5, .90, .62], [.27, .75, .85]],
        sunpetal: [[.5, .17, 1.55], [.23, .41, .9], [.79, .46, .78], [.68, .68, .85], [.13, .59, .95], [.88, .62, .92], [.85, .83, 1.0], [.47, .90, .6], [.62, .31, .78], [.22, .76, .85]],
        mochi: [[.5, .17, 1.55], [.23, .42, .9], [.7, .34, .78], [.12, .57, 1.0], [.88, .64, 1.0], [.66, .69, .82], [.44, .90, .6], [.23, .76, .85], [.83, .85, .72]],
        lumen: [[.5, .17, 1.55], [.24, .44, .85], [.73, .36, .8], [.68, .69, .82], [.87, .62, .85], [.15, .71, .8], [.46, .90, .6], [.79, .45, .9], [.25, .81, .8]]
      };
      const L = layouts[villageId] || layouts.snowbell;
      const row = L[i];
      if (!row) return null;
      const gp = this.groundPoint(row[0], row[1]);
      return { x: gp.x, y: gp.y, scale: row[2], art };
    },

    drawProp(ctx, art, pos, pal, info) {
      const h = this.g.ornH * 1.02 * pos.scale;
      const map = { snowman: 'snowman', lamp: 'lamp', pine: 'pine', star: 'star', well: 'well', bench: 'bench', flower: 'flower', windmill: 'windmill', palm: 'pine', blossom: 'pine', fence: 'fence', flag: 'flag', stall: null, lantern: 'lamp' };
      if (art === 'stall') { this.drawStall(ctx, pos.x, pos.y, h * .85, pal, info); return; }
      if (art === 'pine' && this.village.id === 'mochi') { this.drawPalm(ctx, pos.x, pos.y, h, info); return; }
      if ((art === 'pine') && this.village.id === 'sunpetal') { this.drawBlossom(ctx, pos.x, pos.y, h, info); return; }
      if (art === 'pine' && this.village.id === 'lumen') { this.drawLanternTree(ctx, pos.x, pos.y, h, info); return; }
      if (art === 'lamp' && this.village.id === 'lumen') { this.drawLantern(ctx, pos.x, pos.y, h * .9, info); return; }
      if (art === 'lamp' && this.village.id === 'snowbell') { /* normal */ }
      const artKey = map[art] || 'pine';
      const im = sprite('orn:' + artKey, C().spriteData(artKey));
      const w = h * .8;
      ctx.save();
      // shadow
      ctx.globalAlpha = .16;
      ctx.beginPath(); ctx.ellipse(pos.x, pos.y + 1, w * .30, w * .10, 0, 0, TAU); ctx.fillStyle = '#1d1a2b'; ctx.fill();
      ctx.globalAlpha = 1;
      if (ready(im)) ctx.drawImage(im, pos.x - w / 2, pos.y - h + w * .10, w, h);
      else this.dot(ctx, pos.x, pos.y - h * .4, h * .3, '#88a');
      ctx.restore();
      if (info.night && (art === 'lamp' || art === 'lantern')) {
        if (this._lights) this._lights.push({ x: pos.x, y: pos.y - h * .78, r: h * .95, color: pal.nightGlow, a: .55 });
      }
    },

    drawStall(ctx, x, y, h, pal, info) {
      const w = h * 1.35;
      ctx.save();
      ctx.globalAlpha = .16; ctx.beginPath(); ctx.ellipse(x, y + 1, w * .45, w * .12, 0, 0, TAU); ctx.fillStyle = '#1d1a2b'; ctx.fill(); ctx.globalAlpha = 1;
      // counter
      ctx.fillStyle = '#a9703f';
      ctx.beginPath(); ctx.roundRect(x - w * .42, y - h * .34, w * .84, h * .34, 4); ctx.fill();
      ctx.fillStyle = '#8b5a30';
      ctx.fillRect(x - w * .42, y - h * .34, w * .84, h * .07);
      // posts
      ctx.fillStyle = '#7b5232';
      ctx.fillRect(x - w * .44, y - h * .95, w * .06, h * .64);
      ctx.fillRect(x + w * .38, y - h * .95, w * .06, h * .64);
      // awning
      const aw = w * 1.0;
      ctx.fillStyle = info.dark ? '#c8564a' : '#e2614c';
      ctx.beginPath(); ctx.moveTo(x - aw * .52, y - h * .92); ctx.lineTo(x + aw * .52, y - h * .92); ctx.lineTo(x + aw * .46, y - h * .64); ctx.lineTo(x - aw * .46, y - h * .64); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff6e6';
      for (let i = 0; i < 4; i++) {
        const sx = x - aw * .46 + (aw * .92) * (i / 4);
        ctx.fillRect(sx, y - h * .92, aw * .92 / 8, h * .28);
      }
      // sign
      ctx.fillStyle = '#3b3850';
      ctx.beginPath(); ctx.roundRect(x - w * .30, y - h * 1.10, w * .60, h * .16, 4); ctx.fill();
      ctx.fillStyle = '#ffe3a3';
      ctx.font = '600 ' + Math.round(h * .10) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('SHOP', x, y - h * 1.02);
      // jars
      ctx.fillStyle = '#f2b54b'; ctx.fillRect(x - w * .30, y - h * .44, w * .10, h * .10);
      ctx.fillStyle = '#8cc8b4'; ctx.fillRect(x - w * .15, y - h * .46, w * .10, h * .12);
      ctx.fillStyle = '#f4839e'; ctx.fillRect(x, y - h * .44, w * .10, h * .10);
      ctx.restore();
    },

    drawPalm(ctx, x, y, h, info) {
      ctx.save();
      ctx.globalAlpha = .16; ctx.beginPath(); ctx.ellipse(x, y + 1, h * .22, h * .07, 0, 0, TAU); ctx.fillStyle = '#1d1a2b'; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#a9835c'; ctx.lineWidth = Math.max(3, h * .055); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - h * .05, y - h * .5, x + h * .04, y - h * .78); ctx.stroke();
      ctx.fillStyle = '#3f8f6a';
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI * .95 + i * .32;
        ctx.save(); ctx.translate(x + h * .04, y - h * .78); ctx.rotate(ang);
        ctx.beginPath(); ctx.ellipse(h * .16, 0, h * .18, h * .045, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#c98c22'; ctx.beginPath(); ctx.arc(x + h * .04, y - h * .76, h * .035, 0, TAU); ctx.fill();
      ctx.restore();
    },

    drawBlossom(ctx, x, y, h, info) {
      ctx.save();
      ctx.globalAlpha = .16; ctx.beginPath(); ctx.ellipse(x, y + 1, h * .2, h * .07, 0, 0, TAU); ctx.fillStyle = '#1d1a2b'; ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#8b6a4a'; ctx.fillRect(x - h * .03, y - h * .42, h * .06, h * .42);
      const blobs = [[0, -.62, .30], [-.20, -.52, .20], [.21, -.53, .21], [-.10, -.76, .20], [.12, -.75, .19]];
      blobs.forEach(([dx, dy, r]) => {
        ctx.beginPath(); ctx.arc(x + dx * h, y + dy * h, r * h, 0, TAU);
        ctx.fillStyle = '#ffc6d6'; ctx.fill();
        ctx.beginPath(); ctx.arc(x + dx * h - r * h * .2, y + dy * h - r * h * .2, r * h * .5, 0, TAU);
        ctx.fillStyle = '#ffe3ec'; ctx.fill();
      });
      ctx.fillStyle = '#fff3c4';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + (Math.random() - .5) * h * .6, y - h * .3 + Math.random() * h * .25, 1.6, 0, TAU); ctx.fill(); }
      ctx.restore();
    },

    drawLanternTree(ctx, x, y, h, info) {
      ctx.save();
      ctx.globalAlpha = .16; ctx.beginPath(); ctx.ellipse(x, y + 1, h * .18, h * .06, 0, 0, TAU); ctx.fillStyle = '#1d1a2b'; ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#4b3f5e'; ctx.fillRect(x - h * .035, y - h * .5, h * .07, h * .5);
      ctx.beginPath(); ctx.arc(x, y - h * .72, h * .26, 0, TAU); ctx.fillStyle = '#3e6a58'; ctx.fill();
      ctx.beginPath(); ctx.arc(x - h * .15, y - h * .62, h * .16, 0, TAU); ctx.fillStyle = '#4d7f69'; ctx.fill();
      ctx.beginPath(); ctx.arc(x + h * .16, y - h * .64, h * .15, 0, TAU); ctx.fillStyle = '#4d7f69'; ctx.fill();
      [[-.14, -.62], [.13, -.70], [0, -.45], [.18, -.50]].forEach(([dx, dy]) => {
        this.glow(ctx, x + dx * h, y + dy * h, h * .10, '#ffcf87', .5);
        if (this._lights) this._lights.push({ x: x + dx * h, y: y + dy * h, r: h * .32, color: '#ffcf87', a: .5 });
        ctx.beginPath(); ctx.arc(x + dx * h, y + dy * h, h * .026, 0, TAU); ctx.fillStyle = '#ffe6b0'; ctx.fill();
      });
      ctx.restore();
    },

    drawLantern(ctx, x, y, h, info) {
      ctx.save();
      ctx.strokeStyle = '#4e4a63'; ctx.lineWidth = Math.max(2, h * .04); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - h * .45, x + h * .16, y - h * .52); ctx.stroke();
      this.glow(ctx, x + h * .18, y - h * .40, h * .30, '#ffcf87', .45);
      if (this._lights) this._lights.push({ x: x + h * .18, y: y - h * .40, r: h * .55, color: '#ffcf87', a: .5 });
      ctx.fillStyle = '#e2614c'; ctx.beginPath(); ctx.roundRect(x + h * .06, y - h * .52, h * .24, h * .30, 6); ctx.fill();
      ctx.fillStyle = '#ffe3a3'; ctx.beginPath(); ctx.roundRect(x + h * .10, y - h * .48, h * .16, h * .21, 4); ctx.fill();
      ctx.restore();
    },

    drawOrnament(ctx, p, gp, info) {
      const o = C().orn(p.id);
      if (!o) return;
      const h = this.g.ornH * (o.scale || 1);
      const w = h * .8;
      const im = sprite('orn:' + o.art, C().spriteData(o.art));
      ctx.save();
      if (this.dragUid === p.uid && this.dragging) ctx.globalAlpha = .9;
      ctx.globalAlpha = .18;
      ctx.beginPath(); ctx.ellipse(gp.x, gp.y + 1, w * .30, w * .09, 0, 0, TAU); ctx.fillStyle = '#1d1a2b'; ctx.fill();
      ctx.globalAlpha = 1;
      if (ready(im)) ctx.drawImage(im, gp.x - w / 2, gp.y - h + w * .10, w, h);
      else this.dot(ctx, gp.x, gp.y - h * .45, w * .3, '#a99');
      if (info.night && (o.art === 'lamp' || o.art === 'star' || o.art === 'gbell' || o.art === 'aurora' || o.art === 'gate' || o.art === 'fox' || o.art === 'deer' || o.art === 'crystal')) {
        if (this._lights) this._lights.push({ x: gp.x, y: gp.y - h * .55, r: h * .6, color: '#ffd98a', a: .35 });
      }
      if (o.rarity !== 'common') {
        const c = o.rarity === 'limited' ? '#ffd98a' : '#cbb6ff';
        ctx.globalAlpha = .35 + Math.sin(this.t * 2 + gp.x) * .12;
        ctx.beginPath(); ctx.arc(gp.x, gp.y - h * .55, w * .46, 0, TAU);
        ctx.strokeStyle = c; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (this.dragUid === p.uid) {
        ctx.globalAlpha = .5;
        ctx.beginPath(); ctx.ellipse(gp.x, gp.y + 1, w * .34, w * .11, 0, 0, TAU);
        ctx.strokeStyle = '#f2b54b'; ctx.lineWidth = 2; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      this.hot.push({ type: 'orn', uid: p.uid, id: p.id, x: gp.x, y: gp.y - h * .45, r: Math.max(20, w * .48) });
    },

    drawAvatar(ctx, ap, info) {
      const h = this.g.avH;
      const im = sprite('avatar', C().avatarData());
      const bob = this.avatar.moving ? Math.abs(Math.sin(this.avatar.bob)) * -4 : Math.sin(this.avatar.bob) * -1.2;
      const flip = this.avatar.dir < 0 ? -1 : 1;
      ctx.save();
      ctx.globalAlpha = .2; ctx.beginPath(); ctx.ellipse(ap.x, ap.y, h * .28, h * .09, 0, 0, TAU); ctx.fillStyle = '#1d1a2b'; ctx.fill(); ctx.globalAlpha = 1;
      ctx.translate(ap.x, ap.y + bob);
      ctx.scale(flip, 1);
      if (ready(im)) ctx.drawImage(im, -h * .38, -h * .97, h * .76, h);
      else this.dot(ctx, 0, -h * .3, h * .3, '#e2614c');
      ctx.restore();

      // name tag
      const name = (MV.Store.state.nickname || 'MOA').slice(0, 12);
      const fs = clamp(h * .20, 10, 14);
      if (!this._fontStack) this._fontStack = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
      ctx.save();
      ctx.font = '800 ' + fs + 'px ' + this._fontStack;
      const tw = ctx.measureText(name).width;
      const padX = fs * .75, bh = fs * 1.9;
      const bx = ap.x - (tw + padX * 2) / 2, by = ap.y + bob - h * .99 - bh - 3;
      ctx.fillStyle = 'rgba(255,250,240,.94)';
      ctx.beginPath(); ctx.roundRect(bx, by, tw + padX * 2, bh, bh / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(42,36,56,.08)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#3a3352'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, ap.x, by + bh / 2 + .5);
      ctx.restore();
    },

    drawSparkle(ctx, gp, s) {
      const pulse = .7 + Math.sin(s.ph) * .3;
      const r = clamp(this.g.ornH * .16, 9, 18) * pulse;
      this.glow(ctx, gp.x, gp.y - r * 1.5, r * 3.1, '#ffe9a8', .55);
      ctx.save();
      ctx.translate(gp.x, gp.y - r * 1.6);
      ctx.rotate(Math.sin(s.ph * .6) * .3);
      ctx.fillStyle = '#fff8dc';
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.moveTo(0, -r);
        ctx.quadraticCurveTo(r * .22, -r * .22, r, 0);
        ctx.quadraticCurveTo(r * .22, r * .22, 0, r);
        ctx.quadraticCurveTo(-r * .22, r * .22, -r, 0);
        ctx.quadraticCurveTo(-r * .22, -r * .22, 0, -r);
      }
      ctx.fill();
      ctx.fillStyle = '#f2b54b';
      ctx.beginPath(); ctx.arc(0, 0, r * .30, 0, TAU); ctx.fill();
      ctx.restore();
      this.hot.push({ type: 'spark', index: this.sparkles.indexOf(s), x: gp.x, y: gp.y - r * 1.6, r: Math.max(24, r * 2.6) });
    },

    glow(ctx, x, y, r, color, a) {
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, color);
      grd.addColorStop(.5, color);
      grd.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.save();
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = grd; ctx.fill();
      ctx.restore();
    },

    /* ------------------------- background parts ------------------------- */
    drawSkyObjects(ctx, info) {
      const W = this.W, g = this.g;
      if (info.night) {
        ctx.save();
        for (let i = 0; i < 70; i++) {
          const x = ((i * 137.5) % 1) * W, y = ((i * 71.3) % 1) * g.horizon * 1.1;
          const tw = .35 + .65 * Math.abs(Math.sin(this.t * .8 + i));
          ctx.globalAlpha = tw * .9;
          ctx.fillStyle = i % 7 === 0 ? '#ffe6b8' : '#dfe6ff';
          ctx.beginPath(); ctx.arc(x, y, i % 11 === 0 ? 1.8 : 1.1, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // moon
        const mx = W * .82, my = g.horizon * .42;
        this.glow(ctx, mx, my, 90, '#fff1cc', .22);
        ctx.fillStyle = '#fff6dd';
        ctx.beginPath(); ctx.arc(mx, my, 26, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(20,18,40,.12)';
        ctx.beginPath(); ctx.arc(mx - 7, my - 5, 5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(mx + 8, my + 7, 6.5, 0, TAU); ctx.fill();
        ctx.restore();
      } else if (this.phase === 'sunset') {
        const sx = W * .78, sy = g.horizon * .82;
        this.glow(ctx, sx, sy, 110, '#ffbe73', .38);
        ctx.fillStyle = '#ffe0a8';
        ctx.beginPath(); ctx.arc(sx, sy, 34, 0, TAU); ctx.fill();
      } else if (this.phase === 'clear') {
        const sx = W * .8, sy = g.horizon * .55;
        this.glow(ctx, sx, sy, 190, '#fff3c4', .35);
        ctx.fillStyle = 'rgba(255,252,228,.9)';
        ctx.beginPath(); ctx.arc(sx, sy, 30, 0, TAU); ctx.fill();
      }
      // birds
      if (this.birds.length) {
        ctx.save();
        ctx.strokeStyle = info.dark > .3 ? 'rgba(240,240,255,.55)' : 'rgba(70,60,90,.40)';
        ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        this.birds.forEach(b => {
          const x = b.x * W, y = b.y * g.horizon * 1.05, s = 7 * b.s;
          const flap = Math.sin(this.t * 6 + b.ph) * 3;
          ctx.beginPath();
          ctx.moveTo(x - s, y + flap * .4);
          ctx.quadraticCurveTo(x - s * .45, y - s * .5 - flap, x, y);
          ctx.quadraticCurveTo(x + s * .45, y - s * .5 - flap, x + s, y + flap * .4);
          ctx.stroke();
        });
        ctx.restore();
      }
    },

    drawDistant(ctx, info) {
      const g = this.g, W = this.W;
      const pal = this.village.palette;
      ctx.save();
      // far hills
      const hills = [
        { y: g.horizon + 8, c: info.night ? 'rgba(30,34,66,.9)' : this.phase === 'sunset' ? 'rgba(150,105,140,.55)' : 'rgba(150,175,190,.45)', h: 90, o: .55 },
        { y: g.horizon + 26, c: info.night ? 'rgba(38,40,74,.9)' : this.phase === 'sunset' ? 'rgba(170,120,140,.5)' : 'rgba(120,160,150,.42)', h: 62, o: .7 }
      ];
      hills.forEach((h, i) => {
        ctx.beginPath();
        ctx.moveTo(-50, g.top + 40);
        for (let x = -50; x <= W + 50; x += 60) {
          const y = h.y - Math.sin((x + i * 90) * .004 + i) * h.h - Math.cos(x * .011 + i * 2) * h.h * .35;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W + 50, g.bottom);
        ctx.lineTo(-50, g.bottom);
        ctx.closePath();
        ctx.fillStyle = h.c;
        ctx.fill();
      });
      // distant tree line
      ctx.fillStyle = info.night ? 'rgba(24,28,52,.85)' : 'rgba(70,110,110,.35)';
      for (let i = 0; i < 26; i++) {
        const x = (i / 26) * (W + 80) - 40;
        const y = g.top + 46 + Math.sin(i * 1.7) * 8;
        const h = 16 + ((i * 7) % 16);
        ctx.beginPath();
        ctx.moveTo(x, y - h);
        ctx.lineTo(x + 8, y + 2);
        ctx.lineTo(x - 8, y + 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },

    drawGroundTexture(ctx, pal, info) {
      const g = this.g;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.rx, g.ry, 0, 0, TAU); ctx.clip();
      // soft shading
      const sh = ctx.createRadialGradient(g.cx, g.cy + g.ry * .4, g.rx * .1, g.cx, g.cy + g.ry * .2, g.rx * 1.05);
      sh.addColorStop(0, 'rgba(255,255,255,0)');
      sh.addColorStop(1, info.night ? 'rgba(10,12,30,.42)' : 'rgba(60,50,80,.14)');
      ctx.fillStyle = sh; ctx.fillRect(g.cx - g.rx, g.cy - g.ry, g.rx * 2, g.ry * 2);

      const ground = this.village.ground;
      // deterministic speckles
      let seed = 1;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      if (ground === 'snow') {
        for (let i = 0; i < 130; i++) {
          const a = rnd() * TAU, r = Math.sqrt(rnd());
          const x = g.cx + Math.cos(a) * g.rx * r * .98;
          const y = g.cy + Math.sin(a) * g.ry * r * .98;
          ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + rnd() * .45) + ')';
          ctx.beginPath(); ctx.ellipse(x, y, 1.4 + rnd() * 2.2, .9 + rnd(), 0, 0, TAU); ctx.fill();
        }
        // drifts
        for (let i = 0; i < 7; i++) {
          const x = g.cx + (rnd() - .5) * g.rx * 1.5, y = g.cy + (rnd() - .3) * g.ry * 1.4;
          ctx.fillStyle = 'rgba(255,255,255,.55)';
          ctx.beginPath(); ctx.ellipse(x, y, 26 + rnd() * 30, 8 + rnd() * 6, 0, 0, TAU); ctx.fill();
        }
      } else if (ground === 'grass') {
        for (let i = 0; i < 160; i++) {
          const a = rnd() * TAU, r = Math.sqrt(rnd());
          const x = g.cx + Math.cos(a) * g.rx * r * .98;
          const y = g.cy + Math.sin(a) * g.ry * r * .98;
          ctx.strokeStyle = 'rgba(70,130,80,' + (.25 + rnd() * .35) + ')';
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - .5) * 4, y - 4 - rnd() * 4); ctx.stroke();
        }
      } else if (ground === 'sand') {
        for (let i = 0; i < 90; i++) {
          const a = rnd() * TAU, r = Math.sqrt(rnd());
          const x = g.cx + Math.cos(a) * g.rx * r * .98;
          const y = g.cy + Math.sin(a) * g.ry * r * .98;
          ctx.fillStyle = 'rgba(255,240,200,' + (.2 + rnd() * .35) + ')';
          ctx.beginPath(); ctx.arc(x, y, .8 + rnd() * 1.6, 0, TAU); ctx.fill();
        }
      } else {
        // stone tiles
        ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
        for (let i = -6; i < 8; i++) {
          ctx.beginPath();
          ctx.moveTo(g.cx - g.rx, g.cy + i * 30); ctx.lineTo(g.cx + g.rx, g.cy + i * 30 - 40);
          ctx.stroke();
        }
      }
      ctx.restore();
    },

    drawPath(ctx, pal, info) {
      const g = this.g;
      const pts = [];
      for (let i = 0; i <= 6; i++) pts.push(this.pathPoint(.18 + (i / 6) * .84, 1, 0));
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const w = Math.max(30, g.rx * .155);

      const stroke = (width, color, alpha) => {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      };
      // soft edge halo
      stroke(w + 14, pal.pathEdge || '#ffffff', .16);
      stroke(w + 7, pal.pathEdge || '#ffffff', .22);
      stroke(w, pal.path, .82);
      // trampled centre
      stroke(w * .5, pal.pathEdge || '#ffffff', .12);
      ctx.globalAlpha = 1;

      // stepping stones
      ctx.globalAlpha = .22;
      for (let i = 1; i < 9; i++) {
        const p = this.pathPoint(.18 + (i / 9) * .84, 1, 0);
        ctx.beginPath(); ctx.ellipse(p.x + (i % 2 ? 8 : -8), p.y, w * .26, w * .085, 0, 0, TAU);
        ctx.fillStyle = pal.pathEdge || '#fff'; ctx.fill();
      }
      ctx.restore();

      // scattered flagstones where villagers gather
      const plaza = this.groundPoint(.5, .70);
      ctx.save();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + .4;
        const sx = plaza.x + Math.cos(a) * g.rx * .20;
        const sy = plaza.y + Math.sin(a) * g.ry * .085;
        ctx.globalAlpha = .28 + (i % 2) * .08;
        ctx.beginPath(); ctx.ellipse(sx, sy, 13, 6, 0, 0, TAU);
        ctx.fillStyle = pal.pathEdge || '#fff'; ctx.fill();
      }
      ctx.restore();
    },

    drawBackProps(ctx, pal, info) {
      // plaza glow in centre-back (windows)
      if (!this.village) return;
      const g = this.g;
      const house = this.groundPoint(.5, .20);
      this.drawHouse(ctx, house.x, house.y, pal, info);
      this.hot.push({ type: 'house', x: house.x, y: house.y - g.ornH * .8, r: g.ornH });
    },

    drawHouse(ctx, x, y, pal, info) {
      const g = this.g;
      const style = this.village.house;
      const w = Math.min(g.rx * .88, 340), h = g.ornH * 2.25;
      const left = x - w / 2, base = y;
      ctx.save();
      ctx.globalAlpha = .2; ctx.beginPath(); ctx.ellipse(x, base + 2, w * .48, g.ornH * .16, 0, 0, TAU); ctx.fillStyle = '#1d1a2b'; ctx.fill(); ctx.globalAlpha = 1;

      const wall = style === 'harbor' ? '#eae4d2' : style === 'alley' ? '#4a3f52' : '#f3ecdd';
      const roof = style === 'alley' ? '#2f2a44' : style === 'harbor' ? '#4f7f8f' : '#b1553f';
      const wood = '#8b6a4a';

      // walls
      ctx.fillStyle = wall;
      ctx.beginPath(); ctx.roundRect(left + w * .06, base - h * .62, w * .88, h * .62, 6); ctx.fill();
      if (style === 'cabin') {
        ctx.strokeStyle = 'rgba(140,110,80,.35)'; ctx.lineWidth = 2;
        for (let i = 1; i < 7; i++) { ctx.beginPath(); ctx.moveTo(left + w * .06, base - h * .62 + i * h * .085); ctx.lineTo(left + w * .94, base - h * .62 + i * h * .085); ctx.stroke(); }
      }
      if (style === 'harbor') {
        ctx.fillStyle = '#cfe4ea';
        ctx.fillRect(left + w * .06, base - h * .62, w * .88, h * .07);
      }
      if (style === 'alley') {
        ctx.fillStyle = 'rgba(255,255,255,.05)';
        ctx.fillRect(left + w * .06, base - h * .62, w * .88, h * .62);
      }

      // roof
      ctx.fillStyle = roof;
      ctx.beginPath();
      if (style === 'harbor') {
        ctx.roundRect(left - 4, base - h * .86, w + 8, h * .28, 8);
      } else {
        ctx.moveTo(left - 12, base - h * .60);
        ctx.lineTo(x, base - h * .96);
        ctx.lineTo(left + w + 12, base - h * .60);
        ctx.closePath();
      }
      ctx.fill();
      if (style !== 'harbor') {
        ctx.fillStyle = 'rgba(255,255,255,.10)';
        ctx.beginPath(); ctx.moveTo(left - 12, base - h * .60); ctx.lineTo(x, base - h * .96); ctx.lineTo(x, base - h * .62); ctx.closePath(); ctx.fill();
      }
      // snow on roof
      if (this.phase === 'snow' || this.village.id === 'snowbell') {
        ctx.fillStyle = '#fdfdff';
        ctx.beginPath();
        if (style === 'harbor') ctx.roundRect(left - 6, base - h * .88, w + 12, h * .10, 6);
        else { ctx.moveTo(left - 14, base - h * .595); ctx.lineTo(x, base - h * .975); ctx.lineTo(left + w + 14, base - h * .595); ctx.lineTo(left + w + 4, base - h * .56); ctx.lineTo(x, base - h * .935); ctx.lineTo(left - 4, base - h * .56); }
        ctx.fill();
      }

      // eave shadow
      ctx.fillStyle = 'rgba(70,45,30,.16)';
      ctx.fillRect(left + w * .06, base - h * .64, w * .88, h * .05);
      // porch step
      ctx.fillStyle = 'rgba(160,130,100,.55)';
      ctx.beginPath(); ctx.roundRect(x - w * .12, base - h * .03, w * .24, h * .03, 3); ctx.fill();
      // door
      const dw = w * .16, dh = h * .30;
      ctx.fillStyle = style === 'alley' ? '#2b2536' : '#7b5232';
      ctx.beginPath(); ctx.roundRect(x - dw / 2, base - dh, dw, dh, 4); ctx.fill();
      ctx.fillStyle = pal.nightGlow;
      ctx.globalAlpha = info.dark > .2 ? .9 : .35;
      ctx.fillRect(x - dw * .32, base - dh + h * .03, dw * .64, dh * .2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f2b54b';
      ctx.beginPath(); ctx.arc(x + dw * .28, base - dh * .45, 2.2, 0, TAU); ctx.fill();

      // wreath on the door
      ctx.strokeStyle = '#2f7d5d'; ctx.lineWidth = Math.max(3, w * .012);
      ctx.beginPath(); ctx.arc(x, base - dh * .62, dw * .17, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#e2614c'; ctx.beginPath(); ctx.arc(x + dw * .1, base - dh * .70, Math.max(2, w * .008), 0, TAU); ctx.fill();
      // windows
      const winW = w * .17, winH = h * .17;
      const wy = base - h * .52;
      [[-w * .28], [w * .28]].forEach(([dx]) => {
        const wx = x + dx;
        this.window(ctx, wx, wy, winW, winH, pal, info);
      });
      if (style === 'alley') {
        // hanging lanterns by door
        [-1, 1].forEach((s) => {
          const lx = x + s * w * .22, ly = base - h * .40;
          this.glow(ctx, lx, ly, 34, pal.nightGlow, .5);
          ctx.fillStyle = '#e2614c'; ctx.beginPath(); ctx.roundRect(lx - 5, ly - 8, 10, 16, 4); ctx.fill();
          ctx.fillStyle = '#ffe3a3'; ctx.beginPath(); ctx.roundRect(lx - 3, ly - 5, 6, 9, 2); ctx.fill();
        });
      }
      // chimney + smoke (cabin)
      if (style === 'cabin' || style === 'cottage') {
        const cx = left + w * .74, cy = base - h * .80;
        ctx.fillStyle = '#8b6a4a'; ctx.fillRect(cx, cy, w * .07, h * .16);
        ctx.fillStyle = '#fdfdff'; ctx.fillRect(cx - 2, cy - 3, w * .07 + 4, 5);
        ctx.save();
        ctx.globalAlpha = .35;
        for (let i = 0; i < 3; i++) {
          const t = (this.t * .5 + i * .33) % 1;
          ctx.beginPath();
          ctx.arc(cx + w * .035 + Math.sin(t * 6 + i) * 8, cy - 10 - t * 40, 6 + t * 9, 0, TAU);
          ctx.fillStyle = '#fff'; ctx.fill();
        }
        ctx.restore();
      }
      // shop sign on house for harbor
      if (style === 'harbor') {
        ctx.fillStyle = '#3b3850';
        ctx.beginPath(); ctx.roundRect(x - w * .16, base - h * .58, w * .32, h * .09, 4); ctx.fill();
        ctx.fillStyle = '#ffe3a3';
        ctx.font = '700 ' + Math.round(h * .055) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('MOA', x, base - h * .533);
      }
      // fence/hedge in front of house
      ctx.restore();
    },

    window(ctx, x, y, w, h, pal, info) {
      const lit = info.dark > .15;
      if (lit) {
        this.glow(ctx, x + w / 2, y + h / 2, w * 1.6, pal.nightGlow, .35);
        if (this._lights) this._lights.push({ x: x + w / 2, y: y + h / 2, r: w * 1.9, color: pal.nightGlow, a: .55, rect: [x - w / 2, y - h / 2, w, h] });
      }
      ctx.fillStyle = lit ? '#ffd98a' : '#bfd6e6';
      ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(90,70,50,.6)'; ctx.lineWidth = 2;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x, y + h / 2); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.stroke();
    },

    drawForeground(ctx, pal, info) {
      const g = this.g, W = this.W, H = this.H;
      ctx.save();
      // soft banks that hug the ground ellipse (no hard horizon band)
      const isSnow = this.village.ground === 'snow';
      const bank = isSnow ? 'rgba(255,255,255,.55)' : this.village.ground === 'grass' ? 'rgba(120,185,120,.20)' : this.village.ground === 'sand' ? 'rgba(255,238,200,.30)' : 'rgba(150,135,180,.18)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(g.cx + (i - 1) * g.rx * .34, g.cy + g.ry * (1.02 + i * .035), g.rx * (.42 - i * .05), g.ry * (.10 + i * .02), 0, 0, TAU);
        ctx.fillStyle = bank; ctx.globalAlpha = .55 - i * .12; ctx.fill();
      }
      ctx.globalAlpha = 1;
      // tiny foreground tufts / glints at the bottom edge
      let seed = 7;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let i = 0; i < 26; i++) {
        const x = g.cx + (rnd() - .5) * g.rx * 1.9;
        const y = g.cy + g.ry * (.96 + rnd() * .16);
        ctx.globalAlpha = .25 + rnd() * .3;
        ctx.strokeStyle = isSnow ? '#ffffff' : 'rgba(90,140,100,.8)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - .5) * 4, y - 5 - rnd() * 6); ctx.stroke();
      }
      ctx.restore();
    },

    drawWeather(ctx, info) {
      const W = this.W, H = this.H;
      if (this.phase === 'rain') {
        ctx.save();
        ctx.strokeStyle = 'rgba(200,225,255,.55)';
        ctx.lineWidth = 1.6;
        this.particles.forEach(p => {
          ctx.globalAlpha = p.a;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.l * .18, p.y + p.l); ctx.stroke();
        });
        ctx.restore();
      } else if (this.phase === 'snow') {
        ctx.save();
        this.particles.forEach(p => {
          ctx.globalAlpha = p.a;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        });
        ctx.restore();
      } else if (this.phase === 'night') {
        ctx.save();
        this.particles.forEach(p => {
          const a = .35 + .65 * Math.abs(Math.sin(p.ph));
          ctx.globalAlpha = a * p.a;
          ctx.fillStyle = '#ffe9a8';
          ctx.beginPath(); ctx.arc(p.x, p.y + Math.sin(p.ph) * 6, p.r, 0, TAU); ctx.fill();
        });
        ctx.restore();
      } else {
        ctx.save();
        this.particles.forEach(p => {
          ctx.globalAlpha = p.a * .6;
          ctx.fillStyle = this.phase === 'sunset' ? '#ffd9a8' : '#fffbe4';
          ctx.beginPath(); ctx.arc(p.x, p.y + Math.sin(p.ph) * 8, p.r, 0, TAU); ctx.fill();
        });
        ctx.restore();
      }
    },

    drawNightLights(ctx, info) {
      const L = this._lights || [];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      L.forEach(l => {
        const grd = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, Math.max(6, l.r));
        grd.addColorStop(0, 'rgba(255,224,160,' + (.55 * (l.a || .5)) + ')');
        grd.addColorStop(.45, 'rgba(255,205,130,' + (.22 * (l.a || .5)) + ')');
        grd.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(l.x, l.y, Math.max(6, l.r), 0, TAU); ctx.fill();
        if (l.rect) {
          ctx.fillStyle = 'rgba(255,226,164,.55)';
          ctx.fillRect(l.rect[0], l.rect[1], l.rect[2], l.rect[3]);
        }
      });
      ctx.restore();
    },

    drawLight(ctx, pal, info) {
      const W = this.W, H = this.H;
      if (info.night) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#9aa2de';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(10,12,32,.20)';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, H * .25, 0, H);
        g.addColorStop(0, 'rgba(70,80,150,.10)');
        g.addColorStop(1, 'rgba(20,18,40,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      } else if (this.phase === 'sunset') {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#ffe2cf';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        const g = ctx.createLinearGradient(0, 0, W * .6, H);
        g.addColorStop(0, 'rgba(255,150,90,.22)');
        g.addColorStop(.45, 'rgba(255,185,120,.14)');
        g.addColorStop(1, 'rgba(120,70,120,.20)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      } else if (this.phase === 'rain') {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#c3cfe0';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(50,65,95,.12)';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      if (this.phase === 'clear') {
        ctx.save();
        const g = ctx.createRadialGradient(W * .82, H * .16, 0, W * .82, H * .16, W * .5);
        g.addColorStop(0, 'rgba(255,244,200,.20)');
        g.addColorStop(1, 'rgba(255,244,200,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      // vignette
      ctx.save();
      const vg = ctx.createRadialGradient(W / 2, H * .55, Math.min(W, H) * .38, W / 2, H * .55, Math.max(W, H) * .80);
      vg.addColorStop(0, 'rgba(20,16,40,0)');
      vg.addColorStop(1, info.night ? 'rgba(6,6,18,.62)' : this.phase === 'sunset' ? 'rgba(70,30,70,.28)' : 'rgba(30,24,50,.18)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    },

    /* ------------------------- path math ------------------------- */
    roadPoint(t) { return this.pathPoint(t, 1, 0); },

    pathPoint(t, dir, spread) {
      const g = this.g;
      // S-shaped road from top of ground to bottom
      const yy = g.top + t * (g.ry * 2) * .9;
      const xx = g.cx + Math.sin(t * Math.PI * 1.1 - .3) * g.rx * (.10 + spread);
      return { x: xx, y: yy };
    },

    /* ------------------------- input ------------------------- */
    bindPointer() {
      const c = this.canvas;
      let down = null;
      let moved = false;
      const posOf = (e) => {
        const r = c.getBoundingClientRect();
        const pt = (e.touches && e.touches[0]) || e;
        return { x: pt.clientX - r.left, y: pt.clientY - r.top };
      };
      const hit = (p) => {
        // topmost last drawn -> iterate reverse
        for (let i = this.hot.length - 1; i >= 0; i--) {
          const h = this.hot[i];
          const d = Math.hypot(p.x - h.x, p.y - h.y);
          if (d <= h.r) return h;
        }
        return null;
      };
      const toNorm = (p) => {
        const g = this.g;
        return {
          nx: clamp((p.x - g.cx) / (g.rx * .92) / 2 + .5, .04, .96),
          ny: clamp((p.y - g.top) / ((g.ry * 2) * .94), .04, .97)
        };
      };

      c.addEventListener('pointerdown', (e) => {
        c.setPointerCapture && c.setPointerCapture(e.pointerId);
        const p = posOf(e);
        down = p; moved = false;
        const h = hit(p);
        if (h) {
          if (h.type === 'orn') {
            const placed = this.placements.find(x => x.uid === h.uid);
            if (placed && this.mode !== 'place') {
              this._downOrn = { uid: h.uid, sx: p.x, sy: p.y, nx: placed.nx, ny: placed.ny };
            }
          }
        }
      }, { passive: true });

      c.addEventListener('pointermove', (e) => {
        if (!down) return;
        const p = posOf(e);
        if (Math.hypot(p.x - down.x, p.y - down.y) > 6) moved = true;
        if (this._downOrn && moved && this.mode !== 'place') {
          this.dragging = true;
          this.dragUid = this._downOrn.uid;
          const n = toNorm(p);
          MV.Store.move(this._downOrn.uid, n.nx, n.ny);
          this.refreshPlacements();
        }
      }, { passive: true });

      c.addEventListener('pointerup', (e) => {
        const p = posOf(e);
        const h = hit(p);
        if (this._downOrn && this.dragging) {
          this.dragging = false; this.dragUid = null;
          this._downOrn = null;
          if (this.callbacks.onMoved) this.callbacks.onMoved();
          down = null;
          return;
        }
        this._downOrn = null;
        down = null;
        if (!h) {
          const n = toNorm(p);
          if (this.callbacks.onGround) this.callbacks.onGround(n.nx, n.ny);
          return;
        }
        if (h.type === 'spark' && this.callbacks.onSparkle) this.callbacks.onSparkle(h.index, h);
        else if (h.type === 'pet' && this.callbacks.onPet) this.callbacks.onPet(h.id, h);
        else if (h.type === 'ride' && this.callbacks.onRide) this.callbacks.onRide(h.id, h);
        else if (h.type === 'orn' && this.callbacks.onOrnament) this.callbacks.onOrnament(h.uid, h);
        else if (h.type === 'house' && this.callbacks.onHouse) this.callbacks.onHouse(h);
      });

      c.addEventListener('pointercancel', () => { down = null; this._downOrn = null; this.dragging = false; this.dragUid = null; });
    },

    setMode(mode, itemId) {
      this.mode = mode || 'idle';
      this.pendingItem = itemId || null;
      this.canvas.style.cursor = mode === 'place' ? 'crosshair' : 'default';
    },

    screenOf(nx, ny) { return this.groundPoint(nx, ny); }
  };

  MV.Scene = Scene;
})();
