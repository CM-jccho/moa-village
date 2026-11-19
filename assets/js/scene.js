/* MOA Village v2 — open world engine (camera, city render, vehicles, walkers) */
(function () {
  'use strict';
  window.MV = window.MV || {};
  const C = () => MV.Catalog;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const W = () => MV.World.W;
  const H = () => MV.World.H;

  const imgCache = {};
  function sprite(key, dataUrl) {
    if (!dataUrl) return null;
    let im = imgCache[key];
    if (!im) { im = new Image(); im.decoding = 'async'; im.src = dataUrl; imgCache[key] = im; }
    return im;
  }
  function ready(im) { return im && im.complete && im.naturalWidth > 0; }

  const Scene = {
    canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
    village: null, plan: null, groundCanvas: null, groundScale: .5,
    weatherMode: 'auto', phase: 'clear',
    t: 0, last: 0, raf: 0,
    cam: { x: 1520, y: 1420, zoom: 1.15, tzoom: 1.15 },
    avatar: { x: 1520, y: 1430, tx: 1520, ty: 1430, dir: 1, moving: false, bob: 0, speed: 175, heading: -Math.PI / 2, nickname: '', hidden: false },
    vehicle: null, vehicles: [], npcs: [], pets: [], sparks: [], parts: [], trails: [], pops: [],
    hot: [], keys: {}, joy: { x: 0, y: 0, active: false },
    mode: 'idle', pendingItem: null, dragUid: null, dragging: false, placements: [],
    callbacks: {}, _lights: [], _shake: 0,
    view: { x: 0, y: 0, w: 0, h: 0 },
    lastDistrict: null, districtUntil: 0, frameCount: 0,
    driveTrailT: 0, hornT: 0, muted: false,

    /* ============================ setup ============================ */
    init(canvas, callbacks) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.callbacks = callbacks || {};
      this.bindPointer();
      this.bindKeys();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 260));
      this.last = performance.now();
      this.loop();
    },

    on(name, fn) { this.callbacks[name] = fn; },
    emit(name, data) { const fn = this.callbacks[name]; if (fn) { try { fn(data); } catch (e) { console.warn('cb ' + name, e); } } },

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
      this.buildParticles();
      this.cam.zoom = this.baseZoom();
      this.cam.tzoom = this.baseZoom();
    },

    baseZoom() {
      const w = this.W;
      if (w < 520) return .88;
      if (w < 900) return 1.05;
      if (w < 1220) return 1.18;
      return 1.15;
    },

    setVillage(v) {
      this.village = v;
      this.plan = MV.World.build(v);
      const st = MV.Store.state;
      this.placements = (st.deco[v.id] || []).slice();
      this.avatar.nickname = st.nickname || '';
      this.avatar.x = 1520; this.avatar.y = 1440;
      this.avatar.tx = 1520; this.avatar.ty = 1440;
      this.avatar.hidden = false;
      this.vehicle = null;
      this.cam.x = 1520; this.cam.y = 1400;
      this.buildGround();
      this.spawnVehicles();
      this.spawnNpcs();
      this.syncPets(true);
      this.buildSparks();
      this.buildParticles();
      this.lastDistrict = null;
      this.emit('village', { id: v.id });
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
      this.emit('phase', { phase: mode });
    },

    phaseInfo() {
      const p = this.phase;
      return {
        night: p === 'night', sunset: p === 'sunset', rain: p === 'rain', snow: p === 'snow',
        dark: p === 'night' ? .62 : p === 'sunset' ? .16 : p === 'rain' ? .30 : 0
      };
    },

    isSnow() { return this.phase === 'snow' || (this.village && this.village.id === 'snowbell'); },

    /* ============================ ground ============================ */
    buildGround() {
      const plan = this.plan, pal = plan.pal;
      const s = this.groundScale = .5;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(W() * s); cv.height = Math.ceil(H() * s);
      const g = cv.getContext('2d');
      g.scale(s, s);
      let seed = 3;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

      g.fillStyle = pal.ground; g.fillRect(0, 0, W(), H());
      /* soft terrain variation */
      for (let i = 0; i < 26; i++) {
        const x = rnd() * W(), y = rnd() * H(), r = 120 + rnd() * 320;
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(255,255,255,.16)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }

      /* park */
      g.fillStyle = pal.grass;
      roundRect(g, 1600, 150, 1300, 1050, 60); g.fill();
      /* park paths */
      g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 34; g.lineCap = 'round';
      g.beginPath(); g.moveTo(1640, 1080); g.quadraticCurveTo(2000, 700, 2160, 470); g.stroke();
      g.beginPath(); g.moveTo(2160, 1180); g.quadraticCurveTo(2300, 1000, 2540, 940); g.stroke();

      /* shop block pavement */
      g.fillStyle = pal.walk;
      roundRect(g, 110, 812, 1350, 380, 22); g.fill();
      g.fillStyle = 'rgba(0,0,0,.045)';
      for (let x = 120; x < 1450; x += 58) g.fillRect(x, 812, 1.6, 380);
      for (let y = 820; y < 1190; y += 58) g.fillRect(110, y, 1350, 1.6);

      /* residential ground + paths */
      for (let i = 0; i < 14; i++) {
        const x = 140 + rnd() * 1240, y = 1330 + rnd() * 490, r = 40 + rnd() * 90;
        g.fillStyle = 'rgba(255,255,255,.10)';
        g.beginPath(); g.ellipse(x, y, r, r * .5, 0, 0, TAU); g.fill();
      }
      g.strokeStyle = pal.walkEdge; g.globalAlpha = .55; g.lineWidth = 26;
      g.beginPath(); g.moveTo(180, 1600); g.quadraticCurveTo(700, 1620, 1400, 1580); g.stroke();
      g.beginPath(); g.moveTo(760, 1310); g.lineTo(760, 1760); g.stroke();
      g.globalAlpha = 1;

      /* harbor dock ground */
      g.fillStyle = pal.walk;
      roundRect(g, 1600, 1320, 1290, 660, 26); g.fill();
      g.fillStyle = 'rgba(0,0,0,.05)';
      for (let x = 1610; x < 2890; x += 46) g.fillRect(x, 1320, 1.4, 660);

      /* shore */
      g.fillStyle = pal.sand;
      g.fillRect(0, MV.World.WATER_Y - 76, W(), 76);
      /* water */
      g.fillStyle = pal.water;
      g.fillRect(0, MV.World.WATER_Y, W(), H() - MV.World.WATER_Y);
      g.fillStyle = pal.waterDeep;
      g.fillRect(0, MV.World.WATER_Y + 110, W(), H() - MV.World.WATER_Y - 110);
      /* pond */
      const P = plan.pond;
      g.fillStyle = pal.grass2;
      g.beginPath(); g.ellipse(P.x, P.y, P.rx + 26, P.ry + 22, 0, 0, TAU); g.fill();
      g.fillStyle = pal.water;
      g.beginPath(); g.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, TAU); g.fill();
      g.fillStyle = pal.waterDeep;
      g.beginPath(); g.ellipse(P.x, P.y, P.rx * .8, P.ry * .74, 0, 0, TAU); g.fill();

      /* roads: sidewalks first */
      g.lineCap = 'round';
      plan.roads.forEach(r => {
        g.strokeStyle = pal.walkEdge; g.lineWidth = r.w + 46;
        line(g, r.x1, r.y1, r.x2, r.y2);
        g.strokeStyle = pal.walk; g.lineWidth = r.w + 34;
        line(g, r.x1, r.y1, r.x2, r.y2);
      });
      /* asphalt */
      plan.roads.forEach(r => {
        g.strokeStyle = pal.road; g.lineWidth = r.w;
        line(g, r.x1, r.y1, r.x2, r.y2);
        g.strokeStyle = pal.roadDark; g.lineWidth = 3;
        g.globalAlpha = .25;
        line(g, r.x1, r.y1 + 2, r.x2, r.y2 + 2);
        g.globalAlpha = 1;
      });
      /* lane dashes */
      g.setLineDash([26, 26]);
      g.lineWidth = 4;
      plan.roads.forEach(r => {
        g.strokeStyle = r.main ? pal.line : 'rgba(255,255,255,.5)';
        const horizontal = r.y1 === r.y2;
        if (horizontal) {
          g.beginPath(); g.moveTo(r.x1, r.y1); g.lineTo(r.x2, r.y2); g.stroke();
        } else {
          g.beginPath(); g.moveTo(r.x1, r.y1); g.lineTo(r.x2, r.y2); g.stroke();
        }
      });
      g.setLineDash([]);

      /* plaza */
      const PZ = plan.plaza;
      g.fillStyle = pal.road;
      g.beginPath(); g.arc(PZ.x, PZ.y, PZ.rOut, 0, TAU); g.fill();
      g.fillStyle = pal.plazaEdge;
      g.beginPath(); g.arc(PZ.x, PZ.y, PZ.rIn + 8, 0, TAU); g.fill();
      g.fillStyle = pal.plaza;
      g.beginPath(); g.arc(PZ.x, PZ.y, PZ.rIn, 0, TAU); g.fill();
      /* plaza rings + cobbles */
      g.strokeStyle = pal.plazaLine; g.lineWidth = 3;
      for (let r = 40; r < PZ.rIn; r += 34) { g.beginPath(); g.arc(PZ.x, PZ.y, r, 0, TAU); g.stroke(); }
      for (let a = 0; a < 24; a++) {
        g.beginPath();
        g.moveTo(PZ.x + Math.cos(a / 24 * TAU) * 36, PZ.y + Math.sin(a / 24 * TAU) * 36);
        g.lineTo(PZ.x + Math.cos(a / 24 * TAU) * PZ.rIn, PZ.y + Math.sin(a / 24 * TAU) * PZ.rIn);
        g.stroke();
      }
      /* plaza centre emblem */
      g.fillStyle = pal.accent; g.globalAlpha = .22;
      g.beginPath(); g.arc(PZ.x, PZ.y, 96, 0, TAU); g.fill();
      g.globalAlpha = 1;

      /* crossings */
      plan.crossings.forEach(cr => {
        g.fillStyle = 'rgba(255,255,255,.82)';
        if (cr.d === 'h') {
          for (let i = -3; i <= 3; i++) {
            g.fillRect(cr.x + i * 16 - 5, cr.y - cr.w / 2 + 6, 9, cr.w - 12);
          }
        } else {
          for (let i = -3; i <= 3; i++) {
            g.fillRect(cr.x - cr.w / 2 + 6, cr.y + i * 16 - 5, cr.w - 12, 9);
          }
        }
      });

      /* pier planks */
      g.fillStyle = '#a9835c';
      roundRect(g, 2140, 1940, 140, 200, 6); g.fill();
      g.fillStyle = 'rgba(90,60,40,.35)';
      for (let y = 1950; y < 2136; y += 16) g.fillRect(2140, y, 140, 2);

      /* ground texture */
      const ground = plan.ground;
      const n = ground === 'snow' ? 900 : 700;
      for (let i = 0; i < n; i++) {
        const x = rnd() * W(), y = rnd() * H();
        if (y > MV.World.WATER_Y - 20) continue;
        if (ground === 'snow') {
          g.fillStyle = 'rgba(255,255,255,' + (0.18 + rnd() * .35) + ')';
          g.beginPath(); g.ellipse(x, y, 2 + rnd() * 5, 1 + rnd() * 2, 0, 0, TAU); g.fill();
        } else if (ground === 'grass') {
          g.strokeStyle = 'rgba(60,120,70,' + (.12 + rnd() * .2) + ')'; g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 5, y - 4 - rnd() * 5); g.stroke();
        } else if (ground === 'sand') {
          g.fillStyle = 'rgba(200,160,100,' + (.12 + rnd() * .22) + ')';
          g.beginPath(); g.arc(x, y, 1 + rnd() * 2.2, 0, TAU); g.fill();
        } else {
          g.fillStyle = 'rgba(255,255,255,' + (.03 + rnd() * .05) + ')';
          g.fillRect(x, y, 3 + rnd() * 6, 1.4);
        }
      }

      this.groundCanvas = cv;
      /* mini map base */
      this.miniBase = document.createElement('canvas');
      this.miniBase.width = 600; this.miniBase.height = 440;
      MV.World.mini(this.miniBase.getContext('2d'), 600, 440, plan);
    },

    /* ============================ spawns ============================ */
    spawnVehicles() {
      const st = MV.Store.state;
      const list = [];
      this.plan.vehicleSpots.forEach(s => {
        if (s.premium) {
          list.push({ id: s.id, x: s.x, y: s.y, angle: s.angle || 0, speed: 0, drive: false, test: true, owned: MV.Store.hasRide(s.id), startX: s.x, startY: s.y });
          return;
        }
        if (s.id === 'minicar' || s.id === 'bike' || s.id === 'scooter') {
          /* free starter rides: always parked in the world */
          list.push({ id: s.id, x: s.x, y: s.y, angle: s.angle || 0, speed: 0, drive: false, owned: true, startX: s.x, startY: s.y });
          return;
        }
        if (MV.Store.hasRide(s.id)) list.push({ id: s.id, x: s.x, y: s.y, angle: s.angle || 0, speed: 0, drive: false, owned: true, startX: s.x, startY: s.y });
      });
      /* ambient tram looping the main avenue */
      list.push({ id: 'tram', x: 300, y: 1250, angle: 0, speed: 0, drive: false, owned: MV.Store.hasRide('tram'), route: 'ave', routeT: 0, public: true, startX: 300, startY: 1250 });
      this.vehicles = list;
      this.vehicle = null;
    },

    spawnNpcs() {
      const pal = this.plan.pal;
      const skins = ['#f6d6b8', '#e8c39a', '#d9a878', '#f2d2b0'];
      const coats = ['#e2614c', '#8cc8b4', '#b9aef0', '#f2b54b', '#5fae97', '#c96a8a', '#6d8fd6'];
      this.npcs = this.plan.npcSpots.map((s, i) => ({
        id: 'npc' + i, x: s.x, y: s.y, tx: s.x, ty: s.y, speed: 42 + (i % 4) * 9,
        dir: 1, bob: Math.random() * TAU, home: s, district: s.d, coat: coats[i % coats.length],
        skin: skins[i % skins.length], line: i, wait: rand(0, 2), jump: 0, cheer: false, name: ''
      }));
    },

    syncPets(reset) {
      const st = MV.Store.state;
      const active = st.activePets || [];
      if (reset) this.pets = [];
      else this.pets = this.pets.filter(p => active.indexOf(p.id) >= 0);
      active.slice(0, 3).forEach((id, i) => {
        if (this.pets.some(p => p.id === id)) return;
        this.pets.push({
          id, x: this.avatar.x - 40 + i * 26, y: this.avatar.y + 26 + i * 12,
          tx: this.avatar.x, ty: this.avatar.y, bob: Math.random() * TAU, dir: 1, hop: 0
        });
      });
    },

    syncRides() { this.spawnVehicles(); },

    buildSparks() {
      this.sparks = this.plan.sparkSpots.map((s, i) => ({ x: s.x, y: s.y, ph: rand(0, TAU), life: 1, id: 's' + i + '-' + Date.now() }));
    },

    buildParticles() {
      const Ws = this.W, Hs = this.H;
      this.parts = [];
      const p = this.phase;
      if (p === 'rain') {
        const n = Math.round(clamp(Ws / 6, 90, 260));
        for (let i = 0; i < n; i++) this.parts.push({ x: rand(-.2, 1.2) * Ws, y: rand(0, Hs), v: rand(760, 1250), l: rand(12, 26), a: rand(.16, .45) });
      } else if (p === 'snow') {
        const n = Math.round(clamp(Ws / 7, 70, 220));
        for (let i = 0; i < n; i++) this.parts.push({ x: rand(0, Ws), y: rand(0, Hs), r: rand(1.2, 3.6), v: rand(24, 64), d: rand(.2, 1), ph: rand(0, TAU), a: rand(.4, .95) });
      } else if (p === 'night') {
        for (let i = 0; i < 30; i++) this.parts.push({ x: rand(0, Ws), y: rand(0, Hs), r: rand(1, 2.4), ph: rand(0, TAU), v: rand(.2, .7), a: rand(.3, .9) });
      } else {
        for (let i = 0; i < 24; i++) this.parts.push({ x: rand(0, Ws), y: rand(0, Hs), r: rand(1, 2.4), ph: rand(0, TAU), v: rand(.2, .6), a: rand(.2, .6) });
      }
    },

    /* ============================ loop ============================ */
    loop() {
      this.raf = requestAnimationFrame(() => this.loop());
      const now = performance.now();
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > .1) dt = .1;
      this.t += dt;
      this.update(dt);
      this.render();
      this.frameCount++;
      this.emit('frame', dt);
    },

    update(dt) {
      if (!this.plan) return;
      if (this.vehicle) this.updateDrive(dt);
      else this.updateWalk(dt);
      this.updateVehiclesAmbient(dt);
      this.updatePets(dt);
      this.updateNpcs(dt);
      this.updateSparks(dt);
      this.updateTrails(dt);
      this.updateParts(dt);
      if (MV.Missions) MV.Missions.update(dt);
      this.updateCamera(dt);
      this.updateDistrict();
      if (this._shake > 0) this._shake = Math.max(0, this._shake - dt * 2.4);
    },

    /* ------------------------- walking ------------------------- */
    updateWalk(dt) {
      const a = this.avatar;
      let vx = 0, vy = 0;
      const k = this.keys;
      if (k['w'] || k['arrowup'] || k['ㅈ']) vy -= 1;
      if (k['s'] || k['arrowdown'] || k['ㄴ']) vy += 1;
      if (k['a'] || k['arrowleft'] || k['ㅁ']) vx -= 1;
      if (k['d'] || k['arrowright'] || k['ㅇ']) vx += 1;
      if (this.joy.active) { vx += this.joy.x * 1.15; vy += this.joy.y * 1.15; }
      const len = Math.hypot(vx, vy);
      if (len > .12) {
        vx /= len; vy /= len;
        const sp = a.speed * (k['shift'] ? 1.5 : 1);
        this.tryMove(a, vx * sp * dt, vy * sp * dt, 11);
        a.dir = vx > .2 ? 1 : vx < -.2 ? -1 : a.dir;
        a.heading = Math.atan2(vy, vx);
        a.moving = true;
        a.bob += dt * 10;
        a.tx = a.x; a.ty = a.y;
      } else {
        const dx = a.tx - a.x, dy = a.ty - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 3) {
          const sp = Math.min(a.speed * dt, d);
          this.tryMove(a, dx / d * sp, dy / d * sp, 11);
          a.dir = dx > .4 ? 1 : dx < -.4 ? -1 : a.dir;
          a.heading = Math.atan2(dy, dx);
          a.moving = true; a.bob += dt * 10;
        } else {
          a.moving = false; a.bob += dt * 2.2;
        }
      }
      if (MV.Missions && MV.Missions.onWalk) MV.Missions.onWalk(dt);
    },

    /* ------------------------- driving ------------------------- */
    updateDrive(dt) {
      const v = this.vehicle;
      if (!v) return;
      const cfg = C().vehicle(v.id) || { max: 330, accel: 360, turn: 2.9, offroad: .6 };
      const k = this.keys;
      let ix = 0, iy = 0;
      if (k['w'] || k['arrowup']) iy -= 1;
      if (k['s'] || k['arrowdown']) iy += 1;
      if (k['a'] || k['arrowleft']) ix -= 1;
      if (k['d'] || k['arrowright']) ix += 1;
      if (this.joy.active) { ix += this.joy.x; iy += this.joy.y; }
      const input = Math.hypot(ix, iy) > .12;
      const onRoad = this.onPaved(v.x, v.y);
      const maxSpeed = cfg.max * (onRoad ? 1 : cfg.offroad);
      if (input) {
        const target = Math.atan2(iy, ix);
        let diff = target - v.angle;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        const turnRate = cfg.turn * (1 - .45 * clamp(Math.abs(v.speed) / cfg.max, 0, 1));
        v.angle += clamp(diff, -turnRate * dt, turnRate * dt);
        v.speed += cfg.accel * dt * (1 - clamp(v.speed / (maxSpeed * 1.08), 0, .96));
      } else {
        v.speed *= (1 - 1.9 * dt);
      }
      if (Math.abs(v.speed) < 6) v.speed = 0;
      v.speed = clamp(v.speed, -maxSpeed * .34, maxSpeed);
      const dx = Math.cos(v.angle) * v.speed * dt;
      const dy = Math.sin(v.angle) * v.speed * dt;
      if (!this.tryMove(v, dx, dy, 20)) {
        v.speed *= -.18;
        if (Math.abs(v.speed) > 60) { this.shake(.5); this.beep('bump'); }
      }
      v.dir = Math.cos(v.angle) >= 0 ? 1 : -1;
      /* tyre trails */
      this.driveTrailT -= dt;
      if (Math.abs(v.speed) > 90 && this.driveTrailT <= 0) {
        this.driveTrailT = .045;
        this.trails.push({ x: v.x - Math.cos(v.angle) * 18, y: v.y + 10, a: .5, w: 9 });
        if (this.trails.length > 220) this.trails.shift();
      }
      /* hype from speeding */
      if (MV.Missions && Math.abs(v.speed) > cfg.max * .66) MV.Missions.onSpeed(dt, Math.abs(v.speed) / cfg.max);
      /* test drive timer */
      if (v.test && v.testLeft != null) {
        v.testLeft -= dt;
        if (v.testLeft <= 0) {
          v.testLeft = 0;
          this.exitVehicle(true);
          this.emit('testdrive:end', { id: v.id });
        }
      }
      this.hornT = Math.max(0, this.hornT - dt);
    },

    updateVehiclesAmbient(dt) {
      this.vehicles.forEach(v => {
        if (v.drive) return;
        if (v.route === 'ave') {
          v.routeT += dt * 34;
          const span = 2480;
          const t = (v.routeT % (span * 2));
          const fwd = t < span;
          v.x = fwd ? 200 + t : 2680 - (t - span);
          v.angle = fwd ? 0 : Math.PI;
          v.dir = fwd ? 1 : -1;
          v.speed = 90;
          v.y = 1250 + (fwd ? 26 : -26);
        }
        v.bob = (v.bob || 0) + dt;
      });
    },

    tryMove(e, dx, dy, r) {
      const p = this.plan;
      if (!p) return true;
      const nx = e.x + dx, ny = e.y + dy;
      if (!MV.World.blocked(p, nx, ny, r)) { e.x = nx; e.y = ny; return true; }
      if (Math.abs(dx) > .01 && !MV.World.blocked(p, e.x + dx, e.y, r)) { e.x += dx; return true; }
      if (Math.abs(dy) > .01 && !MV.World.blocked(p, e.x, e.y + dy, r)) { e.y += dy; return true; }
      return false;
    },

    onPaved(x, y) {
      const p = this.plan;
      if (!p) return false;
      if (Math.hypot(x - p.plaza.x, y - p.plaza.y) < p.plaza.rOut + 10) return true;
      for (const r of p.roads) {
        if (r.y1 === r.y2) { if (Math.abs(y - r.y1) < r.w / 2 + 6 && x > Math.min(r.x1, r.x2) && x < Math.max(r.x1, r.x2)) return true; }
        else { if (Math.abs(x - r.x1) < r.w / 2 + 6 && y > Math.min(r.y1, r.y2) && y < Math.max(r.y1, r.y2)) return true; }
      }
      return false;
    },

    updatePets(dt) {
      const a = this.avatar;
      const focus = this.vehicle || a;
      this.pets.forEach((p, i) => {
        const side = i === 0 ? -1 : i === 1 ? 1 : 0;
        const offX = side * (36 + i * 8), offY = 30 + i * 10;
        let tx = focus.x + offX, ty = focus.y + offY;
        if (this.vehicle) { tx = focus.x + offX * .8; ty = focus.y + offY + 10; }
        const dx = tx - p.x, dy = ty - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 46) {
          const sp = Math.min(320, 120 + d * 1.4) * dt;
          this.tryMove(p, dx / d * sp, dy / d * sp, 8);
          p.dir = dx > 0 ? 1 : -1;
          p.bob += dt * 12;
        } else {
          p.bob += dt * 3;
          p.x += Math.sin(this.t * 1.6 + i) * 6 * dt;
          p.y += Math.cos(this.t * 1.3 + i) * 4 * dt;
        }
        if (p.hop > 0) p.hop = Math.max(0, p.hop - dt * 2.4);
      });
    },

    updateNpcs(dt) {
      const fest = MV.Missions && MV.Missions.festivalOn && MV.Missions.festivalOn();
      this.npcs.forEach(n => {
        if (n.jump > 0) n.jump = Math.max(0, n.jump - dt * 2.2);
        if (fest) {
          n.bob += dt * 8;
          n.cheer = true;
          if (Math.random() < dt * .8) n.jump = 1;
          return;
        }
        n.cheer = false;
        if (n.wait > 0) { n.wait -= dt; n.bob += dt * 1.6; return; }
        const dx = n.tx - n.x, dy = n.ty - n.y;
        const d = Math.hypot(dx, dy);
        if (d < 8) {
          n.wait = rand(.8, 3.4);
          const h = n.home;
          n.tx = clamp(h.x + rand(-170, 170), 120, W() - 120);
          n.ty = clamp(h.y + rand(-130, 130), 120, H() - 200);
          if (MV.World.blocked(this.plan, n.tx, n.ty, 12)) { n.tx = n.x; n.ty = n.y; }
          return;
        }
        const sp = n.speed * dt;
        this.tryMove(n, dx / d * sp, dy / d * sp, 10);
        n.dir = dx > 0 ? 1 : -1;
        n.bob += dt * 7;
      });
    },

    updateSparks(dt) {
      this.sparks.forEach(s => {
        s.ph += dt * 2.2;
        const focus = this.vehicle || this.avatar;
        if (Math.hypot(focus.x - s.x, focus.y - s.y) < 42) {
          s.dead = true;
          if (this.callbacks.onSparkleAuto) this.callbacks.onSparkleAuto(s);
        }
      });
      this.sparks = this.sparks.filter(s => !s.dead);
      if (!this._sparkTimer) this._sparkTimer = rand(8, 14);
      this._sparkTimer -= dt;
      if (this._sparkTimer <= 0 && this.sparks.length < 8) {
        this._sparkTimer = rand(11, 19);
        const sp = this.plan.sparkSpots[Math.floor(Math.random() * this.plan.sparkSpots.length)];
        this.sparks.push({ x: sp.x + rand(-30, 30), y: sp.y + rand(-20, 20), ph: rand(0, TAU), id: 'sx' + Date.now() });
      }
    },

    updateTrails(dt) {
      this.trails.forEach(t => { t.a -= dt * .35; });
      this.trails = this.trails.filter(t => t.a > 0);
    },

    updateParts(dt) {
      const p = this.phase;
      if (p === 'rain') {
        this.parts.forEach(q => {
          q.y += q.v * dt; q.x -= q.v * .2 * dt;
          if (q.y > this.H + 20) { q.y = -20; q.x = rand(-.2, 1.2) * this.W; }
        });
      } else if (p === 'snow') {
        this.parts.forEach(q => {
          q.ph += dt * 1.5; q.y += q.v * dt; q.x += Math.sin(q.ph) * 22 * dt;
          if (q.y > this.H + 8) { q.y = -8; q.x = rand(0, this.W); }
        });
      } else {
        this.parts.forEach(q => { q.ph += dt * (q.v || .4); q.y -= 9 * dt; if (q.y < -10) { q.y = this.H + 10; q.x = rand(0, this.W); } });
      }
      this.pops.forEach(p2 => { p2.life -= dt; p2.y -= 26 * dt; });
      this.pops = this.pops.filter(p2 => p2.life > 0);
    },

    updateCamera(dt) {
      const focus = this.vehicle || this.avatar;
      const base = this.baseZoom();
      let zoom = this.vehicle ? base * .9 : base;
      if (this.vehicle && Math.abs(this.vehicle.speed) > 120) zoom *= 1 - Math.min(.1, Math.abs(this.vehicle.speed) / 6000);
      this.cam.tzoom = zoom;
      let lookX = 0, lookY = 0;
      if (this.vehicle) {
        const sp = Math.abs(this.vehicle.speed);
        lookX = Math.cos(this.vehicle.angle) * Math.min(110, sp * .18);
        lookY = Math.sin(this.vehicle.angle) * Math.min(80, sp * .14);
      } else if (this.avatar.moving) {
        lookX = Math.cos(this.avatar.heading) * 26;
        lookY = Math.sin(this.avatar.heading) * 20;
      }
      const tx = focus.x + lookX, ty = focus.y + lookY - 20;
      const k = clamp(dt * 4.4, 0, 1);
      this.cam.x = lerp(this.cam.x, tx, k);
      this.cam.y = lerp(this.cam.y, ty, k);
      this.cam.zoom = lerp(this.cam.zoom, this.cam.tzoom, clamp(dt * 2.6, 0, 1));
      const vw = this.W / this.cam.zoom, vh = this.H / this.cam.zoom;
      if (vw < W()) this.cam.x = clamp(this.cam.x, vw / 2, W() - vw / 2);
      else this.cam.x = W() / 2;
      if (vh < H()) this.cam.y = clamp(this.cam.y, vh / 2, H() - vh / 2);
      else this.cam.y = H() / 2;
    },

    updateDistrict() {
      const d = MV.World.districtAt(this.plan, this.avatar.x, this.avatar.y);
      if (!d) return;
      if (d.id !== this.lastDistrict) {
        const first = this.lastDistrict === null;
        this.lastDistrict = d.id;
        this.emit('district', { id: d.id, key: d.key, first });
      }
    },

    shake(n) { this._shake = Math.min(1, this._shake + n); },

    /* ============================ world ↔ screen ============================ */
    worldToScreen(x, y) {
      const z = this.cam.zoom;
      return { x: (x - this.cam.x) * z + this.W / 2, y: (y - this.cam.y) * z + this.H / 2 };
    },
    screenToWorld(sx, sy) {
      const z = this.cam.zoom;
      return { x: (sx - this.W / 2) / z + this.cam.x, y: (sy - this.H / 2) / z + this.cam.y };
    },
    screenOf(nx, ny) { return this.worldToScreen(nx * W(), ny * H()); },
    groundPoint(nx, ny) { return this.worldToScreen(nx * W(), ny * H()); },
    walkTo(nx, ny) {
      if (this.vehicle) return;
      this.avatar.tx = clamp(nx, 0, 1) * W();
      this.avatar.ty = clamp(ny, 0, 1) * H();
    },
    walkToWorld(x, y) {
      if (this.vehicle) return;
      this.avatar.tx = clamp(x, 60, W() - 60);
      this.avatar.ty = clamp(y, 60, H() - 200);
    },

    /* ============================ interaction ============================ */
    nearestVehicle(radius) {
      if (this.vehicle) return this.vehicle;
      const r = radius || 108;
      let best = null, bd = r;
      this.vehicles.forEach(v => {
        const d = Math.hypot(v.x - this.avatar.x, v.y - this.avatar.y);
        if (d < bd) { bd = d; best = v; }
      });
      return best;
    },

    enterVehicle(v) {
      if (!v || this.vehicle) return false;
      this.vehicle = v;
      v.drive = true;
      if (v.test && !v.owned) { v.testLeft = 30; }
      this.avatar.tx = this.avatar.x; this.avatar.ty = this.avatar.y;
      this.cam.tzoom = this.baseZoom() * .9;
      this.beep('start');
      this.emit('vehicle', { id: v.id, on: true, owned: !!v.owned, test: !!v.test && !v.owned, testLeft: v.testLeft || 0 });
      return true;
    },

    exitVehicle(force) {
      const v = this.vehicle;
      if (!v) return false;
      v.drive = false;
      v.speed = 0;
      if (v.route) { v.routeT = v.routeT || 0; }
      let ax = v.x + 34, ay = v.y + 34;
      if (MV.World.blocked(this.plan, ax, ay, 12)) { ax = v.x - 38; ay = v.y + 26; }
      if (MV.World.blocked(this.plan, ax, ay, 12)) { ax = v.x; ay = v.y + 44; }
      this.avatar.x = ax; this.avatar.y = ay;
      this.avatar.tx = ax; this.avatar.ty = ay;
      this.avatar.hidden = false;
      this.vehicle = null;
      this.cam.tzoom = this.baseZoom();
      this.emit('vehicle', { id: v.id, on: false, test: !!force });
      return true;
    },

    toggleVehicle() {
      if (this.vehicle) return this.exitVehicle(false);
      const v = this.nearestVehicle(110);
      if (v) return this.enterVehicle(v);
      return false;
    },

    horn() {
      const v = this.vehicle;
      if (!v) return;
      const cfg = C().vehicle(v.id) || {};
      this.beep(cfg.horn || 'beep');
      this.pops.push({ x: v.x, y: v.y - 46, text: '📣', life: 1.1, vy: -20 });
      this.npcs.forEach(n => { if (Math.hypot(n.x - v.x, n.y - v.y) < 320) n.jump = 1; });
    },

    beep(kind) {
      if (this.muted) return;
      try {
        if (!this._ac) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this._ac = new AC();
        }
        const ac = this._ac;
        if (ac.state === 'suspended') ac.resume();
        const now = ac.currentTime;
        const play = (freq, dur, type, gain, when) => {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = type || 'square';
          o.frequency.setValueAtTime(freq, now + when);
          g.gain.setValueAtTime(0, now + when);
          g.gain.linearRampToValueAtTime(gain || .04, now + when + .01);
          g.gain.exponentialRampToValueAtTime(.0001, now + when + dur);
          o.connect(g); g.connect(ac.destination);
          o.start(now + when); o.stop(now + when + dur + .02);
        };
        if (kind === 'horn') { play(392, .16, 'square', .05, 0); play(392, .16, 'square', .05, .18); }
        else if (kind === 'sport') { play(320, .22, 'sawtooth', .05, 0); play(300, .22, 'sawtooth', .05, .24); }
        else if (kind === 'ring') { play(880, .1, 'sine', .05, 0); play(1180, .12, 'sine', .04, .12); }
        else if (kind === 'ding') { play(1046, .5, 'sine', .05, 0); play(1568, .5, 'sine', .03, .06); }
        else if (kind === 'bells') { play(1568, .3, 'triangle', .04, 0); play(2093, .3, 'triangle', .03, .1); }
        else if (kind === 'start') { play(220, .12, 'triangle', .04, 0); play(330, .16, 'triangle', .03, .1); }
        else if (kind === 'bump') { play(90, .12, 'sawtooth', .05, 0); }
      } catch (e) {}
    },

    setMode(mode, itemId) {
      this.mode = mode || 'idle';
      this.pendingItem = itemId || null;
      this.canvas.style.cursor = mode === 'place' ? 'crosshair' : 'default';
    },

    maxPlacements() { return MV.Store.maxPlacements(); },

    refreshPlacements() {
      if (!this.village) return;
      this.placements = (MV.Store.state.deco[this.village.id] || []).slice();
    },

    /* ============================ input ============================ */
    bindKeys() {
      window.addEventListener('keydown', (e) => {
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const k = String(e.key || '').toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
        this.keys[k] = true;
        if (k === 'f') this.toggleVehicle();
        else if (k === 'h') this.horn();
        else if (k === 'm') this.emit('mapToggle', {});
        else if (k === 'escape') this.emit('escape', {});
        if (k === 'e' && !this.vehicle) {
          const v = this.nearestVehicle(110);
          if (v) this.emit('vehicleHint', { id: v.id });
        }
      });
      window.addEventListener('keyup', (e) => {
        const k = String(e.key || '').toLowerCase();
        this.keys[k] = false;
      });
      window.addEventListener('blur', () => { this.keys = {}; this.joy = { x: 0, y: 0, active: false }; });
    },

    bindPointer() {
      const c = this.canvas;
      let down = null, moved = false, downAt = 0;
      const pos = (e) => {
        const r = c.getBoundingClientRect();
        const pt = (e.touches && e.touches[0]) || e;
        return { x: pt.clientX - r.left, y: pt.clientY - r.top };
      };
      const hit = (p) => {
        for (let i = this.hot.length - 1; i >= 0; i--) {
          const h = this.hot[i];
          if (Math.hypot(p.x - h.sx, p.y - h.sy) <= h.r) return h;
        }
        return null;
      };
      const toNorm = (p) => {
        const w = this.screenToWorld(p.x, p.y);
        return { nx: clamp(w.x / W(), .01, .99), ny: clamp(w.y / H(), .01, .99), x: w.x, y: w.y };
      };

      c.addEventListener('pointerdown', (e) => {
        try { c.setPointerCapture && c.setPointerCapture(e.pointerId); } catch (err) {}
        const p = pos(e);
        down = p; moved = false; downAt = performance.now();
        const h = hit(p);
        if (h && h.type === 'orn' && this.mode !== 'place') {
          const placed = this.placements.find(x => x.uid === h.uid);
          if (placed) this._downOrn = { uid: h.uid };
        }
      }, { passive: true });

      c.addEventListener('pointermove', (e) => {
        if (!down) return;
        const p = pos(e);
        if (Math.hypot(p.x - down.x, p.y - down.y) > 7) moved = true;
        if (this._downOrn && moved && this.mode !== 'place') {
          this.dragging = true;
          this.dragUid = this._downOrn.uid;
          const n = toNorm(p);
          MV.Store.move(this._downOrn.uid, n.nx, n.ny);
          this.refreshPlacements();
        }
      }, { passive: true });

      c.addEventListener('pointerup', (e) => {
        const p = pos(e);
        const h = hit(p);
        if (this._downOrn && this.dragging) {
          this.dragging = false; this.dragUid = null; this._downOrn = null;
          if (this.callbacks.onMoved) this.callbacks.onMoved();
          down = null;
          return;
        }
        this._downOrn = null;
        down = null;
        if (h) {
          if (h.type === 'spark' && this.callbacks.onSparkle) this.callbacks.onSparkle(h);
          else if (h.type === 'pet' && this.callbacks.onPet) this.callbacks.onPet(h.id, h);
          else if (h.type === 'npc' && this.callbacks.onNpc) this.callbacks.onNpc(h.id, h);
          else if (h.type === 'ride' && this.callbacks.onRide) this.callbacks.onRide(h.id, h);
          else if (h.type === 'orn' && this.callbacks.onOrnament) this.callbacks.onOrnament(h.uid, h);
          else if (h.type === 'building' && this.callbacks.onBuilding) this.callbacks.onBuilding(h);
          else if (h.type === 'vehicle' && this.callbacks.onVehicleTap) this.callbacks.onVehicleTap(h.id);
          return;
        }
        if (this.vehicle) return;
        const n = toNorm(p);
        if (this.callbacks.onGround) this.callbacks.onGround(n.nx, n.ny, n.x, n.y);
      });

      c.addEventListener('pointercancel', () => { down = null; this._downOrn = null; this.dragging = false; this.dragUid = null; });
    },

    /* ============================ rendering ============================ */
    render() {
      const ctx = this.ctx;
      if (!ctx || !this.plan) return;
      const pal = this.plan.pal;
      const info = this.phaseInfo();
      const Ws = this.W, Hs = this.H;
      this.hot.length = 0;
      this._lights = [];
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, Ws, Hs);
      ctx.fillStyle = pal.ground2;
      ctx.fillRect(0, 0, Ws, Hs);

      const z = this.cam.zoom;
      const vw = Ws / z, vh = Hs / z;
      const vx = this.cam.x - vw / 2, vy = this.cam.y - vh / 2;
      this.view = { x: vx, y: vy, w: vw, h: vh };

      ctx.save();
      const sh = this._shake;
      if (sh > 0) ctx.translate(rand(-1, 1) * sh * 7, rand(-1, 1) * sh * 7);
      ctx.translate(Ws / 2, Hs / 2);
      ctx.scale(z, z);
      ctx.translate(-this.cam.x, -this.cam.y);

      /* ground */
      if (this.groundCanvas) {
        const s = this.groundScale;
        ctx.drawImage(this.groundCanvas,
          Math.max(0, vx * s), Math.max(0, vy * s),
          Math.min(this.groundCanvas.width, vw * s), Math.min(this.groundCanvas.height, vh * s),
          vx, vy, vw, vh);
      }
      this.drawWater(ctx, info);

      /* trails on the ground */
      this.trails.forEach(t => {
        if (!this.inView(t.x, t.y, 40)) return;
        ctx.globalAlpha = t.a * .5;
        ctx.fillStyle = this.isSnow() ? 'rgba(120,140,180,.5)' : 'rgba(28,24,44,.55)';
        ctx.beginPath(); ctx.ellipse(t.x, t.y, t.w, t.w * .42, 0, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;

      /* draw list */
      const list = [];
      const inView = (x, y, m) => this.inView(x, y, m);

      this.plan.buildings.forEach(b => {
        if (!inView(b.x, b.y, 300)) return;
        list.push({ y: b.y + .01, draw: () => this.drawBuilding(ctx, b, info) });
      });
      this.plan.props.forEach(p => {
        if (!inView(p.x, p.y, 160)) return;
        list.push({ y: p.y, draw: () => this.drawProp(ctx, p, info) });
      });
      /* fountain centrepiece */
      if (inView(this.plan.plaza.x, this.plan.plaza.y, 300)) {
        list.push({ y: this.plan.plaza.y + 20, draw: () => this.drawFountain(ctx, this.plan.plaza.x, this.plan.plaza.y, info) });
      }
      this.vehicles.forEach(v => {
        if (!inView(v.x, v.y, 200)) return;
        if (v === this.vehicle) return;
        list.push({ y: v.y, draw: () => this.drawVehicle(ctx, v, info, false) });
      });
      this.npcs.forEach(n => {
        if (!inView(n.x, n.y, 120)) return;
        list.push({ y: n.y, draw: () => this.drawNpc(ctx, n, info) });
      });
      this.pets.forEach(p => {
        if (!inView(p.x, p.y, 120)) return;
        list.push({ y: p.y, draw: () => this.drawPet(ctx, p, info) });
      });
      this.placements.forEach(p => {
        const wx = p.nx * W(), wy = p.ny * H();
        if (!inView(wx, wy, 140)) return;
        list.push({ y: wy, draw: () => this.drawOrnament(ctx, p, wx, wy, info) });
      });
      this.sparks.forEach(s => {
        if (!inView(s.x, s.y, 90)) return;
        list.push({ y: s.y + 6, draw: () => this.drawSpark(ctx, s) });
      });
      if (MV.Missions) MV.Missions.collect(list, this);
      if (this.vehicle) {
        list.push({ y: this.vehicle.y + .5, draw: () => this.drawVehicle(ctx, this.vehicle, info, true) });
      } else {
        list.push({ y: this.avatar.y, draw: () => this.drawAvatar(ctx, info) });
      }

      list.sort((a, b) => a.y - b.y);
      list.forEach(o => { try { o.draw(); } catch (e) { console.warn('draw', e); } });

      /* mission beacons + objective arrow */
      if (MV.Missions) MV.Missions.drawOverlay(ctx, this, info);

      /* lights at night */
      this.drawStreetLights(ctx, info);
      ctx.restore();

      /* screen-space weather + grade */
      this.drawWeather(ctx, info);
      this.drawGrade(ctx, pal, info);
      if (MV.Missions) MV.Missions.drawScreen(ctx, this);

      /* minimap */
      this.emit('frameEnd', {});
    },

    /* viewport cull test — uses this.view set at the top of each render */
    inView(x, y, m) {
      const v = this.view;
      if (!v) return true;
      const mx = m || 120, my = m || 160;
      return x > v.x - mx && x < v.x + v.w + mx && y > v.y - my && y < v.y + v.h + my;
    },

    drawWater(ctx, info) {
      const pal = this.plan.pal;
      const P = this.plan.plaza;
      /* pond ripples */
      const pd = this.plan.pond;
      if (this.inView(pd.x, pd.y, 300)) {
        ctx.save();
        ctx.globalAlpha = .35;
        ctx.strokeStyle = pal.waterFoam; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const rr = ((this.t * 18 + i * 40) % 120);
          ctx.beginPath();
          ctx.ellipse(pd.x, pd.y, pd.rx * (.35 + rr / 240), pd.ry * (.32 + rr / 260), 0, 0, TAU);
          ctx.globalAlpha = .3 * (1 - rr / 130);
          ctx.stroke();
        }
        ctx.restore();
      }
      /* sea waves */
      const wy = MV.World.WATER_Y;
      if (this.view.y + this.view.h > wy - 60) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.28)';
        ctx.lineWidth = 3;
        const startY = Math.max(wy + 16, this.view.y);
        for (let y = Math.floor(startY / 46) * 46; y < this.view.y + this.view.h; y += 46) {
          if (y < wy) continue;
          const phase = (y * .13 + this.t * .9);
          ctx.globalAlpha = .16 + .12 * Math.sin(phase);
          ctx.beginPath();
          for (let x = this.view.x - 40; x < this.view.x + this.view.w + 40; x += 40) {
            const yy = y + Math.sin(x * .012 + phase) * 6;
            if (x === this.view.x - 40) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    },

    /* ------------------------- buildings ------------------------- */
    drawBuilding(ctx, b, info) {
      const pal = this.plan.pal;
      const x = b.x, y = b.y, w = b.w, h = b.h;
      const style = b.style;
      ctx.save();
      /* shadow */
      ctx.globalAlpha = .22; ctx.fillStyle = pal.shade;
      ctx.beginPath(); ctx.ellipse(x, y + 6, w * .54, 15, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;

      const wallH = h * .66;
      const wallTop = y - wallH;
      const roofH = h * .34;

      if (style === 'showroom') {
        /* glass showroom */
        ctx.fillStyle = pal.wallDark;
        roundRect(ctx, x - w / 2 - 6, wallTop - 12, w + 12, wallH + 12, 10); ctx.fill();
        /* glass front */
        const gg = ctx.createLinearGradient(x - w / 2, wallTop, x + w / 2, y);
        gg.addColorStop(0, pal.glass); gg.addColorStop(.55, '#f7fbff'); gg.addColorStop(1, pal.glass);
        ctx.fillStyle = gg;
        roundRect(ctx, x - w / 2 + 6, wallTop + 8, w - 12, wallH - 16, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(40,32,58,.45)'; ctx.lineWidth = 3;
        for (let i = 1; i < 4; i++) {
          const gx = x - w / 2 + 6 + (w - 12) * (i / 4);
          ctx.beginPath(); ctx.moveTo(gx, wallTop + 8); ctx.lineTo(gx, y - 8); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(x - w / 2 + 6, wallTop + wallH * .52); ctx.lineTo(x + w / 2 - 6, wallTop + wallH * .52); ctx.stroke();
        /* neon sign */
        ctx.fillStyle = pal.signBg;
        roundRect(ctx, x - w * .42, wallTop - 44, w * .84, 36, 8); ctx.fill();
        ctx.fillStyle = '#ffd98a';
        ctx.font = '800 ' + Math.round(Math.min(24, w * .085)) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('MOA VIP', x, wallTop - 26);
        this.glow(ctx, x, wallTop - 24, w * .46, '#ffd98a', .5);
        if (this._lights) this._lights.push({ x, y: wallTop - 20, r: w * .5, color: '#ffe0a8', a: .6 });
        /* turntable glow */
        ctx.globalAlpha = info.dark > .1 ? .5 : .28;
        const tg = ctx.createRadialGradient(x, y - 10, 4, x, y - 10, w * .42);
        tg.addColorStop(0, 'rgba(255,224,160,.9)'); tg.addColorStop(1, 'rgba(255,224,160,0)');
        ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(x, y - 8, w * .42, 22, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        /* door */
        ctx.fillStyle = 'rgba(40,32,58,.55)';
        roundRect(ctx, x - 26, y - 54, 52, 54, 4); ctx.fill();
        this.hotBuilding(b, x, y, w, h);
        ctx.restore();
        return;
      }

      if (style === 'hall') {
        /* town hall with columns + clock */
        ctx.fillStyle = pal.wall;
        roundRect(ctx, x - w / 2, wallTop, w, wallH, 6); ctx.fill();
        ctx.fillStyle = pal.wall2;
        ctx.fillRect(x - w / 2, wallTop, w, 10);
        /* pediment */
        ctx.fillStyle = pal.roof;
        ctx.beginPath(); ctx.moveTo(x - w / 2 - 14, wallTop); ctx.lineTo(x, wallTop - roofH); ctx.lineTo(x + w / 2 + 14, wallTop); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        ctx.beginPath(); ctx.moveTo(x - w / 2 - 8, wallTop); ctx.lineTo(x, wallTop - roofH + 6); ctx.lineTo(x, wallTop); ctx.closePath(); ctx.fill();
        /* columns */
        for (let i = 0; i < 5; i++) {
          const cx = x - w * .36 + i * (w * .18);
          ctx.fillStyle = '#fffaf0';
          ctx.fillRect(cx - 5, wallTop + 14, 10, wallH - 34);
          ctx.fillStyle = 'rgba(120,100,80,.22)';
          ctx.fillRect(cx + 2, wallTop + 14, 2, wallH - 34);
        }
        /* big door */
        ctx.fillStyle = pal.wallDark;
        roundRect(ctx, x - 34, y - 86, 68, 86, 6); ctx.fill();
        ctx.fillStyle = pal.sign;
        ctx.globalAlpha = info.dark > .2 ? .9 : .5;
        ctx.fillRect(x - 26, y - 78, 52, 30);
        ctx.globalAlpha = 1;
        /* clock */
        ctx.fillStyle = '#fffaf0';
        ctx.beginPath(); ctx.arc(x, wallTop - roofH * .45, 15, 0, TAU); ctx.fill();
        ctx.strokeStyle = pal.wallDark; ctx.lineWidth = 2.4; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, wallTop - roofH * .45); ctx.lineTo(x, wallTop - roofH * .45 - 9); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, wallTop - roofH * .45); ctx.lineTo(x + 6, wallTop - roofH * .45 + 3); ctx.stroke();
        /* flags */
        ctx.fillStyle = pal.accent2;
        ctx.beginPath(); ctx.moveTo(x - w / 2 + 6, wallTop); ctx.lineTo(x - w / 2 + 6, wallTop - 50); ctx.lineTo(x - w / 2 + 44, wallTop - 40); ctx.lineTo(x - w / 2 + 6, wallTop - 30); ctx.closePath(); ctx.fill();
        this.hotBuilding(b, x, y, w, h);
        ctx.restore();
        return;
      }

      if (style === 'gazebo') {
        ctx.fillStyle = '#efe6d2';
        roundRect(ctx, x - h * .42, y - 16, h * .84, 16, 5); ctx.fill();
        ctx.fillStyle = '#e2d6bd';
        roundRect(ctx, x - h * .36, y - 34, h * .72, 20, 4); ctx.fill();
        for (let i = -1; i <= 1; i++) {
          ctx.fillStyle = '#cbb999';
          ctx.fillRect(x + i * h * .26 - 4, y - h * .62, 8, h * .3);
        }
        ctx.fillStyle = pal.roof;
        ctx.beginPath(); ctx.moveTo(x - h * .46, y - h * .58); ctx.lineTo(x, y - h * .96); ctx.lineTo(x + h * .46, y - h * .58); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.2)';
        ctx.beginPath(); ctx.moveTo(x - h * .4, y - h * .58); ctx.lineTo(x, y - h * .92); ctx.lineTo(x, y - h * .58); ctx.closePath(); ctx.fill();
        ctx.fillStyle = pal.accent;
        ctx.beginPath(); ctx.arc(x, y - h * .97, 4, 0, TAU); ctx.fill();
        this.hotBuilding(b, x, y, w, h);
        ctx.restore();
        return;
      }

      if (style === 'greenhouse') {
        ctx.fillStyle = 'rgba(210,240,250,.72)';
        roundRect(ctx, x - w / 2, wallTop, w, wallH, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(90,120,130,.55)'; ctx.lineWidth = 2.2;
        for (let i = 1; i < 6; i++) {
          const gx = x - w / 2 + w * (i / 6);
          ctx.beginPath(); ctx.moveTo(gx, wallTop); ctx.lineTo(gx, y); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(x - w / 2, wallTop + wallH * .5); ctx.lineTo(x + w / 2, wallTop + wallH * .5); ctx.stroke();
        ctx.fillStyle = 'rgba(180,220,235,.9)';
        ctx.beginPath(); ctx.moveTo(x - w / 2 - 8, wallTop); ctx.lineTo(x, wallTop - roofH); ctx.lineTo(x + w / 2 + 8, wallTop); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(90,140,90,.55)';
        for (let i = 0; i < 7; i++) {
          const px = x - w * .4 + i * w * .13;
          ctx.beginPath(); ctx.ellipse(px, y - 22, 12, 18, 0, 0, TAU); ctx.fill();
        }
        this.hotBuilding(b, x, y, w, h);
        ctx.restore();
        return;
      }

      if (style === 'lighthouse') {
        ctx.fillStyle = '#f6f2e8';
        ctx.beginPath();
        ctx.moveTo(x - 26, y); ctx.lineTo(x - 16, y - h * .8); ctx.lineTo(x + 16, y - h * .8); ctx.lineTo(x + 26, y);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = pal.accent2;
        for (let i = 0; i < 3; i++) {
          const yy = y - h * .18 - i * h * .2;
          ctx.fillRect(x - 22 + i * 1.4, yy, 44 - i * 2.8, 12);
        }
        ctx.fillStyle = '#3b3850';
        ctx.fillRect(x - 20, y - h * .86, 40, 8);
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.arc(x, y - h * .9, 13, 0, TAU); ctx.fill();
        this.glow(ctx, x, y - h * .9, 90, '#ffe9a8', info.dark > .2 ? .7 : .35);
        if (this._lights) this._lights.push({ x, y: y - h * .9, r: 130, color: '#ffe9a8', a: .8 });
        if (info.dark > .2) {
          const sweep = (this.t * .5) % TAU;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = .18;
          const grd = ctx.createLinearGradient(x, y - h * .9, x + Math.cos(sweep) * 380, y - h * .9 + Math.sin(sweep) * 380);
          grd.addColorStop(0, 'rgba(255,233,168,.8)'); grd.addColorStop(1, 'rgba(255,233,168,0)');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.moveTo(x, y - h * .9);
          ctx.arc(x, y - h * .9, 380, sweep - .2, sweep + .2); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        this.hotBuilding(b, x, y, w, h);
        ctx.restore();
        return;
      }

      /* generic wall + roof */
      const wallCol = style === 'warehouse' ? '#b9bfc9' : style === 'harbor' ? '#efe7d3' : pal.wall;
      const roofCol = style === 'warehouse' ? '#8f97a6' : style === 'cabin' ? pal.roof2 : pal.roof;
      ctx.fillStyle = wallCol;
      roundRect(ctx, x - w / 2, wallTop, w, wallH, 5); ctx.fill();

      if (style === 'cabin') {
        ctx.strokeStyle = 'rgba(120,90,60,.22)'; ctx.lineWidth = 2;
        for (let i = 1; i < 6; i++) {
          ctx.beginPath(); ctx.moveTo(x - w / 2 + 4, wallTop + wallH * (i / 6)); ctx.lineTo(x + w / 2 - 4, wallTop + wallH * (i / 6)); ctx.stroke();
        }
      }
      if (style === 'warehouse') {
        ctx.fillStyle = 'rgba(90,100,120,.25)';
        for (let i = 1; i < 8; i++) ctx.fillRect(x - w / 2 + w * (i / 8), wallTop, 2, wallH);
      }
      if (style === 'harbor') {
        ctx.fillStyle = pal.glass;
        ctx.fillRect(x - w / 2, wallTop, w, 12);
      }

      /* roof */
      const flat = style === 'warehouse' || style === 'shop' || style === 'kiosk' || style === 'cafe';
      if (flat) {
        ctx.fillStyle = roofCol;
        roundRect(ctx, x - w / 2 - 8, wallTop - roofH * .75, w + 16, roofH * .75 + 8, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.fillRect(x - w / 2 - 8, wallTop - roofH * .75, w + 16, 5);
      } else {
        ctx.fillStyle = roofCol;
        ctx.beginPath();
        ctx.moveTo(x - w / 2 - 12, wallTop + 4);
        ctx.lineTo(x, wallTop - roofH * 1.15);
        ctx.lineTo(x + w / 2 + 12, wallTop + 4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.beginPath();
        ctx.moveTo(x - w / 2 - 12, wallTop + 4);
        ctx.lineTo(x, wallTop - roofH * 1.15);
        ctx.lineTo(x, wallTop + 4);
        ctx.closePath(); ctx.fill();
      }
      /* snow on roof */
      if (this.isSnow()) {
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        if (flat) {
          roundRect(ctx, x - w / 2 - 8, wallTop - roofH * .78, w + 16, 9, 4); ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(x - w / 2 - 14, wallTop + 4);
          ctx.lineTo(x, wallTop - roofH * 1.18);
          ctx.lineTo(x + w / 2 + 14, wallTop + 4);
          ctx.lineTo(x + w / 2 + 2, wallTop + 10);
          ctx.lineTo(x, wallTop - roofH * 1.02);
          ctx.lineTo(x - w / 2 - 2, wallTop + 10);
          ctx.closePath(); ctx.fill();
        }
      }

      /* windows */
      const winN = style === 'warehouse' ? 2 : w > 200 ? 3 : 2;
      const wy = wallTop + wallH * .26;
      for (let i = 0; i < winN; i++) {
        const ww = w * .16, wh = wallH * .28;
        const wx = x - w * .3 + i * (w * .3);
        this.buildingWindow(ctx, wx, wy, ww, wh, info);
      }
      /* door */
      const dw = Math.min(56, w * .22), dh = wallH * .52;
      ctx.fillStyle = pal.wallDark;
      roundRect(ctx, x - dw / 2, y - dh, dw, dh, 4); ctx.fill();
      ctx.fillStyle = pal.sign;
      ctx.globalAlpha = info.dark > .2 ? .9 : .35;
      ctx.fillRect(x - dw * .32, y - dh + 8, dw * .64, dh * .22);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f2b54b';
      ctx.beginPath(); ctx.arc(x + dw * .28, y - dh * .45, 2.2, 0, TAU); ctx.fill();

      /* awning for shops */
      if (style === 'shop' || style === 'cafe' || style === 'kiosk') {
        const aw = w * .9, ah = 16;
        const stripes = style === 'cafe' ? 2 : 4;
        for (let i = 0; i < stripes; i++) {
          ctx.fillStyle = i % 2 ? '#fff6e6' : (style === 'cafe' ? '#8cc8b4' : pal.accent2);
          ctx.beginPath();
          ctx.moveTo(x - aw / 2 + (aw / stripes) * i, y - wallH * .52);
          ctx.lineTo(x - aw / 2 + (aw / stripes) * (i + 1), y - wallH * .52);
          ctx.lineTo(x - aw / 2 + (aw / stripes) * (i + 1) - 4, y - wallH * .52 + ah);
          ctx.lineTo(x - aw / 2 + (aw / stripes) * i + 4, y - wallH * .52 + ah);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(40,32,58,.18)';
        ctx.fillRect(x - aw / 2, y - wallH * .52 + ah - 3, aw, 3);
      }
      /* sign plate */
      if (b.sign) {
        const sw = Math.min(w * .8, 140), shh = 22;
        ctx.fillStyle = pal.signBg;
        roundRect(ctx, x - sw / 2, y - wallH * .92, sw, shh, 5); ctx.fill();
        ctx.fillStyle = pal.sign;
        ctx.font = '800 ' + Math.round(clamp(w * .075, 9, 14)) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.sign, x, y - wallH * .92 + shh / 2 + .5);
        if (info.dark > .2) this.glow(ctx, x, y - wallH * .9, sw * .7, pal.sign, .35);
        if (info.dark > .2 && this._lights) this._lights.push({ x, y: y - wallH * .9, r: sw * .5, color: '#ffe0a8', a: .5 });
      }
      /* chimney smoke for cabins */
      if (style === 'cabin') {
        ctx.fillStyle = '#8b6a4a';
        ctx.fillRect(x + w * .3, wallTop - roofH * 1.5, 18, roofH * .8);
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        for (let i = 0; i < 3; i++) {
          const tt = (this.t * .4 + i * .33) % 1;
          ctx.globalAlpha = .3 * (1 - tt);
          ctx.beginPath();
          ctx.arc(x + w * .3 + 9 + Math.sin(tt * 5 + i) * 8, wallTop - roofH * 1.6 - tt * 44, 6 + tt * 10, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      this.hotBuilding(b, x, y, w, h);
      ctx.restore();
    },

    buildingWindow(ctx, x, y, w, h, info) {
      const pal = this.plan.pal;
      const lit = info.dark > .15;
      if (lit) {
        this.glow(ctx, x, y, w * 1.5, pal.neon, .3);
        if (this._lights) this._lights.push({ x, y, r: w * 1.4, color: '#ffd98a', a: .5 });
      }
      ctx.fillStyle = lit ? '#ffd98a' : pal.glass;
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(80,64,48,.55)'; ctx.lineWidth = 1.6;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x, y + h / 2); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.stroke();
      /* window box */
      ctx.fillStyle = 'rgba(120,90,60,.5)';
      ctx.fillRect(x - w / 2 - 2, y + h / 2 - 1, w + 4, 3);
    },

    hotBuilding(b, x, y, w, h) {
      if (!b.interact) return;
      const s = this.worldToScreen(x, y - h * .5);
      this.hot.push({ type: 'building', interact: b.interact, x, y, sx: s.x, sy: s.y, r: Math.max(30, w * .5 * this.cam.zoom * .7) });
    },

    /* ------------------------- fountain ------------------------- */
    drawFountain(ctx, x, y, info) {
      const pal = this.plan.pal;
      ctx.save();
      ctx.globalAlpha = .25; ctx.fillStyle = pal.shade;
      ctx.beginPath(); ctx.ellipse(x, y + 8, 96, 24, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.plazaEdge;
      ctx.beginPath(); ctx.ellipse(x, y, 88, 34, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.plazaLine;
      ctx.beginPath(); ctx.ellipse(x, y - 4, 78, 29, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.water;
      ctx.beginPath(); ctx.ellipse(x, y - 6, 66, 23, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.waterDeep;
      ctx.beginPath(); ctx.ellipse(x, y - 6, 52, 17, 0, 0, TAU); ctx.fill();
      /* statue + jets */
      ctx.fillStyle = '#efe6d2';
      ctx.beginPath(); ctx.ellipse(x, y - 22, 16, 8, 0, 0, TAU); ctx.fill();
      ctx.fillRect(x - 5, y - 48, 10, 28);
      ctx.beginPath(); ctx.arc(x, y - 52, 9, 0, TAU); ctx.fill();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + this.t * .5;
        const h = 22 + Math.sin(this.t * 3 + i) * 10;
        ctx.strokeStyle = 'rgba(226,246,255,.75)';
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 14, y - 40);
        ctx.quadraticCurveTo(x + Math.cos(a) * 34, y - 46 - h, x + Math.cos(a) * 44, y - 8);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(226,246,255,.5)';
      ctx.beginPath(); ctx.ellipse(x, y - 6, 40 + Math.sin(this.t * 2) * 3, 13, 0, 0, TAU); ctx.fill();
      this.glow(ctx, x, y - 40, 60, '#cfeaff', .25);
      this.hot.push({ type: 'building', interact: 'shop', x, y, sx: this.worldToScreen(x, y - 20).x, sy: this.worldToScreen(x, y - 20).y, r: 46 });
      ctx.restore();
    },

    /* ------------------------- props ------------------------- */
    drawProp(ctx, p, info) {
      const pal = this.plan.pal;
      const s = p.s || 1;
      const x = p.x, y = p.y;
      switch (p.kind) {
        case 'lamp': {
          ctx.fillStyle = 'rgba(40,32,58,.16)';
          ctx.beginPath(); ctx.ellipse(x, y + 2, 9, 3.4, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#4e4a63'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 62); ctx.stroke();
          ctx.fillStyle = '#3b3850';
          roundRect(ctx, x - 12, y - 74, 24, 16, 5); ctx.fill();
          ctx.fillStyle = info.dark > .15 ? '#ffe9a8' : '#fff6dd';
          ctx.beginPath(); ctx.ellipse(x, y - 64, 8, 5, 0, 0, TAU); ctx.fill();
          if (info.dark > .15) {
            this.glow(ctx, x, y - 64, 86, '#ffe0a8', .55);
            if (this._lights) this._lights.push({ x, y: y - 64, r: 110, color: '#ffe0a8', a: .7 });
          }
          break;
        }
        case 'tree': {
          const h = 90 * s;
          ctx.fillStyle = 'rgba(40,32,58,.18)';
          ctx.beginPath(); ctx.ellipse(x, y + 2, h * .22, h * .07, 0, 0, TAU); ctx.fill();
          const theme = this.plan.theme;
          if (theme === 'mochi') {
            ctx.strokeStyle = '#a9835c'; ctx.lineWidth = Math.max(4, h * .06); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - h * .06, y - h * .5, x + h * .04, y - h * .78); ctx.stroke();
            ctx.fillStyle = pal.leaf;
            for (let i = 0; i < 6; i++) {
              const ang = -Math.PI * .95 + i * .32;
              ctx.save(); ctx.translate(x + h * .04, y - h * .78); ctx.rotate(ang);
              ctx.beginPath(); ctx.ellipse(h * .16, 0, h * .18, h * .05, 0, 0, TAU); ctx.fill();
              ctx.restore();
            }
          } else if (theme === 'sunpetal') {
            ctx.fillStyle = '#8b6a4a'; ctx.fillRect(x - h * .03, y - h * .42, h * .06, h * .42);
            [[0, -.62, .30], [-.20, -.52, .20], [.21, -.53, .21], [-.10, -.76, .20], [.12, -.75, .19]].forEach(([dx, dy, r]) => {
              ctx.beginPath(); ctx.arc(x + dx * h, y + dy * h, r * h, 0, TAU);
              ctx.fillStyle = '#ffc6d6'; ctx.fill();
              ctx.beginPath(); ctx.arc(x + dx * h - r * h * .2, y + dy * h - r * h * .2, r * h * .5, 0, TAU);
              ctx.fillStyle = '#ffe3ec'; ctx.fill();
            });
          } else if (theme === 'lumen') {
            ctx.fillStyle = '#4b3f5e'; ctx.fillRect(x - h * .035, y - h * .5, h * .07, h * .5);
            ctx.fillStyle = pal.leaf;
            ctx.beginPath(); ctx.arc(x, y - h * .72, h * .26, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.arc(x - h * .15, y - h * .62, h * .16, 0, TAU); ctx.fill();
            ctx.fillStyle = pal.leaf2;
            ctx.beginPath(); ctx.arc(x + h * .16, y - h * .64, h * .15, 0, TAU); ctx.fill();
            for (let i = 0; i < 4; i++) {
              const gx = x + (i - 1.5) * h * .12, gy = y - h * (.52 + (i % 2) * .12);
              this.glow(ctx, gx, gy, h * .14, '#ffcf87', .5);
              ctx.fillStyle = '#ffe6b0'; ctx.beginPath(); ctx.arc(gx, gy, 2.6, 0, TAU); ctx.fill();
            }
          } else {
            ctx.fillStyle = '#7b5232'; ctx.fillRect(x - 3, y - 20, 6, 20);
            ctx.fillStyle = pal.leaf2;
            ctx.beginPath(); ctx.moveTo(x, y - 96 * s); ctx.lineTo(x + 26 * s, y - 20); ctx.lineTo(x - 26 * s, y - 20); ctx.closePath(); ctx.fill();
            ctx.fillStyle = pal.leaf;
            ctx.beginPath(); ctx.moveTo(x, y - 80 * s); ctx.lineTo(x + 32 * s, y - 6); ctx.lineTo(x - 32 * s, y - 6); ctx.closePath(); ctx.fill();
            if (this.isSnow()) {
              ctx.fillStyle = 'rgba(255,255,255,.85)';
              ctx.beginPath(); ctx.moveTo(x, y - 96 * s); ctx.lineTo(x + 14 * s, y - 62 * s); ctx.lineTo(x - 14 * s, y - 62 * s); ctx.closePath(); ctx.fill();
            }
          }
          break;
        }
        case 'bush': {
          ctx.fillStyle = pal.leaf2;
          ctx.beginPath(); ctx.ellipse(x, y - 8 * s, 22 * s, 14 * s, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = pal.leaf;
          ctx.beginPath(); ctx.ellipse(x - 6 * s, y - 13 * s, 13 * s, 9 * s, 0, 0, TAU); ctx.fill();
          if (this.isSnow()) {
            ctx.fillStyle = 'rgba(255,255,255,.8)';
            ctx.beginPath(); ctx.ellipse(x - 4 * s, y - 18 * s, 11 * s, 5 * s, 0, 0, TAU); ctx.fill();
          }
          break;
        }
        case 'bench': {
          ctx.fillStyle = 'rgba(40,32,58,.16)';
          ctx.beginPath(); ctx.ellipse(x, y + 2, 24 * s, 6, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#a9703f';
          roundRect(ctx, x - 24 * s, y - 26 * s, 48 * s, 6 * s, 3); ctx.fill();
          ctx.fillStyle = '#bd8250';
          roundRect(ctx, x - 24 * s, y - 18 * s, 48 * s, 6 * s, 3); ctx.fill();
          ctx.fillStyle = '#5b4a3a';
          ctx.fillRect(x - 18 * s, y - 12 * s, 4, 12 * s);
          ctx.fillRect(x + 14 * s, y - 12 * s, 4, 12 * s);
          break;
        }
        case 'stall': {
          const h = 64 * s, w = 84 * s;
          ctx.fillStyle = 'rgba(40,32,58,.18)';
          ctx.beginPath(); ctx.ellipse(x, y + 2, w * .5, 8, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#a9703f';
          roundRect(ctx, x - w * .42, y - h * .36, w * .84, h * .36, 4); ctx.fill();
          ctx.fillStyle = '#8b5a30';
          ctx.fillRect(x - w * .42, y - h * .36, w * .84, 5);
          ctx.fillStyle = '#7b5232';
          ctx.fillRect(x - w * .44, y - h * .95, 4, h * .62);
          ctx.fillRect(x + w * .40, y - h * .95, 4, h * .62);
          for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i % 2 ? '#fff6e6' : pal.accent2;
            ctx.beginPath();
            ctx.moveTo(x - w * .5 + (w / 4) * i, y - h * .92);
            ctx.lineTo(x - w * .5 + (w / 4) * (i + 1), y - h * .92);
            ctx.lineTo(x - w * .5 + (w / 4) * (i + 1) - 3, y - h * .66);
            ctx.lineTo(x - w * .5 + (w / 4) * i + 3, y - h * .66);
            ctx.closePath(); ctx.fill();
          }
          ctx.fillStyle = '#f2b54b'; ctx.fillRect(x - w * .3, y - h * .46, 8, 8);
          ctx.fillStyle = '#8cc8b4'; ctx.fillRect(x - w * .12, y - h * .48, 8, 10);
          ctx.fillStyle = '#f4839e'; ctx.fillRect(x + w * .06, y - h * .46, 8, 8);
          break;
        }
        case 'planter': {
          ctx.fillStyle = '#a9703f';
          roundRect(ctx, x - 12, y - 14, 24, 14, 3); ctx.fill();
          ctx.fillStyle = pal.accent;
          ctx.beginPath(); ctx.ellipse(x, y - 20, 13, 9, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffd166';
          for (let i = 0; i < 3; i++) ctx.fillRect(x - 6 + i * 5, y - 26, 2.4, 4);
          break;
        }
        case 'mailbox': {
          ctx.fillStyle = '#5b4a3a'; ctx.fillRect(x - 1.6, y - 26, 3.2, 26);
          ctx.fillStyle = '#e2614c';
          roundRect(ctx, x - 7, y - 36, 14, 12, 3); ctx.fill();
          break;
        }
        case 'sign': {
          const label = p.label ? MV.t(p.label) : '';
          ctx.fillStyle = '#8b6a4a';
          ctx.fillRect(x - 2, y - 46, 4, 46);
          ctx.fillStyle = pal.signBg;
          roundRect(ctx, x - 52, y - 74, 104, 28, 6); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = pal.sign;
          ctx.font = '700 12px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(label.slice(0, 14), x, y - 60);
          break;
        }
        case 'crate': {
          ctx.fillStyle = 'rgba(40,32,58,.18)';
          ctx.beginPath(); ctx.ellipse(x, y + 1, 16 * s, 5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#a9703f';
          ctx.fillRect(x - 14 * s, y - 22 * s, 28 * s, 22 * s);
          ctx.strokeStyle = 'rgba(90,60,30,.5)'; ctx.lineWidth = 1.6;
          ctx.strokeRect(x - 14 * s, y - 22 * s, 28 * s, 22 * s);
          ctx.beginPath(); ctx.moveTo(x - 14 * s, y - 22 * s); ctx.lineTo(x + 14 * s, y); ctx.moveTo(x + 14 * s, y - 22 * s); ctx.lineTo(x - 14 * s, y); ctx.stroke();
          break;
        }
        case 'post': {
          ctx.fillStyle = '#7b5232';
          ctx.fillRect(x - 5, y - 60, 10, 60);
          ctx.fillStyle = '#8b6a4a';
          ctx.beginPath(); ctx.ellipse(x, y - 58, 9, 4, 0, 0, TAU); ctx.fill();
          if (this.phase === 'night') {
            ctx.fillStyle = '#ffe9a8';
            ctx.beginPath(); ctx.arc(x, y - 62, 3.4, 0, TAU); ctx.fill();
            this.glow(ctx, x, y - 62, 30, '#ffe9a8', .4);
          }
          break;
        }
        case 'boat': {
          const flip = p.flip ? -1 : 1;
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(flip, 1);
          ctx.fillStyle = 'rgba(20,30,50,.18)';
          ctx.beginPath(); ctx.ellipse(0, 6, 46 * s, 10 * s, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#e8eef6';
          ctx.beginPath();
          ctx.moveTo(-44 * s, -10 * s); ctx.quadraticCurveTo(0, 16 * s, 44 * s, -10 * s);
          ctx.quadraticCurveTo(0, -2 * s, -44 * s, -10 * s); ctx.fill();
          ctx.fillStyle = '#8cc8b4';
          ctx.fillRect(-2, -56 * s, 3, 46 * s);
          ctx.fillStyle = '#fff6e6';
          ctx.beginPath();
          ctx.moveTo(0, -54 * s); ctx.lineTo(30 * s, -18 * s); ctx.lineTo(0, -18 * s); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#f0715c';
          ctx.beginPath();
          ctx.moveTo(0, -50 * s); ctx.lineTo(-26 * s, -18 * s); ctx.lineTo(0, -18 * s); ctx.closePath(); ctx.fill();
          ctx.restore();
          /* rock gently */
          break;
        }
        case 'buoy': {
          ctx.fillStyle = '#e2614c';
          ctx.beginPath(); ctx.arc(x, y - 4, 7, 0, TAU); ctx.fill();
          ctx.fillStyle = '#fff6e6';
          ctx.beginPath(); ctx.arc(x, y - 4, 3, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.ellipse(x, y + 3, 14 + Math.sin(this.t * 2) * 2, 4, 0, 0, TAU); ctx.stroke();
          break;
        }
        case 'stage': {
          const w = 240 * s, h = 96 * s;
          ctx.fillStyle = 'rgba(20,16,40,.22)';
          ctx.beginPath(); ctx.ellipse(x, y + 4, w * .5, 14, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#3b3850';
          roundRect(ctx, x - w / 2, y - h * .5, w, h * .5, 6); ctx.fill();
          ctx.fillStyle = '#2f2a44';
          roundRect(ctx, x - w / 2 + 8, y - h * .5 - 6, w - 16, 10, 4); ctx.fill();
          /* canopy */
          ctx.fillStyle = '#e2614c';
          ctx.beginPath(); ctx.moveTo(x - w / 2, y - h * .95); ctx.lineTo(x, y - h * 1.25); ctx.lineTo(x + w / 2, y - h * .95); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff6e6';
          for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(x - w / 2 + (w / 6) * i, y - h * .95);
            ctx.lineTo(x - w / 2 + (w / 6) * (i + 1), y - h * .95);
            ctx.lineTo(x - w / 2 + (w / 6) * (i + 1) - 6, y - h * .9);
            ctx.lineTo(x - w / 2 + (w / 6) * i + 6, y - h * .9);
            ctx.closePath(); ctx.fill();
          }
          ctx.fillStyle = '#ffd98a';
          ctx.font = '800 14px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('MOA FEST', x, y - h * 1.02);
          if (info.dark > .1) this.glow(ctx, x, y - h * .7, w * .55, '#ffd98a', .4);
          break;
        }
        case 'speaker': {
          ctx.fillStyle = '#2f2a44';
          ctx.fillRect(x - 12, y - 58, 24, 58);
          ctx.fillStyle = '#4a4458';
          ctx.beginPath(); ctx.arc(x, y - 40, 8, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(x, y - 18, 6, 0, TAU); ctx.fill();
          break;
        }
        case 'snowpile': {
          ctx.fillStyle = 'rgba(255,255,255,.9)';
          ctx.beginPath(); ctx.ellipse(x, y - 4 * s, 20 * s, 9 * s, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(220,235,255,.7)';
          ctx.beginPath(); ctx.ellipse(x + 4 * s, y - 2 * s, 12 * s, 5 * s, 0, 0, TAU); ctx.fill();
          break;
        }
        case 'rock': {
          ctx.fillStyle = 'rgba(120,120,130,.5)';
          ctx.beginPath(); ctx.ellipse(x, y - 3, 11 * s, 7 * s, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.25)';
          ctx.beginPath(); ctx.ellipse(x - 3, y - 5, 6 * s, 3.4 * s, 0, 0, TAU); ctx.fill();
          break;
        }
        case 'flowerbed': {
          ctx.fillStyle = '#a9703f';
          roundRect(ctx, x - 44, y - 16, 88, 16, 5); ctx.fill();
          const cols = ['#f4839e', '#ffd166', '#cbb6ff', '#ff9b8a'];
          for (let i = 0; i < 10; i++) {
            ctx.fillStyle = cols[i % cols.length];
            ctx.beginPath(); ctx.arc(x - 36 + i * 8, y - 20 - (i % 3) * 3, 4, 0, TAU); ctx.fill();
          }
          break;
        }
        case 'fountainSmall': {
          ctx.fillStyle = 'rgba(140,200,220,.5)';
          ctx.beginPath(); ctx.ellipse(x, y - 4, 26, 10, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#efe6d2';
          ctx.fillRect(x - 4, y - 30, 8, 26);
          ctx.fillStyle = 'rgba(226,246,255,.7)';
          ctx.beginPath(); ctx.arc(x, y - 34, 6, 0, TAU); ctx.fill();
          break;
        }
      }
    },

    /* ------------------------- people ------------------------- */
    drawAvatar(ctx, info) {
      const a = this.avatar;
      if (a.hidden) return;
      const ap = { x: a.x, y: a.y };
      const h = 56;
      const im = sprite('avatar', C().avatarData());
      const bob = a.moving ? Math.abs(Math.sin(a.bob)) * -4 : Math.sin(a.bob) * -1.2;
      const flip = a.dir < 0 ? -1 : 1;
      const s = this.worldToScreen(ap.x, ap.y);
      ctx.save();
      ctx.globalAlpha = .24; ctx.fillStyle = '#1d1a2b';
      ctx.beginPath(); ctx.ellipse(ap.x, ap.y, h * .26, h * .09, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.translate(ap.x, ap.y + bob);
      ctx.scale(flip, 1);
      if (ready(im)) ctx.drawImage(im, -h * .38, -h * .97, h * .76, h);
      else { ctx.fillStyle = '#e2614c'; ctx.beginPath(); ctx.arc(0, -h * .4, h * .26, 0, TAU); ctx.fill(); }
      ctx.restore();

      /* carried package indicator */
      const st = MV.Missions && MV.Missions.carrying && MV.Missions.carrying();
      if (st) {
        ctx.save();
        ctx.translate(ap.x + 16, ap.y - h * .95 + bob);
        ctx.fillStyle = '#c98c22';
        ctx.fillRect(-7, -9, 14, 12);
        ctx.fillStyle = '#a9703f';
        ctx.fillRect(-7, -5, 14, 2);
        ctx.restore();
      }

      /* name tag */
      const name = (MV.Store.state.nickname || 'MOA').slice(0, 12);
      const fs = 12;
      if (!this._fontStack) this._fontStack = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
      ctx.save();
      ctx.font = '800 ' + fs + 'px ' + this._fontStack;
      const tw = ctx.measureText(name).width;
      const padX = 9, bh = 22;
      const bx = ap.x - (tw + padX * 2) / 2, by = ap.y + bob - h * .99 - bh - 4;
      ctx.fillStyle = 'rgba(255,250,240,.94)';
      roundRect(ctx, bx, by, tw + padX * 2, bh, bh / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(42,36,56,.10)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#3a3352'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, ap.x, by + bh / 2 + .5);
      ctx.restore();
      this.hot.push({ type: 'avatar', x: ap.x, y: ap.y, sx: s.x, sy: s.y - 20, r: 26 });
    },

    drawNpc(ctx, n, info) {
      const h = 46;
      const bob = n.jump > 0 ? -Math.sin(n.jump * Math.PI) * 14 : Math.abs(Math.sin(n.bob)) * (n.cheer ? 3 : 1.6);
      const s = this.worldToScreen(n.x, n.y);
      ctx.save();
      ctx.globalAlpha = .22; ctx.fillStyle = '#1d1a2b';
      ctx.beginPath(); ctx.ellipse(n.x, n.y, 13, 4.4, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.translate(n.x, n.y - bob);
      ctx.scale(n.dir < 0 ? -1 : 1, 1);
      /* legs */
      const sw = Math.sin(n.bob) * 4;
      ctx.strokeStyle = '#3b3850'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-3, -16); ctx.lineTo(-3 + sw, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, -16); ctx.lineTo(3 - sw, 0); ctx.stroke();
      /* body */
      ctx.fillStyle = n.coat;
      roundRect(ctx, -8, -34, 16, 20, 6); ctx.fill();
      /* head */
      ctx.fillStyle = n.skin;
      ctx.beginPath(); ctx.arc(0, -40, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3b3850';
      ctx.beginPath(); ctx.arc(0, -42, 7, Math.PI, TAU); ctx.fill();
      /* arms up when cheering */
      ctx.strokeStyle = n.coat; ctx.lineWidth = 3.2;
      if (n.cheer) {
        ctx.beginPath(); ctx.moveTo(-7, -30); ctx.lineTo(-12, -44); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(7, -30); ctx.lineTo(12, -44); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(-7, -30); ctx.lineTo(-10, -20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(7, -30); ctx.lineTo(10, -20); ctx.stroke();
      }
      ctx.restore();
      this.hot.push({ type: 'npc', id: n.id, x: n.x, y: n.y, sx: s.x, sy: s.y - 24, r: 22 });
    },

    drawPet(ctx, p, info) {
      const im = sprite('pet:' + p.id, C().petData(p.id));
      const h = 40;
      const bob = Math.abs(Math.sin(p.bob)) * 1.6;
      const s = this.worldToScreen(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = .2; ctx.fillStyle = '#1d1a2b';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 14, 4, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.translate(p.x, p.y - bob);
      ctx.scale(p.dir < 0 ? -1 : 1, 1);
      if (ready(im)) ctx.drawImage(im, -h * .62, -h * .84, h * 1.24, h * 1.08);
      else {
        ctx.fillStyle = '#e8c39a';
        ctx.beginPath(); ctx.arc(0, -h * .5, h * .3, 0, TAU); ctx.fill();
      }
      ctx.restore();
      this.hot.push({ type: 'pet', id: p.id, x: p.x, y: p.y, sx: s.x, sy: s.y - 22, r: 26 });
    },

    drawVehicle(ctx, v, info, driven) {
      const cfg = C().vehicle(v.id) || { scale: 1 };
      const artKey = cfg.sprite || v.id;
      const im = sprite('veh:' + artKey, C().rideData(v.id) || C().rideData('scooter'));
      const h = 46 * (cfg.scale || 1);
      const bob = Math.abs(Math.sin((v.bob || 0) * 2)) * 1.4;
      ctx.save();
      ctx.globalAlpha = .24; ctx.fillStyle = '#1d1a2b';
      ctx.beginPath(); ctx.ellipse(v.x, v.y + 2, h * .62, h * .18, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.translate(v.x, v.y - bob);
      ctx.scale(v.dir < 0 ? -1 : 1, 1);
      const w = v.id === 'tram' ? h * 2.1 : h * 1.85;
      if (ready(im)) ctx.drawImage(im, -w / 2, -h * .92, w, h);
      else { ctx.fillStyle = '#f0a55f'; roundRect(ctx, -w / 2, -h * .7, w, h * .6, 6); ctx.fill(); }
      ctx.restore();

      /* premium badge */
      if (v.test && !v.owned) {
        const s = this.worldToScreen(v.x, v.y);
        ctx.save();
        ctx.font = '800 10px system-ui, sans-serif';
        const label = MV.t('veh.test');
        const tw = ctx.measureText(label).width + 12;
        ctx.fillStyle = 'rgba(250,230,180,.94)';
        roundRect(ctx, s.x - tw / 2, s.y - 58, tw, 16, 8); ctx.fill();
        ctx.fillStyle = '#6b4000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, s.x, s.y - 50);
        ctx.restore();
      }
      if (driven && info.dark > .15) {
        /* headlights */
        const ax = v.x + Math.cos(v.angle) * 30, ay = v.y + Math.sin(v.angle) * 18;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = .5;
        const lg = ctx.createLinearGradient(ax, ay, ax + Math.cos(v.angle) * 220, ay + Math.sin(v.angle) * 160);
        lg.addColorStop(0, 'rgba(255,238,190,.55)'); lg.addColorStop(1, 'rgba(255,238,190,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(ax - 12, ay - 6); ctx.lineTo(ax + Math.cos(v.angle) * 240 - 40, ay + Math.sin(v.angle) * 180 - 40);
        ctx.lineTo(ax + Math.cos(v.angle) * 240 + 40, ay + Math.sin(v.angle) * 180 + 40);
        ctx.lineTo(ax + 12, ay + 6); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      const s2 = this.worldToScreen(v.x, v.y);
      this.hot.push({ type: 'vehicle', id: v.id, ref: v, x: v.x, y: v.y, sx: s2.x, sy: s2.y - 20, r: 34 });
    },

    /* ------------------------- ornaments ------------------------- */
    drawOrnament(ctx, p, x, y, info) {
      const o = C().orn(p.id);
      if (!o) return;
      const h = 84 * (o.scale || 1);
      const w = h * .8;
      const im = sprite('orn:' + o.art, C().spriteData(o.art));
      ctx.save();
      if (this.dragUid === p.uid && this.dragging) ctx.globalAlpha = .9;
      ctx.globalAlpha = .2;
      ctx.beginPath(); ctx.ellipse(x, y + 1, w * .3, w * .09, 0, 0, TAU); ctx.fillStyle = '#1d1a2b'; ctx.fill();
      ctx.globalAlpha = 1;
      if (ready(im)) ctx.drawImage(im, x - w / 2, y - h + w * .1, w, h);
      else { ctx.fillStyle = '#a99'; ctx.beginPath(); ctx.arc(x, y - h * .45, w * .3, 0, TAU); ctx.fill(); }
      if (info.dark > .2 && ['lamp', 'star', 'gbell', 'aurora', 'gate', 'fox', 'deer', 'crystal'].indexOf(o.art) >= 0) {
        this.glow(ctx, x, y - h * .55, h * .5, '#ffd98a', .35);
        if (this._lights) this._lights.push({ x, y: y - h * .55, r: h * .6, color: '#ffd98a', a: .4 });
      }
      if (o.rarity !== 'common') {
        const c = o.rarity === 'limited' ? '#ffd98a' : '#cbb6ff';
        ctx.globalAlpha = .35 + Math.sin(this.t * 2 + x) * .12;
        ctx.beginPath(); ctx.arc(x, y - h * .55, w * .46, 0, TAU);
        ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (this.dragUid === p.uid) {
        ctx.globalAlpha = .6;
        ctx.beginPath(); ctx.ellipse(x, y + 1, w * .4, w * .13, 0, 0, TAU);
        ctx.strokeStyle = '#f2b54b'; ctx.lineWidth = 2.4; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      const s = this.worldToScreen(x, y - h * .45);
      this.hot.push({ type: 'orn', uid: p.uid, id: p.id, x, y, sx: s.x, sy: s.y, r: Math.max(20, w * .48 * this.cam.zoom) });
    },

    /* ------------------------- sparkles ------------------------- */
    drawSpark(ctx, s) {
      const pulse = .7 + Math.sin(s.ph) * .3;
      const r = 12 * pulse;
      this.glow(ctx, s.x, s.y - r * 1.5, r * 3.2, '#ffe9a8', .5);
      ctx.save();
      ctx.translate(s.x, s.y - r * 1.6);
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
      ctx.beginPath(); ctx.arc(0, 0, r * .3, 0, TAU); ctx.fill();
      ctx.restore();
      const sc = this.worldToScreen(s.x, s.y - r * 1.6);
      this.hot.push({ type: 'spark', id: s.id, ref: s, x: s.x, y: s.y, sx: sc.x, sy: sc.y, r: Math.max(24, r * 2.6) });
    },

    /* ------------------------- overlays ------------------------- */
    drawStreetLights(ctx, info) {
      if (!info.night && this.phase !== 'sunset') return;
      const L = this._lights || [];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      L.forEach(l => {
        const grd = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, Math.max(8, l.r));
        grd.addColorStop(0, 'rgba(255,224,160,' + (.5 * (l.a || .5)) + ')');
        grd.addColorStop(.45, 'rgba(255,205,130,' + (.2 * (l.a || .5)) + ')');
        grd.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(l.x, l.y, Math.max(8, l.r), 0, TAU); ctx.fill();
      });
      ctx.restore();
    },

    glow(ctx, x, y, r, color, a) {
      if (!r || r < 1) return;
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

    drawWeather(ctx, info) {
      const Ws = this.W, Hs = this.H;
      if (this.phase === 'rain') {
        ctx.save();
        ctx.strokeStyle = 'rgba(200,225,255,.6)';
        ctx.lineWidth = 1.6;
        this.parts.forEach(p => {
          ctx.globalAlpha = p.a;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.l * .18, p.y + p.l); ctx.stroke();
        });
        ctx.restore();
      } else if (this.phase === 'snow') {
        ctx.save();
        this.parts.forEach(p => {
          ctx.globalAlpha = p.a;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        });
        ctx.restore();
      } else if (this.phase === 'night') {
        ctx.save();
        this.parts.forEach(p => {
          const a = .3 + .6 * Math.abs(Math.sin(p.ph));
          ctx.globalAlpha = a * p.a;
          ctx.fillStyle = '#ffe9a8';
          ctx.beginPath(); ctx.arc(p.x, p.y + Math.sin(p.ph) * 6, p.r, 0, TAU); ctx.fill();
        });
        ctx.restore();
      } else {
        ctx.save();
        this.parts.forEach(p => {
          ctx.globalAlpha = p.a * .5;
          ctx.fillStyle = this.phase === 'sunset' ? '#ffd9a8' : '#fffbe4';
          ctx.beginPath(); ctx.arc(p.x, p.y + Math.sin(p.ph) * 8, p.r, 0, TAU); ctx.fill();
        });
        ctx.restore();
      }
      /* popups */
      this.pops.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.font = '800 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff8ea';
        ctx.strokeStyle = 'rgba(40,32,58,.5)'; ctx.lineWidth = 3;
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      });
    },

    drawGrade(ctx, pal, info) {
      const Ws = this.W, Hs = this.H;
      if (info.night) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#9aa2de';
        ctx.fillRect(0, 0, Ws, Hs);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(10,12,32,.22)';
        ctx.fillRect(0, 0, Ws, Hs);
        ctx.restore();
      } else if (this.phase === 'sunset') {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#ffe2cf';
        ctx.fillRect(0, 0, Ws, Hs);
        ctx.globalCompositeOperation = 'source-over';
        const g = ctx.createLinearGradient(0, 0, Ws * .6, Hs);
        g.addColorStop(0, 'rgba(255,150,90,.20)');
        g.addColorStop(.45, 'rgba(255,185,120,.12)');
        g.addColorStop(1, 'rgba(120,70,120,.18)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, Ws, Hs);
        ctx.restore();
      } else if (this.phase === 'rain') {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#c3cfe0';
        ctx.fillRect(0, 0, Ws, Hs);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(50,65,95,.12)';
        ctx.fillRect(0, 0, Ws, Hs);
        ctx.restore();
      }
      /* vignette */
      ctx.save();
      const vg = ctx.createRadialGradient(Ws / 2, Hs * .55, Math.min(Ws, Hs) * .42, Ws / 2, Hs * .55, Math.max(Ws, Hs) * .82);
      vg.addColorStop(0, 'rgba(20,16,40,0)');
      vg.addColorStop(1, info.night ? 'rgba(6,6,18,.55)' : this.phase === 'sunset' ? 'rgba(70,30,70,.24)' : 'rgba(30,24,50,.16)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, Ws, Hs);
      ctx.restore();
    },

    /* ------------------------- minimap / full map ------------------------- */
    drawMini(ctx, w, h, opts) {
      if (!this.miniBase) return;
      opts = opts || {};
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.drawImage(this.miniBase, 0, 0, w, h);
      const sx = w / W(), sy = h / H();
      /* ornaments */
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      this.placements.forEach(p => {
        ctx.beginPath(); ctx.arc(p.nx * w, p.ny * h, 1.3, 0, TAU); ctx.fill();
      });
      /* vehicles */
      this.vehicles.forEach(v => {
        if (v === this.vehicle) return;
        ctx.fillStyle = v.owned ? 'rgba(255,227,163,.95)' : 'rgba(255,255,255,.65)';
        ctx.fillRect(v.x * sx - 2, v.y * sy - 2, 4, 4);
      });
      /* npcs */
      ctx.fillStyle = 'rgba(210,230,255,.65)';
      this.npcs.forEach(n => { ctx.beginPath(); ctx.arc(n.x * sx, n.y * sy, 1.4, 0, TAU); ctx.fill(); });
      /* mission markers */
      if (MV.Missions) MV.Missions.markers().forEach(m => {
        const mx = m.x * sx, my = m.y * sy;
        ctx.fillStyle = m.color || '#ffd166';
        ctx.beginPath(); ctx.arc(mx, my, 5.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#241f30';
        ctx.font = '800 8px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(m.icon || '!', mx, my + .5);
      });
      /* player arrow */
      const focus = this.vehicle || this.avatar;
      const ang = this.vehicle ? this.vehicle.angle : this.avatar.heading;
      const px = focus.x * sx, py = focus.y * sy;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = '#fff8ea';
      ctx.strokeStyle = 'rgba(40,32,58,.7)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.6, 5); ctx.lineTo(0, 2.6); ctx.lineTo(-4.6, 5); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
      /* radar sweep */
      if (opts.sweep !== false) {
        ctx.save();
        ctx.globalAlpha = .16;
        ctx.fillStyle = '#baffdc';
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.arc(px, py, Math.max(w, h) * .34, this.t * 1.2, this.t * 1.2 + .5);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    },

    /* ------------------------- public helpers for UI/tests ------------------------- */
    stats() {
      return {
        avatar: { x: Math.round(this.avatar.x), y: Math.round(this.avatar.y) },
        cam: { x: Math.round(this.cam.x), y: Math.round(this.cam.y), zoom: +this.cam.zoom.toFixed(2) },
        vehicle: this.vehicle ? { id: this.vehicle.id, speed: Math.round(this.vehicle.speed), test: !!this.vehicle.test } : null,
        district: this.lastDistrict,
        buildings: this.plan ? this.plan.buildings.length : 0,
        props: this.plan ? this.plan.props.length : 0,
        vehiclesCount: this.vehicles.length,
        npcs: this.npcs.length,
        sparks: this.sparks.length,
        phase: this.phase,
        village: this.village ? this.village.id : null
      };
    },
    warp(x, y) {
      this.avatar.x = x; this.avatar.y = y; this.avatar.tx = x; this.avatar.ty = y;
      this.cam.x = x; this.cam.y = y - 40;
    },
    warpLandmark(id) {
      const l = this.plan.landmarks.find(x => x.id === id);
      if (l) this.warp(l.x, l.y + 70);
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function line(g, x1, y1, x2, y2) {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }

  Scene.roundRect = roundRect;
  MV.Scene = Scene;
})();
