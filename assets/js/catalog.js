/* MOA Village — catalog: villages, ornaments, pets, rides, Rapid sets, sprites */
(function () {
  'use strict';
  window.MV = window.MV || {};

  /* ---------------- Rapid config ----------------
     실제 운영 시 이 블록의 storeUrl 과 각 세트의 buyUrl 만 바꾸면 됩니다.
     (래피드 상품 페이지: https://www.latpeed.com/products/xxxxx)            */
  const RAPID = {
    storeUrl: 'https://www.latpeed.com/',
    /* 실제 판매 중인 래피드 상품 — MOA Daily · AI 세팅 팩 (9,900원) */
    creator: {
      id: 'creator',
      name: ['MOA Daily · AI 세팅 팩', 'MOA Daily · AI Set-up Pack', 'MOA Daily · AI 套装包', 'MOA Daily · AIセットアップパック'],
      price: 9900,
      url: 'https://www.latpeed.com/products/VTtxq',
      code: 'MOA-VIP-2026',
      perks: ['perk.coins2', 'perk.supercar', 'perk.viporn', 'perk.rabbit'],
      items: ['kite', 'gbell'],
      pets: ['moonrabbit']
    },
    trialCode: 'MOA-TRIAL-2026',
    sets: [
      {
        id: 'snowset', accent: '#9fd2ff', glow: '#6aa9ff', price: 9900,
        name: ['설강 리미티드 세트', 'Snowbell Limited Set', '雪铃限定套装', 'スノーベル限定セット'],
        desc: ['얼음 수정 · 리스 · 스노우 글로브 · 오로라 램프 + 달토끼', 'Ice Crystal · Wreath · Snow Globe · Aurora Lamp + Moon Rabbit', '冰晶 · 花环 · 雪花球 · 极光灯 + 月兔', '氷の結晶 · リース · スノーグローブ · オーロラランプ + 月うさぎ'],
        items: ['crystal', 'wreath', 'snowglobe', 'aurora'],
        pets: ['moonrabbit'],
        perks: ['perk.supercar', 'perk.rabbit', 'perk.orn4'],
        code: 'MOA-SNOW-2026',
        buyUrl: 'https://www.latpeed.com/products/VTtxq'
      },
      {
        id: 'sunset', accent: '#ffd08a', glow: '#f2a24b', price: 12900,
        name: ['해바람 레어 세트', 'Sunpetal Rare Set', '日光花瓣稀有套装', 'ひだまりレアセット'],
        desc: ['회전목마 · 풍차 · 여우 등불', 'Carousel · Windmill · Lantern Fox', '旋转木马 · 风车 · 灯笼狐狸', 'メリーゴーランド · 風車 · 灯籠狐'],
        items: ['carousel', 'windmill', 'fox'],
        perks: ['perk.sleigh', 'perk.orn3', 'perk.coins2'],
        code: 'MOA-SUNN-2026',
        buyUrl: 'https://www.latpeed.com/products/VTtxq'
      },
      {
        id: 'lumen', accent: '#c9b4ff', glow: '#9a7bff', price: 14900,
        name: ['별빛 나이트 세트', 'Lumen Night Set', '星灯夜空套装', '星あかりナイトセット'],
        desc: ['별사슴 · 혜성 연 · 달빛 문 · 황금 종 + 썰매', 'Star Deer · Comet Kite · Moon Gate · Golden Bell + Sleigh', '星鹿 · 彗星风筝 · 月光门 · 金铃 + 雪橇', '星鹿 · 彗星凧 · 月の門 · 黄金の鐘 + そり'],
        items: ['deer', 'kite', 'gate', 'gbell'],
        rides: ['sleigh'],
        perks: ['perk.rabbit', 'perk.sleigh', 'perk.orn4'],
        code: 'MOA-LUMN-2026',
        buyUrl: 'https://www.latpeed.com/products/VTtxq'
      }
    ],
    byCode(code) {
      const c = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
      if (c === this.trialCode) return { trial: true, items: ['gate'], perks: ['perk.trial'], name: ['체험 선물', 'Trial gift', '体验礼物', '体験ギフト'] };
      if (c === this.creator.code) {
        return { creator: true, items: this.creator.items, pets: this.creator.pets, perks: this.creator.perks, name: this.creator.name, url: this.creator.url };
      }
      for (const s of this.sets) if (s.code === c) return { set: s, items: s.items, perks: s.perks || [] };
      return null;
    }
  };

  /* ---------------- villages ---------------- */
  const VILLAGES = [
    {
      id: 'snowbell', emoji: '❄️', cost: 0, weather: 'snow',
      tree: 'pine', house: 'cabin', ground: 'snow',
      palette: {
        skyTop: '#a9b8e0', skyMid: '#cfd6ee', skyLow: '#eef1fb',
        ground: '#eef3fd', ground2: '#dfe8f8', path: '#c9d5ec', pathEdge: '#f6f9ff',
        accent: '#3f7f8f', accent2: '#c1503f', warm: '#ffd79a',
        night: '#131a33', nightGlow: '#ffcf87'
      },
      props: ['stall', 'snowman', 'lamp', 'pine', 'pine', 'pine', 'star', 'fence', 'well']
    },
    {
      id: 'sunpetal', emoji: '🌼', cost: 180, weather: 'clear',
      tree: 'blossom', house: 'cottage', ground: 'grass',
      palette: {
        skyTop: '#8fd0e8', skyMid: '#c6e8ef', skyLow: '#f4f6dc',
        ground: '#b9de92', ground2: '#a3d17e', path: '#efe3bf', pathEdge: '#fbf3dc',
        accent: '#4f8a52', accent2: '#e2765f', warm: '#fff0a8',
        night: '#1a2440', nightGlow: '#ffdca0'
      },
      props: ['stall', 'flower', 'bench', 'blossom', 'blossom', 'windmill', 'fence', 'lamp', 'well']
    },
    {
      id: 'mochi', emoji: '🌊', cost: 420, weather: 'sunset',
      tree: 'palm', house: 'harbor', ground: 'sand',
      palette: {
        skyTop: '#f6a878', skyMid: '#f7c69b', skyLow: '#ffe6c7',
        ground: '#f3ddb2', ground2: '#e6c894', path: '#e9cf9f', pathEdge: '#fff3d6',
        accent: '#3c7d8f', accent2: '#d2603f', warm: '#ffd08a',
        night: '#20182f', nightGlow: '#ffce8a'
      },
      props: ['stall', 'lamp', 'palm', 'palm', 'bench', 'fence', 'well', 'flag']
    },
    {
      id: 'lumen', emoji: '🌙', cost: 720, weather: 'night',
      tree: 'lantern', house: 'alley', ground: 'stone',
      palette: {
        skyTop: '#2a2b52', skyMid: '#46407a', skyLow: '#7d5f9c',
        ground: '#6a5f86', ground2: '#5b5175', path: '#8a7ba8', pathEdge: '#a696c4',
        accent: '#f2b54b', accent2: '#c96a8a', warm: '#ffcf87',
        night: '#141127', nightGlow: '#ffcf87'
      },
      props: ['lantern', 'lamp', 'bench', 'lantern', 'flag', 'fence', 'stall', 'well']
    }
  ];

  /* ---------------- ornament art (inline SVG) ---------------- */
  const S = (inner) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80">' + inner + '</svg>';
  const shadow = '<ellipse cx="32" cy="75" rx="17" ry="4.2" fill="#1d1a2b" opacity=".16"/>';

  const SPR = {
    pine: S(shadow +
      '<rect x="29" y="56" width="6" height="19" rx="3" fill="#7b5232"/>' +
      '<path d="M32 5 L52 38 H12 Z" fill="#2f7d5d"/>' +
      '<path d="M32 18 L57 54 H7 Z" fill="#37936b"/>' +
      '<path d="M32 31 L62 70 H2 Z" fill="#43a377"/>' +
      '<path d="M32 5 L42 26 H22 Z" fill="#66c595" opacity=".75"/>' +
      '<circle cx="26" cy="16" r="2" fill="#ffe6a8"/><circle cx="41" cy="42" r="2" fill="#ffe6a8"/>' +
      '<circle cx="20" cy="58" r="2" fill="#ff9b8a"/><circle cx="45" cy="63" r="2" fill="#ffe6a8"/>'),
    snowman: S(shadow +
      '<ellipse cx="32" cy="64" rx="17" ry="11" fill="#fff"/>' +
      '<ellipse cx="27" cy="62" rx="8" ry="6" fill="#e8eefb" opacity=".8"/>' +
      '<circle cx="32" cy="42" r="13" fill="#fff"/>' +
      '<circle cx="27" cy="40" r="1.8" fill="#2a2438"/><circle cx="37" cy="40" r="1.8" fill="#2a2438"/>' +
      '<path d="M32 44 l7 3 -7 2z" fill="#f08a3c"/>' +
      '<path d="M21 53 q11 6 22 0" stroke="#d9503d" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M24 59 l-8 6" stroke="#7b5232" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M40 59 l8 6" stroke="#7b5232" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M20 29 h24 l-3 -10 h-18z" fill="#2f2a44"/><rect x="18" y="28" width="28" height="4" rx="2" fill="#2f2a44"/>' +
      '<circle cx="32" cy="24" r="2.4" fill="#66c595"/>' +
      '<circle cx="32" cy="55" r="1.5" fill="#2a2438"/><circle cx="32" cy="62" r="1.5" fill="#2a2438"/>'),
    lamp: S(shadow +
      '<rect x="30" y="30" width="4" height="45" rx="2" fill="#4e4a63"/>' +
      '<rect x="24" y="72" width="16" height="4" rx="2" fill="#3b3850"/>' +
      '<circle cx="32" cy="22" r="15" fill="#ffdf9f" opacity=".35"/>' +
      '<path d="M22 12 h20 l4 16 h-28z" fill="#3b3850"/>' +
      '<path d="M24 14 h16 l3 12 h-22z" fill="#ffe3a3"/>' +
      '<rect x="22" y="27" width="20" height="3.4" rx="1.7" fill="#3b3850"/>' +
      '<path d="M27 12 h10" stroke="#3b3850" stroke-width="3" stroke-linecap="round"/>'),
    gift: S(shadow +
      '<rect x="10" y="34" width="44" height="38" rx="5" fill="#e2614c"/>' +
      '<rect x="10" y="34" width="44" height="9" rx="4" fill="#f47b64"/>' +
      '<rect x="27" y="34" width="10" height="38" fill="#ffe8bd"/>' +
      '<path d="M32 34 c-8 -12 -18 -10 -16 -2 2 6 12 4 16 2z" fill="#ffe8bd"/>' +
      '<path d="M32 34 c8 -12 18 -10 16 -2 -2 6 -12 4 -16 2z" fill="#ffe8bd"/>' +
      '<circle cx="32" cy="32" r="3.4" fill="#f2b54b"/>'),
    bell: S(shadow +
      '<path d="M32 12 c-3 0 -5 2 -5 5 0 2 -2 3 -2 6 0 8 -5 20 -8 26 -1 3 1 5 4 5 h22 c3 0 5 -2 4 -5 -3 -6 -8 -18 -8 -26 0 -3 -2 -4 -2 -6 0 -3 -2 -5 -5 -5z" fill="url(#bg1)"/>' +
      '<defs><linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset=".55" stop-color="#f2b54b"/><stop offset="1" stop-color="#c98c22"/></linearGradient></defs>' +
      '<circle cx="32" cy="56" r="5" fill="#c98c22"/>' +
      '<path d="M24 22 c0 12 -4 22 -6 27" stroke="#fff3cf" stroke-width="2.6" fill="none" opacity=".7" stroke-linecap="round"/>' +
      '<circle cx="32" cy="12" r="3" fill="#c98c22"/>'),
    star: S(shadow +
      '<circle cx="32" cy="30" r="24" fill="#fff3c4" opacity=".35"/>' +
      '<path d="M32 6 l6.6 15.4 16.4 1.6 -12.4 11 3.4 16.4 -14 -8.6 -14 8.6 3.4 -16.4 -12.4 -11 16.4 -1.6z" fill="url(#sg1)" stroke="#e8b23c" stroke-width="1.2"/>' +
      '<defs><linearGradient id="sg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="1" stop-color="#f5b93c"/></linearGradient></defs>' +
      '<path d="M32 14 l3.5 8.4 8.8 .9 -6.6 5.9 1.8 8.8 -7.5 -4.6z" fill="#fffbe6" opacity=".8"/>'),
    mushroom: S(shadow +
      '<path d="M26 46 h12 l3 24 h-18z" fill="#f6e7cf"/>' +
      '<path d="M8 46 q24 -36 48 0 q-24 10 -48 0z" fill="#d95d4c"/>' +
      '<circle cx="22" cy="36" r="4" fill="#ffeede"/><circle cx="40" cy="40" r="3" fill="#ffeede"/><circle cx="32" cy="29" r="2.4" fill="#ffeede"/>' +
      '<path d="M20 64 q4 -6 8 0" stroke="#6aa87a" stroke-width="2" fill="none"/>'),
    flower: S(shadow +
      '<path d="M22 52 l20 0 3 22 h-26z" fill="#cf7a56"/><rect x="20" y="49" width="24" height="6" rx="3" fill="#e08a63"/>' +
      '<path d="M32 50 v-18" stroke="#4f9a5e" stroke-width="2.4"/>' +
      '<path d="M32 42 q-9 -2 -11 -9 q9 -1 11 9z" fill="#63b370"/>' +
      '<circle cx="32" cy="24" r="5" fill="#ffd166"/><circle cx="32" cy="24" r="2" fill="#f08a3c"/>' +
      '<g fill="#f4839e"><circle cx="24" cy="19" r="4"/><circle cx="40" cy="19" r="4"/><circle cx="32" cy="14" r="4"/><circle cx="25" cy="29" r="4"/><circle cx="40" cy="29" r="4"/></g>'),
    bench: S(shadow +
      '<rect x="8" y="42" width="48" height="7" rx="3" fill="#a9703f"/>' +
      '<rect x="8" y="33" width="48" height="6" rx="3" fill="#bd8250"/>' +
      '<rect x="8" y="24" width="48" height="6" rx="3" fill="#a9703f"/>' +
      '<rect x="12" y="49" width="5" height="22" rx="2" fill="#5b4a3a"/><rect x="47" y="49" width="5" height="22" rx="2" fill="#5b4a3a"/>' +
      '<rect x="12" y="18" width="5" height="10" rx="2" fill="#5b4a3a"/><rect x="47" y="18" width="5" height="10" rx="2" fill="#5b4a3a"/>'),
    flag: S(shadow +
      '<rect x="30" y="10" width="4" height="65" rx="2" fill="#8b6a4a"/>' +
      '<path d="M34 14 q14 2 22 8 q-10 8 -22 8z" fill="#e2614c"/>' +
      '<path d="M34 22 q12 2 18 6 q-8 6 -18 6z" fill="#f2b54b" opacity=".75"/>' +
      '<circle cx="32" cy="9" r="3.4" fill="#f2b54b"/>'),
    candy: S(shadow +
      '<path d="M40 14 a12 12 0 0 1 0 24 l-14 34" stroke="#fff" stroke-width="11" fill="none" stroke-linecap="round"/>' +
      '<path d="M40 14 a12 12 0 0 1 0 24 l-14 34" stroke="#e2614c" stroke-width="11" fill="none" stroke-linecap="round" stroke-dasharray="5 9"/>' +
      '<path d="M40 14 a12 12 0 0 1 0 24 l-14 34" stroke="#ffd7cf" stroke-width="3" fill="none" stroke-linecap="round" opacity=".65"/>'),
    boot: S(shadow +
      '<path d="M24 8 h16 v30 q10 6 12 16 q1 6 -5 6 h-24 q-5 0 -4 -6 q2 -11 5 -16z" fill="#c1503f"/>' +
      '<path d="M24 8 h16 v6 h-16z" fill="#fff3e2"/>' +
      '<path d="M22 60 h30 q4 0 3 5 q-1 6 -6 6 h-30 q-4 0 -3 -6z" fill="#3b3850"/>' +
      '<circle cx="36" cy="34" r="3" fill="#ffe3a3"/>'),
    fence: S(shadow +
      '<g fill="#f7efe2" stroke="#d8c8b2" stroke-width="1.2">' +
      '<path d="M8 26 l6 -6 6 6 v44 h-12z"/><path d="M26 22 l6 -6 6 6 v48 h-12z"/><path d="M44 26 l6 -6 6 6 v44 h-12z"/></g>' +
      '<rect x="6" y="38" width="50" height="5" rx="2" fill="#e8dcc6"/><rect x="6" y="54" width="50" height="5" rx="2" fill="#e8dcc6"/>'),
    well: S(shadow +
      '<ellipse cx="32" cy="70" rx="20" ry="7" fill="#8a7f9c"/>' +
      '<path d="M14 50 h36 v18 q0 4 -4 4 h-28 q-4 0 -4 -4z" fill="#9d93ad"/>' +
      '<ellipse cx="32" cy="50" rx="18" ry="6" fill="#5a5378"/>' +
      '<rect x="14" y="20" width="4" height="30" fill="#8b6a4a"/><rect x="46" y="20" width="4" height="30" fill="#8b6a4a"/>' +
      '<path d="M10 20 L32 6 L54 20z" fill="#c1503f"/>' +
      '<path d="M32 20 v14" stroke="#e8dcc6" stroke-width="2"/><rect x="27" y="33" width="10" height="7" rx="2" fill="#a9703f"/>' +
      '<circle cx="20" cy="60" r="1.6" fill="#fff" opacity=".5"/><circle cx="42" cy="63" r="1.6" fill="#fff" opacity=".5"/>'),
    crystal: S(shadow +
      '<circle cx="32" cy="40" r="26" fill="#bfe6ff" opacity=".22"/>' +
      '<path d="M32 8 l10 24 -6 34 h-8 l-6 -34z" fill="url(#cry)"/>' +
      '<path d="M20 30 l7 12 -3 22 h-6 l-4 -30z" fill="#a9dbff" opacity=".9"/>' +
      '<path d="M44 32 l6 12 -2 20 h-6 l-2 -24z" fill="#8fcbf7" opacity=".9"/>' +
      '<defs><linearGradient id="cry" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2fbff"/><stop offset=".5" stop-color="#b6e3ff"/><stop offset="1" stop-color="#79b9ea"/></linearGradient></defs>' +
      '<path d="M32 14 l3 12 -3 12 -3 -12z" fill="#fff" opacity=".7"/>' +
      '<circle cx="48" cy="20" r="2" fill="#fff"/><circle cx="16" cy="44" r="1.6" fill="#fff"/>'),
    wreath: S(shadow +
      '<circle cx="32" cy="40" r="22" fill="none" stroke="#2f7d5d" stroke-width="11"/>' +
      '<circle cx="32" cy="40" r="22" fill="none" stroke="#46a077" stroke-width="5" stroke-dasharray="4 6"/>' +
      '<g fill="#e2614c"><circle cx="20" cy="24" r="3"/><circle cx="44" cy="26" r="3"/><circle cx="32" cy="62" r="3"/><circle cx="14" cy="44" r="3"/><circle cx="50" cy="46" r="3"/></g>' +
      '<path d="M22 56 l10 -8 10 8 -10 4z" fill="#e2614c"/>' +
      '<circle cx="32" cy="54" r="3.6" fill="#f2b54b"/>' +
      '<path d="M22 56 l-6 6 M42 56 l6 6" stroke="#e2614c" stroke-width="3" stroke-linecap="round"/>'),
    snowglobe: S(shadow +
      '<path d="M20 56 h24 l4 14 h-32z" fill="#8b6a4a"/>' +
      '<rect x="18" y="53" width="28" height="5" rx="2.5" fill="#a9835c"/>' +
      '<circle cx="32" cy="34" r="22" fill="#e7f4ff" opacity=".55"/>' +
      '<circle cx="32" cy="34" r="22" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>' +
      '<path d="M26 44 l6 -14 6 14z" fill="#4c9a74"/>' +
      '<rect x="30" y="44" width="4" height="6" fill="#8b6a4a"/>' +
      '<g fill="#fff"><circle cx="22" cy="26" r="2"/><circle cx="41" cy="22" r="1.6"/><circle cx="44" cy="38" r="1.8"/><circle cx="24" cy="40" r="1.4"/><circle cx="34" cy="17" r="1.4"/></g>' +
      '<path d="M12 34 a20 20 0 0 1 12 -18" stroke="#fff" stroke-width="3" fill="none" opacity=".8" stroke-linecap="round"/>'),
    carousel: S(shadow +
      '<ellipse cx="32" cy="71" rx="21" ry="5" fill="#c9b6a0"/>' +
      '<rect x="13" y="66" width="38" height="5" rx="2.5" fill="#a9835c"/>' +
      '<rect x="29" y="24" width="6" height="44" fill="#f2d7a8"/>' +
      '<path d="M10 24 L32 8 L54 24z" fill="#e2614c"/>' +
      '<path d="M14 24 h36 l-2 6 h-32z" fill="#f2b54b"/>' +
      '<g fill="#fff6e6"><circle cx="32" cy="14" r="2"/><circle cx="22" cy="20" r="1.6"/><circle cx="42" cy="20" r="1.6"/></g>' +
      '<path d="M18 34 q6 -4 8 2 q-4 6 -8 -2z" fill="#ffd8c9"/>' +
      '<path d="M38 34 q6 -4 8 2 q-4 6 -8 -2z" fill="#cfe9ff"/>' +
      '<path d="M20 40 v22 M44 40 v22" stroke="#c9a06a" stroke-width="2.4"/>'),
    windmill: S(shadow +
      '<path d="M24 70 l4 -40 h8 l4 40z" fill="#f3e9d7"/>' +
      '<path d="M26 70 l3 -40 h3 l-2 40z" fill="#e2d3ba"/>' +
      '<path d="M20 30 h24 l-2 -8 h-20z" fill="#c1503f"/>' +
      '<circle cx="32" cy="26" r="4" fill="#8b6a4a"/>' +
      '<g stroke="#a9835c" stroke-width="3.4" stroke-linecap="round">' +
      '<path d="M32 24 L32 4"/><path d="M34 26 L52 16"/><path d="M32 28 L32 48"/><path d="M30 26 L12 36"/></g>' +
      '<g fill="#fff6e6" opacity=".9"><path d="M32 4 l6 6 -6 6 -6 -6z"/><path d="M52 16 l-2 8 -8 0z"/><path d="M32 48 l6 -6 6 6 -6 6z" opacity=".7"/><path d="M12 36 l8 -2 0 8z" opacity=".7"/></g>' +
      '<rect x="29" y="58" width="6" height="12" rx="3" fill="#8b6a4a"/>'),
    fox: S(shadow +
      '<path d="M40 66 q14 4 16 -8 q2 -10 -6 -12 q4 10 -10 12z" fill="#e0803f"/>' +
      '<ellipse cx="30" cy="58" rx="14" ry="12" fill="#e8944f"/>' +
      '<path d="M20 50 q-2 -14 8 -18 q10 4 8 18 q-6 8 -16 0z" fill="#f0a55f"/>' +
      '<path d="M21 36 l-2 -12 9 6z" fill="#e0803f"/><path d="M35 34 l6 -10 3 12z" fill="#e0803f"/>' +
      '<circle cx="27" cy="45" r="1.8" fill="#2a2438"/><circle cx="35" cy="45" r="1.8" fill="#2a2438"/>' +
      '<path d="M31 49 l2 2 -2 1z" fill="#2a2438"/>' +
      '<path d="M22 40 q-4 3 -1 6 q4 1 4 -3z" fill="#fff" opacity=".85"/>' +
      '<g><rect x="44" y="30" width="2" height="14" fill="#6b5a44"/><circle cx="45" cy="46" r="7" fill="#ffd98a" opacity=".95"/><circle cx="45" cy="46" r="3.4" fill="#fff3c4"/></g>'),
    deer: S(shadow +
      '<ellipse cx="30" cy="60" rx="13" ry="10" fill="#c9b39a"/>' +
      '<path d="M25 68 v6 M36 68 v6" stroke="#a8927a" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M22 50 q-2 -12 8 -14 q10 2 8 14z" fill="#dcc7ad"/>' +
      '<circle cx="30" cy="38" r="9" fill="#e8d5bd"/>' +
      '<path d="M23 34 l-2 -8 6 4z M37 34 l2 -8 -6 4z" fill="#e8d5bd"/>' +
      '<circle cx="27" cy="38" r="1.6" fill="#2a2438"/><circle cx="33" cy="38" r="1.6" fill="#2a2438"/>' +
      '<path d="M30 42 l2 2 -2 1z" fill="#2a2438"/>' +
      '<g stroke="#ffd98a" stroke-width="2" fill="none" stroke-linecap="round" opacity=".95"><path d="M23 30 q-6 -8 -2 -14"/><path d="M23 26 q-8 0 -10 -6"/><path d="M37 30 q6 -8 2 -14"/><path d="M37 26 q8 0 10 -6"/></g>' +
      '<circle cx="30" cy="8" r="2.4" fill="#fff3c4"/><circle cx="12" cy="20" r="1.6" fill="#fff3c4"/>'),
    kite: S(shadow +
      '<path d="M32 6 L52 30 L32 56 L12 30z" fill="#f2b54b"/>' +
      '<path d="M32 6 L32 56" stroke="#e8a02c" stroke-width="2"/><path d="M12 30 H52" stroke="#e8a02c" stroke-width="2"/>' +
      '<path d="M32 6 L52 30 L32 30z" fill="#ffe1a0"/><path d="M12 30 L32 30 L32 56z" fill="#e8993c"/>' +
      '<path d="M32 56 q4 8 -2 12 q8 0 6 8" stroke="#e2614c" stroke-width="2" fill="none"/>' +
      '<g fill="#e2614c"><circle cx="32" cy="62" r="2.4"/><circle cx="35" cy="70" r="2.4"/></g>' +
      '<circle cx="32" cy="30" r="3" fill="#fff8e6" opacity=".8"/>'),
    gate: S(shadow +
      '<path d="M12 72 v-30 q20 -26 40 0 v30" fill="none" stroke="#9d93ad" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M12 72 v-30 q20 -26 40 0 v30" fill="none" stroke="#fff3cf" stroke-width="2.4" opacity=".75"/>' +
      '<circle cx="32" cy="24" r="9" fill="#ffd98a" opacity=".45"/>' +
      '<circle cx="32" cy="24" r="5" fill="#fff3cf"/>' +
      '<path d="M6 72 h52" stroke="#6b6280" stroke-width="5" stroke-linecap="round"/>' +
      '<g fill="#fff3cf" opacity=".9"><circle cx="20" cy="46" r="1.6"/><circle cx="44" cy="44" r="1.6"/><circle cx="32" cy="56" r="1.4"/></g>'),
    aurora: S(shadow +
      '<rect x="30" y="40" width="4" height="34" rx="2" fill="#4e4a63"/>' +
      '<rect x="24" y="70" width="16" height="4" rx="2" fill="#3b3850"/>' +
      '<path d="M32 40 q-24 -6 -26 -24" stroke="#8ef0d0" stroke-width="7" fill="none" opacity=".75" stroke-linecap="round"/>' +
      '<path d="M32 36 q26 -4 26 -26" stroke="#b3a6ff" stroke-width="7" fill="none" opacity=".7" stroke-linecap="round"/>' +
      '<path d="M32 32 q-10 -16 4 -26" stroke="#ffd0f0" stroke-width="6" fill="none" opacity=".65" stroke-linecap="round"/>' +
      '<circle cx="32" cy="40" r="6" fill="#fff6d8"/><circle cx="32" cy="40" r="12" fill="#ffe9a8" opacity=".3"/>' +
      '<circle cx="14" cy="14" r="1.8" fill="#fff"/><circle cx="50" cy="10" r="1.4" fill="#fff"/>'),
    gbell: S(shadow +
      '<circle cx="32" cy="40" r="24" fill="#ffe9a8" opacity=".22"/>' +
      '<path d="M32 14 c-3 0 -5 2 -5 5 0 2 -2 3 -2 6 0 8 -5 18 -8 24 -1 3 1 5 4 5 h22 c3 0 5 -2 4 -5 -3 -6 -8 -16 -8 -24 0 -3 -2 -4 -2 -6 0 -3 -2 -5 -5 -5z" fill="url(#gg)"/>' +
      '<defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6d0"/><stop offset=".5" stop-color="#f5c65a"/><stop offset="1" stop-color="#c98c22"/></linearGradient></defs>' +
      '<circle cx="32" cy="56" r="5" fill="#c98c22"/><circle cx="32" cy="12" r="3.2" fill="#c98c22"/>' +
      '<path d="M24 22 c0 10 -4 20 -6 24" stroke="#fffbe8" stroke-width="2.6" fill="none" opacity=".75" stroke-linecap="round"/>' +
      '<circle cx="14" cy="20" r="2" fill="#fff3c4"/><circle cx="50" cy="30" r="1.6" fill="#fff3c4"/>')
  };

  /* ---------------- pets ---------------- */
  const PET_SPR = {
    puppy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 56">' +
      '<ellipse cx="32" cy="51" rx="16" ry="3.6" fill="#1d1a2b" opacity=".18"/>' +
      '<path d="M44 40 q10 -2 10 -10" stroke="#e0b284" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="32" cy="36" rx="14" ry="11" fill="#f0c79a"/>' +
      '<circle cx="30" cy="21" r="12" fill="#f6d6ae"/>' +
      '<path d="M19 14 q-4 10 2 14 q4 -8 4 -14z" fill="#c98f5c"/>' +
      '<path d="M41 14 q4 10 -2 14 q-4 -8 -4 -14z" fill="#c98f5c"/>' +
      '<circle cx="26" cy="20" r="1.8" fill="#2a2438"/><circle cx="35" cy="20" r="1.8" fill="#2a2438"/>' +
      '<ellipse cx="30" cy="26" rx="4" ry="3" fill="#fff"/>' +
      '<path d="M30 27 q0 3 2 3" stroke="#2a2438" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M28 30 q2 3 4 0" stroke="#e07a6a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<circle cx="24" cy="46" r="3.4" fill="#e8c39a"/><circle cx="38" cy="46" r="3.4" fill="#e8c39a"/>' +
      '<circle cx="35" cy="31" r="6" fill="#f2d2b0" opacity=".0"/>' +
      '</svg>',
    cat: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 56">' +
      '<ellipse cx="32" cy="51" rx="15" ry="3.4" fill="#1d1a2b" opacity=".18"/>' +
      '<path d="M44 44 q12 0 8 -14 q-2 -5 -6 -3 q4 8 -3 11z" fill="#b9b3c9"/>' +
      '<ellipse cx="32" cy="38" rx="13" ry="10" fill="#cfc9dc"/>' +
      '<circle cx="30" cy="22" r="11" fill="#dad5e6"/>' +
      '<path d="M20 15 l-1 -9 8 5z" fill="#cfc9dc"/><path d="M40 15 l1 -9 -8 5z" fill="#cfc9dc"/>' +
      '<path d="M21 14 l0 -5 4 3z" fill="#f0b8c2"/><path d="M39 14 l0 -5 -4 3z" fill="#f0b8c2"/>' +
      '<path d="M24 20 q2 -2 4 0" stroke="#4a4458" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M34 20 q2 -2 4 0" stroke="#4a4458" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M30 25 l2 2 -2 1z" fill="#e58f9f"/>' +
      '<path d="M22 26 l-7 -1 M22 28 l-7 2" stroke="#9a93ab" stroke-width="1" />' +
      '<path d="M38 26 l7 -1 M38 28 l7 2" stroke="#9a93ab" stroke-width="1" />' +
      '<circle cx="24" cy="45" r="3" fill="#cec8da"/><circle cx="38" cy="45" r="3" fill="#cec8da"/>' +
      '</svg>',
    moonrabbit: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<ellipse cx="32" cy="58" rx="14" ry="3.4" fill="#1d1a2b" opacity=".16"/>' +
      '<circle cx="32" cy="34" r="24" fill="#efe9ff" opacity=".35"/>' +
      '<ellipse cx="32" cy="46" rx="12" ry="10" fill="#fbf7ff"/>' +
      '<circle cx="31" cy="30" r="11" fill="#fff"/>' +
      '<path d="M24 22 q-4 -14 2 -15 q6 4 4 15z" fill="#fbf7ff"/>' +
      '<path d="M38 22 q4 -14 -2 -15 q-6 4 -4 15z" fill="#fbf7ff"/>' +
      '<path d="M25 21 q-2 -9 1 -10 q3 3 2 10z" fill="#f3c9dd"/>' +
      '<path d="M37 21 q2 -9 -1 -10 q-3 3 -2 10z" fill="#f3c9dd"/>' +
      '<circle cx="27" cy="30" r="1.7" fill="#2a2438"/><circle cx="35" cy="30" r="1.7" fill="#2a2438"/>' +
      '<path d="M31 34 l2 2 -2 1z" fill="#e58f9f"/>' +
      '<path d="M29 37 q3 2 5 0" stroke="#c08ba0" stroke-width="1.3" fill="none"/>' +
      '<circle cx="20" cy="34" r="2.4" fill="#ffd0e0" opacity=".7"/><circle cx="42" cy="34" r="2.4" fill="#ffd0e0" opacity=".7"/>' +
      '<path d="M20 46 q-6 2 -7 8 q6 1 9 -4z" fill="#fff6fb"/>' +
      '<circle cx="40" cy="20" r="1.6" fill="#fff3c4"/><circle cx="14" cy="24" r="1.2" fill="#fff3c4"/>' +
      '</svg>',
    critter: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 56">' +
      '<ellipse cx="32" cy="51" rx="14" ry="3.2" fill="#1d1a2b" opacity=".18"/>' +
      '<path d="M44 40 q14 -4 12 -18 q-1 -6 -6 -5 q3 8 -2 13 q-3 4 -6 4z" fill="#c98f5c"/>' +
      '<ellipse cx="31" cy="38" rx="12" ry="11" fill="#e0b284"/>' +
      '<circle cx="31" cy="24" r="10" fill="#edc79c"/>' +
      '<path d="M22 18 l-2 -8 7 4z" fill="#d3a06a"/><path d="M40 18 l2 -8 -7 4z" fill="#d3a06a"/>' +
      '<circle cx="27" cy="23" r="1.8" fill="#2a2438"/><circle cx="35" cy="23" r="1.8" fill="#2a2438"/>' +
      '<path d="M31 27 l2 2 -2 1z" fill="#8a5a3c"/>' +
      '<path d="M27 30 q4 3 8 0" stroke="#a06a44" stroke-width="1.4" fill="none"/>' +
      '<circle cx="31" cy="42" r="6" fill="#f3dcc0"/>' +
      '<circle cx="23" cy="46" r="2.6" fill="#d3a06a"/><circle cx="39" cy="46" r="2.6" fill="#d3a06a"/>' +
      '</svg>'
  };

  /* ---------------- rides ---------------- */
  const RIDE_SPR = {
    bike: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 64">' +
      '<ellipse cx="48" cy="56" rx="34" ry="5" fill="#1d1a2b" opacity=".16"/>' +
      '<g fill="none" stroke="#4a4458" stroke-width="3">' +
      '<circle cx="26" cy="44" r="12"/><circle cx="68" cy="44" r="12"/></g>' +
      '<g fill="none" stroke="#c9d3e8" stroke-width="1.4">' +
      '<circle cx="26" cy="44" r="6"/><circle cx="68" cy="44" r="6"/></g>' +
      '<path d="M26 44 L40 24 L60 24 M40 24 L52 44 L68 44 M60 24 L52 44" stroke="#e2614c" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M36 20 h10" stroke="#4a4458" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M60 24 l6 -6" stroke="#4a4458" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="34" cy="54" r="3" fill="#8cc8b4"/>' +
      '</svg>',
    scooter: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 64">' +
      '<ellipse cx="48" cy="56" rx="30" ry="4.6" fill="#1d1a2b" opacity=".16"/>' +
      '<circle cx="30" cy="48" r="8" fill="#3b3850"/><circle cx="30" cy="48" r="3" fill="#c9d3e8"/>' +
      '<circle cx="68" cy="48" r="8" fill="#3b3850"/><circle cx="68" cy="48" r="3" fill="#c9d3e8"/>' +
      '<path d="M30 48 h20 q10 0 12 -10 l4 -12" stroke="#8cc8b4" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      '<path d="M22 46 h30 l4 6 h-34z" fill="#5fae97"/>' +
      '<path d="M64 26 h12" stroke="#3b3850" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M52 22 h10 l2 8 h-12z" fill="#f2b54b"/>' +
      '<circle cx="58" cy="26" r="2.4" fill="#fff6d8"/>' +
      '</svg>',
    balloon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 96">' +
      '<ellipse cx="36" cy="92" rx="12" ry="3" fill="#1d1a2b" opacity=".1"/>' +
      '<path d="M36 8 q26 0 26 26 q0 22 -26 38 q-26 -16 -26 -38 q0 -26 26 -26z" fill="url(#bl)"/>' +
      '<defs><linearGradient id="bl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd08a"/><stop offset=".5" stop-color="#f07a5c"/><stop offset="1" stop-color="#c1503f"/></linearGradient></defs>' +
      '<path d="M36 8 q10 0 14 12 q4 14 -14 38 q-18 -24 -14 -38 q4 -12 14 -12z" fill="#ffe0b8" opacity=".55"/>' +
      '<path d="M22 12 q6 20 2 38 M50 12 q-6 20 -2 38" stroke="#fff3d6" stroke-width="2" opacity=".6" fill="none"/>' +
      '<path d="M28 72 h16 l-2 10 h-12z" fill="#a9703f"/>' +
      '<path d="M32 70 v-6 M40 70 v-6" stroke="#8b6a4a" stroke-width="1.6"/>' +
      '<path d="M28 82 h16" stroke="#8b6a4a" stroke-width="2"/>' +
      '</svg>',
    sleigh: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72">' +
      '<ellipse cx="48" cy="64" rx="30" ry="4.6" fill="#1d1a2b" opacity=".16"/>' +
      '<path d="M18 52 q0 -16 16 -16 h36 q8 0 8 10 v6 h-56z" fill="#c1503f"/>' +
      '<path d="M18 46 q4 -8 14 -8 h34 q6 0 6 8z" fill="#e2614c"/>' +
      '<path d="M30 24 h10 v10 h-10z" fill="#f2b54b"/><path d="M32 26 h6 v6 h-6z" fill="#ffe9a8"/>' +
      '<path d="M14 54 q0 8 8 8 h52 q8 0 8 -6" stroke="#8b6a4a" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M14 58 h62" stroke="#a9835c" stroke-width="2"/>' +
      '<circle cx="78" cy="30" r="4" fill="#8cc8b4"/>' +
      '<path d="M64 30 q6 -6 12 0" stroke="#e8dcc6" stroke-width="2" fill="none"/>' +
      '</svg>',
    car: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 64">' +
      '<ellipse cx="50" cy="57" rx="34" ry="4.6" fill="#1d1a2b" opacity=".16"/>' +
      '<path d="M14 46 q0 -10 8 -11 l8 -1 q6 -13 20 -13 q14 0 19 13 l13 2 q8 2 8 10 v5 q0 4 -5 4 h-66 q-5 0 -5 -4z" fill="url(#cg)"/>' +
      '<defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8cc8b4"/><stop offset=".55" stop-color="#5fae97"/><stop offset="1" stop-color="#3f8a76"/></linearGradient></defs>' +
      '<path d="M32 22 q6 -8 16 -8 q11 0 16 8z" fill="#dff2f8"/>' +
      '<path d="M50 14 v8" stroke="#3f8a76" stroke-width="1.6" opacity=".5"/>' +
      '<path d="M20 35 h58" stroke="#ffffff" stroke-width="2" opacity=".35"/>' +
      '<circle cx="28" cy="51" r="8" fill="#2f2a44"/><circle cx="28" cy="51" r="3.2" fill="#e8eefb"/>' +
      '<circle cx="73" cy="51" r="8" fill="#2f2a44"/><circle cx="73" cy="51" r="3.2" fill="#e8eefb"/>' +
      '<rect x="84" y="35" width="7" height="5" rx="2" fill="#ffe6a8"/>' +
      '<rect x="11" y="35" width="6" height="4" rx="2" fill="#ffb3a0"/>' +
      '<circle cx="50" cy="32" r="3" fill="#ffe6a8" opacity=".75"/>' +
      '</svg>',
    supercar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 116 58">' +
      '<ellipse cx="58" cy="52" rx="42" ry="4" fill="#1d1a2b" opacity=".2"/>' +
      '<path d="M8 43 q1 -9 12 -11 l14 -2 q9 -11 24 -11 q15 0 22 11 l16 3 q8 2 8 9 v3 q0 4 -5 4 h-86 q-5 0 -5 -4z" fill="url(#sc)"/>' +
      '<defs><linearGradient id="sc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd08a"/><stop offset=".45" stop-color="#f0715c"/><stop offset="1" stop-color="#b8324a"/></linearGradient></defs>' +
      '<path d="M33 30 q8 -9 20 -9 q13 0 19 9z" fill="#2b2540"/>' +
      '<path d="M37 29 q7 -7 16 -7 q10 0 15 7z" fill="#9fd8ee" opacity=".85"/>' +
      '<path d="M12 41 h86" stroke="#ffe9c4" stroke-width="2.4" opacity=".55"/>' +
      '<path d="M96 25 l12 3 0 5 -14 -2z" fill="#c9d3e8"/>' +
      '<path d="M100 24 h12 v3 h-12z" fill="#ffd08a"/>' +
      '<circle cx="32" cy="47" r="9" fill="#242036"/><circle cx="32" cy="47" r="4" fill="#e8eefb"/><circle cx="32" cy="47" r="1.6" fill="#9aa6bb"/>' +
      '<circle cx="82" cy="47" r="9" fill="#242036"/><circle cx="82" cy="47" r="4" fill="#e8eefb"/><circle cx="82" cy="47" r="1.6" fill="#9aa6bb"/>' +
      '<path d="M104 36 l8 1 -2 4 -7 -1z" fill="#fff3c4"/>' +
      '<circle cx="105" cy="38" r="3.4" fill="#fff8dc" opacity=".9"/>' +
      '<path d="M22 34 h16" stroke="#fff" stroke-width="2" opacity=".35"/>' +
      '</svg>',
    tram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72">' +
      '<ellipse cx="48" cy="64" rx="34" ry="5" fill="#1d1a2b" opacity=".16"/>' +
      '<path d="M20 18 h56 q6 0 6 6 v26 q0 6 -6 6 h-56 q-6 0 -6 -6 v-26 q0 -6 6 -6z" fill="#e2614c"/>' +
      '<path d="M20 18 h56 q6 0 6 6 v6 h-68 v-6 q0 -6 6 -6z" fill="#f47b64"/>' +
      '<g fill="#fff6e0"><rect x="22" y="32" width="14" height="12" rx="2"/><rect x="41" y="32" width="14" height="12" rx="2"/><rect x="60" y="32" width="14" height="12" rx="2"/></g>' +
      '<circle cx="30" cy="58" r="6" fill="#3b3850"/><circle cx="66" cy="58" r="6" fill="#3b3850"/>' +
      '<circle cx="30" cy="58" r="2" fill="#c9d3e8"/><circle cx="66" cy="58" r="2" fill="#c9d3e8"/>' +
      '<path d="M48 18 v-8 M40 10 h16" stroke="#4a4458" stroke-width="2.4"/>' +
      '<circle cx="80" cy="28" r="2.4" fill="#ffd98a"/>' +
      '</svg>'
  };

  const AVATAR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64">' +
    '<ellipse cx="24" cy="61" rx="12" ry="2.8" fill="#1d1a2b" opacity=".2"/>' +
    '<path d="M16 46 q-2 10 0 14 h5 l1 -12z M32 46 q2 10 0 14 h-5 l-1 -12z" fill="#3b3850"/>' +
    '<path d="M14 30 q10 -6 20 0 l2 18 q-12 5 -24 0z" fill="#e2614c"/>' +
    '<path d="M14 34 q10 4 20 0" stroke="#f9a191" stroke-width="2.4" fill="none"/>' +
    '<circle cx="24" cy="20" r="10" fill="#f6d6b8"/>' +
    '<path d="M14 18 q2 -12 10 -12 q8 0 10 12 q-10 -4 -20 0z" fill="#3b3850"/>' +
    '<circle cx="20.5" cy="20" r="1.6" fill="#2a2438"/><circle cx="27.5" cy="20" r="1.6" fill="#2a2438"/>' +
    '<path d="M22 25 q2 2 4 0" stroke="#c96a5a" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
    '<circle cx="15.5" cy="23" r="2.2" fill="#f7a5a0" opacity=".5"/><circle cx="32.5" cy="23" r="2.2" fill="#f7a5a0" opacity=".5"/>' +
    '</svg>';

  /* ---------------- ornaments ---------------- */
  const ORN = [
    { id: 'pine', art: 'pine', rarity: 'common', price: 40, scale: 1.0 },
    { id: 'snowman', art: 'snowman', rarity: 'common', price: 60, scale: .95 },
    { id: 'lamp', art: 'lamp', rarity: 'common', price: 80, scale: .95 },
    { id: 'gift', art: 'gift', rarity: 'common', price: 60, scale: .8 },
    { id: 'bell', art: 'bell', rarity: 'common', price: 90, scale: .8 },
    { id: 'star', art: 'star', rarity: 'common', price: 100, scale: .8 },
    { id: 'mushroom', art: 'mushroom', rarity: 'common', price: 45, scale: .8 },
    { id: 'flower', art: 'flower', rarity: 'common', price: 55, scale: .85 },
    { id: 'bench', art: 'bench', rarity: 'common', price: 70, scale: .9 },
    { id: 'flag', art: 'flag', rarity: 'common', price: 50, scale: .95 },
    { id: 'candy', art: 'candy', rarity: 'common', price: 65, scale: .9 },
    { id: 'boot', art: 'boot', rarity: 'common', price: 55, scale: .85 },
    { id: 'fence', art: 'fence', rarity: 'common', price: 45, scale: .85 },
    { id: 'well', art: 'well', rarity: 'common', price: 120, scale: 1.0 },
    { id: 'crystal', art: 'crystal', rarity: 'rare', price: 320, scale: 1.0 },
    { id: 'wreath', art: 'wreath', rarity: 'rare', price: 300, scale: .95 },
    { id: 'snowglobe', art: 'snowglobe', rarity: 'rare', price: 360, scale: .9 },
    { id: 'carousel', art: 'carousel', rarity: 'rare', price: 420, scale: 1.05 },
    { id: 'windmill', art: 'windmill', rarity: 'rare', price: 380, scale: 1.1 },
    { id: 'fox', art: 'fox', rarity: 'limited', price: null, scale: 1.0 },
    { id: 'deer', art: 'deer', rarity: 'limited', price: null, scale: 1.0 },
    { id: 'kite', art: 'kite', rarity: 'limited', price: null, scale: .95 },
    { id: 'gate', art: 'gate', rarity: 'limited', price: null, scale: 1.15 },
    { id: 'aurora', art: 'aurora', rarity: 'limited', price: null, scale: 1.1 },
    { id: 'gbell', art: 'gbell', rarity: 'limited', price: null, scale: .85 }
  ];

  /* ---------------- pets / rides catalog ---------------- */
  const PETS = [
    { id: 'puppy', price: 0, speed: 26, start: 0.0 },
    { id: 'cat', price: 260, speed: 20, start: .45 },
    { id: 'critter', price: 180, speed: 34, start: .72 },
    { id: 'moonrabbit', price: null, rapid: true, speed: 22, start: .55 }
  ];
  const RIDES = [
    { id: 'bike', price: 0, speed: 46, path: 'road', vehicle: true },
    { id: 'scooter', price: 240, speed: 58, path: 'road', vehicle: true },
    { id: 'balloon', price: 480, speed: 14, path: 'air' },
    { id: 'tram', price: 620, speed: 30, path: 'road', vehicle: true },
    { id: 'sleigh', price: null, rapid: true, speed: 40, path: 'road', vehicle: true },
    { id: 'supercar', price: null, rapid: true, speed: 60, path: 'road', vehicle: true }
  ];

  /* ---------------- drivable vehicles (v2 open world) ---------------- */
  const VEHICLES = {
    minicar: { sprite: 'car', max: 330, accel: 360, turn: 2.9, offroad: .55, horn: 'beep', scale: 1.0 },
    supercar: { sprite: 'supercar', max: 540, accel: 620, turn: 3.6, offroad: .42, horn: 'sport', scale: 1.05, premium: true },
    bike: { sprite: 'bike', max: 250, accel: 260, turn: 4.2, offroad: .7, horn: 'ring', scale: .86 },
    scooter: { sprite: 'scooter', max: 320, accel: 330, turn: 3.6, offroad: .62, horn: 'beep', scale: .82 },
    tram: { sprite: 'tram', max: 300, accel: 240, turn: 2.2, offroad: .38, horn: 'ding', scale: 1.12, heavy: true },
    sleigh: { sprite: 'sleigh', max: 460, accel: 470, turn: 3.2, offroad: .8, horn: 'bells', scale: 1.0 }
  };

  MV.Catalog = {
    RAPID, VILLAGES, ORN, PETS, RIDES, VEHICLES,
    SPR, PET_SPR, RIDE_SPR, AVATAR,
    TREND_FALLBACK: [
      { id: 'gbell', score: 98 }, { id: 'aurora', score: 94 }, { id: 'deer', score: 91 },
      { id: 'snowglobe', score: 87 }, { id: 'carousel', score: 84 }, { id: 'kite', score: 80 }
    ],
    orn(id) { return ORN.find(o => o.id === id) || null; },
    village(id) { return VILLAGES.find(v => v.id === id) || VILLAGES[0]; },
    pet(id) { return PETS.find(p => p.id === id) || null; },
    ride(id) { return RIDES.find(r => r.id === id) || null; },
    vehicle(id) { return VEHICLES[id] || null; },
    setName(set) {
      const i = { ko: 0, en: 1, zh: 2, ja: 3 }[MV.I18n.lang] || 0;
      return set.name ? set.name[i] : set.id;
    },
    setDesc(set) {
      const i = { ko: 0, en: 1, zh: 2, ja: 3 }[MV.I18n.lang] || 0;
      return set.desc ? set.desc[i] : '';
    },
    spriteData(art) {
      const svg = SPR[art];
      return svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) : null;
    },
    petData(id) {
      const svg = PET_SPR[id];
      return svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) : null;
    },
    rideData(id) {
      const svg = RIDE_SPR[id];
      if (svg) return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      /* vehicles (supercar, minicar, …) share the vehicle sprite sheet */
      const cfg = VEHICLES[id];
      const art = cfg && RIDE_SPR[cfg.sprite];
      return art ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(art) : null;
    },
    avatarData() {
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(AVATAR);
    }
  };
})();
