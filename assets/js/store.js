/* MOA Village — state, persistence, economy */
(function () {
  'use strict';
  window.MV = window.MV || {};
  const KEY = 'moa.village.v1';
  const C = () => MV.Catalog;

  const FRIEND_NAMES = ['하늘', '루나', '보리', '토토', '민지', '코코', '유진', '단비', '모모', '제이', '소담', '라라'];
  const FRIEND_EMOJI = ['🐰', '🦊', '🐻', '🐱', '🐶', '🐼', '🐨', '🐯', '🐸', '🐥'];

  function rand(n) { return Math.floor(Math.random() * n); }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function makeCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += A[rand(A.length)];
    return 'MOA-' + s;
  }

  const DEFAULT = () => ({
    version: 1,
    lang: null,
    weather: 'auto',
    coins: 160,
    sparks: 0,
    xp: 0,
    vip: false,
    trial: false,
    missionsDone: 0,
    bestStars: 0,
    previewSeen: [],
    nickname: '',
    code: makeCode(),
    village: 'snowbell',
    unlocked: ['snowbell'],
    inv: { pine: 3, snowman: 1, lamp: 1, star: 1, gift: 1 },
    deco: { snowbell: [], sunpetal: [], mochi: [], lumen: [] },
    pets: ['puppy'],
    rides: ['bike'],
    activePets: ['puppy'],
    activeRides: ['bike'],
    friends: [],
    coop: null,
    serials: [],
    inbox: [],
    claimed: [],
    seenWelcome: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  const Store = {
    state: DEFAULT(),
    listeners: [],

    on(fn) { this.listeners.push(fn); return fn; },
    emit(type, data) {
      this.listeners.forEach(fn => { try { fn(type, data, this.state); } catch (e) { console.warn(e); } });
    },

    load() {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) {}
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const base = DEFAULT();
          this.state = Object.assign(base, parsed);
          // structural repairs
          if (!this.state.deco) this.state.deco = base.deco;
          C().VILLAGES.forEach(v => { if (!Array.isArray(this.state.deco[v.id])) this.state.deco[v.id] = []; });
          if (!this.state.unlocked || !this.state.unlocked.length) this.state.unlocked = ['snowbell'];
          if (!this.state.code) this.state.code = makeCode();
          if (!Array.isArray(this.state.friends)) this.state.friends = [];
          if (!Array.isArray(this.state.inbox)) this.state.inbox = [];
          if (!Array.isArray(this.state.claimed)) this.state.claimed = [];
          if (!Array.isArray(this.state.previewSeen)) this.state.previewSeen = [];
          if (typeof this.state.xp !== 'number') this.state.xp = 0;
          if (typeof this.state.missionsDone !== 'number') this.state.missionsDone = 0;
          if (typeof this.state.vip !== 'boolean') this.state.vip = false;
          if (!this.state.inv) this.state.inv = {};
        } catch (e) { this.state = DEFAULT(); }
      }
      this.state.updatedAt = Date.now();
      return this.state;
    },

    save() {
      this.state.updatedAt = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) {}
    },

    reset() { this.state = DEFAULT(); this.save(); this.emit('reset'); },

    /* ---------- helpers ---------- */
    v() { return C().village(this.state.village); },
    co() { return this.state.coop; },
    discount() { return (this.state.coop && this.state.coop.unlocked) ? 0.4 : 0; },
    priceOf(ornId) {
      const o = C().orn(ornId);
      if (!o || o.price == null) return null;
      const d = this.discount();
      return Math.max(0, Math.round(o.price * (1 - d) / 5) * 5);
    },
    ownCount(id) {
      let n = this.state.inv[id] || 0;
      Object.keys(this.state.deco).forEach(vid => {
        (this.state.deco[vid] || []).forEach(p => { if (p.id === id) n++; });
      });
      return n;
    },
    placedCount(vid) { return (this.state.deco[vid || this.state.village] || []).length; },
    maxPlacements() { return 24; },
    isOwned(id) { return this.ownCount(id) > 0; },
    hasPet(id) { return this.state.pets.indexOf(id) >= 0; },
    hasRide(id) { return this.state.rides.indexOf(id) >= 0; },
    isPetActive(id) { return this.state.activePets.indexOf(id) >= 0; },
    isRideActive(id) { return this.state.activeRides.indexOf(id) >= 0; },

    /* ---------- economy ---------- */
    addCoins(n, silent) {
      this.state.coins = Math.max(0, this.state.coins + n);
      this.save(); this.emit('coins', { n });
      return this.state.coins;
    },
    /* mission / world reward — VIP members earn double coins */
    reward(n) {
      const coins = Math.round(n * (this.state.vip ? 2 : 1));
      this.addCoins(coins);
      return coins;
    },
    addXp(n) {
      this.state.xp = Math.max(0, (this.state.xp || 0) + n);
      this.save(); this.emit('xp', { n });
      return this.state.xp;
    },
    level() { return 1 + Math.floor((this.state.xp || 0) / 300); },
    xpInLevel() { return (this.state.xp || 0) % 300; },
    spend(n) {
      if (this.state.coins < n) return false;
      this.state.coins -= n; this.save(); this.emit('coins', { n: -n });
      return true;
    },
    addSparks(n) {
      this.state.sparks = Math.max(0, this.state.sparks + n);
      this.save(); this.emit('sparks', { n });
    },
    grant(ids, opts) {
      (ids || []).forEach(id => {
        if (!C().orn(id)) return;
        this.state.inv[id] = (this.state.inv[id] || 0) + 1;
      });
      this.save(); this.emit('inventory', opts || {});
    },
    buyOrn(id) {
      const o = C().orn(id);
      if (!o) return { ok: false, reason: 'missing' };
      if (o.rarity === 'limited') return { ok: false, reason: 'rapid' };
      const p = this.priceOf(id);
      if (this.state.coins < p) return { ok: false, reason: 'coins', need: p - this.state.coins };
      this.state.coins -= p;
      this.state.inv[id] = (this.state.inv[id] || 0) + 1;
      this.save(); this.emit('buy', { id, price: p });
      return { ok: true, price: p };
    },

    /* ---------- villages ---------- */
    switchVillage(id) {
      if (this.state.unlocked.indexOf(id) < 0) return false;
      if (!this.state.deco[id]) this.state.deco[id] = [];
      this.state.village = id;
      this.save(); this.emit('village', { id });
      return true;
    },
    unlockVillage(id) {
      const v = C().village(id);
      if (!v) return { ok: false };
      if (this.state.unlocked.indexOf(id) >= 0) return { ok: true, already: true };
      const cost = v.cost || 0;
      if (this.state.coins < cost) return { ok: false, reason: 'coins', need: cost - this.state.coins };
      this.state.coins -= cost;
      this.state.unlocked.push(id);
      this.save(); this.emit('villageUnlock', { id });
      return { ok: true, cost };
    },

    /* ---------- decoration ---------- */
    place(id, nx, ny) {
      if (!(this.state.inv[id] > 0)) return null;
      const list = this.state.deco[this.state.village] || (this.state.deco[this.state.village] = []);
      if (list.length >= this.maxPlacements()) return null;
      this.state.inv[id] -= 1;
      const p = { uid: uid(), id, nx: Math.max(.06, Math.min(.94, nx)), ny: Math.max(.08, Math.min(.94, ny)) };
      list.push(p);
      this.save(); this.emit('deco', { action: 'place', id });
      return p;
    },
    move(uidv, nx, ny) {
      const list = this.state.deco[this.state.village] || [];
      const p = list.find(x => x.uid === uidv);
      if (!p) return false;
      p.nx = Math.max(.06, Math.min(.94, nx));
      p.ny = Math.max(.08, Math.min(.94, ny));
      this.save(); this.emit('deco', { action: 'move', uid: uidv });
      return true;
    },
    retrieve(uidv) {
      const list = this.state.deco[this.state.village] || [];
      const i = list.findIndex(x => x.uid === uidv);
      if (i < 0) return null;
      const p = list.splice(i, 1)[0];
      this.state.inv[p.id] = (this.state.inv[p.id] || 0) + 1;
      this.save(); this.emit('deco', { action: 'retrieve', id: p.id });
      return p;
    },

    /* ---------- pets / rides ---------- */
    buyPet(id) {
      const p = C().pet(id);
      if (!p) return { ok: false };
      if (this.hasPet(id)) return { ok: true, already: true };
      if (p.price == null) return { ok: false, reason: 'rapid' };
      if (this.state.coins < p.price) return { ok: false, reason: 'coins' };
      this.state.coins -= p.price;
      this.state.pets.push(id);
      if (this.state.activePets.length < 3) this.state.activePets.push(id);
      this.save(); this.emit('pet', { id });
      return { ok: true };
    },
    togglePet(id) {
      if (!this.hasPet(id)) return false;
      const i = this.state.activePets.indexOf(id);
      if (i >= 0) this.state.activePets.splice(i, 1);
      else { if (this.state.activePets.length >= 3) this.state.activePets.shift(); this.state.activePets.push(id); }
      this.save(); this.emit('pet', { id });
      return this.isPetActive(id);
    },
    buyRide(id) {
      const r = C().ride(id);
      if (!r) return { ok: false };
      if (this.hasRide(id)) return { ok: true, already: true };
      if (r.price == null) return { ok: false, reason: 'rapid' };
      const price = Math.round(r.price * (1 - this.discount()) / 5) * 5;
      if (this.state.coins < price) return { ok: false, reason: 'coins' };
      this.state.coins -= price;
      this.state.rides.push(id);
      if (this.state.activeRides.length < 3) this.state.activeRides.push(id);
      this.save(); this.emit('ride', { id });
      return { ok: true };
    },
    toggleRide(id) {
      if (!this.hasRide(id)) return false;
      const i = this.state.activeRides.indexOf(id);
      if (i >= 0) this.state.activeRides.splice(i, 1);
      else { if (this.state.activeRides.length >= 3) this.state.activeRides.shift(); this.state.activeRides.push(id); }
      this.save(); this.emit('ride', { id });
      return this.isRideActive(id);
    },

    /* ---------- referral ---------- */
    friendName() {
      const name = FRIEND_NAMES[rand(FRIEND_NAMES.length)];
      const emo = FRIEND_EMOJI[rand(FRIEND_EMOJI.length)];
      return { name: name + ' ' + emo, emoji: emo };
    },
    addFriend(name) {
      const f = name ? { name, emoji: '🐣', at: Date.now() } : Object.assign(this.friendName(), { at: Date.now() });
      this.state.friends.push(f);
      const reward = 60;
      this.state.coins += reward;
      this.save(); this.emit('friend', f);
      return { friend: f, reward };
    },
    referralLink(base) {
      const u = new URL(base || location.href);
      u.search = '';
      u.hash = '';
      u.searchParams.set('ref', this.state.code);
      return u.toString();
    },

    /* ---------- coop ---------- */
    coopLink(base) {
      if (!this.state.coop) return '';
      const u = new URL(base || location.href);
      u.search = ''; u.hash = '';
      u.searchParams.set('coop', this.state.coop.code);
      return u.toString();
    },
    startCoop() {
      if (this.state.coop) return this.state.coop;
      this.state.coop = { code: 'COOP-' + makeCode().slice(4), joined: 1, mine: true, unlocked: false, max: 5 };
      this.save(); this.emit('coop');
      return this.state.coop;
    },
    joinCoop(code) {
      if (this.state.coop && this.state.coop.code === code) return this.state.coop;
      this.state.coop = { code, joined: 2, mine: false, unlocked: false, max: 5 };
      this.checkCoop();
      return this.state.coop;
    },
    coopSim() {
      const c = this.state.coop;
      if (!c) return null;
      if (c.joined >= c.max) return c;
      const f = this.friendName();
      f.name = f.name;
      c.joined += 1;
      this.state.friends.push({ name: f.name, emoji: f.emoji, at: Date.now(), via: 'coop' });
      this.checkCoop();
      this.save(); this.emit('coop', { friend: f });
      return { coop: c, friend: f };
    },
    checkCoop() {
      const c = this.state.coop;
      if (!c) return;
      const was = c.unlocked;
      c.unlocked = c.joined >= c.max;
      this.save();
      if (c.unlocked && !was) this.emit('coopUnlock');
    },

    /* ---------- vehicles (v2 open world) ---------- */
    hasVehicle(id) {
      if (id === 'minicar') return true;
      if (id === 'supercar' || id === 'sleigh') return this.hasRide(id);
      return this.hasRide(id);
    },
    unlockRide(id) {
      if (this.state.rides.indexOf(id) < 0) this.state.rides.push(id);
      if (this.state.activeRides.indexOf(id) < 0 && this.state.activeRides.length < 3) this.state.activeRides.push(id);
      this.emit('ride', { id });
    },
    unlockPet(id) {
      if (this.state.pets.indexOf(id) < 0) this.state.pets.push(id);
      if (this.state.activePets.indexOf(id) < 0 && this.state.activePets.length < 3) this.state.activePets.push(id);
      this.emit('pet', { id });
    },
    applyPerk(p) {
      if (p === 'perk.supercar') this.unlockRide('supercar');
      else if (p === 'perk.sleigh') this.unlockRide('sleigh');
      else if (p === 'perk.rabbit') this.unlockPet('moonrabbit');
      else if (p === 'perk.coins2') this.state.vip = true;
      else if (p === 'perk.viporn') this.grant(['kite', 'gbell']);
      else if (p === 'perk.trial') this.state.trial = true;
    },

    /* ---------- serial codes ---------- */
    redeem(code) {
      const r = C().RAPID.byCode(code);
      if (!r) return { ok: false, reason: 'invalid' };
      const key = String(code).trim().toUpperCase();
      if (this.state.serials.indexOf(key) >= 0) return { ok: false, reason: 'already' };
      this.state.serials.push(key);
      const items = (r.items || []).slice();
      this.grant(items);
      const pets = [];
      const rides = [];
      const addPet = (id) => {
        if (!this.hasPet(id)) { this.state.pets.push(id); pets.push(id); }
        if (this.state.activePets.indexOf(id) < 0 && this.state.activePets.length < 3) this.state.activePets.push(id);
      };
      const addRide = (id) => {
        if (!this.hasRide(id)) { this.state.rides.push(id); rides.push(id); }
        if (this.state.activeRides.indexOf(id) < 0 && this.state.activeRides.length < 3) this.state.activeRides.push(id);
      };
      ((r.set && r.set.pets) || []).forEach(addPet);
      ((r.set && r.set.rides) || []).forEach(addRide);
      (r.pets || []).forEach(addPet);
      (r.rides || []).forEach(addRide);
      (r.perks || []).forEach(p => this.applyPerk(p));
      this.save();
      this.emit('pet', {}); this.emit('ride', {});
      return {
        ok: true, items, pets, rides, set: r.set || null, trial: !!r.trial, creator: !!r.creator,
        perks: r.perks || [], url: r.url || null,
        name: r.set ? C().setName(r.set) : null
      };
    },

    /* ---------- gifts ---------- */
    makeGift(ornId, message) {
      if (!(this.state.inv[ornId] > 0)) return null;
      this.state.inv[ornId] -= 1;
      this.save();
      const payload = {
        v: 1, from: this.state.nickname || 'MOA', code: this.state.code,
        item: ornId, msg: (message || '').slice(0, 90), at: Date.now()
      };
      this.emit('giftSent', { id: ornId });
      return payload;
    },
    giftUrl(base, payload) {
      const u = new URL(base || location.href);
      u.search = ''; u.hash = '';
      u.searchParams.set('gift', encodeGift(payload));
      return u.toString();
    },
    receiveGift(payload) {
      if (!payload || !payload.item) return { ok: false };
      const key = 'g:' + (payload.code || '') + ':' + payload.item + ':' + (payload.at || '');
      if (this.state.claimed.indexOf(key) >= 0) return { ok: false, reason: 'already' };
      this.state.claimed.push(key);
      this.state.inv[payload.item] = (this.state.inv[payload.item] || 0) + 1;
      this.state.inbox.push({ from: payload.from || '', item: payload.item, msg: payload.msg || '', at: Date.now() });
      this.save(); this.emit('giftReceived', payload);
      return { ok: true, item: payload.item };
    }
  };

  function encodeGift(p) {
    const json = JSON.stringify(p);
    try {
      return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) { return ''; }
  }
  function decodeGift(s) {
    try {
      let b = String(s).replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      return JSON.parse(decodeURIComponent(escape(atob(b))));
    } catch (e) { return null; }
  }

  Store.encodeGift = encodeGift;
  Store.decodeGift = decodeGift;
  MV.Store = Store;
})();
