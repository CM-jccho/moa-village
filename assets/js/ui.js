/* MOA Village v2 — UI: HUD, radar, world missions, shop, decorate, friends, Rapid */
(function () {
  'use strict';
  window.MV = window.MV || {};
  const C = () => MV.Catalog;
  const S = () => MV.Store;
  const t = (k, v) => MV.t(k, v);
  const RAPID_URL = 'https://www.latpeed.com/products/VTtxq';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString();
  const mmss = (s) => {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  const UI = {
    scene: null,
    sheetName: null,
    pendingMove: null,
    giftDraft: null,
    trend: { items: [], generatedAt: 0 },
    mission: null,
    promo: null,
    mapOpen: false,
    waypoint: null,
    lastMini: 0,
    lastSpeed: 0,
    lastPrompt: 0,
    stars: 0,

    init() {
      this.bind();
      this.applyStatic();
      this.updateHud();
      this.renderTrend();
      this.bindScene();
      this.bindMissions();
      this.bindWorld();
      this.tipTimer();
      this.updateStars(this.stars, false);
    },

    /* ================= static text & language ================= */
    applyStatic() {
      $$('[data-i18n]').forEach(el => {
        const k = el.getAttribute('data-i18n');
        if (el.tagName === 'INPUT') el.placeholder = t(k);
        else el.textContent = t(k);
      });
      const lang = MV.I18n.lang;
      $$('#langSeg button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
      this.updateWeatherLabels();
      this.updateVillageChip();
      this.updateDockLabels();
      this.updateHud();
      this.renderMissionHud(true);
      this.renderLegend();
      if (this.sheetName) this.openSheet(this.sheetName, this._sheetOpts, true);
      if (this.mapOpen) this.drawFullMap();
      document.title = 'MOA Village';
    },

    updateDockLabels() {
      const labels = { villages: 'dock.villages', shop: 'dock.shop', decorate: 'dock.decorate', friends: 'dock.friends', rapid: 'dock.rapid' };
      $$('#dock .dock-btn').forEach(b => {
        const el = b.querySelector('.dl');
        if (el) el.textContent = t(labels[b.dataset.panel]);
      });
    },
    updateWeatherLabels() {
      const names = { auto: 'weather.auto', clear: 'weather.clear', rain: 'weather.rain', snow: 'weather.snow', sunset: 'weather.sunset', night: 'weather.night' };
      $$('#weatherBar button').forEach(b => {
        const em = b.querySelector('em');
        if (em) em.textContent = t(names[b.dataset.w]);
        else b.textContent = t('weather.auto');
        b.classList.toggle('on', b.dataset.w === S().state.weather);
      });
      const icons = { auto: '🌤️', clear: '☀️', rain: '🌧️', snow: '❄️', sunset: '🌇', night: '🌙' };
      $('#weatherIcon').textContent = icons[S().state.weather] || '☀️';
    },
    updateVillageChip() {
      const v = C().village(S().state.village);
      $('#villageEmoji').textContent = v.emoji;
      $('#villageName').textContent = t('v.' + v.id + '.name');
    },

    updateHud() {
      $('#coinCount').textContent = fmt(S().state.coins);
      $('#sparkCount').textContent = fmt(S().state.sparks);
      $('#levelNum').textContent = S().level();
      $('#vipBadgeCard').hidden = !S().state.vip;
      this.updateVillageChip();
    },

    updateStars(n, animate) {
      this.stars = n;
      $$('#stars i').forEach(el => {
        const i = Number(el.dataset.i);
        const on = i <= n;
        if (on && !el.classList.contains('on')) {
          el.classList.add('on');
          if (animate) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
        } else if (!on) el.classList.remove('on');
      });
    },

    /* ================= events ================= */
    bind() {
      $('#langSeg').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        MV.I18n.setLang(b.dataset.lang);
        S().state.lang = b.dataset.lang;
        S().save();
        this.applyStatic();
        this.renderTrend();
        if (this.scene) this.scene.emit('district', { id: this.scene.lastDistrict, key: 'dist.' + this.scene.lastDistrict, first: true });
        this.toast(t('toast.lang'));
      });

      $('#weatherBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        $('#weatherBar').classList.toggle('open');
      });
      $('#weatherBar').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const w = b.dataset.w;
        S().state.weather = w;
        S().save();
        this.scene.setWeather(w);
        this.updateWeatherLabels();
        $('#weatherBar').classList.remove('open');
        const names = { auto: 'weather.auto', clear: 'weather.clear', rain: 'weather.rain', snow: 'weather.snow', sunset: 'weather.sunset', night: 'weather.night' };
        this.toast(t('toast.weather', { name: t(names[w]) }));
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#weatherBar') && !e.target.closest('#weatherBtn')) $('#weatherBar').classList.remove('open');
      });

      $('#dock').addEventListener('click', (e) => {
        const b = e.target.closest('.dock-btn');
        if (!b) return;
        if (this.sheetName === b.dataset.panel && $('#sheet').classList.contains('open')) { this.closeSheet(); return; }
        this.openSheet(b.dataset.panel);
      });

      $('#sheetClose').addEventListener('click', () => this.closeSheet());
      $('#scrim').addEventListener('click', () => this.closeSheet());
      $('#modalScrim').addEventListener('click', () => this.closeModal());
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { this.closeModal(); this.closeSheet(); $('#weatherBar').classList.remove('open'); this.closeMap(); }
      });

      $('#villageChip').addEventListener('click', () => this.openSheet('villages'));
      $('#levelChip').addEventListener('click', () => this.profileModal());
      $('#coinChip').addEventListener('click', () => this.openSheet('shop'));
      $('#sparkChip').addEventListener('click', () => this.openSheet('shop'));
      $('#trendStrip').addEventListener('click', () => this.openSheet('shop', { tab: 'orn' }));
      $('#serialBtn').addEventListener('click', () => this.openSerial());
      $('#stars').addEventListener('click', () => this.hypeModal());

      S().on((type, data) => {
        this.updateHud();
        if (type === 'coins' || type === 'buy' || type === 'inventory' || type === 'friend' || type === 'coop' || type === 'giftSent' || type === 'xp') {
          if (this.sheetName) this.openSheet(this.sheetName, this._sheetOpts, true);
        }
        if (type === 'village') { this.scene.setVillage(C().village(data.id)); this.updateVillageChip(); }
        if (type === 'villageUnlock') { this.updateHud(); }
        if (type === 'deco') { this.scene.refreshPlacements(); }
        if (type === 'pet') this.scene.syncPets(false);
        if (type === 'ride') this.scene.spawnVehicles();
        if (type === 'giftReceived') this.scene.refreshPlacements();
        if (type === 'coopUnlock') { this.toast(t('friends.rapidBanner')); this.confetti(24); }
      });
    },

    bindScene() {
      const sc = this.scene;
      sc.on('onGround', (nx, ny) => {
        if (sc.mode === 'place' && sc.pendingItem) {
          const p = S().place(sc.pendingItem, nx, ny);
          if (p) {
            const o = C().orn(p.id);
            this.toast(t('decorate.placed', { name: MV.I18n.itemName(o.id) }));
            this.burst(nx, ny);
            sc.refreshPlacements();
            if (!(S().state.inv[p.id] > 0)) { sc.setMode('idle'); this.tip(t('decorate.tapItem')); }
            if (this.sheetName === 'decorate') this.openSheet('decorate', this._sheetOpts, true);
          } else {
            this.toast(t('decorate.full', { n: sc.maxPlacements() }));
          }
          return;
        }
        if (sc.mode === 'move' && this.pendingMove) {
          S().move(this.pendingMove, nx, ny);
          this.pendingMove = null;
          sc.setMode('idle');
          sc.refreshPlacements();
          this.toast(t('decorate.moved'));
          return;
        }
        sc.walkTo(nx, ny);
      });
      sc.on('onSparkle', (h) => {
        const s = h.ref;
        if (s) s.dead = true;
        S().addCoins(3); S().addSparks(1);
        this.burstScreen(h.sx, h.sy);
        this.updateHud();
      });
      sc.on('onSparkleAuto', (s) => {
        S().addCoins(3); S().addSparks(1);
        const p = sc.worldToScreen(s.x, s.y);
        this.burstScreen(p.x, p.y);
        this.updateHud();
      });
      sc.on('onPet', (id, h) => {
        this._petLine = this._petLine || {};
        const i = this._petLine[id] = ((this._petLine[id] == null) ? 0 : this._petLine[id] + 1);
        this.bubble(MV.I18n.petLine(id, i), h.sx, h.sy - 8);
      });
      sc.on('onNpc', (id, h) => {
        this._npcLine = this._npcLine || {};
        const i = this._npcLine[id] = ((this._npcLine[id] == null) ? 0 : this._npcLine[id] + 1);
        this.bubble(MV.I18n.npcLine(i), h.sx, h.sy - 8);
      });
      sc.on('onRide', (id, h) => {
        this._rideLine = this._rideLine || {};
        const i = this._rideLine[id] = ((this._rideLine[id] == null) ? 0 : this._rideLine[id] + 1);
        this.bubble(MV.I18n.rideLine(id, i), h.sx, h.sy - 6);
      });
      sc.on('onOrnament', (uid) => this.ornamentMenu(uid));
      sc.on('onBuilding', (h) => this.buildingAction(h.interact));
      sc.on('onVehicleTap', (id) => {
        const v = sc.vehicles.find(x => x.id === id);
        if (v && Math.hypot(v.x - sc.avatar.x, v.y - sc.avatar.y) < 150) sc.enterVehicle(v);
        else this.toast(t('veh.tooFar'));
      });
      sc.on('onMoved', () => { if (this.sheetName === 'decorate') this.openSheet('decorate', this._sheetOpts, true); });
      sc.on('district', (d) => this.showDistrict(d));
      sc.on('vehicle', (v) => this.onVehicle(v));
      sc.on('testdrive:end', () => this.testDriveEnd());
      sc.on('mapToggle', () => this.toggleMap());
      sc.on('frameEnd', () => this.frameTick());
      sc.on('vehicleHint', () => {});
    },

    buildingAction(kind) {
      if (kind === 'showroom') this.showroomModal();
      else if (kind === 'rapid') this.openSerial();
      else if (kind === 'decorate') this.openSheet('decorate');
      else if (kind === 'villages') this.openSheet('villages');
      else this.openSheet('shop');
    },

    /* ================= missions ================= */
    bindMissions() {
      const M = MV.Missions;
      if (!M) return;
      M.init(this.scene);
      M.on('start', (o) => { this.mission = o; this.renderMissionHud(); this.toast(t('mis.started', { name: t(o.titleKey) })); });
      M.on('objective', (o) => { this.mission = o; this.renderMissionHud(); });
      M.on('tick', (o) => { this.mission = o; });
      M.on('complete', (p) => this.missionComplete(p));
      M.on('expire', () => { this.mission = null; this.renderMissionHud(); this.toast(t('mis.expired')); });
      M.on('star', (p) => this.onStar(p));
      M.on('preview', (p) => this.showPromo(p));
    },

    missionComplete(p) {
      this.confetti(46);
      this.burstScreen(window.innerWidth / 2, window.innerHeight * .42);
      const name = t('mis.' + p.type);
      const extra = p.bonus && p.bonus.kind === 'orn' ? ' + ' + MV.I18n.itemName(p.bonus.id) : '';
      this.toast(t('mis.completed', { name, coins: fmt(p.coins), xp: p.xp }) + extra, 3200);
      this.bubble('★ ' + t('mis.starUp'), window.innerWidth / 2, window.innerHeight * .5);
      if (p.level && S().level() > (this._lastLevel || 1)) {
        this._lastLevel = S().level();
        setTimeout(() => this.toast(t('mis.levelUp', { n: S().level() })), 900);
      }
    },

    onStar(p) {
      this.updateStars(p.stars, p.up);
      if (p.up && p.stars >= 2) {
        this.scene.pops.push({ x: this.scene.avatar.x + 20, y: this.scene.avatar.y - 70, text: '★'.repeat(p.stars), life: 1.5 });
        const lines = ['npc.star1', 'npc.star2', 'npc.star3', 'npc.star4', 'npc.star5'];
        const key = lines[Math.min(4, p.stars - 1)];
        this.toast(t(key), 2000);
      }
    },

    renderMissionHud(force) {
      const el = $('#missionHud');
      const o = this.mission;
      if (!o) { el.hidden = true; return; }
      el.hidden = false;
      $('#mhIco').textContent = o.icon || '!';
      $('#mhTitle').textContent = t(o.titleKey);
      $('#mhSub').textContent = t(o.subKey);
      $('#mhDist').textContent = o.dist + 'm';
      $('#mhTime').textContent = mmss(o.t);
      const fill = $('#mhBarFill');
      if (o.progress != null) {
        fill.style.width = Math.round(o.progress * 100) + '%';
        fill.style.background = 'linear-gradient(90deg,#a7dfcb,#4fa78c)';
      } else {
        fill.style.width = Math.max(2, Math.round((o.t / o.total) * 100)) + '%';
        fill.style.background = o.t / o.total < .25 ? 'linear-gradient(90deg,#ff9b8a,#f0715c)' : 'linear-gradient(90deg,#ffd166,#f2b54b)';
      }
      el.classList.toggle('warn', o.t / o.total < .22);
    },

    /* ================= world hud / radar ================= */
    bindWorld() {
      const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.innerWidth < 900;
      if (isTouch) document.body.classList.add('touch-on');

      /* minimap tap = full map */
      $('#radar').addEventListener('click', (e) => {
        if (e.target.closest('#mapBtn') || e.target.id === 'minimap' || e.target.closest('.radar')) {
          if (e.target.closest('#mapBtn')) { this.toggleMap(); return; }
          this.toggleMap();
        }
      });
      $('#mapBtn').addEventListener('click', (e) => { e.stopPropagation(); this.toggleMap(); });
      $('#mapClose').addEventListener('click', () => this.closeMap());
      $('#mapOverlay').addEventListener('click', (e) => { if (e.target.id === 'mapOverlay') this.closeMap(); });

      /* vehicle prompt */
      $('#vehEnter').addEventListener('click', () => {
        if (this.scene.vehicle) this.scene.exitVehicle(false);
        else {
          const v = this.scene.nearestVehicle(130);
          if (v) this.scene.enterVehicle(v);
        }
      });
      $('#vehExit').addEventListener('click', () => this.scene.exitVehicle(false));
      $('#hornBtn').addEventListener('click', () => this.scene.horn());

      /* touch joystick */
      const joy = $('#joystick'), knob = $('#joyKnob');
      let joyId = null;
      const setJoy = (ev) => {
        const r = joy.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = (ev.clientX - cx) / (r.width * .36);
        let dy = (ev.clientY - cy) / (r.height * .36);
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        this.scene.joy = { x: dx, y: dy, active: true };
        knob.style.transform = 'translate(' + (dx * r.width * .3) + 'px,' + (dy * r.height * .3) + 'px)';
      };
      joy.addEventListener('pointerdown', (e) => {
        joyId = e.pointerId;
        try { joy.setPointerCapture(e.pointerId); } catch (err) {}
        setJoy(e);
        e.preventDefault();
      });
      joy.addEventListener('pointermove', (e) => { if (joyId === e.pointerId) { setJoy(e); e.preventDefault(); } });
      const endJoy = () => {
        joyId = null;
        this.scene.joy = { x: 0, y: 0, active: false };
        knob.style.transform = '';
      };
      joy.addEventListener('pointerup', endJoy);
      joy.addEventListener('pointercancel', endJoy);
      $('#tAction').addEventListener('click', () => this.scene.toggleVehicle());
      $('#tMap').addEventListener('click', () => this.toggleMap());

      /* promo card */
      $('#pcClose').addEventListener('click', () => this.hidePromo());
      $('#promoCard').addEventListener('click', (e) => {
        if (e.target.closest('[data-pc="keep"]')) this.hidePromo();
      });

      /* full map click → ping */
      $('#fullmap').addEventListener('click', (e) => {
        const cv = $('#fullmap');
        const r = cv.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width * MV.World.W;
        const y = (e.clientY - r.top) / r.height * MV.World.H;
        this.waypoint = { x, y };
        this.scene.waypoint = this.waypoint;
        this.toast(t('map.ping'));
        this.drawFullMap();
      });
    },

    frameTick() {
      const now = performance.now();
      if (now - this.lastMini > 90) {
        this.lastMini = now;
        this.drawRadar();
        this.renderMissionHud();
        this.updateSpeed();
        this.updateVehiclePrompt();
      }
    },

    drawRadar() {
      const cv = $('#minimap');
      if (!cv) return;
      const ctx = cv.getContext('2d');
      this.scene.drawMini(ctx, cv.width, cv.height);
    },

    updateSpeed() {
      const v = this.scene.vehicle;
      const hud = $('#driveHud');
      if (!v) { if (!hud.hidden) hud.hidden = true; return; }
      hud.hidden = false;
      const kmh = Math.round(Math.abs(v.speed) * .36);
      $('#speedVal').textContent = kmh;
      const tl = $('#testLeft');
      if (v.testLeft != null && v.testLeft > 0) {
        tl.hidden = false;
        tl.textContent = Math.ceil(v.testLeft) + 's';
      } else tl.hidden = true;
    },

    updateVehiclePrompt() {
      const v = this.scene.vehicle ? null : this.scene.nearestVehicle(120);
      const el = $('#vehiclePrompt');
      if (!v) { if (!el.hidden) el.hidden = true; return; }
      el.hidden = false;
      $('#vehName').textContent = (C().vehicle(v.id) ? MV.I18n.vehicleName(v.id) : v.id) + ' · ' + t('veh.enter');
    },

    onVehicle(v) {
      document.body.classList.toggle('driving', !!v.on);
      $('#driveHud').hidden = !v.on;
      $('#vehiclePrompt').hidden = true;
      if (v.on) {
        if (v.test) this.toast(t('veh.testStart', { n: 30 }), 2600);
        else this.toast(t('veh.enterToast', { name: MV.I18n.vehicleName(v.id) }));
      } else {
        this.toast(t('veh.exitToast'));
      }
    },

    showDistrict(d) {
      const el = $('#districtTag');
      const key = d.key || ('dist.' + d.id);
      $('#dtName').textContent = t(key);
      $('#dtSub').textContent = t(key + '.sub');
      el.hidden = false;
      el.classList.remove('out');
      clearTimeout(this._dtT);
      this._dtT = setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 620);
      }, 2200);
      if (this.mapOpen) this.drawFullMap();
    },

    /* ================= full map ================= */
    toggleMap() { this.mapOpen ? this.closeMap() : this.openMap(); },
    openMap() {
      this.mapOpen = true;
      $('#mapOverlay').hidden = false;
      this.renderLegend();
      this.drawFullMap();
      document.body.classList.add('map-open');
    },
    closeMap() {
      this.mapOpen = false;
      $('#mapOverlay').hidden = true;
      document.body.classList.remove('map-open');
    },
    drawFullMap() {
      const cv = $('#fullmap');
      if (!cv) return;
      const ctx = cv.getContext('2d');
      this.scene.drawMini(ctx, cv.width, cv.height, { sweep: false });
      const sx = cv.width / MV.World.W, sy = cv.height / MV.World.H;
      ctx.save();
      /* landmark labels */
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      (this.scene.plan.landmarks || []).forEach(l => {
        const x = l.x * sx, y = l.y * sy;
        ctx.fillStyle = 'rgba(20,18,34,.72)';
        const label = t(l.key);
        const w = ctx.measureText(label).width + 12;
        MOA_round(ctx, x - w / 2, y - 10, w, 18, 9); ctx.fill();
        ctx.fillStyle = '#fff8ea';
        ctx.fillText(label, x, y);
      });
      /* district names */
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.globalAlpha = .32;
      ctx.fillStyle = '#fff8ea';
      (this.scene.plan.districts || []).forEach(d => {
        ctx.fillText(t(d.key), (d.x + d.w / 2) * sx, (d.y + d.h / 2) * sy);
      });
      ctx.globalAlpha = 1;
      /* waypoint */
      if (this.waypoint) {
        const x = this.waypoint.x * sx, y = this.waypoint.y * sy;
        ctx.strokeStyle = '#8cc8b4'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 10); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
    },
    renderLegend() {
      const el = $('#mapLegend');
      if (!el) return;
      const items = [['#fff8ea', 'map.you'], ['#ffd166', 'map.mission'], ['#ffe3a3', 'map.vehicles'], ['#cbb6ff', 'map.ornaments'], ['#d2e6ff', 'map.npcs']];
      el.innerHTML = items.map(([c, k]) => '<span><i style="background:' + c + '"></i>' + esc(t(k)) + '</span>').join('') +
        '<span style="opacity:.7">' + esc(t('map.sub')) + '</span>';
    },

    /* ================= promo preview ================= */
    showPromo(p) {
      const o = C().orn(p.item);
      const set = C().RAPID.sets.find(s => s.id === p.set);
      const perks = (set && set.perks || []).slice(0, 3).map(k => t(k)).join(' · ');
      const el = $('#promoCard');
      const art = o ? C().spriteData(o.art) : '';
      $('#pcBody').innerHTML = `
        <div class="pc-kicker">${esc(t('preview.kicker'))}</div>
        ${art ? `<img class="pc-thumb" alt="" src="${art}">` : ''}
        <h4>💎 ${esc(p.setName || '')}</h4>
        <div class="pc-set">${esc(p.perks ? p.perks : perks)}</div>
        <div class="pc-perks">${(set && set.perks || []).slice(0, 3).map(k => '<span>' + esc(t(k)) + '</span>').join('')}</div>
        <div class="pc-actions">
          <a class="btn gold" href="${esc(p.url || RAPID_URL)}" target="_blank" rel="noopener">${esc(t('preview.view'))}</a>
          <button class="btn ghost" data-pc="keep">${esc(t('preview.keep'))}</button>
        </div>`;
      el.hidden = false;
      el.classList.remove('out');
      this.promo = p;
      clearTimeout(this._promoT);
      this._promoT = setTimeout(() => this.hidePromo(), 11000);
    },
    hidePromo() {
      const el = $('#promoCard');
      if (!el) return;
      el.hidden = true;
      this.promo = null;
      clearTimeout(this._promoT);
    },

    /* ================= serial / rapid ================= */
    openSerial(prefill) {
      this.openModal(`
        <h3>💎 ${esc(t('serial.title'))}</h3>
        <p class="lead">${esc(t('serial.sub'))}</p>
        <div class="serial-row">
          <input type="text" id="serIn" autocapitalize="characters" autocomplete="off" placeholder="${esc(t('rapid.placeholder'))}" value="${esc(prefill || '')}">
          <button class="btn sm coral" data-mact="redeem">${esc(t('rapid.unlock'))}</button>
        </div>
        <div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap">
          <button class="btn sm mint" data-mact="trial">🎟 ${esc(t('rapid.trialTry'))}</button>
          <a class="btn sm ghost" href="${RAPID_URL}" target="_blank" rel="noopener">💎 ${esc(t('rapid.creatorShort'))} ↗</a>
        </div>
        <div class="trial" style="margin-top:12px">🔑 ${esc(t('rapid.trialTitle'))} — <code>${C().RAPID.trialCode}</code><br><span style="opacity:.8">${esc(t('rapid.trialSub'))}</span></div>
        <button class="btn wide ghost" style="margin-top:10px" data-mact="close">${esc(t('common.close'))}</button>
      `);
      const card = $('#modalCard');
      const input = card.querySelector('#serIn');
      const doRedeem = (code) => {
        const r = S().redeem(code);
        if (!r.ok) { this.toast(r.reason === 'already' ? t('rapid.already') : t('rapid.invalid')); return; }
        this.closeModal();
        this.confetti(60);
        this.parcel();
        const names = r.items.map(i => MV.I18n.itemName(i))
          .concat((r.pets || []).map(i => MV.I18n.petName(i)))
          .concat((r.rides || []).map(i => MV.I18n.rideName(i))).join(', ');
        this.toast(r.creator ? t('rapid.creatorOk') : r.trial ? t('gift.claimed', { name: names }) : t('rapid.success', { name: r.name || names }), 3400);
        this.scene.spawnVehicles();
        this.scene.syncPets(false);
        this.updateHud();
        setTimeout(() => { if (this.sheetName) this.openSheet(this.sheetName, this._sheetOpts, true); }, 300);
      };
      card.querySelector('[data-mact="redeem"]').addEventListener('click', () => {
        const code = (input.value || '').trim();
        if (!code) return;
        doRedeem(code);
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doRedeem((input.value || '').trim()); } });
      card.querySelector('[data-mact="trial"]').addEventListener('click', () => doRedeem(C().RAPID.trialCode));
      card.querySelector('[data-mact="close"]').addEventListener('click', () => this.closeModal());
    },

    showroomModal() {
      const sets = C().RAPID.sets;
      const perks = ['perk.supercar', 'perk.sleigh', 'perk.rabbit', 'perk.coins2', 'perk.orn4'];
      this.openModal(`
        <div style="display:flex;align-items:center;gap:8px">
          <div style="font-size:1.7em">🏎️</div>
          <div><h3>${esc(t('showroom.title'))}</h3><p class="lead" style="margin:0">${esc(t('showroom.sub'))}</p></div>
        </div>
        <div class="set-orn" style="margin:12px 0 8px">
          <span class="o" style="width:52px;height:52px"><img class="spr" alt="" src="${C().rideData('supercar')}"></span>
          <span class="o" style="width:52px;height:52px"><img class="spr" alt="" src="${C().rideData('sleigh')}"></span>
          ${sets.map(s => { const o = C().orn(s.items[0]); return `<span class="o" style="width:52px;height:52px"><img class="spr" alt="" src="${C().spriteData(o.art)}"></span>`; }).join('')}
        </div>
        <div class="pc-perks" style="margin:0 0 10px">${perks.map(k => '<span>' + esc(t(k)) + '</span>').join('')}</div>
        <p class="muted tiny">${esc(t('showroom.note'))}</p>
        <div class="modal-actions" style="flex-wrap:wrap">
          <button class="btn sm gold" data-mact="testcar">🏎 ${esc(t('showroom.testCar'))}</button>
          <button class="btn sm mint" data-mact="testsleigh">🛷 ${esc(t('showroom.testSleigh'))}</button>
        </div>
        <div class="modal-actions" style="margin-top:8px">
          <a class="btn sm" href="${RAPID_URL}" target="_blank" rel="noopener">💎 ${esc(t('showroom.browse'))}</a>
          <button class="btn sm ghost" data-mact="serial">🔑 ${esc(t('showroom.serial'))}</button>
        </div>
        <button class="btn wide ghost" style="margin-top:8px" data-mact="close">${esc(t('common.close'))}</button>
      `);
      const card = $('#modalCard');
      const test = (id) => {
        this.closeModal();
        const v = this.scene.vehicles.find(x => x.id === id);
        if (!v) return;
        this.scene.warp(v.x - 50, v.y + 40);
        setTimeout(() => this.scene.enterVehicle(v), 260);
      };
      card.querySelector('[data-mact="testcar"]').addEventListener('click', () => test('supercar'));
      card.querySelector('[data-mact="testsleigh"]').addEventListener('click', () => test('sleigh'));
      card.querySelector('[data-mact="serial"]').addEventListener('click', () => this.openSerial());
      card.querySelector('[data-mact="close"]').addEventListener('click', () => this.closeModal());
    },

    testDriveEnd() {
      this.openModal(`
        <div style="text-align:center;font-size:2em">🏎️</div>
        <h3 style="text-align:center">${esc(t('testdrive.title'))}</h3>
        <p class="lead" style="text-align:center">${esc(t('testdrive.body'))}</p>
        <div class="pc-perks" style="justify-content:center">${['perk.supercar', 'perk.sleigh', 'perk.coins2'].map(k => '<span>' + esc(t(k)) + '</span>').join('')}</div>
        <div class="modal-actions">
          <a class="btn coral" href="${RAPID_URL}" target="_blank" rel="noopener" style="flex:1">💎 ${esc(t('testdrive.unlock'))}</a>
          <button class="btn ghost" data-mact="keep" style="flex:1">${esc(t('testdrive.keep'))}</button>
        </div>
      `);
      const card = $('#modalCard');
      card.querySelector('[data-mact="keep"]').addEventListener('click', () => this.closeModal());
    },

    profileModal() {
      const st = S().state;
      this.openModal(`
        <h3>${esc(t('profile.title'))}</h3>
        <p class="lead">${esc(t('profile.sub'))}</p>
        <div class="kv"><span>${esc(t('profile.level'))}</span><b>Lv. ${S().level()}</b></div>
        <div class="kv"><span>${esc(t('profile.xp'))}</span><b>${fmt(st.xp)} / ${fmt(S().level() * 300)}</b></div>
        <div class="kv"><span>${esc(t('profile.missions'))}</span><b>${fmt(st.missionsDone)}</b></div>
        <div class="kv"><span>${esc(t('profile.vip'))}</span><b>${st.vip ? 'ON ×2' : '—'}</b></div>
        <div class="modal-actions" style="margin-top:12px">
          <a class="btn sm gold" href="${RAPID_URL}" target="_blank" rel="noopener">💎 ${esc(t('rapid.title'))}</a>
          <button class="btn sm ghost" data-mact="close">${esc(t('common.close'))}</button>
        </div>
      `);
      $('#modalCard').querySelector('[data-mact="close"]').addEventListener('click', () => this.closeModal());
    },

    hypeModal() {
      this.openModal(`
        <h3>⭐ ${esc(t('hype.title'))}</h3>
        <p class="lead">${esc(t('hype.sub'))}</p>
        <div class="kv"><span>${esc(t('hype.now'))}</span><b>${'★'.repeat(this.stars) || '—'}</b></div>
        <div class="kv"><span>${esc(t('hype.how'))}</span><b>${esc(t('hype.howTxt'))}</b></div>
        <button class="btn wide ghost" style="margin-top:12px" data-mact="close">${esc(t('common.close'))}</button>
      `);
      $('#modalCard').querySelector('[data-mact="close"]').addEventListener('click', () => this.closeModal());
    },

    /* ================= toast / bubble / fx ================= */
    toast(msg, ms) {
      const w = $('#toastWrap');
      const d = document.createElement('div');
      d.className = 'toast';
      d.textContent = msg;
      w.appendChild(d);
      setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 320); }, ms || 2200);
    },

    bubble(text, x, y) {
      const layer = $('#bubbleLayer');
      const old = layer.querySelectorAll('.speech');
      if (old.length > 2) old[0].remove();
      const d = document.createElement('div');
      d.className = 'speech';
      d.textContent = text;
      d.style.left = (x / (this.scene.W || 1)) * 100 + '%';
      d.style.top = (y / (this.scene.H || 1)) * 100 + '%';
      layer.appendChild(d);
      setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 280); }, 2600);
    },

    burst(nx, ny) {
      const p = this.scene.screenOf(nx, ny);
      this.burstScreen(p.x, p.y);
    },

    burstScreen(x, y) {
      const layer = $('#fxLayer');
      const colors = ['#ffe08a', '#f2b54b', '#8cc8b4', '#f4839e', '#b9aef0'];
      for (let i = 0; i < 9; i++) {
        const d = document.createElement('div');
        d.className = 'fx-burst';
        d.style.left = x + 'px'; d.style.top = y + 'px';
        d.style.background = colors[i % colors.length];
        const ang = Math.random() * Math.PI * 2, dist = 24 + Math.random() * 46;
        d.animate([
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist - 18}px) scale(.2)`, opacity: 0 }
        ], { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' });
        layer.appendChild(d);
        setTimeout(() => d.remove(), 1050);
      }
    },

    confetti(n) {
      const layer = $('#fxLayer');
      const colors = ['#ffd47e', '#f0715c', '#8cc8b4', '#b9aef0', '#fff3d6'];
      for (let i = 0; i < (n || 40); i++) {
        const d = document.createElement('div');
        d.className = 'fx-confetti';
        d.style.left = Math.random() * 100 + '%';
        d.style.top = (-10 - Math.random() * 20) + '%';
        d.style.background = colors[i % colors.length];
        d.style.setProperty('--spin', (Math.random() * 900 - 450) + 'deg');
        d.style.animationDuration = (1.4 + Math.random() * 1.4) + 's';
        d.style.animationDelay = (Math.random() * .35) + 's';
        layer.appendChild(d);
        setTimeout(() => d.remove(), 3200);
      }
    },

    parcel() {
      const layer = $('#fxLayer');
      const d = document.createElement('div');
      d.className = 'fx-parcel';
      d.textContent = '🎁';
      layer.appendChild(d);
      setTimeout(() => d.remove(), 1600);
    },

    tip(text) {
      const el = $('#tip');
      $('#tipText').innerHTML = text;
      el.classList.remove('hide');
      clearTimeout(this._tipT);
      this._tipT = setTimeout(() => el.classList.add('hide'), 5200);
    },

    tipTimer() {
      const tips = ['tip.start', 'tip.drive', 'tip.decorate', 'tip.map', 'tip.gift'];
      let i = 0;
      const show = () => { this.tip(t(tips[i % tips.length])); i++; };
      setTimeout(show, 1800);
      setInterval(() => { if (!document.hidden) show(); }, 30000);
    },

    /* ================= sheets ================= */
    openSheet(name, opts, silent) {
      this.sheetName = name;
      this._sheetOpts = opts || {};
      const map = {
        villages: ['villages.title', 'villages.sub', this.panelVillages],
        shop: ['shop.title', 'shop.sub', this.panelShop],
        decorate: ['decorate.title', 'decorate.sub', this.panelDecorate],
        friends: ['friends.title', 'friends.sub', this.panelFriends],
        rapid: ['rapid.title', 'rapid.sub', this.panelRapid]
      };
      const row = map[name];
      if (!row) return;
      $('#sheetTitle').textContent = t(row[0]);
      $('#sheetSub').textContent = t(row[1]);
      const body = $('#sheetBody');
      const scroll = silent ? body.scrollTop : 0;
      body.innerHTML = row[2].call(this, this._sheetOpts || {});
      body.scrollTop = scroll;
      this.bindPanel(body, name);
      $('#sheet').classList.add('open');
      $('#scrim').classList.add('on');
      document.body.classList.add('sheet-open');
      $$('#dock .dock-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
      if (!silent) $('#sheet').classList.add('bump');
      setTimeout(() => $('#sheet').classList.remove('bump'), 400);
    },

    closeSheet() {
      this.sheetName = null;
      $('#sheet').classList.remove('open');
      $('#scrim').classList.remove('on');
      document.body.classList.remove('sheet-open');
      $$('#dock .dock-btn').forEach(b => b.classList.remove('active'));
      $('#weatherBar').classList.remove('open');
    },

    /* ---------- villages ---------- */
    panelVillages() {
      const st = S().state;
      const cards = C().VILLAGES.map(v => {
        const unlocked = st.unlocked.indexOf(v.id) >= 0;
        const cur = st.village === v.id;
        const cost = v.cost;
        const pal = v.palette;
        const thumb = `background:linear-gradient(180deg,${pal.skyTop} 0%,${pal.skyMid} 42%,${pal.ground} 58%,${pal.ground2} 100%)`;
        const action = cur
          ? `<span class="pill">${esc(t('villages.current'))}</span>`
          : unlocked
            ? `<button class="btn sm" data-act="switch" data-id="${v.id}">${esc(t('villages.switch'))}</button>`
            : `<button class="btn sm gold" data-act="unlock" data-id="${v.id}">${esc(t('villages.unlock'))} · ${cost}</button>`;
        return `<div class="village-card ${cur ? 'cur' : ''}">
          <div class="vthumb" style="${thumb}"><span style="position:absolute;inset:0;display:grid;place-items:center;font-size:1.7em;text-shadow:0 2px 6px rgba(0,0,0,.18)">${v.emoji}</span></div>
          <div class="vinfo">
            <b>${esc(t('v.' + v.id + '.name'))} ${unlocked ? '' : '🔒'}</b>
            <span>${esc(t('v.' + v.id + '.desc'))}</span>
            <span style="margin-top:5px">${cur ? '' : unlocked ? esc(t('villages.owned')) : esc(t('villages.unlockCost', { n: fmt(cost) }))}</span>
          </div>
          <div class="vact">${action}</div>
        </div>`;
      }).join('');
      const placed = S().placedCount();
      return `<div class="village-list">${cards}</div>
        <div class="section">
          <div class="section-title"><h3>${esc(t('decorate.scene'))}</h3><span class="sub">${placed}/${S().maxPlacements()}</span></div>
          <p class="muted tiny">${esc(t('app.tagline'))}</p>
        </div>`;
    },

    /* ---------- shop ---------- */
    panelShop(opts) {
      const st = S().state;
      const tab = opts.tab || this._shopTab || 'all';
      this._shopTab = tab;
      const disc = S().discount();
      const trendIds = this.trend.items.map(x => x.id);

      const tabs = [['all', 'shop.all'], ['orn', 'shop.orn'], ['pet', 'shop.pet'], ['ride', 'shop.ride']]
        .map(([k, key]) => `<button data-act="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${esc(t(key))}</button>`).join('');

      let html = `<div class="tabs">${tabs}</div>`;
      if (disc > 0) html += `<div class="coop-badge" style="margin-bottom:10px">🎉 ${esc(t('shop.discountOn'))}</div>`;

      const ornAllowed = tab === 'all' || tab === 'orn';
      if (ornAllowed) {
        let list = C().ORN.slice();
        list.sort((a, b) => {
          const ta = trendIds.indexOf(a.id), tb = trendIds.indexOf(b.id);
          if (ta >= 0 && tb >= 0) return ta - tb;
          if (ta >= 0) return -1;
          if (tb >= 0) return 1;
          const ro = { common: 0, rare: 1, limited: 2 };
          return ro[a.rarity] - ro[b.rarity] || (a.price || 0) - (b.price || 0);
        });
        html += `<div class="grid">` + list.map(o => {
          const price = S().priceOf(o.id);
          const own = S().ownCount(o.id);
          const isTrend = trendIds.indexOf(o.id) >= 0;
          const locked = o.rarity === 'limited';
          const badge = o.rarity === 'limited' ? `<span class="pill limited">${esc(t('rarity.limited'))}</span>`
            : o.rarity === 'rare' ? `<span class="pill rare">${esc(t('rarity.rare'))}</span>` : '';
          const trendBadge = isTrend ? `<span class="pill trend">🔥 ${esc(t('shop.trendBadge'))}</span>` : '';
          const priceHtml = locked
            ? `<span class="locked-price" style="color:#8a6bbf">💎 ${esc(t('shop.rapidOnly'))}</span>`
            : `<span>🪙 ${fmt(price)}</span>${disc ? `<del>${fmt(o.price)}</del>` : ''}`;
          return `<button class="item-card ${locked ? 'locked' : ''}" data-act="buy" data-id="${o.id}">
            ${own > 0 ? `<span class="own">${esc(t('shop.owned'))} ×${own}</span>` : ''}
            <div class="thumb"><img alt="" src="${C().spriteData(o.art)}" class="spr"></div>
            <div class="nm">${esc(MV.I18n.itemName(o.id))} ${badge} ${trendBadge}</div>
            <div class="pr">${priceHtml}</div>
          </button>`;
        }).join('') + `</div>`;
      }

      if (tab === 'all' || tab === 'pet') {
        html += `<div class="section"><div class="section-title"><h3>${esc(t('shop.petsTitle'))}</h3><span class="sub">${esc(t('friends.shopHint'))}</span></div><div class="grid">` +
          C().PETS.map(p => {
            const owned = S().hasPet(p.id);
            const active = S().isPetActive(p.id);
            const rapidOnly = p.price == null;
            const price = rapidOnly ? null : Math.round(p.price * (1 - disc) / 5) * 5;
            return `<div class="item-card">
              <div class="thumb"><img alt="" src="${C().petData(p.id)}" class="spr"></div>
              <div class="nm">${esc(MV.I18n.petName(p.id))}</div>
              <div class="pr">${owned ? (active ? `<span class="free">${esc(t('shop.ownedOn'))}</span>` : `<span class="muted">${esc(t('shop.owned'))}</span>`) : rapidOnly ? `<span style="color:#8a6bbf">💎 ${esc(t('shop.rapidOnly'))}</span>` : `<span>🪙 ${fmt(price)}</span>`}</div>
              <div style="margin-top:6px">${owned
                ? `<button class="btn sm ${active ? 'ghost' : 'mint'} wide" data-act="togglePet" data-id="${p.id}">${esc(active ? t('shop.turnOff') : t('shop.turnOn'))}</button>`
                : rapidOnly ? `<button class="btn sm gold wide" data-act="openRapid">${esc(t('rapid.title'))}</button>`
                  : `<button class="btn sm wide" data-act="buyPet" data-id="${p.id}">${esc(t('shop.buy'))}</button>`}</div>
            </div>`;
          }).join('') + `</div></div>`;
      }

      if (tab === 'all' || tab === 'ride') {
        html += `<div class="section"><div class="section-title"><h3>${esc(t('shop.ridesTitle'))}</h3><span class="sub">${esc(t('shop.rideHint'))}</span></div><div class="grid">` +
          C().RIDES.map(r => {
            const owned = S().hasRide(r.id);
            const active = S().isRideActive(r.id);
            const rapidOnly = r.price == null;
            const price = rapidOnly ? null : Math.round(r.price * (1 - disc) / 5) * 5;
            return `<div class="item-card">
              <div class="thumb"><img alt="" src="${C().rideData(r.id)}" class="spr"></div>
              <div class="nm">${esc(MV.I18n.rideName(r.id))}</div>
              <div class="pr">${owned ? (active ? `<span class="free">${esc(t('shop.ownedOn'))}</span>` : `<span class="muted">${esc(t('shop.owned'))}</span>`) : rapidOnly ? `<span style="color:#8a6bbf">💎 ${esc(t('shop.rapidOnly'))}</span>` : `<span>🪙 ${fmt(price)}</span>`}</div>
              <div style="margin-top:6px">${owned
                ? `<button class="btn sm ${active ? 'ghost' : 'mint'} wide" data-act="toggleRide" data-id="${r.id}">${esc(active ? t('shop.turnOff') : t('shop.turnOn'))}</button>`
                : rapidOnly ? `<button class="btn sm gold wide" data-act="openRapid">${esc(t('rapid.title'))}</button>`
                  : `<button class="btn sm wide" data-act="buyRide" data-id="${r.id}">${esc(t('shop.buy'))}</button>`}</div>
            </div>`;
          }).join('') + `</div></div>`;
      }

      html += `<div class="section"><button class="btn ghost wide" data-act="showroom">🏎 ${esc(t('showroom.title'))} →</button></div>`;
      html += `<div class="section"><a class="btn gold wide" href="${RAPID_URL}" target="_blank" rel="noopener">💎 ${esc(t('rapid.creatorShort'))} ↗</a></div>`;
      return html;
    },

    /* ---------- decorate ---------- */
    panelDecorate() {
      const st = S().state;
      const inv = st.inv || {};
      const ids = Object.keys(inv).filter(id => inv[id] > 0 && C().orn(id));
      const tray = ids.length ? `<div class="tray">` + ids.map(id => {
        const o = C().orn(id);
        const sel = this.scene.pendingItem === id && this.scene.mode === 'place';
        return `<div class="tray-item ${sel ? 'sel' : ''}" data-act="pick" data-id="${id}">
          <span class="cnt">×${inv[id]}</span>
          <div class="thumb"><img alt="" src="${C().spriteData(o.art)}" class="spr"></div>
          <b>${esc(MV.I18n.itemName(id))}</b>
        </div>`;
      }).join('') + `</div>` : `<div class="empty">${esc(t('decorate.empty'))}</div>`;

      const placed = S().state.deco[st.village] || [];
      const placedHtml = placed.length ? placed.map(p => {
        const o = C().orn(p.id);
        return `<div class="tray-item">
          <div class="thumb"><img alt="" src="${C().spriteData(o.art)}" class="spr"></div>
          <b>${esc(MV.I18n.itemName(p.id))}</b>
          <div class="mini">
            <button data-act="move" data-uid="${p.uid}">${esc(t('decorate.move'))}</button>
            <button data-act="retrieve" data-uid="${p.uid}">${esc(t('decorate.retrieve'))}</button>
            <button data-act="giftOne" data-id="${p.id}">🎁</button>
          </div>
        </div>`;
      }).join('') : `<div class="empty">${esc(t('decorate.tapItem'))}</div>`;

      return `<div class="section">
          <div class="section-title"><h3>${esc(t('decorate.tray'))}</h3><span class="sub">${placed.length}/${S().maxPlacements()} ${esc(t('decorate.scene'))}</span></div>
          ${tray}
          <p class="muted tiny" style="margin-top:9px">${esc(t('decorate.sub2'))}</p>
        </div>
        <div class="section">
          <div class="section-title"><h3>${esc(t('decorate.scene'))}</h3></div>
          <div class="tray">${placedHtml}</div>
        </div>`;
    },

    /* ---------- friends ---------- */
    panelFriends() {
      const st = S().state;
      const link = S().referralLink(location.origin + location.pathname);
      const friends = st.friends.slice().reverse();
      const friendRows = friends.length ? friends.map(f =>
        `<div class="friend-row"><span class="av">${esc(f.emoji || '🐣')}</span><b>${esc(f.name)}</b><span class="muted tiny" style="margin-left:auto">+60 🪙</span></div>`
      ).join('') : `<div class="empty">${esc(t('friends.noFriends'))}</div>`;

      const c = st.coop;
      let coopHtml = '';
      if (!c) {
        coopHtml = `<p class="muted tiny">${esc(t('friends.coopNone'))}</p>
          <button class="btn coral wide" style="margin-top:10px" data-act="coopStart">🤝 ${esc(t('friends.coopJoin'))}</button>`;
      } else {
        const pct = Math.min(100, Math.round(c.joined / c.max * 100));
        const remain = Math.max(0, c.max - c.joined);
        coopHtml = `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span class="pill ${c.mine ? 'trend' : ''}">${esc(c.mine ? t('friends.coopOwner') : t('friends.coopGuest'))} · ${esc(c.code)}</span>
            ${c.unlocked ? `<span class="coop-badge">40% OFF</span>` : ''}
          </div>
          <div class="gauge ${c.unlocked ? 'full' : ''}"><i style="width:${pct}%"></i></div>
          <div class="gauge-cap"><span>${esc(t('friends.coopGauge', { n: c.joined, max: c.max }))}</span><span>${c.unlocked ? esc(t('friends.coopReady')) : esc(t('friends.coopNeed', { n: remain }))}</span></div>
          <div class="link-box">${esc(S().coopLink(location.origin + location.pathname))}</div>
          <div style="display:flex;gap:7px;margin-top:9px;flex-wrap:wrap">
            <button class="btn sm ghost" data-act="copyCoop">🔗 ${esc(t('friends.coopLink'))}</button>
            ${c.joined < c.max ? `<button class="btn sm mint" data-act="coopSim">+ ${esc(t('friends.coopSim'))}</button>` : ''}
          </div>
          ${c.unlocked ? `<div class="coop-rapid">
            <b>💎 ${esc(t('friends.rapidTitle'))}</b>
            <span>${esc(t('friends.rapidBanner'))}</span>
            <div style="display:flex;gap:7px;margin-top:8px;flex-wrap:wrap">
              <a class="btn sm gold" href="${RAPID_URL}" target="_blank" rel="noopener">${esc(t('rapid.creatorShort'))} ↗</a>
              <button class="btn sm ghost" data-act="serialOpen">🔑 ${esc(t('rapid.serialTitle'))}</button>
            </div>
          </div>` : ''}`;
      }

      return `
        <div class="card" style="padding:13px">
          <div class="section-title" style="margin-bottom:2px"><h3>🎁 ${esc(t('friends.refTitle'))}</h3><span class="sub">${esc(t('friends.reward', { n: 60 }))}</span></div>
          <p class="muted tiny">${esc(t('friends.refSub'))}</p>
          <div class="code-box">
            <span class="code">${esc(st.code)}</span>
            <button class="btn sm coral" data-act="copyRef">${esc(t('friends.copy'))}</button>
          </div>
          <div class="link-box">${esc(link)}</div>
          <div style="display:flex;gap:7px;margin-top:10px">
            <button class="btn sm wide" data-act="simFriend">+ ${esc(t('friends.simulate'))}</button>
          </div>
          <div class="section-title" style="margin-top:14px"><h3>${esc(t('friends.invites', { n: friends.length }))}</h3></div>
          ${friendRows}
        </div>

        <div class="section card" style="padding:13px">
          <div class="section-title" style="margin-bottom:2px"><h3>🤝 ${esc(t('friends.coopTitle'))}</h3>${c && c.unlocked ? `<span class="coop-badge">40%</span>` : ''}</div>
          <p class="muted tiny">${esc(t('friends.coopSub'))}</p>
          <div style="margin-top:9px">${coopHtml}</div>
        </div>
        <p class="muted tiny" style="margin-top:10px">${esc(t('friends.shopHint'))}</p>`;
    },

    /* ---------- rapid ---------- */
    panelRapid() {
      const st = S().state;
      const cr = C().RAPID.creator;
      const creatorHtml = `
        <div class="creator-card">
          <div class="cc-glow"></div>
          <div class="cc-kicker">OFFICIAL BUNDLE · LATPEED</div>
          <h4>${esc(C().setName({ name: cr.name }))} <span class="cc-price">₩${fmt(cr.price)}</span></h4>
          <p class="cc-desc">${esc(t('rapid.creatorDesc'))}</p>
          <div class="pc-perks">${cr.perks.map(k => '<span>' + esc(t(k)) + '</span>').join('')}</div>
          <div class="cc-actions">
            <a class="btn gold" href="${cr.url}" target="_blank" rel="noopener">💎 ${esc(t('rapid.creatorBuy'))} ↗</a>
            <button class="btn ghost" data-act="serialOpen">🔑 ${esc(t('rapid.enterCode'))}</button>
          </div>
          <div class="cc-code">🔑 ${esc(t('rapid.bundleCode'))} <code>${cr.code}</code></div>
        </div>`;

      const sets = C().RAPID.sets.map(set => {
        const owned = set.items.every(i => S().ownCount(i) > 0) &&
          (set.pets || []).every(id => S().hasPet(id)) && (set.rides || []).every(id => S().hasRide(id));
        const thumbs = set.items.map(id => {
          const o = C().orn(id);
          return `<span class="o" title="${esc(MV.I18n.itemName(id))}"><img alt="" src="${C().spriteData(o.art)}" class="spr"></span>`;
        }).join('') +
          (set.pets || []).map(id => `<span class="o pet" title="${esc(MV.I18n.petName(id))}"><img alt="" src="${C().petData(id)}" class="spr"></span>`).join('') +
          (set.rides || []).map(id => `<span class="o ride" title="${esc(MV.I18n.rideName(id))}"><img alt="" src="${C().rideData(id)}" class="spr"></span>`).join('');
        return `<div class="set-card">
          <div class="glow" style="background:${set.glow}"></div>
          <h4>💎 ${esc(C().setName(set))} ${owned ? `<span class="pill">${esc(t('rapid.owned'))}</span>` : ''}</h4>
          <div class="set-desc">${esc(C().setDesc(set))}</div>
          <div class="set-orn">${thumbs}</div>
          <div class="pc-perks">${(set.perks || []).map(k => '<span>' + esc(t(k)) + '</span>').join('')}</div>
          <div class="set-foot">
            <span class="set-price">₩${fmt(set.price)}<small>Rapid</small></span>
            <a class="btn sm gold" href="${set.buyUrl}" target="_blank" rel="noopener">${esc(t('rapid.buy'))} ↗</a>
          </div>
          <div class="set-note">🔑 ${esc(t('rapid.serialSub'))}</div>
        </div>`;
      }).join('');

      return `${creatorHtml}
        ${sets}
        <div class="section card" style="padding:13px">
          <div class="section-title" style="margin-bottom:2px"><h3>${esc(t('rapid.serialTitle'))}</h3></div>
          <p class="muted tiny">${esc(t('rapid.serialSub'))}</p>
          <div class="serial-row">
            <input type="text" id="serialInput" autocapitalize="characters" autocomplete="off" placeholder="${esc(t('rapid.placeholder'))}">
            <button class="btn sm coral" data-act="redeem">${esc(t('rapid.unlock'))}</button>
          </div>
          <div style="display:flex;gap:7px;margin-top:8px;flex-wrap:wrap">
            <button class="btn sm mint" data-act="trialTry">🎟 ${esc(t('rapid.trialTry'))}</button>
          </div>
          <div class="trial">🔑 ${esc(t('rapid.trialTitle'))} — <code>${C().RAPID.trialCode}</code><br><span style="opacity:.8">${esc(t('rapid.trialSub'))}</span></div>
          <p class="muted tiny" style="margin-top:9px">${esc(t('rapid.configNote'))}</p>
        </div>`;
    },

    /* ---------- panel actions ---------- */
    bindPanel(body, name) {
      body.querySelectorAll('[data-act]').forEach(el => {
        const act = el.dataset.act;
        if (act === 'none') return;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.panelAction(act, el, name);
        });
      });
      if (name === 'rapid') {
        const inp = body.querySelector('#serialInput');
        if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.panelAction('redeem', inp, name); });
      }
    },

    panelAction(act, el, name) {
      const st = S().state;
      if (act === 'tab') {
        this._shopTab = el.dataset.tab;
        this.openSheet('shop', { tab: el.dataset.tab }, true);
      } else if (act === 'switch') {
        const id = el.dataset.id;
        if (S().switchVillage(id)) {
          this.scene.setVillage(C().village(id));
          this.updateVillageChip();
          this.toast(t('villages.switched', { name: t('v.' + id + '.name') }));
          this.openSheet('villages', this._sheetOpts, true);
        }
      } else if (act === 'unlock') {
        const id = el.dataset.id;
        const r = S().unlockVillage(id);
        if (r.ok) {
          this.confetti(34);
          this.toast(t('villages.unlockedMsg', { name: t('v.' + id + '.name') }));
          S().switchVillage(id);
          this.scene.setVillage(C().village(id));
          this.updateVillageChip();
          this.openSheet('villages', this._sheetOpts, true);
        } else {
          this.toast(t('villages.notEnough'));
        }
      } else if (act === 'buy') {
        const id = el.dataset.id;
        const o = C().orn(id);
        if (o.rarity === 'limited') { this.openSheet('rapid'); return; }
        const r = S().buyOrn(id);
        if (r.ok) {
          this.toast(t('shop.bought', { name: MV.I18n.itemName(id) }));
          this.burstScreen(window.innerWidth / 2, window.innerHeight * .5);
        } else if (r.reason === 'coins') {
          this.toast(t('shop.notEnough', { n: fmt(r.need) }));
        }
      } else if (act === 'buyPet') {
        const cfg = C().pet(el.dataset.id);
        const r = S().buyPet(el.dataset.id);
        if (r.ok) { this.toast(t('shop.petOn', { name: MV.I18n.petName(el.dataset.id) })); this.scene.syncPets(false); this.openSheet('shop', this._sheetOpts, true); }
        else if (r.reason === 'rapid') { this.openSheet('rapid'); }
        else this.toast(t('shop.notEnough', { n: fmt(Math.max(0, (cfg ? cfg.price : 0) - st.coins)) }));
      } else if (act === 'togglePet') {
        const on = S().togglePet(el.dataset.id);
        this.scene.syncPets(false);
        this.toast(on ? t('shop.petOn', { name: MV.I18n.petName(el.dataset.id) }) : t('shop.petOff', { name: MV.I18n.petName(el.dataset.id) }));
        this.openSheet('shop', this._sheetOpts, true);
      } else if (act === 'buyRide') {
        const r = S().buyRide(el.dataset.id);
        const rcfg = C().ride(el.dataset.id);
        if (r.ok) { this.toast(t('shop.rideOn', { name: MV.I18n.rideName(el.dataset.id) })); this.scene.spawnVehicles(); this.openSheet('shop', this._sheetOpts, true); }
        else if (r.reason === 'rapid') this.openSheet('rapid');
        else this.toast(t('shop.notEnough', { n: fmt(Math.max(0, (rcfg ? rcfg.price : 0) - st.coins)) }));
      } else if (act === 'toggleRide') {
        const on = S().toggleRide(el.dataset.id);
        this.scene.spawnVehicles();
        this.toast(on ? t('shop.rideOn', { name: MV.I18n.rideName(el.dataset.id) }) : t('shop.rideOff', { name: MV.I18n.rideName(el.dataset.id) }));
        this.openSheet('shop', this._sheetOpts, true);
      } else if (act === 'openRapid') {
        this.openSheet('rapid');
      } else if (act === 'showroom') {
        this.showroomModal();
      } else if (act === 'pick') {
        const id = el.dataset.id;
        if (!(st.inv[id] > 0)) return;
        this.scene.setMode('place', id);
        this.pendingMove = null;
        this.closeSheet();
        this.tip(t('decorate.modeOn'));
        this.toast(t('decorate.placing'));
      } else if (act === 'move') {
        this.pendingMove = el.dataset.uid;
        this.scene.setMode('move', null);
        this.closeSheet();
        this.tip(t('decorate.moving'));
      } else if (act === 'retrieve') {
        const p = S().retrieve(el.dataset.uid);
        if (p) {
          this.toast(t('decorate.retrieved', { name: MV.I18n.itemName(p.id) }));
          this.scene.refreshPlacements();
          this.openSheet('decorate', this._sheetOpts, true);
        }
      } else if (act === 'giftOne') {
        this.giftPicker(el.dataset.id);
      } else if (act === 'copyRef') {
        this.copy(S().referralLink(location.origin + location.pathname), t('friends.copied'));
      } else if (act === 'copyCoop') {
        this.copy(S().coopLink(location.origin + location.pathname), t('friends.copied'));
      } else if (act === 'simFriend') {
        const r = S().addFriend();
        this.toast(t('friends.simulated', { name: r.friend.name, n: r.reward }));
        this.confetti(16);
      } else if (act === 'coopStart') {
        S().startCoop();
        this.toast(t('friends.coopMine'));
        this.openSheet('friends', this._sheetOpts, true);
      } else if (act === 'coopSim') {
        const r = S().coopSim();
        if (r) {
          this.toast(t('friends.coopSimmed', { name: r.friend.name }));
          if (r.coop.unlocked) { this.confetti(44); this.toast(t('friends.rapidBanner'), 3400); }
        }
        this.openSheet('friends', this._sheetOpts, true);
      } else if (act === 'serialOpen') {
        this.openSerial();
      } else if (act === 'trialTry') {
        const r = S().redeem(C().RAPID.trialCode);
        if (r.ok) {
          this.confetti(50);
          this.toast(t('rapid.trialOk'), 3000);
          this.scene.spawnVehicles();
          this.openSheet(this.sheetName || 'rapid', this._sheetOpts, true);
        } else this.toast(r.reason === 'already' ? t('rapid.already') : t('rapid.invalid'));
      } else if (act === 'redeem') {
        const input = name === 'rapid' ? ($('#sheetBody').querySelector('#serialInput') || el) : el;
        const code = (input.value || '').trim();
        if (!code) return;
        const r = S().redeem(code);
        if (r.ok) {
          this.closeSheet();
          this.confetti(60);
          this.parcel();
          const names = r.items.map(i => MV.I18n.itemName(i))
            .concat((r.pets || []).map(i => MV.I18n.petName(i)))
            .concat((r.rides || []).map(i => MV.I18n.rideName(i))).join(', ');
          this.toast(r.trial ? t('gift.claimed', { name: names }) : t('rapid.success', { name: r.name || names }));
          this.scene.spawnVehicles();
          this.scene.syncPets(false);
          setTimeout(() => this.openSheet('decorate'), 900);
        } else {
          this.toast(r.reason === 'already' ? t('rapid.already') : t('rapid.invalid'));
        }
      }
    },

    /* ================= ornament menu ================= */
    ornamentMenu(uid) {
      const st = S().state;
      const p = (st.deco[st.village] || []).find(x => x.uid === uid);
      if (!p) return;
      const o = C().orn(p.id);
      this.openModal(`
        <h3>${esc(MV.I18n.itemName(p.id))}</h3>
        <p class="lead">${esc(t('rarity.' + o.rarity))} ${o.rarity === 'limited' ? '💎' : ''}</p>
        <div style="display:flex;justify-content:center;margin:2px 0 6px">
          <img alt="" src="${C().spriteData(o.art)}" style="width:96px;height:120px;object-fit:contain">
        </div>
        <div class="modal-actions" style="flex-wrap:wrap">
          <button class="btn sm ghost" data-mact="move">↔ ${esc(t('decorate.move'))}</button>
          <button class="btn sm ghost" data-mact="retrieve">↩ ${esc(t('decorate.retrieve'))}</button>
          <button class="btn sm coral" data-mact="gift">🎁 ${esc(t('decorate.gift'))}</button>
        </div>
        <button class="btn wide ghost" style="margin-top:9px" data-mact="close">${esc(t('common.close'))}</button>
      `);
      const card = $('#modalCard');
      card.querySelectorAll('[data-mact]').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.mact;
        this.closeModal();
        if (a === 'move') { this.pendingMove = uid; this.scene.setMode('move'); this.tip(t('decorate.moving')); }
        if (a === 'retrieve') {
          const r = S().retrieve(uid);
          if (r) { this.toast(t('decorate.retrieved', { name: MV.I18n.itemName(r.id) })); this.scene.refreshPlacements(); }
        }
        if (a === 'gift') this.giftPicker(p.id);
      }));
    },

    /* ================= modal ================= */
    openModal(html) {
      $('#modalCard').innerHTML = html;
      $('#modal').classList.add('on');
      $('#modalScrim').classList.add('on');
    },
    closeModal() {
      $('#modal').classList.remove('on');
      $('#modalScrim').classList.remove('on');
      $('#modalCard').innerHTML = '';
    },

    /* ================= clipboard ================= */
    copy(text, okMsg) {
      const done = () => this.toast(okMsg || t('common.copied'));
      const fallback = () => {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { this.openModal(`<h3>${esc(t('common.copy'))}</h3><p class="lead">${esc(text)}</p><button class="btn wide" data-mact="close">${esc(t('common.close'))}</button>`); }
        ta.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fallback);
      } else fallback();
    },

    /* ================= gifts ================= */
    giftPicker(preselect) {
      const st = S().state;
      const ids = Object.keys(st.inv || {}).filter(id => st.inv[id] > 0 && C().orn(id));
      if (!ids.length) { this.toast(t('gift.empty')); return; }
      const cards = ids.map(id => {
        const o = C().orn(id);
        return `<div class="tray-item" data-gid="${id}" style="${preselect === id ? 'box-shadow:inset 0 0 0 2px var(--coral)' : ''}">
          <span class="cnt">×${st.inv[id]}</span>
          <div class="thumb"><img alt="" src="${C().spriteData(o.art)}" class="spr"></div>
          <b>${esc(MV.I18n.itemName(id))}</b>
        </div>`;
      }).join('');
      this.openModal(`
        <h3>🎁 ${esc(t('gift.title'))}</h3>
        <p class="lead">${esc(t('gift.pickSub'))}</p>
        <div class="tray" style="grid-template-columns:repeat(auto-fill,minmax(76px,1fr))">${cards}</div>
        <label class="tiny" style="display:block;margin-top:12px;font-weight:800;color:var(--ink-soft)">${esc(t('gift.message'))}</label>
        <input id="giftMsg" type="text" maxlength="90" placeholder="${esc(t('gift.messagePh'))}" style="width:100%;height:44px;margin-top:5px;border-radius:13px;border:1.5px solid rgba(42,36,56,.14);padding:0 12px;font-family:inherit;font-size:.9em">
        <div class="modal-actions">
          <button class="btn ghost" data-mact="close">${esc(t('common.cancel'))}</button>
          <button class="btn coral" data-mact="create" disabled>${esc(t('gift.create'))}</button>
        </div>
      `);
      let picked = preselect || null;
      const card = $('#modalCard');
      card.querySelectorAll('[data-gid]').forEach(el => el.addEventListener('click', () => {
        picked = el.dataset.gid;
        card.querySelectorAll('[data-gid]').forEach(x => x.style.boxShadow = '');
        el.style.boxShadow = 'inset 0 0 0 2px var(--coral)';
        card.querySelector('[data-mact="create"]').disabled = false;
      }));
      if (preselect) card.querySelector('[data-mact="create"]').disabled = false;
      card.querySelector('[data-mact="create"]').addEventListener('click', () => {
        if (!picked) return;
        const msg = (card.querySelector('#giftMsg').value || '').slice(0, 90);
        this.showGiftCard(picked, msg);
      });
      card.querySelectorAll('[data-mact="close"]').forEach(b => b.addEventListener('click', () => this.closeModal()));
    },

    showGiftCard(ornId, msg) {
      const payload = S().makeGift(ornId, msg);
      if (!payload) return;
      const url = S().giftUrl(location.origin + location.pathname, payload);
      this.giftDraft = { payload, url, ornId };
      const o = C().orn(ornId);
      this.openModal(`
        <h3>🎁 ${esc(t('gift.toast', { name: MV.I18n.itemName(ornId) }))}</h3>
        <p class="lead">${esc(t('gift.sub'))}</p>
        <div class="gift-card" id="giftCard">
          <div class="gc-from">${esc(t('gift.fromLabel'))} · ${esc(S().state.nickname || 'MOA')}</div>
          <img alt="" src="${C().spriteData(o.art)}" style="width:96px;height:116px;object-fit:contain;margin:4px auto 0;display:block">
          <div style="font-family:var(--display);font-size:1.15em;font-weight:800;margin-top:2px">${esc(MV.I18n.itemName(ornId))}</div>
          ${msg ? `<div class="tiny muted" style="margin-top:4px">“${esc(msg)}”</div>` : ''}
          <div class="tiny" style="margin-top:8px;letter-spacing:.14em;opacity:.55">MOA VILLAGE</div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" data-mact="img">🖼 ${esc(t('gift.download'))}</button>
          <button class="btn coral" data-mact="copy">🔗 ${esc(t('gift.copy'))}</button>
        </div>
        <button class="btn wide ghost" style="margin-top:8px" data-mact="close">${esc(t('gift.cancel'))}</button>
      `);
      const card = $('#modalCard');
      let shared = false;
      card.querySelector('[data-mact="copy"]').addEventListener('click', () => { shared = true; this.copy(url, t('gift.copied')); });
      card.querySelector('[data-mact="img"]').addEventListener('click', () => { shared = true; this.downloadGiftCard(ornId, msg, payload); });
      card.querySelector('[data-mact="close"]').addEventListener('click', () => {
        if (!shared) {
          S().state.inv[ornId] = (S().state.inv[ornId] || 0) + 1;
          S().save(); S().emit('inventory');
          this.toast(t('gift.canceled'));
        }
        this.closeModal();
      });
      if (this.sheetName) this.openSheet(this.sheetName, this._sheetOpts, true);
    },

    downloadGiftCard(ornId, msg, payload) {
      const o = C().orn(ornId);
      const cv = document.createElement('canvas');
      cv.width = 760; cv.height = 980;
      const ctx = cv.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 760, 980);
      g.addColorStop(0, '#ffe9cd'); g.addColorStop(.5, '#fff8ec'); g.addColorStop(1, '#efe6ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 760, 980);
      ctx.strokeStyle = 'rgba(42,36,56,.12)'; ctx.lineWidth = 3; ctx.strokeRect(18, 18, 724, 944);
      ctx.fillStyle = '#7a6e92'; ctx.font = '600 22px system-ui,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('MOA VILLAGE', 380, 92);
      const im = new Image();
      im.onload = () => {
        ctx.drawImage(im, 240, 150, 280, 350);
        ctx.fillStyle = '#2a2438'; ctx.font = '800 44px system-ui,sans-serif';
        ctx.fillText(MV.I18n.itemName(ornId), 380, 570);
        if (msg) {
          ctx.fillStyle = '#6b6280'; ctx.font = '500 24px system-ui,sans-serif';
          this.wrapText(ctx, '“' + msg + '”', 380, 620, 560, 34);
        }
        ctx.fillStyle = '#8a6bbf'; ctx.font = '700 24px system-ui,sans-serif';
        ctx.fillText('from ' + (payload.from || 'MOA'), 380, 830);
        ctx.fillStyle = '#a79fb4'; ctx.font = '500 20px system-ui,sans-serif';
        ctx.fillText('open the gift link to place it in your village', 380, 880);
        const a = document.createElement('a');
        a.download = 'moa-village-gift-' + ornId + '.png';
        a.href = cv.toDataURL('image/png');
        a.click();
      };
      im.src = C().spriteData(o.art);
    },

    wrapText(ctx, text, x, y, maxW, lh) {
      const chars = String(text).split('');
      let line = '', yy = y;
      chars.forEach(ch => {
        if (ctx.measureText(line + ch).width > maxW) { ctx.fillText(line, x, yy); line = ch; yy += lh; }
        else line += ch;
      });
      if (line) ctx.fillText(line, x, yy);
    },

    showGiftArrival(payload) {
      const o = C().orn(payload.item);
      if (!o) return;
      this.parcel();
      this.confetti(50);
      this.openModal(`
        <h3>🎁 ${esc(t('gift.receivedTitle'))}</h3>
        <p class="lead">${esc(t('gift.receivedBody', { from: payload.from || 'MOA', name: MV.I18n.itemName(payload.item) }))}</p>
        <div class="gift-card">
          <img alt="" src="${C().spriteData(o.art)}" style="width:110px;height:136px;object-fit:contain;display:block;margin:0 auto">
          ${payload.msg ? `<div class="tiny muted" style="margin-top:6px">“${esc(payload.msg)}”</div>` : ''}
        </div>
        <div class="modal-actions">
          <button class="btn coral" data-mact="claim">${esc(t('gift.claim'))}</button>
        </div>
        <button class="btn wide ghost" style="margin-top:8px" data-mact="later">${esc(t('common.close'))}</button>
      `);
      const card = $('#modalCard');
      card.querySelector('[data-mact="later"]').addEventListener('click', () => this.closeModal());
      card.querySelector('[data-mact="claim"]').addEventListener('click', () => {
        const r = S().receiveGift(payload);
        this.closeModal();
        if (r.ok) {
          this.toast(t('gift.claimed', { name: MV.I18n.itemName(payload.item) }));
          this.confetti(55);
          setTimeout(() => this.openSheet('decorate'), 700);
        } else {
          this.toast(t('gift.already'));
        }
      });
    },

    /* ================= trending ================= */
    async loadTrend() {
      const url = 'data/trending-items.json';
      let data = null;
      try {
        const res = await fetch(url + '?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
        if (res.ok) data = await res.json();
      } catch (e) { data = null; }
      if (!data || !Array.isArray(data.items) || !data.items.length) {
        data = { generated_at: new Date().toISOString(), items: C().TREND_FALLBACK };
      }
      this.trend = { items: data.items.slice(0, 6), generatedAt: data.generated_at ? new Date(data.generated_at) : new Date() };
      this.renderTrend();
      if (this.sheetName === 'shop') this.openSheet('shop', this._sheetOpts, true);
    },

    renderTrend() {
      const strip = $('#trendStrip');
      if (!this.trend.items.length) { strip.hidden = true; return; }
      strip.hidden = false;
      const names = this.trend.items.slice(0, 3).map(x => {
        const o = C().orn(x.id);
        return o ? MV.I18n.itemName(x.id) : x.id;
      });
      $('#trendItems').textContent = names.join(' · ');
      let hh = '', mm = '';
      try {
        const d = this.trend.generatedAt || new Date();
        hh = String(d.getHours()).padStart(2, '0');
        mm = String(d.getMinutes()).padStart(2, '0');
      } catch (e) {}
      $('#trendTime').textContent = hh ? t('trend.updated', { t: hh + ':' + mm }) : '';
      $('#trendLive').textContent = t('trend.live');
    },

    /* ================= first run ================= */
    nicknameModal(force) {
      const st = S().state;
      this.openModal(`
        <div style="text-align:center;font-size:2.2em;line-height:1">${C().village(st.village).emoji}</div>
        <h3 style="text-align:center;margin-top:6px;letter-spacing:.04em;font-size:1.5em">MOA Village</h3>
        <p class="lead" style="text-align:center">${esc(t('v.' + st.village + '.name'))} · ${esc(t('app.tagline'))}</p>
        <label class="tiny" style="font-weight:800;color:var(--ink-soft)">${esc(t('common.you'))}</label>
        <input id="nickInput" type="text" maxlength="12" value="${esc(st.nickname || '')}" placeholder="MOA" style="width:100%;height:48px;margin-top:6px;border-radius:14px;border:1.5px solid rgba(42,36,56,.14);padding:0 14px;font-family:inherit;font-weight:700;font-size:1em">
        <button class="btn coral wide" style="margin-top:12px" data-mact="ok">🏡 ${esc(t('nick.start'))}</button>
        ${force ? '' : `<button class="btn wide ghost" style="margin-top:7px" data-mact="skip">${esc(t('common.close'))}</button>`}
      `);
      const card = $('#modalCard');
      const finish = (name) => {
        if (name) { S().state.nickname = name.slice(0, 12); S().save(); this.scene.avatar.nickname = name; }
        if (S().state.seenWelcome.indexOf('nick') < 0) { S().state.seenWelcome.push('nick'); S().save(); }
        this.closeModal();
        if (name) this.toast(t('nick.welcome', { name: name }));
        /* first-run open-world controls card */
        if (S().state.seenWelcome.indexOf('world') < 0) {
          S().state.seenWelcome.push('world'); S().save();
          setTimeout(() => this.welcomeModal('world'), 700);
        }
      };
      card.querySelector('[data-mact="ok"]').addEventListener('click', () => {
        const v = (card.querySelector('#nickInput').value || '').trim() || 'MOA';
        finish(v);
      });
      const skip = card.querySelector('[data-mact="skip"]');
      if (skip) skip.addEventListener('click', () => finish(null));
      card.querySelector('#nickInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); card.querySelector('[data-mact="ok"]').click(); }
      });
    },

    welcomeModal(kind, extra) {
      if (kind === 'ref') {
        this.openModal(`
          <div style="text-align:center;font-size:2.4em">🎉</div>
          <h3 style="text-align:center">${esc(t('welcome.refTitle'))}</h3>
          <p class="lead" style="text-align:center">${esc(t('welcome.refBody', { n: extra.n || 75 }))}</p>
          <button class="btn coral wide" data-mact="ok">${esc(t('welcome.ok'))}</button>
        `);
      } else if (kind === 'coop') {
        this.openModal(`
          <div style="text-align:center;font-size:2.4em">🤝</div>
          <h3 style="text-align:center">${esc(t('welcome.coopTitle'))}</h3>
          <p class="lead" style="text-align:center">${esc(t('welcome.coopBody'))}</p>
          <div class="modal-actions">
            <button class="btn ghost" data-mact="later">${esc(t('common.close'))}</button>
            <button class="btn coral" data-mact="join">${esc(t('friends.coopJoinBtn'))}</button>
          </div>
        `);
      } else if (kind === 'world') {
        this.openModal(`
          <div style="text-align:center;font-size:2.2em">${C().village(S().state.village).emoji} 🏎️</div>
          <h3 style="text-align:center">${esc(t('welcome.worldTitle'))}</h3>
          <p class="lead" style="text-align:center">${esc(t('welcome.worldBody'))}</p>
          <div class="kv"><span>${esc(t('welcome.worldMove'))}</span><b>WASD / Tap</b></div>
          <div class="kv"><span>${esc(t('welcome.worldDrive'))}</span><b>F</b></div>
          <div class="kv"><span>${esc(t('welcome.worldMap'))}</span><b>M</b></div>
          <button class="btn coral wide" style="margin-top:12px" data-mact="ok">${esc(t('welcome.ok'))}</button>
        `);
      }
      const card = $('#modalCard');
      card.querySelectorAll('[data-mact="ok"],[data-mact="later"]').forEach(b => b.addEventListener('click', () => this.closeModal()));
      const j = card.querySelector('[data-mact="join"]');
      if (j) j.addEventListener('click', () => {
        S().joinCoop(extra.code);
        this.closeModal();
        this.confetti(30);
        this.toast(t('friends.coopJoined'));
        this.openSheet('friends');
      });
    }
  };

  function MOA_round(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  MV.UI = UI;
})();
