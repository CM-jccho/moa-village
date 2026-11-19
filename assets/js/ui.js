/* MOA Village — UI: HUD, sheets, shop, decorate, friends, gifts, Rapid */
(function () {
  'use strict';
  window.MV = window.MV || {};
  const C = () => MV.Catalog;
  const S = () => MV.Store;
  const t = (k, v) => MV.t(k, v);

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString();

  const UI = {
    scene: null,
    sheetName: null,
    pendingMove: null,
    giftDraft: null,
    trend: { items: [], generatedAt: 0 },
    history: [],

    init() {
      this.bind();
      this.applyStatic();
      this.updateHud();
      this.renderTrend();
      this.bindScene();
      this.tipTimer();
    },

    /* ---------------- static text & language ---------------- */
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
      document.title = 'MOA Village';
      if (this.sheetName) this.openSheet(this.sheetName, this._sheetOpts, true);
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
      this.updateVillageChip();
    },

    /* ---------------- events ---------------- */
    bind() {
      $('#langSeg').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        MV.I18n.setLang(b.dataset.lang);
        S().state.lang = b.dataset.lang;
        S().save();
        this.applyStatic();
        this.updateHud();
        this.renderTrend();
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
        if (e.key === 'Escape') { this.closeModal(); this.closeSheet(); $('#weatherBar').classList.remove('open'); }
      });

      $('#villageChip').addEventListener('click', () => this.openSheet('villages'));
      $('#coinChip').addEventListener('click', () => this.openSheet('shop'));
      $('#sparkChip').addEventListener('click', () => this.openSheet('shop'));
      $('#trendStrip').addEventListener('click', () => this.openSheet('shop', { tab: 'orn' }));

      S().on((type, data) => {
        this.updateHud();
        if (type === 'coins' || type === 'buy' || type === 'inventory' || type === 'friend' || type === 'coop' || type === 'giftSent') {
          if (this.sheetName) this.openSheet(this.sheetName, this._sheetOpts, true);
        }
        if (type === 'village') { this.scene.setVillage(C().village(data.id)); this.updateVillageChip(); }
        if (type === 'villageUnlock') { this.updateHud(); }
        if (type === 'deco') { this.scene.refreshPlacements(); }
        if (type === 'pet') this.scene.syncPets(false);
        if (type === 'ride') this.scene.syncRides(false);
        if (type === 'giftReceived') this.scene.refreshPlacements();
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
        sc.avatar.tx = nx; sc.avatar.ty = ny;
      });
      sc.on('onSparkle', (index, h) => {
        const gp = sc.collectSparkle(index);
        S().addCoins(3);
        S().addSparks(1);
        this.burstScreen(gp ? gp.x : h.x, gp ? gp.y : h.y);
        this.updateHud();
      });
      sc.on('onPet', (id, h) => {
        const key = 'petline-' + id;
        this._petLine = this._petLine || {};
        const i = this._petLine[id] = ((this._petLine[id] == null) ? 0 : this._petLine[id] + 1);
        this.bubble(MV.I18n.petLine(id, i), h.x, h.y - h.r * .6);
      });
      sc.on('onRide', (id, h) => {
        this._rideLine = this._rideLine || {};
        const i = this._rideLine[id] = ((this._rideLine[id] == null) ? 0 : this._rideLine[id] + 1);
        this.bubble(MV.I18n.rideLine(id, i), h.x, h.y - h.r * .4);
      });
      sc.on('onOrnament', (uid) => this.ornamentMenu(uid));
      sc.on('onHouse', () => this.openSheet('shop'));
      sc.on('onMoved', () => { if (this.sheetName === 'decorate') this.openSheet('decorate', this._sheetOpts, true); });
    },

    /* ---------------- toast / bubble / fx ---------------- */
    toast(msg, ms) {
      const w = $('#toastWrap');
      const d = document.createElement('div');
      d.className = 'toast';
      d.textContent = msg;
      w.appendChild(d);
      setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 320); }, ms || 2100);
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
      const tips = ['tip.start', 'tip.decorate', 'tip.click', 'tip.gift'];
      let i = 0;
      const show = () => {
        this.tip(t(tips[i % tips.length]));
        i++;
      };
      setTimeout(show, 1400);
      setInterval(() => {
        if (document.hidden) return;
        show();
      }, 26000);
    },

    /* ---------------- sheet ---------------- */
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

    /* ---------------- villagers panel ---------------- */
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

    /* ---------------- shop panel ---------------- */
    panelShop(opts) {
      const st = S().state;
      const tab = opts.tab || this._shopTab || 'all';
      this._shopTab = tab;
      const disc = S().discount();
      const trendIds = this.trend.items.map(x => x.id);

      const tabs = [['all', 'shop.all'], ['orn', 'shop.orn'], ['pet', 'shop.pet'], ['ride', 'shop.ride']]
        .map(([k, key]) => `<button data-act="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${esc(t(key))}</button>`).join('');

      let html = `<div class="tabs">${tabs}</div>`;
      if (disc > 0) {
        html += `<div class="coop-badge" style="margin-bottom:10px">🎉 ${esc(t('shop.discountOn'))}</div>`;
      }

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
        html += `<div class="section"><div class="section-title"><h3>${esc(t('shop.ridesTitle'))}</h3></div><div class="grid">` +
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

      html += `<div class="section"><button class="btn ghost wide" data-act="openRapid">💎 ${esc(t('rapid.title'))} →</button></div>`;
      return html;
    },

    /* ---------------- decorate panel ---------------- */
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
          <p class="muted tiny" style="margin-top:9px">${esc(t('decorate.sub'))}</p>
        </div>
        <div class="section">
          <div class="section-title"><h3>${esc(t('decorate.scene'))}</h3></div>
          <div class="tray">${placedHtml}</div>
        </div>`;
    },

    /* ---------------- friends panel ---------------- */
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
          </div>`;
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

    /* ---------------- rapid panel ---------------- */
    panelRapid() {
      const st = S().state;
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
          <div class="set-foot">
            <span class="set-price">₩${fmt(set.price)}<small>Rapid</small></span>
            <button class="btn sm gold" data-act="rapidBuy" data-url="${esc(set.buyUrl)}">${esc(t('rapid.buy'))} ↗</button>
          </div>
          <div class="set-note">🔑 ${esc(t('rapid.serialSub'))}</div>
        </div>`;
      }).join('');

      return `${sets}
        <div class="section card" style="padding:13px">
          <div class="section-title" style="margin-bottom:2px"><h3>${esc(t('rapid.serialTitle'))}</h3></div>
          <p class="muted tiny">${esc(t('rapid.serialSub'))}</p>
          <div class="serial-row">
            <input type="text" id="serialInput" autocapitalize="characters" autocomplete="off" placeholder="${esc(t('rapid.placeholder'))}">
            <button class="btn sm coral" data-act="redeem">${esc(t('rapid.unlock'))}</button>
          </div>
          <div class="trial">🔑 ${esc(t('rapid.trialTitle'))} — <code>${C().RAPID.trialCode}</code><br><span style="opacity:.8">${esc(t('rapid.trialSub'))}</span></div>
          <p class="muted tiny" style="margin-top:9px">${esc(t('rapid.configNote'))}</p>
        </div>`;
    },

    /* ---------------- panel actions ---------------- */
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
        if (r.ok) { this.toast(t('shop.petOn', { name: MV.I18n.petName(el.dataset.id) })); this.openSheet('shop', this._sheetOpts, true); }
        else if (r.reason === 'rapid') { this.openSheet('rapid'); }
        else this.toast(t('shop.notEnough', { n: fmt(Math.max(0, (cfg ? cfg.price : 0) - st.coins)) }));
      } else if (act === 'togglePet') {
        const on = S().togglePet(el.dataset.id);
        this.toast(on ? t('shop.petOn', { name: MV.I18n.petName(el.dataset.id) }) : t('shop.petOff', { name: MV.I18n.petName(el.dataset.id) }));
        this.openSheet('shop', this._sheetOpts, true);
      } else if (act === 'buyRide') {
        const r = S().buyRide(el.dataset.id);
        const rcfg = C().ride(el.dataset.id);
        if (r.ok) { this.toast(t('shop.rideOn', { name: MV.I18n.rideName(el.dataset.id) })); this.openSheet('shop', this._sheetOpts, true); }
        else if (r.reason === 'rapid') this.openSheet('rapid');
        else this.toast(t('shop.notEnough', { n: fmt(Math.max(0, (rcfg ? rcfg.price : 0) - st.coins)) }));
      } else if (act === 'toggleRide') {
        const on = S().toggleRide(el.dataset.id);
        this.toast(on ? t('shop.rideOn', { name: MV.I18n.rideName(el.dataset.id) }) : t('shop.rideOff', { name: MV.I18n.rideName(el.dataset.id) }));
        this.openSheet('shop', this._sheetOpts, true);
      } else if (act === 'openRapid') {
        this.openSheet('rapid');
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
          if (r.coop.unlocked) { this.confetti(44); this.toast(t('friends.coopReady')); }
        }
        this.openSheet('friends', this._sheetOpts, true);
      } else if (act === 'rapidBuy') {
        window.open(el.dataset.url, '_blank', 'noopener');
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
          setTimeout(() => this.openSheet('decorate'), 900);
        } else {
          this.toast(r.reason === 'already' ? t('rapid.already') : t('rapid.invalid'));
        }
      }
    },

    /* ---------------- ornament menu ---------------- */
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

    /* ---------------- modal ---------------- */
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

    /* ---------------- clipboard ---------------- */
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

    /* ---------------- gifts ---------------- */
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

    /* ---------------- trending ---------------- */
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

    /* ---------------- first run ---------------- */
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

  MV.UI = UI;
})();
