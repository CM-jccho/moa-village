/* MOA Village v2 — live world situations, missions, hype stars */
(function () {
  'use strict';
  window.MV = window.MV || {};
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const C = () => MV.Catalog;

  const TYPES = {
    delivery: { dur: 120, coin: 120, xp: 40, icon: '📦', key: 'mis.delivery' },
    supply: { dur: 75, coin: 90, xp: 30, icon: '🎁', key: 'mis.supply' },
    pet: { dur: 135, coin: 100, xp: 35, icon: '🐾', key: 'mis.pet' },
    festival: { dur: 60, coin: 90, xp: 30, icon: '🎉', key: 'mis.festival' }
  };
  const RARE_POOL = ['crystal', 'wreath', 'snowglobe', 'carousel', 'windmill'];

  const M = {
    scene: null,
    state: null,
    cooldown: 7,
    done: 0,
    hype: 0,
    stars: 0,
    idleTime: 9,
    previewAt: {},
    fest: null,
    crate: null,
    lostPet: null,
    fw: [],
    cbs: {},
    tick: 0,
    seq: 0,

    init(scene) {
      this.scene = scene;
      this.cooldown = 8;
      this.state = null;
      this.hype = 0; this.stars = 0; this.idleTime = 9;
      this.previewAt = {};
      this.cooldown = 7;
    },

    on(name, fn) { this.cbs[name] = fn; },
    emit(name, data) { const fn = this.cbs[name]; if (fn) { try { fn(data); } catch (e) { console.warn('mis cb', e); } } },

    festivalOn() { return !!(this.state && this.state.type === 'festival' && this.state.phase === 'go'); },
    carrying() { return !!(this.state && this.state.type === 'delivery' && this.state.phase === 'deliver'); },

    /* ======================= lifecycle ======================= */
    update(dt) {
      if (!this.scene || !this.scene.plan) return;
      this.tick += dt;
      /* hype decay */
      this.idleTime += dt;
      if (this.idleTime > 9 && this.hype > 0) {
        this.hype = clamp(this.hype - dt * .022, 0, 5);
      }
      const ns = Math.floor(this.hype + 1e-4);
      if (ns !== this.stars) {
        const up = ns > this.stars;
        this.stars = ns;
        this.emit('star', { stars: ns, up });
        if (up && ns >= 3) this.checkPreview();
      }

      if (!this.state) {
        this.cooldown -= dt;
        if (this.cooldown <= 0) this.start();
        return;
      }
      const st = this.state;
      st.t -= dt;
      if (st.t <= 0) { this.expire(); return; }
      if (st.type === 'supply' && this.crate) {
        this.crate.fall = Math.max(0, this.crate.fall - dt * .8);
      }
      if (st.type === 'festival') this.updateFestival(dt);
      if (st.type === 'pet' && st.phase === 'escort' && this.lostPet) {
        /* lost pet follows */
        const s = this.scene;
        const p = this.lostPet;
        const tx = s.avatar.x - 30, ty = s.avatar.y + 24;
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
        if (d > 40) { p.x += dx / d * Math.min(190 * dt, d); p.y += dy / d * Math.min(190 * dt, d); p.dir = dx > 0 ? 1 : -1; }
        p.bob += dt * 8;
      }
      /* arrival checks */
      if (st.type === 'delivery') {
        const focus = this.scene.vehicle || this.scene.avatar;
        if (st.phase === 'pickup' && near(focus, st.from, 68)) {
          st.phase = 'deliver';
          st.t = Math.min(st.t + 20, TYPES.delivery.dur);
          this.scene.pops.push({ x: st.from.x, y: st.from.y - 40, text: '📦', life: 1.2 });
          this.scene.beep && this.scene.beep('start');
          this.emit('objective', this.objective());
        } else if (st.phase === 'deliver' && near(focus, st.to, 78)) {
          this.complete();
        }
      } else if (st.type === 'supply') {
        if (this.crate && this.crate.fall <= 0) {
          const focus = this.scene.vehicle || this.scene.avatar;
          if (near(focus, this.crate, 70)) this.complete();
        }
      } else if (st.type === 'pet') {
        const focus = this.scene.vehicle || this.scene.avatar;
        if (st.phase === 'find' && this.lostPet && near(focus, this.lostPet, 70)) {
          st.phase = 'escort';
          this.emit('objective', this.objective());
          this.scene.pops.push({ x: this.lostPet.x, y: this.lostPet.y - 40, text: '💖', life: 1.2 });
        } else if (st.phase === 'escort' && near(focus, st.to, 96)) {
          this.complete();
        }
      }
      /* objective tick for HUD distance (throttled) */
      this.emit('tick', this.objective());
    },

    start() {
      const scene = this.scene;
      const plan = scene.plan;
      const types = ['delivery', 'supply', 'pet', 'festival'];
      /* avoid repeating the same type twice */
      let type = types[Math.floor(Math.random() * types.length)];
      if (this._lastType === type) type = types[(types.indexOf(type) + 1 + Math.floor(Math.random() * 2)) % types.length];
      this._lastType = type;
      const T = TYPES[type];
      const st = { type, phase: 'go', t: T.dur, total: T.dur, id: ++this.seq, reward: T };

      if (type === 'delivery') {
        const shopLm = plan.landmarks.filter(l => ['market', 'fountain', 'showroom'].indexOf(l.id) >= 0);
        st.from = pick(shopLm) || plan.landmarks[0];
        st.phase = 'pickup';
        const others = plan.landmarks.filter(l => l.id !== st.from.id);
        st.to = pick(others);
      } else if (type === 'supply') {
        const d = pick(plan.districts);
        const sp = pick(plan.spawns[d.id]) || { x: 1520, y: 1250 };
        this.crate = { x: sp.x, y: sp.y, fall: 1, landed: false, rot: rand(-.3, .3) };
        st.landmark = d;
        this.scene.pops.push({ x: sp.x, y: sp.y - 200, text: '🪂', life: 1.6 });
      } else if (type === 'pet') {
        const pool = ['shop', 'park', 'harbor', 'plaza'];
        const d = pick(pool);
        const sp = pick(plan.spawns[d]) || { x: 1520, y: 1250 };
        const petIds = ['cat', 'critter', 'puppy', 'moonrabbit'];
        this.lostPet = {
          x: sp.x, y: sp.y, bob: 0, dir: 1,
          id: petIds[Math.floor(Math.random() * petIds.length)],
          wanderT: 0, tx: sp.x, ty: sp.y
        };
        st.district = d;
        const home = plan.landmarks.find(l => l.id === 'home');
        st.to = home;
      } else {
        const zones = [plan.festival, { x: plan.plaza.x, y: plan.plaza.y, r: 210 }];
        const z = pick(zones);
        this.fest = { x: z.x, y: z.y, r: z.r, prog: 0, inside: false };
        st.zone = this.fest;
      }

      this.state = st;
      this.emit('start', this.objective());
      this.emit('objective', this.objective());
    },

    expire() {
      const st = this.state;
      if (!st) return;
      this.state = null;
      this.crate = null;
      this.lostPet = null;
      this.fest = null;
      this.hype = clamp(this.hype - .3, 0, 5);
      this.cooldown = rand(9, 15);
      this.emit('expire', { type: st.type });
      this.emit('objective', null);
    },

    complete() {
      const st = this.state;
      if (!st) return;
      const T = st.reward;
      const S = MV.Store;
      let coins = S.reward(T.coin);
      let bonus = null;
      if (st.type === 'supply') {
        const id = RARE_POOL[Math.floor(Math.random() * RARE_POOL.length)];
        S.grant([id]);
        bonus = { kind: 'orn', id };
      }
      if (st.type === 'festival') { S.addSparks(5); }
      S.addXp(T.xp);
      S.state.missionsDone = (S.state.missionsDone || 0) + 1;
      S.save();
      this.done++;
      this.hype = clamp(this.hype + (st.type === 'festival' ? .9 : .7), 0, 5);
      this.idleTime = 0;
      const payload = {
        type: st.type, coins, xp: T.xp, bonus, stars: Math.floor(this.hype + 1e-4),
        icon: T.icon, key: T.key, level: S.level()
      };
      /* monetization touchpoint: rare preview after a supply claim / high hype */
      if (st.type === 'supply' || this.hype >= 3) this.checkPreview(true);
      this.emit('complete', payload);
      this.state = null;
      this.crate = null;
      this.lostPet = null;
      this.fest = null;
      this.cooldown = rand(10, 16);
      this.emit('objective', null);
    },

    checkPreview(force) {
      const key = force ? 'supply' : 'star3';
      if (!force && this.previewAt[key]) return;
      if (!force && this.stars < 3) return;
      if (force && this.previewAt[key] && this.done > 1) return;
      this.previewAt[key] = true;
      const set = C().RAPID.sets[Math.floor(Math.random() * C().RAPID.sets.length)];
      const item = set.items[0];
      this.emit('preview', {
        key, set: set.id, item,
        setName: C().setName(set), url: C().RAPID.creator.url,
        price: set.price
      });
    },

    updateFestival(dt) {
      const f = this.fest;
      if (!f) return;
      const focus = this.scene.vehicle || this.scene.avatar;
      const inside = Math.hypot(focus.x - f.x, focus.y - f.y) < f.r;
      f.inside = inside;
      if (inside) {
        f.prog += dt;
        this.idleTime = 0;
        this.hype = clamp(this.hype + dt * .16, 0, 5);
        if (Math.random() < dt * 1.6) this.burstFirework();
        if (f.prog >= 6) this.complete();
      }
      if (Math.random() < dt * .5) this.burstFirework();
    },

    burstFirework() {
      const f = this.fest;
      if (!f) return;
      const x = f.x + rand(-f.r, f.r) * .8;
      const y = f.y - rand(90, 300);
      const cols = ['#ffd166', '#f0715c', '#8cc8b4', '#b9aef0', '#fff3c6'];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        this.fw.push({
          x, y, vx: Math.cos(a) * rand(40, 110), vy: Math.sin(a) * rand(40, 110),
          life: rand(.6, 1.2), max: 1.2, c: cols[i % cols.length]
        });
      }
    },

    /* ======================= objective for HUD ======================= */
    objective() {
      const st = this.state;
      if (!st) return null;
      const focus = this.scene.vehicle || this.scene.avatar;
      const t = this.targetPoint();
      const dist = t ? Math.round(Math.hypot(t.x - focus.x, t.y - focus.y) / 10) : 0;
      let subKey = st.type === 'delivery'
        ? (st.phase === 'pickup' ? 'mis.sub.pickup' : 'mis.sub.deliver')
        : st.type === 'supply' ? 'mis.sub.supply'
          : st.type === 'pet' ? (st.phase === 'find' ? 'mis.sub.petFind' : 'mis.sub.petHome')
            : 'mis.sub.festival';
      return {
        type: st.type, icon: st.reward.icon, titleKey: st.reward.key, subKey,
        dist, t: st.t, total: st.total, phase: st.phase,
        progress: st.type === 'festival' && this.fest ? clamp(this.fest.prog / 6, 0, 1) : null
      };
    },

    targetPoint() {
      const st = this.state;
      if (!st) return null;
      if (st.type === 'delivery') return st.phase === 'pickup' ? st.from : st.to;
      if (st.type === 'supply') return this.crate;
      if (st.type === 'pet') return st.phase === 'find' ? this.lostPet : st.to;
      if (st.type === 'festival') return this.fest;
      return null;
    },

    markers() {
      const out = [];
      const st = this.state;
      if (!st) return out;
      if (st.type === 'delivery') {
        const dest = st.phase === 'pickup' ? st.from : st.to;
        out.push({ x: dest.x, y: dest.y, icon: st.phase === 'pickup' ? '📦' : '!', color: '#ffd166' });
        if (st.phase === 'deliver') out.push({ x: st.from.x, y: st.from.y, icon: '·', color: '#8cc8b4' });
      } else if (st.type === 'supply' && this.crate) {
        out.push({ x: this.crate.x, y: this.crate.y, icon: '!', color: '#ffd166' });
      } else if (st.type === 'pet') {
        const p = st.phase === 'find' ? this.lostPet : st.to;
        if (p) out.push({ x: p.x, y: p.y, icon: '!', color: '#ff9b8a' });
      } else if (st.type === 'festival' && this.fest) {
        out.push({ x: this.fest.x, y: this.fest.y, icon: '🎉', color: '#cbb6ff' });
      }
      return out;
    },

    /* ======================= drawing ======================= */
    collect(list, scene) {
      const st = this.state;
      if (!st) return;
      /* pickup package */
      if (st.type === 'delivery' && st.phase === 'pickup') {
        list.push({ y: st.from.y + 12, draw: () => drawPackage(scene, st.from.x, st.from.y + 6) });
      }
      if (st.type === 'delivery' && st.phase === 'deliver') {
        list.push({ y: st.to.y + 14, draw: () => drawDropRing(scene, st.to.x, st.to.y, '#ffd166') });
      }
      /* supply crate */
      if (st.type === 'supply' && this.crate) {
        list.push({ y: this.crate.y + 10, draw: () => drawCrate(scene, this.crate) });
      }
      /* lost pet */
      if (st.type === 'pet' && this.lostPet && st.phase === 'find') {
        const p = this.lostPet;
        list.push({ y: p.y, draw: () => drawLostPet(scene, p) });
      }
      if (st.type === 'pet' && st.phase === 'escort') {
        list.push({ y: st.to.y + 14, draw: () => drawDropRing(scene, st.to.x, st.to.y, '#ff9b8a') });
      }
      /* festival zone */
      if (st.type === 'festival' && this.fest) {
        list.push({ y: this.fest.y - 200, draw: () => drawFestZone(scene, this.fest) });
      }
    },

    drawOverlay(ctx, scene, info) {
      const st = this.state;
      if (!st) return;
      const tp = this.targetPoint();
      if (tp) {
        const col = st.type === 'pet' ? '#ff9b8a' : st.type === 'festival' ? '#cbb6ff' : '#ffd166';
        beacon(ctx, scene, tp.x, tp.y, col);
      }
      /* fireworks */
      this.fw.forEach(f => { f.life -= .016; f.x += f.vx * .016; f.y += f.vy * .016; f.vy += 40 * .016; f.vx *= .99; });
      this.fw = this.fw.filter(f => f.life > 0);
      if (this.fw.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        this.fw.forEach(f => {
          ctx.globalAlpha = clamp(f.life / f.max, 0, 1) * .9;
          ctx.fillStyle = f.c;
          ctx.beginPath(); ctx.arc(f.x, f.y, 3.2, 0, TAU); ctx.fill();
        });
        ctx.restore();
      }
    },

    drawScreen(ctx, scene) {
      const st = this.state;
      if (!st) return;
      const tp = this.targetPoint();
      if (!tp) return;
      const s = scene.worldToScreen(tp.x, tp.y);
      const W = scene.W, H = scene.H;
      const m = 46;
      if (s.x > m && s.x < W - m && s.y > 110 && s.y < H - 130) return;
      /* clamp to border */
      const cx = W / 2, cy = H / 2;
      let dx = s.x - cx, dy = s.y - cy;
      const ang = Math.atan2(dy, dx);
      const rx = (W / 2 - m), ry = (H / 2 - m - 40);
      const k = Math.min(rx / Math.max(1e-3, Math.abs(dx)), ry / Math.max(1e-3, Math.abs(dy)));
      const px = cx + dx * k, py = cy + dy * k;
      const focus = scene.vehicle || scene.avatar;
      const dist = Math.round(Math.hypot(tp.x - focus.x, tp.y - focus.y) / 10);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.fillStyle = st.type === 'pet' ? '#ff9b8a' : st.type === 'festival' ? '#cbb6ff' : '#ffd166';
      ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-8, 11); ctx.lineTo(-4, 0); ctx.lineTo(-8, -11); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.font = '800 11px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(28,24,44,.8)';
      const label = dist + 'm';
      const tw = ctx.measureText(label).width + 12;
      MOA_round(ctx, px - tw / 2, py + 16, tw, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#fff8ea';
      ctx.fillText(label, px, py + 24);
      ctx.restore();
    }
  };

  /* ---------- drawing helpers ---------- */
  function near(a, b, r) { return b && Math.hypot(a.x - b.x, a.y - b.y) < r; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function MOA_round(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  function beacon(ctx, scene, x, y, color) {
    const t = scene.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const top = y - 300;
    const g = ctx.createLinearGradient(x, top, x, y);
    g.addColorStop(0, 'rgba(255,209,102,0)');
    g.addColorStop(1, color);
    ctx.globalAlpha = .35 + Math.sin(t * 2.4) * .08;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - 30, y); ctx.lineTo(x - 7, top); ctx.lineTo(x + 7, top); ctx.lineTo(x + 30, y); ctx.closePath(); ctx.fill();
    ctx.restore();
    /* ground rings */
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const rr = ((t * 44 + i * 56) % 112);
      ctx.globalAlpha = .55 * (1 - rr / 112);
      ctx.strokeStyle = color; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.ellipse(x, y, rr * .9, rr * .36, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    /* ! badge */
    const by = y - 300 + Math.sin(t * 2.6) * 7;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, by, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#241f30';
    ctx.font = '800 19px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', x, by + 1);
    ctx.restore();
  }

  function drawPackage(scene, x, y) {
    const ctx = scene.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(40,32,58,.2)';
    ctx.beginPath(); ctx.ellipse(0, 2, 20, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c98c22';
    ctx.beginPath(); MOA_round(ctx, -16, -26, 32, 26, 4); ctx.fill();
    ctx.fillStyle = '#a9703f';
    ctx.fillRect(-16, -18, 32, 4);
    ctx.fillRect(-4, -26, 8, 26);
    ctx.fillStyle = '#ffe3a3';
    ctx.beginPath(); ctx.arc(0, -13, 3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawCrate(scene, c) {
    const ctx = scene.ctx;
    const t = scene.t;
    const lift = c.fall > 0 ? c.fall * 300 : 0;
    const y = c.y - lift;
    const swing = Math.sin(t * 2) * (.2 + c.fall);
    ctx.save();
    /* shadow */
    ctx.globalAlpha = c.fall > 0 ? .12 : .24;
    ctx.fillStyle = '#1d1a2b';
    ctx.beginPath(); ctx.ellipse(c.x, c.y + 2, 24, 7, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.translate(c.x, y);
    ctx.rotate(swing * .4 + c.rot);
    /* parachute */
    if (c.fall > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-10, -24); ctx.lineTo(-22, -64); ctx.moveTo(10, -24); ctx.lineTo(22, -64); ctx.stroke();
      ctx.fillStyle = '#f0715c';
      ctx.beginPath(); ctx.arc(0, -74, 30, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#fff6e6';
      ctx.beginPath(); ctx.arc(-12, -74, 12, Math.PI, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(12, -74, 12, Math.PI, TAU); ctx.fill();
    }
    /* crate */
    ctx.fillStyle = '#a9703f';
    ctx.beginPath(); MOA_round(ctx, -20, -34, 40, 34, 5); ctx.fill();
    ctx.fillStyle = '#c98c22';
    ctx.fillRect(-20, -34, 40, 7);
    ctx.fillStyle = '#ffe3a3';
    ctx.beginPath(); ctx.arc(0, -15, 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,30,.6)'; ctx.lineWidth = 2;
    ctx.strokeRect(-20, -34, 40, 34);
    if (c.fall <= 0) scene.glow(ctx, 0, -16, 46, '#ffe08a', .5);
    ctx.restore();
    if (c.fall <= 0) {
      ctx.save();
      ctx.globalAlpha = .5 + Math.sin(t * 4) * .2;
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(c.x, c.y + 2, 34, 12, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  function drawLostPet(scene, p) {
    const ctx = scene.ctx;
    const im = (function () {
      const url = MV.Catalog.petData(p.id);
      if (!url) return null;
      if (!scene._lostImg || scene._lostImgKey !== p.id) {
        scene._lostImg = new Image(); scene._lostImg.src = url; scene._lostImgKey = p.id;
      }
      return scene._lostImg;
    })();
    const h = 38;
    const bob = Math.abs(Math.sin(p.bob)) * 2;
    ctx.save();
    ctx.globalAlpha = .22; ctx.fillStyle = '#1d1a2b';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 14, 4, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.translate(p.x, p.y - bob);
    ctx.scale(p.dir < 0 ? -1 : 1, 1);
    if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -h * .62, -h * .84, h * 1.24, h * 1.08);
    else { ctx.fillStyle = '#f0c79a'; ctx.beginPath(); ctx.arc(0, -h * .5, h * .3, 0, TAU); ctx.fill(); }
    ctx.restore();
    /* bubble */
    ctx.save();
    const by = p.y - 54 - Math.sin(scene.t * 3) * 3;
    ctx.fillStyle = 'rgba(255,250,240,.95)';
    MOA_round(ctx, p.x - 15, by - 12, 30, 22, 10); ctx.fill();
    ctx.fillStyle = '#2a2438';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', p.x, by);
    ctx.restore();
  }

  function drawDropRing(scene, x, y, color) {
    const ctx = scene.ctx;
    const t = scene.t;
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const rr = ((t * 52 + i * 60) % 120);
      ctx.globalAlpha = .6 * (1 - rr / 120);
      ctx.strokeStyle = color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, y, rr * .95, rr * .4, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  function drawFestZone(scene, f) {
    const ctx = scene.ctx;
    const t = scene.t;
    ctx.save();
    ctx.globalAlpha = f.inside ? .3 : .18;
    const g = ctx.createRadialGradient(f.x, f.y, 20, f.x, f.y, f.r);
    g.addColorStop(0, 'rgba(203,182,255,.55)');
    g.addColorStop(1, 'rgba(203,182,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * .55, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = .5;
    ctx.strokeStyle = '#cbb6ff'; ctx.lineWidth = 3;
    ctx.setLineDash([16, 14]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * .55, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  M.TYPES = TYPES;
  MV.Missions = M;
})();
