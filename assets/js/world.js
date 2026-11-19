/* MOA Village v2 — open world plan (3000×2200) + city palettes + static map */
(function () {
  'use strict';
  window.MV = window.MV || {};

  const W = 3000, H = 2200, TAU = Math.PI * 2;

  function seeded(seed) {
    let s = seed % 233280 || 7;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  /* ---------------- city palettes per village theme ---------------- */
  const CITY = {
    snowbell: {
      ground: '#eef4fd', ground2: '#e2eaf8', road: '#787f92', roadDark: '#666d80',
      line: '#f4f7ff', walk: '#dde6f5', walkEdge: '#cbd7ea',
      plaza: '#e9eef9', plazaLine: '#d3dcee', plazaEdge: '#c7d3e8',
      grass: '#e6eefb', grass2: '#d7e3f6', water: '#6d96bb', waterDeep: '#4e749a', waterFoam: '#d8ecff',
      wall: '#f4eddf', wall2: '#e4d9c7', wallDark: '#4a3f52', roof: '#b1553f', roof2: '#8f4232',
      glass: '#cfe3f2', accent: '#3f7f8f', accent2: '#c1503f', trunk: '#8b6a4a',
      leaf: '#3f8f6a', leaf2: '#2f7d5d', sand: '#e9effa', snow: '#ffffff',
      neon: '#ffcf87', sign: '#ffe3a3', signBg: '#3b3850', shade: 'rgba(40,52,82,.16)'
    },
    sunpetal: {
      ground: '#b9de92', ground2: '#a8d382', road: '#7b8189', roadDark: '#696f77',
      line: '#fff8e2', walk: '#e7e0c6', walkEdge: '#d6cfb0',
      plaza: '#f0e6c6', plazaLine: '#e0d2ab', plazaEdge: '#d3c39c',
      grass: '#b4dc8d', grass2: '#a2cf7c', water: '#6fb7d6', waterDeep: '#4f97b6', waterFoam: '#e6f7ff',
      wall: '#fff7e6', wall2: '#f1e4cd', wallDark: '#6b5a44', roof: '#c96a4a', roof2: '#a9522f',
      glass: '#cde9f3', accent: '#4f8a52', accent2: '#e2765f', trunk: '#8b6a4a',
      leaf: '#4f9e5c', leaf2: '#3d8a4c', sand: '#f3e6c0', snow: '#ffffff',
      neon: '#ffdca0', sign: '#4a3a20', signBg: '#fff3d2', shade: 'rgba(40,52,32,.16)'
    },
    mochi: {
      ground: '#f3ddb2', ground2: '#e8cd9c', road: '#8a8078', roadDark: '#77706a',
      line: '#fff0c8', walk: '#f6e8c8', walkEdge: '#e6d4ac',
      plaza: '#f7dcb0', plazaLine: '#e8c794', plazaEdge: '#dcbb86',
      grass: '#c9db9a', grass2: '#b7cd86', water: '#4f9fbf', waterDeep: '#347c9c', waterFoam: '#e2f6ff',
      wall: '#fbf0dd', wall2: '#efdfc4', wallDark: '#5b4a3a', roof: '#3f7d8f', roof2: '#2f6474',
      glass: '#c9e5ec', accent: '#3c7d8f', accent2: '#d2603f', trunk: '#a9835c',
      leaf: '#3f8f6a', leaf2: '#2f7d5d', sand: '#f6e5bd', snow: '#ffffff',
      neon: '#ffce8a', sign: '#5a3a05', signBg: '#ffe6b8', shade: 'rgba(70,50,32,.18)'
    },
    lumen: {
      ground: '#5b5175', ground2: '#4f4668', road: '#3b3550', roadDark: '#312c45',
      line: '#b9aef0', walk: '#6a5f86', walkEdge: '#7b6f99',
      plaza: '#7a6f96', plazaLine: '#6a6086', plazaEdge: '#625878',
      grass: '#4f5a6e', grass2: '#44505f', water: '#3a3a66', waterDeep: '#2a2a50', waterFoam: '#9fb6ff',
      wall: '#4a3f52', wall2: '#3e3546', wallDark: '#241f30', roof: '#2f2a44', roof2: '#242036',
      glass: '#8b7fb0', accent: '#f2b54b', accent2: '#c96a8a', trunk: '#3e3546',
      leaf: '#3e6a58', leaf2: '#345c4c', sand: '#5b5175', snow: '#f3efff',
      neon: '#ffcf87', sign: '#ffe3a3', signBg: '#241f30', shade: 'rgba(12,10,26,.32)'
    }
  };

  /* ---------------- districts ---------------- */
  const DISTRICTS = [
    { id: 'plaza', key: 'dist.plaza', x: 1180, y: 900, w: 700, h: 720 },
    { id: 'shop', key: 'dist.shop', x: 100, y: 620, w: 1350, h: 580 },
    { id: 'home', key: 'dist.home', x: 100, y: 1200, w: 1350, h: 720 },
    { id: 'park', key: 'dist.park', x: 1600, y: 100, w: 1300, h: 1200 },
    { id: 'harbor', key: 'dist.harbor', x: 1600, y: 1300, w: 1300, h: 700 }
  ];

  /* ---------------- roads ---------------- */
  const ROADS = [
    { x1: 40, y1: 1250, x2: 2960, y2: 1250, w: 112, main: true, name: 'ave' },
    { x1: 1520, y1: 40, x2: 1520, y2: 2180, w: 112, main: true, name: 'st' },
    { x1: 260, y1: 760, x2: 1520, y2: 760, w: 92, name: 'shopst' },
    { x1: 1520, y1: 560, x2: 2840, y2: 560, w: 84, name: 'parkrd' },
    { x1: 260, y1: 1800, x2: 1520, y2: 1800, w: 84, name: 'lanerd' },
    { x1: 1520, y1: 1710, x2: 2860, y2: 1710, w: 92, name: 'harborrd' },
    { x1: 760, y1: 760, x2: 760, y2: 1800, w: 84, name: 'west' },
    { x1: 2400, y1: 560, x2: 2400, y2: 1710, w: 84, name: 'east' }
  ];

  const CROSSINGS = [
    { x: 760, y: 760, d: 'h', w: 92 }, { x: 1520, y: 760, d: 'h', w: 92 },
    { x: 760, y: 560, d: 'v', w: 84 }, { x: 1520, y: 560, d: 'v', w: 84 },
    { x: 2400, y: 560, d: 'h', w: 84 }, { x: 760, y: 1800, d: 'h', w: 84 },
    { x: 1520, y: 1800, d: 'h', w: 84 }, { x: 2400, y: 1710, d: 'h', w: 92 },
    { x: 1520, y: 1710, d: 'h', w: 92 }, { x: 2400, y: 1250, d: 'v', w: 112 },
    { x: 760, y: 1250, d: 'v', w: 84 }, { x: 1520, y: 1250, d: 'v', w: 112 }
  ];

  const PLAZA = { x: 1520, y: 1250, rIn: 168, rOut: 226 };
  const POND = { x: 2160, y: 930, rx: 208, ry: 124 };
  const WATER_Y = 1984;

  /* ---------------- buildings ---------------- */
  function buildings() {
    return [
      /* shop strip */
      { x: 180, y: 1010, w: 150, h: 140, style: 'shop', sign: 'MOA', interact: 'shop' },
      { x: 380, y: 1010, w: 180, h: 155, style: 'shop', sign: 'GIFT', interact: 'shop' },
      { x: 610, y: 1015, w: 200, h: 170, style: 'cafe', sign: 'CAFE', interact: 'shop' },
      { x: 840, y: 1010, w: 180, h: 160, style: 'shop', sign: 'FLOWER', interact: 'shop' },
      { x: 1055, y: 1015, w: 190, h: 175, style: 'shop', sign: 'TOY', interact: 'shop' },
      { x: 380, y: 1170, w: 170, h: 140, style: 'shop', sign: 'BAKERY', interact: 'shop' },
      { x: 700, y: 1175, w: 160, h: 135, style: 'shop', sign: 'CANDY', interact: 'shop' },
      { x: 960, y: 1170, w: 165, h: 140, style: 'shop', sign: 'BOOK', interact: 'shop' },

      /* residential */
      { x: 330, y: 1470, w: 160, h: 140, style: 'house' },
      { x: 560, y: 1470, w: 170, h: 150, style: 'house' },
      { x: 830, y: 1470, w: 160, h: 140, style: 'house' },
      { x: 1060, y: 1460, w: 170, h: 150, style: 'house' },
      { x: 1290, y: 1470, w: 150, h: 140, style: 'house' },
      { x: 700, y: 1732, w: 300, h: 220, style: 'cabin', sign: 'MY HOME', interact: 'decorate', home: true },
      { x: 330, y: 1722, w: 150, h: 130, style: 'house' },
      { x: 1010, y: 1722, w: 160, h: 140, style: 'house' },
      { x: 1265, y: 1722, w: 150, h: 130, style: 'house' },

      /* park */
      { x: 2470, y: 1010, w: 210, h: 145, style: 'gazebo', interact: 'shop' },
      { x: 1830, y: 770, w: 220, h: 130, style: 'greenhouse', interact: 'shop' },

      /* plaza */
      { x: 1250, y: 1060, w: 240, h: 200, style: 'hall', interact: 'villages' },
      { x: 1832, y: 1062, w: 300, h: 180, style: 'showroom', interact: 'showroom', vip: true },
      { x: 1140, y: 1440, w: 140, h: 120, style: 'kiosk', interact: 'shop' },
      { x: 1900, y: 1450, w: 140, h: 120, style: 'kiosk', interact: 'rapid' },

      /* harbor */
      { x: 1780, y: 1900, w: 230, h: 170, style: 'harbor', interact: 'shop' },
      { x: 2080, y: 1930, w: 270, h: 180, style: 'warehouse' },
      { x: 2700, y: 1905, w: 130, h: 120, style: 'lighthouse' }
    ];
  }

  /* ---------------- landmarks ---------------- */
  const LANDMARKS = [
    { id: 'home', key: 'lm.home', x: 700, y: 1690 },
    { id: 'hall', key: 'lm.hall', x: 1250, y: 1058 },
    { id: 'fountain', key: 'lm.fountain', x: 1520, y: 1250 },
    { id: 'gazebo', key: 'lm.gazebo', x: 2470, y: 1008 },
    { id: 'pier', key: 'lm.pier', x: 2200, y: 2050 },
    { id: 'light', key: 'lm.light', x: 2700, y: 1900 },
    { id: 'showroom', key: 'lm.showroom', x: 1832, y: 1140 },
    { id: 'market', key: 'lm.market', x: 610, y: 1080 },
    { id: 'stage', key: 'lm.stage', x: 2400, y: 1820 },
    { id: 'park', key: 'lm.park', x: 2160, y: 930 }
  ];

  /* ---------------- build ---------------- */
  function build(village) {
    const v = village || MV.Catalog.village('snowbell');
    const theme = CITY[v.id] ? v.id : 'snowbell';
    const pal = CITY[theme];
    const rnd = seeded(theme.length * 977 + 41);

    const plan = {
      W, H, theme, pal, ground: v.ground || 'snow',
      roads: ROADS, crossings: CROSSINGS, plaza: PLAZA, pond: POND, waterY: WATER_Y,
      districts: DISTRICTS, buildings: buildings(), landmarks: LANDMARKS,
      props: [], solids: [], circles: [], vehicleSpots: [], npcSpots: [], sparkSpots: [],
      showroom: { x: 1832, y: 1130, r: 150 },
      festival: { x: 2400, y: 1800, r: 210 },
      tramStop: { x: 2100, y: 1250 }
    };

    /* solids: thin band at each facade base */
    plan.buildings.forEach(b => {
      b.solid = { x: b.x - b.w / 2, y: b.y - 34, w: b.w, h: 42 };
      plan.solids.push(b.solid);
    });
    /* fountain + pond circles */
    plan.circles.push({ x: PLAZA.x, y: PLAZA.y, r: 84 });
    plan.circles.push({ x: POND.x, y: POND.y, r: 0, rx: POND.rx, ry: POND.ry, ellipse: true });
    /* pond blocked as rect */
    plan.solids.push({ x: POND.x - POND.rx * .78, y: POND.y - POND.ry * .78, w: POND.rx * 1.56, h: POND.ry * 1.56, pond: true });

    /* vehicles */
    plan.vehicleSpots = [
      { id: 'minicar', x: 1640, y: 1140, angle: 0 },
      { id: 'tram', x: 2130, y: 1250, angle: 0 },
      { id: 'bike', x: 806, y: 1738, angle: 0 },
      { id: 'scooter', x: 930, y: 1108, angle: 0 },
      { id: 'supercar', x: 1770, y: 1146, angle: 0, premium: true, showroom: true },
      { id: 'sleigh', x: 1930, y: 1148, angle: 0, premium: true, showroom: true, themeOnly: false }
    ];

    /* npc spots */
    plan.npcSpots = [
      { x: 1420, y: 1330, d: 'plaza' }, { x: 1620, y: 1180, d: 'plaza' }, { x: 1520, y: 1420, d: 'plaza' },
      { x: 640, y: 940, d: 'shop' }, { x: 980, y: 960, d: 'shop' }, { x: 430, y: 1110, d: 'shop' },
      { x: 2050, y: 780, d: 'park' }, { x: 2400, y: 900, d: 'park' }, { x: 1900, y: 1060, d: 'park' },
      { x: 520, y: 1640, d: 'home' }, { x: 1080, y: 1600, d: 'home' },
      { x: 1900, y: 1760, d: 'harbor' }, { x: 2600, y: 1800, d: 'harbor' }
    ];

    /* sparkle spots */
    plan.sparkSpots = [
      { x: 1350, y: 1180 }, { x: 1700, y: 1400 }, { x: 620, y: 1120 }, { x: 900, y: 900 },
      { x: 2050, y: 620 }, { x: 2520, y: 760 }, { x: 480, y: 1560 }, { x: 1150, y: 1640 },
      { x: 2300, y: 1600 }, { x: 2650, y: 1740 }, { x: 1520, y: 960 }, { x: 780, y: 1400 }
    ];

    /* ---- props ---- */
    const props = plan.props;
    const push = (p) => props.push(p);
    const isOnRoad = (x, y, pad) => {
      pad = pad == null ? 8 : pad;
      for (const r of plan.roads) {
        const hw = r.w / 2 + pad;
        if (r.y1 === r.y2) { if (Math.abs(y - r.y1) < hw && x > Math.min(r.x1, r.x2) && x < Math.max(r.x1, r.x2)) return true; }
        else { if (Math.abs(x - r.x1) < hw && y > Math.min(r.y1, r.y2) && y < Math.max(r.y1, r.y2)) return true; }
      }
      return false;
    };
    plan.isOnRoad = isOnRoad;

    /* street lamps along roads */
    plan.roads.forEach(r => {
      const horizontal = r.y1 === r.y2;
      const len = horizontal ? Math.abs(r.x2 - r.x1) : Math.abs(r.y2 - r.y1);
      const step = 300;
      let i = 0;
      for (let d = 150; d < len - 60; d += step, i++) {
        const side = i % 2 ? 1 : -1;
        const off = r.w / 2 + 34;
        const x = horizontal ? Math.min(r.x1, r.x2) + d : r.x1 + side * off;
        const y = horizontal ? r.y1 + side * off : Math.min(r.y1, r.y2) + d;
        if (Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.rOut + 46) continue;
        push({ kind: 'lamp', x, y, s: 1 });
      }
    });

    /* trees in the park + around homes */
    for (let i = 0; i < 46; i++) {
      const x = 1680 + rnd() * 1140, y = 240 + rnd() * 900;
      if (isOnRoad(x, y, 34)) continue;
      if (Math.hypot((x - POND.x) / POND.rx, (y - POND.y) / POND.ry) < 1.28) continue;
      if (inBuilding(x, y, 40)) continue;
      push({ kind: 'tree', x, y, s: .82 + rnd() * .5 });
    }
    for (let i = 0; i < 26; i++) {
      const x = 180 + rnd() * 1200, y = 1360 + rnd() * 540;
      if (isOnRoad(x, y, 30) || inBuilding(x, y, 30)) continue;
      push({ kind: 'tree', x, y, s: .7 + rnd() * .4 });
    }
    for (let i = 0; i < 12; i++) {
      const x = 180 + rnd() * 1220, y = 660 + rnd() * 520;
      if (isOnRoad(x, y, 26) || inBuilding(x, y, 26)) continue;
      push({ kind: 'bush', x, y, s: .8 + rnd() * .5 });
    }

    /* plaza decorations: benches, stalls, planters */
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + .2;
      const rad = PLAZA.rIn - 40;
      push({ kind: 'bench', x: PLAZA.x + Math.cos(a) * rad, y: PLAZA.y + Math.sin(a) * rad * .82, s: 1, a });
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + .55;
      const rad = PLAZA.rIn - 20;
      push({ kind: 'planter', x: PLAZA.x + Math.cos(a) * rad, y: PLAZA.y + Math.sin(a) * rad * .82, s: 1 });
    }

    /* shop street market stalls */
    [280, 500, 900, 1120, 1300].forEach(x => {
      if (inBuilding(x, 880, 20)) return;
      push({ kind: 'stall', x, y: 892, s: 1.05 });
    });

    /* waterfront: pier posts, boats, crates, buoys */
    for (let i = 0; i < 6; i++) push({ kind: 'post', x: 2150 + (i % 2) * 120, y: 1950 + i * 34, s: 1 });
    push({ kind: 'boat', x: 2470, y: 2060, s: 1.1 });
    push({ kind: 'boat', x: 1880, y: 2040, s: .9, flip: true });
    push({ kind: 'boat', x: 2760, y: 2110, s: .8 });
    for (let i = 0; i < 7; i++) push({ kind: 'crate', x: 1980 + rnd() * 200, y: 1840 + rnd() * 80, s: .8 + rnd() * .5 });
    push({ kind: 'buoy', x: 2320, y: 2120, s: 1 });
    push({ kind: 'buoy', x: 2600, y: 2020, s: 1 });

    /* festival stage + speakers */
    push({ kind: 'stage', x: 2400, y: 1810, s: 1 });
    push({ kind: 'speaker', x: 2230, y: 1800, s: 1 });
    push({ kind: 'speaker', x: 2570, y: 1800, s: 1 });

    /* residential props: fences, mailboxes, laundry */
    plan.buildings.filter(b => b.style === 'house' || b.style === 'cabin').forEach((b, i) => {
      push({ kind: 'bush', x: b.x - b.w * .38, y: b.y + 16, s: .8 });
      if (i % 2 === 0) push({ kind: 'mailbox', x: b.x + b.w * .40, y: b.y + 10, s: 1 });
      if (i % 3 === 0) push({ kind: 'planter', x: b.x + b.w * .18, y: b.y + 18, s: .9 });
    });

    /* district signs */
    push({ kind: 'sign', x: 300, y: 832, s: 1, label: 'dist.shop' });
    push({ kind: 'sign', x: 1750, y: 598, s: 1, label: 'dist.park' });
    push({ kind: 'sign', x: 300, y: 1868, s: 1, label: 'dist.home' });
    push({ kind: 'sign', x: 1720, y: 1768, s: 1, label: 'dist.harbor' });

    /* park path lamps + playground bits */
    push({ kind: 'bench', x: 2010, y: 1080, s: 1 });
    push({ kind: 'bench', x: 2330, y: 1090, s: 1 });
    push({ kind: 'bench', x: 2160, y: 1140, s: 1 });
    push({ kind: 'fountainSmall', x: 2160, y: 930, s: 1 });
    push({ kind: 'flowerbed', x: 1900, y: 900, s: 1 });
    push({ kind: 'flowerbed', x: 2440, y: 860, s: 1 });

    /* theme snow piles */
    if (theme === 'snowbell') {
      for (let i = 0; i < 24; i++) {
        const x = 160 + rnd() * 2680, y = 180 + rnd() * 1740;
        if (isOnRoad(x, y, 20) || inBuilding(x, y, 10)) continue;
        push({ kind: 'snowpile', x, y, s: .6 + rnd() * .8 });
      }
    } else if (theme === 'sunpetal' || theme === 'mochi') {
      for (let i = 0; i < 22; i++) {
        const x = 160 + rnd() * 2680, y = 180 + rnd() * 1740;
        if (isOnRoad(x, y, 20) || inBuilding(x, y, 10)) continue;
        push({ kind: 'rock', x, y, s: .5 + rnd() * .7 });
      }
    }

    function inBuilding(x, y, pad) {
      pad = pad || 0;
      return plan.buildings.some(b => x > b.x - b.w / 2 - pad && x < b.x + b.w / 2 + pad && y > b.y - b.h - pad && y < b.y + pad);
    }
    plan.inBuilding = inBuilding;

    /* walkable spawn points per district (for missions) */
    const spawn = {
      plaza: [{ x: 1400, y: 1360 }, { x: 1660, y: 1130 }, { x: 1520, y: 1450 }],
      shop: [{ x: 600, y: 940 }, { x: 900, y: 960 }, { x: 400, y: 1100 }, { x: 1100, y: 1080 }],
      park: [{ x: 1980, y: 760 }, { x: 2400, y: 880 }, { x: 2300, y: 1050 }, { x: 1850, y: 1000 }],
      home: [{ x: 620, y: 1560 }, { x: 1000, y: 1560 }, { x: 880, y: 1690 }],
      harbor: [{ x: 1900, y: 1780 }, { x: 2200, y: 1900 }, { x: 2600, y: 1780 }]
    };
    plan.spawns = spawn;

    plan.landmarks.forEach(l => {
      plan.solids.push({ x: l.x - 3, y: l.y - 3, w: 6, h: 6, tiny: true });
    });

    return plan;
  }

  /* ---------------- queries ---------------- */
  function isWater(x, y) {
    if (y > WATER_Y) return true;
    return false;
  }
  function pondHit(x, y, pad) {
    const dx = (x - POND.x) / (POND.rx + (pad || 0));
    const dy = (y - POND.y) / (POND.ry + (pad || 0));
    return dx * dx + dy * dy < 1;
  }
  function blocked(plan, x, y, r) {
    if (!plan) return false;
    r = r || 10;
    if (x < 40 || y < 40 || x > W - 40 || y > H - 40) return true;
    if (isWater(x, y + 6)) return true;
    if (pondHit(x, y, r * .6)) return true;
    for (const s of plan.solids) {
      if (s.tiny) continue;
      if (x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) return true;
    }
    if (Math.hypot(x - PLAZA.x, (y - PLAZA.y) / .92) < 84 + r) return true; /* fountain */
    return false;
  }
  function insideBuilding(plan, x, y, r) {
    for (const b of plan.buildings) {
      if (x + r > b.x - b.w / 2 && x - r < b.x + b.w / 2 && y + r > b.y - b.h && y - r < b.y) return b;
    }
    return null;
  }
  function districtAt(plan, x, y) {
    const list = plan ? plan.districts : DISTRICTS;
    for (const d of list) {
      if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return d;
    }
    let best = list[0], bd = 1e9;
    list.forEach(d => {
      const d2 = Math.hypot(x - (d.x + d.w / 2), y - (d.y + d.h / 2));
      if (d2 < bd) { bd = d2; best = d; }
    });
    return best;
  }

  /* ---------------- static mini map ---------------- */
  function mini(ctx, w, h, plan) {
    if (!plan) return;
    const pal = plan.pal;
    const sx = w / W, sy = h / H;
    ctx.save();
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, 0, w, h);
    /* park */
    ctx.fillStyle = pal.grass;
    ctx.fillRect(1600 * sx, 150 * sy, 1300 * sx, 1050 * sy);
    /* shop / home blocks slight tint */
    ctx.fillStyle = 'rgba(0,0,0,.04)';
    ctx.fillRect(120 * sx, 640 * sy, 1320 * sx, 540 * sy);
    /* water */
    ctx.fillStyle = pal.water;
    ctx.fillRect(0, WATER_Y * sy, w, h - WATER_Y * sy);
    ctx.fillStyle = pal.waterDeep;
    ctx.fillRect(0, (WATER_Y + 70) * sy, w, h - (WATER_Y + 70) * sy);
    /* pond */
    ctx.fillStyle = pal.water;
    ctx.beginPath();
    ctx.ellipse(POND.x * sx, POND.y * sy, POND.rx * sx, POND.ry * sy, 0, 0, TAU);
    ctx.fill();
    /* roads */
    plan.roads.forEach(r => {
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = (r.w + 22) * sx;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(r.x1 * sx, r.y1 * sy); ctx.lineTo(r.x2 * sx, r.y2 * sy); ctx.stroke();
      ctx.strokeStyle = pal.road;
      ctx.lineWidth = r.w * sx;
      ctx.beginPath(); ctx.moveTo(r.x1 * sx, r.y1 * sy); ctx.lineTo(r.x2 * sx, r.y2 * sy); ctx.stroke();
    });
    /* plaza */
    ctx.fillStyle = pal.road;
    ctx.beginPath(); ctx.arc(PLAZA.x * sx, PLAZA.y * sy, PLAZA.rOut * sx, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.plaza;
    ctx.beginPath(); ctx.arc(PLAZA.x * sx, PLAZA.y * sy, PLAZA.rIn * sx, 0, TAU); ctx.fill();
    /* buildings */
    ctx.fillStyle = 'rgba(40,32,58,.55)';
    plan.buildings.forEach(b => {
      ctx.fillRect((b.x - b.w / 2) * sx, (b.y - b.h * .55) * sy, b.w * sx, Math.max(2, b.h * .55 * sy));
    });
    ctx.restore();
  }

  MV.World = {
    W, H, CITY, DISTRICTS, ROADS, PLAZA, POND, WATER_Y, LANDMARKS,
    build, blocked, insideBuilding, districtAt, isWater, pondHit, mini
  };
})();
