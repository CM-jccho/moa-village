/* MOA Village — bootstrap */
(function () {
  'use strict';
  window.MV = window.MV || {};

  function pickLang() {
    const st = MV.Store.state;
    if (st.lang && MV.LANGS.indexOf(st.lang) >= 0) return st.lang;
    const n = (navigator.language || 'ko').toLowerCase();
    if (n.indexOf('ko') === 0) return 'ko';
    if (n.indexOf('ja') === 0) return 'ja';
    if (n.indexOf('zh') === 0) return 'zh';
    return 'en';
  }

  function boot() {
    const Store = MV.Store;
    Store.load();

    const lang = pickLang();
    MV.I18n.setLang(lang);
    Store.state.lang = lang;

    const scene = MV.Scene;
    scene.init(document.getElementById('scene'), {});
    scene.setVillage(MV.Catalog.village(Store.state.village));
    scene.setWeather(Store.state.weather);

    const UI = MV.UI;
    UI.scene = scene;
    UI.init();

    // restore nickname on avatar
    scene.avatar.nickname = Store.state.nickname || '';

    // deep links
    const params = new URLSearchParams(location.search);
    const gift = params.get('gift');
    const ref = params.get('ref');
    const coop = params.get('coop');

    if (gift) {
      const payload = Store.decodeGift(gift);
      if (payload && payload.item) {
        setTimeout(() => UI.showGiftArrival(payload), 900);
      }
    }

    if (coop) {
      const code = String(coop).trim();
      const mine = Store.state.coop && Store.state.coop.code === code;
      if (!mine) {
        setTimeout(() => UI.welcomeModal('coop', { code }), gift ? 4200 : 900);
      }
    }

    if (ref && ref !== Store.state.code) {
      const key = 'ref:' + ref;
      if (Store.state.claimed.indexOf(key) < 0 && !gift) {
        Store.state.claimed.push(key);
        Store.state.coins += 75;
        Store.save();
        UI.updateHud();
        setTimeout(() => UI.welcomeModal('ref', { n: 75 }), 1200);
      }
    }

    // first run nickname
    if (!Store.state.nickname && Store.state.seenWelcome.indexOf('nick') < 0 && !gift) {
      setTimeout(() => UI.nicknameModal(false), 520);
    }

    UI.loadTrend();

    // service worker (PWA) — only over http(s)
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }

    // save language choice when changed is handled in UI; also persist on unload
    window.addEventListener('beforeunload', () => { try { Store.save(); } catch (e) {} });

    // expose for debugging / tests
    window.MOA = { Store, Scene: scene, UI, Catalog: MV.Catalog, I18n: MV.I18n };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
