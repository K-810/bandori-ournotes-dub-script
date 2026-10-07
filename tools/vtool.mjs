#!/usr/bin/env node
// vtool.mjs —— 语体取数工具（零依赖，只用 Node 内置模块）
// 用法： node vtool.mjs --pack <语料目录> <子命令> [参数]
//       或用环境变量 OURNOTES_PACK 指定语料目录
//
// <语料目录> 里应有（见 references/07-取数说明.md）：
//   ournotes_对白全表.tsv        advId series asset title idx speaker key canonical name voiced jp zh
//   ournotes_index.tsv           （可选）advId series speaker exp motion cue asset …，用于 exp 子命令
//
// 本脚本不含任何数据；数据全部由使用者提供。

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

// ---------- 参数 ----------
const argv = process.argv.slice(2);
const opt = { pack: process.env.OURNOTES_PACK || '', limit: 10, cn: false, top: 10, in: '', out: '', src: '' };
const rest = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--pack') opt.pack = argv[++i];
  else if (a === '--limit') opt.limit = Number(argv[++i]) || 10;
  else if (a === '--top') opt.top = Number(argv[++i]) || 10;
  else if (a === '--cn') opt.cn = true;
  else if (a === '--in') opt.in = argv[++i];
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--src') opt.src = argv[++i];
  else rest.push(a);
}
const [cmd, ...args] = rest;

if (!cmd || cmd === '-h' || cmd === '--help') { usage(); process.exit(0); }
// model 子命令只看模型文件，不需要语料
if (cmd === 'model') { await cmdModel(args[0]); process.exit(0); }
// read / audit 是纯文字处理（注音表、稿子体检），同样不需要语料包
const NOPACK = ['read', 'audit'];
if (!NOPACK.includes(cmd) && !opt.pack) { console.error('缺少 --pack <语料目录>（或设置环境变量 OURNOTES_PACK）'); console.error('取数说明见 references/07-取数说明.md'); process.exit(2); }

const TSV = path.join(opt.pack || '.', 'ournotes_对白全表.tsv');
const IDX_CANDS = [
  path.join(opt.pack || '.', 'ournotes_index.tsv'),
  path.join(opt.pack || '.', '..', '结构化', '剧情结构', 'ournotes_index.tsv'),
  path.join(opt.pack || '.', '剧情结构', 'ournotes_index.tsv'),
  path.join(opt.pack || '.', '结构化', 'ournotes_index.tsv'),
];
const IDX = IDX_CANDS.find((f) => fs.existsSync(f)) || IDX_CANDS[0];
if (!NOPACK.includes(cmd) && !fs.existsSync(TSV)) { console.error(`找不到 ${TSV}\n→ 请确认 --pack 指向含有 ournotes_对白全表.tsv 的目录（见 references/07-取数说明.md）`); process.exit(2); }

function usage() {
  console.log(`vtool —— 语体取数（零依赖）

  node vtool.mjs --pack <语料目录> self  <角色>            语言指纹：自称 / 敬体率 / 语尾 / 句长
  node vtool.mjs --pack <语料目录> tail  <角色> [语尾]     该语尾的真实例句（省略语尾则取该角色首位）
  node vtool.mjs --pack <语料目录> call  <角色> [对象]     称呼取证：○○さん / ちゃん / 先輩 / 呼び捨て
  node vtool.mjs --pack <语料目录> map   [角色]            中日名对应表（call 用的那张，可查绰号）
  node vtool.mjs model  <模型目录>                   列出一个 Live2D 模型可用的表情 / 动作名
  node vtool.mjs --pack <语料目录> exp   <集号> [角色]     该集的表情 / 动作码（需 ournotes_index.tsv）
  node vtool.mjs --pack <语料目录> line  <集号>#<行号>     定位一句，带前后文
  node vtool.mjs read                                   注音表（26 人官方读法 + 绰号），给 TTS 用
  node vtool.mjs read --in <稿.txt> --out <注音稿.txt>    把稿子里的名字批量换成假名
  node vtool.mjs audit <稿.txt> [--src <中文原文.txt>]    稿子体检：敬体率 / 句长 / 自称 / 句尾多样性 / 直译形状

  选项：--limit N（默认 10） · --top N（语尾取前 N 个，默认 10） · --cn（额外输出官方中译）

  角色可用说话人 id 或中文名，例： self hotaru / self 汐见萤`);
}

// ---------- 注音表（给 TTS：GPT-SoVITS 的日语前端会读错生僻人名） ----------
// 读法来源：游戏官网角色页 URL slug（bang-dream-on.bushimo.jp）+ 萌百 {{jpn}}/{{ruby}} 模板，
// 两者一致，且与语料里的假名写法（サキコ/ウミコ/ウイコ/ムーコ/ちえり/ののちゃん…）对得上。
const READING = [
  ['高松燈', 'たかまつともり'], ['千早愛音', 'ちはやあのん'], ['要楽奈', 'かなめらな'],
  ['長崎そよ', 'ながさきそよ'], ['椎名立希', 'しいな たき'], ['豊川祥子', 'とがわさきこ'],
  ['三角初華', 'みすみういか'], ['若葉睦', 'わかばむつみ'], ['八幡海鈴', 'やはたうみり'],
  ['祐天寺にゃむ', 'ゆうてんじにゃむ'], ['仲町あられ', 'なかまちあられ'], ['宮永ののか', 'みやながののか'],
  ['峰月律', 'みねつきりつ'], ['藤都子', 'ふじみやこ'], ['千石ユノ', 'せんごくユノ'],
  ['汐見蛍', 'しおみほたる'], ['伊沢なつめ', 'いざわなつめ'], ['琴平凪', 'ことひらなぎ'],
  ['浜崎まほろ', 'はまさきまほろ'], ['和泉朋花', 'いずみほうか'], ['須賀蕾叶', 'すがらいか'],
  ['馬橋心玖', 'まはしみく'], ['矢倉蓬咲', 'やくらよもぎ'], ['梅里ちえり', 'うめざとちえり'],
  ['四宮寧月', 'しのみやしずく'], ['野良猫', 'のらねこ'],
  ['沢海奏多', 'さわみかなた'],
  ['高松', 'たかまつ'], ['燈', 'ともり'], ['千早', 'ちはや'], ['愛音', 'あのん'],
  ['要', 'かなめ'], ['楽奈', 'らな'], ['長崎', 'ながさき'],
  ['椎名', 'しいな'], ['立希', 'たき'], ['豊川', 'とがわ'], ['祥子', 'さきこ'],
  ['三角', 'みすみ'], ['初華', 'ういか'], ['若葉', 'わかば'], ['睦', 'むつみ'],
  ['八幡', 'やはた'], ['海鈴', 'うみり'], ['祐天寺', 'ゆうてんじ'],
  ['仲町', 'なかまち'], ['宮永', 'みやなが'],
  ['峰月', 'みねつき'], ['律', 'りつ'], ['藤', 'ふじ'], ['都子', 'みやこ'],
  ['千石', 'せんごく'], ['汐見', 'しおみ'], ['蛍', 'ほたる'],
  ['伊沢', 'いざわ'], ['琴平', 'ことひら'], ['凪', 'なぎ'],
  ['浜崎', 'はまさき'], ['和泉', 'いずみ'], ['朋花', 'ほうか'],
  ['須賀', 'すが'], ['蕾叶', 'らいか'], ['馬橋', 'まはし'], ['心玖', 'みく'],
  ['矢倉', 'やくら'], ['蓬咲', 'よもぎ'], ['梅里', 'うめざと'], ['四宮', 'しのみや'],
  ['寧月', 'しずく'],
  ['沢海', 'さわみ'], ['奏多', 'かなた'],
  ['MyGO!!!!!', 'マイゴ'], ['Ave Mujica', 'アヴェムジカ'], ['millsage', 'ミルサージュ'],
  ['一家Dumb Rock!', 'いっかだんらん'],
].sort((a, b) => b[0].length - a[0].length);

// 单字汉字名（燈/睦/律/凪/蛍/要/藤）最容易误伤同形词（必要・法律・要点），
// 所以只在「左边不是汉字 + 右边是助词/标点/敬称」时才换。
const KANJI = /[\u4e00-\u9fff々]/;
const SAFE_NEXT = /^(?:[はがをにものねよへとっ、。！？…〜♪\s]|さん|ちゃん|くん|君|先輩|先生|様|$)/;
function replaceGuarded(line, key, val) {
  if (key.length >= 2) return { s: line.split(key).join(val), n: line.split(key).length - 1 };
  let out = '', n = 0;
  for (let i = 0; i < line.length; i++) {
    const prev = i > 0 ? line[i - 1] : '';
    const rest = line.slice(i + 1);
    if (line[i] === key && !(prev && KANJI.test(prev)) && SAFE_NEXT.test(rest)) { out += val; n++; }
    else out += line[i];
  }
  return { s: out, n };
}
function cmdRead() {
  if (opt.in) {
    const src = fs.readFileSync(opt.in, 'utf8');
    let out = src, n = 0;
    // 每行只改「说话人：」之后的部分——说话人标记是给作者看的，不该被动
    out = out.split('\n').map((line) => {
      const i = line.search(/[：:]/);
      const head = i >= 0 ? line.slice(0, i + 1) : '';
      let body = i >= 0 ? line.slice(i + 1) : line;
      for (const [k, v] of READING) {
        if (k === v) continue;
        const r = replaceGuarded(body, k, v);
        body = r.s; n += r.n;
      }
      return head + body;
    }).join('\n');
    const dst = opt.out || opt.in.replace(/(\.[^.\\/]+)?$/, '_注音$1');
    fs.writeFileSync(dst, out, 'utf8');
    console.log(`已写出 ${dst}（替换 ${n} 处）`);
    console.log('注意：只改了「：」之后的台词，说话人标记与标点原样；换完请抽听 1~2 句，异常处改回汉字或加空格。');
    return;
  }
  console.log('注音表（写法 → 假名）　给 TTS 用：内容不改，只改写法');
  console.log('写法\t假名');
  for (const [k, v] of READING.slice().sort((a, b) => a[0].localeCompare(b[0], 'ja'))) console.log(`${k}\t${v}`);
  console.log('\n用法： node vtool.mjs read --in 台词稿.txt --out 台词稿_注音.txt');
  console.log('注意：① 假名写法（そよ/あられ/ののか/なつめ/まほろ/にゃむ/ユノ）不必再动；');
  console.log('      ② 长音「ー」不能省（ムーコ ≠ ムコ）；③ 只换名字，别整句改写；');
  console.log('      ④ 单字名（燈/睦/律/凪/蛍/要/藤）只在「左边不是汉字」时才换，避免误伤 必要・法律・要点。');
}

// ---------- 读表 ----------
// 一次流式读完，累积需要的统计（表约数 MB，命中内存没问题）
const SELF = ['わたくし', 'わたし', 'あたし', 'アタシ', 'あたい', '僕', 'ぼく', '俺', 'おれ', 'うち', '自分', 'わし', '拙者', '我々', '僕ら', '私達', '私たち', '私'];
const POLITE_END = /(です|ます|ました|ません|ましょう|でしょう|ですわ|ますわ)/;

// 语尾判定的硬拒名单：敬称、括号、引用符、纯标点 —— 这些出现在句末是噪声，不是语尾
const TAIL_STOP = [
  'さん', 'ちゃん', '先輩', '先生', 'くん', '君', '様',
  ')', '）', ']', '］', '】', '>', '》', '』', '」', '”', '"', '’', "'",
  '。', '、', '！', '？', '…', '～', '〜', '!', '?', '♪', '♡', '・',
];

function tailOf(jp) {
  // 先剥掉句末标点与配对括号（可反复），再取尾部 1–3 字的候选
  let s = jp.replace(/\n/g, '').replace(/[。、！？…～〜!?♪♡\s]+$/g, '');
  for (let i = 0; i < 3; i++) s = s.replace(/[)）\]］】>》』」”"’']+$/g, '').replace(/[。、！？…～〜!?♪♡\s]+$/g, '');
  if (!s) return '';
  let t = s.slice(-3);
  if (t.includes('）') || t.includes(')') || t.includes('（') || t.includes('(')) return '';
  return t;
}

function isTail(t) {
  if (!t || t.length < 2) return false;                    // 单字尾一律不采
  if (/^[ー～〜\-–—〈〉《》\[\]{}]/.test(t)) return false;   // 破折号/长音/书名号开头 → 目录或引用，不是语尾
  // 纯汉字短尾多半是名字/称谓碎片，不是语尾
  if (/^[\u4e00-\u9fff]{1,3}$/.test(t)) return false;
  for (const s of TAIL_STOP) if (t.includes(s)) return false;
  if (/^\d+$/.test(t)) return false;
  return true;
}

function loadAll() {
  return new Promise((resolve) => {
    const rows = [];
    const names = new Map();      // id -> 中文名
    const nameToId = new Map();   // 中文名 -> id
    const rl = readline.createInterface({ input: fs.createReadStream(TSV) });
    let head = true;
    rl.on('line', (l) => {
      if (head) { head = false; return; }
      const c = l.split('\t');
      if (c.length < 12) return;
      const [, series, asset, title, idx, speaker, , canonical, name, voiced, jp, zh] = c;
      rows.push({ series, asset, title, idx: +idx, speaker, canonical, name, voiced: +voiced, jp, zh });
      if (name && speaker) { names.set(speaker, name); if (!nameToId.has(name)) nameToId.set(name, speaker); }
    });
    rl.on('close', () => resolve({ rows, names, nameToId }));
  });
}

// 补充名表：优先读语料目录下的 names.tsv（两列：id / 中文名），否则就近找 roles.tsv
function loadRoles(names, nameToId) {
  const apply = (p) => {
    const txt = fs.readFileSync(p, 'utf8').split('\n');
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i].split('\t');
      if (c.length < 2) continue;
      const id = c[0].trim(), cn = c[1].trim();
      if (i === 0 && /^(id|ＩＤ)$/i.test(id)) continue;           // 表头
      if (!id || !cn) continue;
      if (!names.get(id)) names.set(id, cn);                       // 空值也补上
      if (!nameToId.has(cn) && cn.length >= 2) nameToId.set(cn, id);
    }
  };
  const direct = path.join(opt.pack, 'names.tsv');
  if (fs.existsSync(direct)) { apply(direct); return; }
  // 退路：向上下附近找 roles.tsv
  const found = [];
  const probe = (dir, depth) => {
    if (depth > 3 || found.length) return;
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (ents.some((e) => e.isFile() && e.name === 'roles.tsv')) { found.push(path.join(dir, 'roles.tsv')); return; }
    for (const e of ents) if (e.isDirectory()) probe(path.join(dir, e.name), depth + 1);
  };
  let dir = opt.pack;
  for (let i = 0; i < 4 && !found.length; i++) {
    probe(dir, 0);
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  if (found.length) apply(found[0]);
}

const resolveId = (q, names, nameToId) => {
  if (nameToId.has(q)) return nameToId.get(q);
  if (names.has(q)) return q;
  // 兜底：中文名可能带「（舞台）」等后缀，或被写成「/」分隔的并列名
  for (const [id, n] of names) if (n && (n.includes(q) || q.includes(n))) return id;
  for (const [n, id] of nameToId) if (n && (n.includes(q) || q.includes(n))) return id;
  return q;
};

function fingerprint(rows, id) {
  const mine = rows.filter((r) => r.speaker === id);
  const all = rows.length;
  const self = new Map(), tail = new Map(), tailAll = new Map();
  let polite = 0, chars = 0, eps = new Set();
  for (const r of mine) {
    eps.add(r.asset);
    if (POLITE_END.test(r.jp.replace(/\n/g, ''))) polite++;
    chars += r.jp.replace(/\s|\n/g, '').length;
    for (const s of SELF) if (r.jp.includes(s)) self.set(s, (self.get(s) || 0) + 1);
  }
  for (const r of rows) {
    const t = tailOf(r.jp);
    if (!isTail(t)) continue;
    tailAll.set(t, (tailAll.get(t) || 0) + 1);
    if (r.speaker === id) tail.set(t, (tail.get(t) || 0) + 1);
  }
  const n = mine.length;
  const tails = [...tail.entries()]
    .map(([t, c]) => ({ t, c, p: c / n, z: (c / n) / Math.max((tailAll.get(t) || 0) / all, 1e-9) }))
    .filter((x) => x.c >= 5)                 // 至少 5 次，挡掉偶然
    .sort((a, b) => (b.z * Math.log2(1 + b.c)) - (a.z * Math.log2(1 + a.c)));
  return {
    id, name: '', n, eps: eps.size, lineLen: n ? (chars / n) : 0,
    politeRate: n ? polite / n : 0,
    self: [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    tails,
  };
}

const pct = (x) => (x * 100).toFixed(1) + '%';

// ---------- 中日名对应（自动学出来，供 call 用） ----------
// 依据：中日双语对齐。**谁在说这句不重要，重要的是这句谈到了谁**——
// 当某行中译里出现角色 X 的中文名时，该行日文里出现的候选写法就是 X 的日文名/绰号。
function learnNames(rows, names) {
  const KANJI = (s) => (s.match(/[\u4e00-\u9fff]/g) || []).join('');
  // 每个目标：中文名 + 「共有汉字」集合（中日同形的那几个字，如 楽/乐、祥、鈴/铃）
  const TARGETS = [];
  for (const n of new Set(names.values())) {
    if (!n) continue;
    const forms = new Set([n]);
    if (n.length >= 3) { forms.add(n.slice(-2)); forms.add(n.slice(-3)); }
    for (const f of forms) TARGETS.push({ cn: n, form: f, kanji: new Set([...KANJI(f)]) });
  }
  const KANJI2CN = new Map();     // 单个汉字 -> 它属于哪个中文名（用于消歧）
  for (const t of TARGETS) for (const k of t.kanji) if (!KANJI2CN.has(k)) KANJI2CN.set(k, t.cn);

  const cand = new Map();      // 日文写法 -> Map(中文名 -> 次数)
  for (const r of rows) {
    if (!r.zh || !r.jp) continue;
    const jpCands = [];
    const push = (s, strong) => { if (s && s.length >= 1 && s.length <= 6) jpCands.push({ s, strong }); };
    // ① 紧跟在敬称前面的那一截（最强证据）
    for (const m of r.jp.matchAll(/([\u3040-\u30ff\u4e00-\u9fff]{1,6}?)(さん|ちゃん|先輩|先生|くん|君|様)/g)) {
      push(m[1], true);
      const b = m[1];
      if (b.length >= 3) { push(b.slice(-2), true); push(b.slice(-3), true); }
    }
    // ② 其余位置的 2–5 字候选
    for (const m of r.jp.matchAll(/[\u3040-\u30ff\u4e00-\u9fff]{2,5}/g)) {
      push(m[0], false);
      if (m[0].length >= 3) push(m[0].slice(0, 3), false);
      if (m[0].length >= 4) push(m[0].slice(0, 4), false);
    }
    if (!jpCands.length) continue;
    for (const t of TARGETS) {
      if (!r.zh.includes(t.form)) continue;
      for (const { s, strong } of jpCands) {
        if (s === t.form) continue;
        // 闸门：必须含有目标名的汉字；或者出现在敬称位置、且是 2–4 字纯假名（可能是假名绰号）
        const hasKanji = [...t.kanji].some((k) => s.includes(k));
        const kanaAlias = strong && /^[\u3040-\u30ff]{2,4}$/.test(s);
        if (!hasKanji && !kanaAlias) continue;
        const key = `${t.cn}\u0000${s}`;
        if (!cand.has(key)) cand.set(key, 0);
        cand.set(key, cand.get(key) + 1);
      }
    }
  }

  // 取每个写法的最强归属，够 3 次才收
  const byJp = new Map();
  for (const [k, n] of cand) {
    const i = k.indexOf('\u0000');
    const cn = k.slice(0, i), jp = k.slice(i + 1);
    if (!byJp.has(jp)) byJp.set(jp, new Map());
    byJp.get(jp).set(cn, Math.max(byJp.get(jp).get(cn) || 0, n));
  }
  const scored = [];
  for (const [jp, m] of byJp) {
    const [cn, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n >= 3) scored.push({ jp, cn, n });
  }

  // 裁掉末尾敬称与问句助词 → 基名；只保留「以基名开头」的读法
  const SUFIX = /(さん|ちゃん|先輩|先生|くん|君|様)$/;
  const out = new Map();       // 基名 -> {cn, n, full}
  for (const x of scored) {
    let base = x.jp;
    while (SUFIX.test(base)) base = base.replace(SUFIX, '');
    base = base.replace(/(が|と|に|は|も|を|へ|の|で|って)$/, '') || base;   // 「さんが」「さんと」
    base = base.replace(/^[\u3040-\u309f]{1,2}(?=[\u4e00-\u9fff\u30a0-\u30ff])/, '') || base; // 「て楽奈」
    if (!base || !x.jp.startsWith(base)) continue;
    if (base.length > 5) continue;
    const cur = out.get(base);
    if (!cur || x.n > cur.n) out.set(base, { cn: x.cn, n: x.n, full: new Map([[x.jp, x.n]]) });
  }
  // 收口：同一中文名下的写法互相吸收（前缀关系，或仅差一个敬称）
  const SUFONLY = /^(さん|ちゃん|先輩|先生|くん|君|様|ちゃ|ち|さ|に|が|と|は|も|を|へ|の|で)+$/;
  const byCn = new Map();
  for (const [jp, v] of out) {
    if (!byCn.has(v.cn)) byCn.set(v.cn, []);
    byCn.get(v.cn).push({ jp, ...v });
  }
  const kept = [];
  const used = new Set();
  for (const [, list] of byCn) {
    list.sort((a, b) => b.jp.length - a.jp.length || b.n - a.n);
    for (const x of list) {
      if (used.has(x.jp + '|' + x.cn)) continue;
      for (const y of list) {
        if (x === y || used.has(y.jp + '|' + y.cn)) continue;
        if (x.jp.startsWith(y.jp) && SUFONLY.test(x.jp.slice(y.jp.length))) {
          x.n += y.n; used.add(y.jp + '|' + y.cn);   // y 并入 x
        }
      }
      used.add(x.jp + '|' + x.cn);
      kept.push(x);
    }
  }
  const res = new Map();
  for (const v of kept) res.set(v.jp + '|' + v.cn, v);
  return res;
}
async function cmdSelf(q) {
  const { rows, names, nameToId } = await loadAll(); loadRoles(names, nameToId);
  const id = resolveId(q, names, nameToId);
  const f = fingerprint(rows, id);
  if (!f.n) { console.log(`没有找到说话人「${q}」的台词。可用中文名或说话人 id；名单见 references/README.md`); return; }
  const globalSelf = new Map();
  for (const r of rows) for (const s of SELF) if (r.jp.includes(s)) globalSelf.set(s, (globalSelf.get(s) || 0) + 1);
  console.log(`角色\t${names.get(id) || ''}（${id}）`);
  console.log(`句数\t${f.n}`);
  console.log(`覆盖集数\t${f.eps}`);
  console.log(`平均句长(日文字符)\t${f.lineLen.toFixed(1)}`);
  console.log(`敬体率\t${pct(f.politeRate)}（含句中，口径见 05/09）`);
  console.log('');
  console.log(`自称\t次数\t占比\t全库占比`);
  if (!f.self.length) console.log(`（无）\t0\t0%\t—`);
  for (const [s, c] of f.self) console.log(`${s}\t${c}\t${pct(c / f.n)}\t${pct((globalSelf.get(s) || 0) / rows.length)}`);
  // ★ 用名字自称：代词统计看不见的一层（千樱梨的「ちえり」、乃花的「ののちゃん」、若麦的「にゃむ」）
  // 口径：出现次数；被同族更长写法包住的不数（「にゃむ」不数「にゃむち」里的那一截）。
  const mine = rows.filter((r) => r.speaker === id);
  const meForms = new Set(NAMEFORM[id] || []);
  for (const [jp, cn] of Object.entries(NICK)) if (normCn(cn) === normCn(names.get(id))) meForms.add(jp);
  // 名字 + 敬称的派生也要算（乃花的 `ののちゃん` 就是这么来的）
  for (const f of [...meForms]) for (const s of ['ちゃん', 'さん', '先輩']) meForms.add(f + s);
  const meList = [...meForms];
  const selfName = [];
  for (const form of meList) {
    let occ = 0, lines = 0;
    for (const r of mine) {
      let i = -1, c = 0;
      while ((i = r.jp.indexOf(form, i + 1)) !== -1) {
        if (!meList.some((g) => g.length > form.length && r.jp.startsWith(g, i))) c++;
      }
      if (c) { occ += c; lines++; }
    }
    if (occ >= 3) selfName.push([form, occ, lines]);
  }
  selfName.sort((a, b) => b[1] - a[1]);
  if (selfName.length) {
    console.log('');
    console.log(`用名字自称\t次数\t行数\t占比(按行)`);
    for (const [form, occ, lines] of selfName.slice(0, 6)) console.log(`${form}\t${occ}\t${lines}\t${pct(lines / f.n)}`);
    console.log('（这一层不算代词；中→日时中文的「我」要优先落到名字上，见 02 第六节）');
  }
  console.log('');
  console.log(`语尾\t次数\t占比\tz`);
  for (const x of f.tails.slice(0, opt.top)) console.log(`${x.t}\t${x.c}\t${pct(x.p)}\t${x.z.toFixed(1)}`);
}

// ---------- tail ----------
async function cmdTail(q, tailArg) {
  const { rows, names, nameToId } = await loadAll(); loadRoles(names, nameToId);
  const id = resolveId(q, names, nameToId);
  const f = fingerprint(rows, id);
  if (!f.n) { console.log(`没有找到说话人「${q}」的台词。`); return; }
  const t = tailArg || f.tails[0]?.t;
  if (!t) { console.log('该角色没有可统计的语尾。'); return; }
  const hits = rows.filter((r) => r.speaker === id && r.jp.replace(/\n/g, '').includes(t));
  console.log(`角色\t${names.get(id) || ''}（${id}）　语尾\t${t}　命中\t${hits.length} 句`);
  console.log('');
  for (const r of hits.slice(0, opt.limit)) {
    console.log(`${r.asset}#${r.idx}`);
    console.log(`日\t${r.jp.replace(/\n/g, ' ⏎ ')}`);
    if (opt.cn) console.log(`中\t${(r.zh || '').replace(/\n/g, ' ⏎ ')}`);
  }
  if (hits.length > opt.limit) console.log(`\n（还有 ${hits.length - opt.limit} 句，用 --limit 调整）`);
}

// ---------- 已核验的专属绰号（03c 第三节那一层） ----------
// 名字之外、靠名字写法扫不出来的叫法。全部由语料实测得出（次数见 03c）。
// 写在这里是为了让 call 子命令与 03b/03c 的数字口径一致；**要改请先回语料核一遍**。
const NICK = {
  ともりん: '高松灯', あのちゃん: '千早爱音', そよりん: '长崎素世',
  りっきー: '椎名立希', 野良猫: '要乐奈', チェリ: '梅里千樱梨',
  りっちゃん: '峰月律', にゃむち: '祐天寺若麦', にゃむ: '祐天寺若麦',
  // ↓ 若麦专用的片假名化叫法：里面没有目标名字的任何 2-gram，名字扫描必然漏，只能单列
  サキコ: '丰川祥子', ウミコ: '八幡海铃', ウイコ: '三角初华', ムーコ: '若叶睦',
};
const HON_ALL = ['さん', 'ちゃん', '先輩', '先生', 'くん', '君', '様'];
// 名表里的中文名可能带舞台代号后缀（`祐天寺若麦（喵梦）`），比对前一律去掉括号部分
const normCn = (s) => (s || '').replace(/[（(].*?[)）]/g, '').trim();
const KANA_LET = /[\u3040-\u30ff\u4e00-\u9fff々ー]/;
const BOUND_PART = /^[はがをにものねよへとっ]$/;

// ---------- 已核验的名字形态（id → 语料里真实出现过的写法） ----------
// 只收「语料里真的这么写过」的形式；**招牌写法照抄，不要自己加汉字或罗马字**（见 03c 第四节）。
const NAMEFORM = {
  tomori: ['高松', '燈', 'ともり'], anon: ['千早', '愛音', 'あのん'],
  rana: ['楽奈', 'らな'], soyo: ['長崎', 'そよ'], taki: ['椎名', '立希', 'たき'],
  sakiko: ['豊川', '祥子', '祥', 'さき'], uika: ['三角', '初華', 'うい'],
  mutsumi: ['若葉', '睦'], umiri: ['八幡', '海鈴'], nyamu: ['祐天寺', 'にゃむ'],
  arale: ['仲町', 'あられ'], nonoka: ['宮永', 'ののか', 'のの'], ritsu: ['峰月', '律'],
  miyako: ['藤', '都子', 'みやこ'], yuno: ['千石', 'ユノ'], hotaru: ['汐見', '蛍'],
  natsume: ['伊沢', '棗', 'なつめ'], nagi: ['琴平', '凪'], mahoro: ['浜崎', 'まほろ'],
  houka: ['和泉', '朋花', 'ほうか'], raika: ['須賀', '蕾叶', 'らいか'],
  miku: ['馬橋', '心玖', 'みく'], yomogi: ['矢倉', '蓬咲', 'よもぎ'],
  chieri: ['梅里', 'ちえり'], shizuku: ['四宮', '寧月', 'しずく'],
};
// 全名（姓+名）也进存货，好让「藤都子」整体匹配，不被单字姓切开
const FULLNAME = {};
for (const [id, arr] of Object.entries(NAMEFORM)) FULLNAME[id] = arr.slice(1).map((g) => arr[0] + g);

// ---------- call ----------
async function cmdCall(q, target) {
  const { rows, names, nameToId } = await loadAll(); loadRoles(names, nameToId);
  const id = resolveId(q, names, nameToId);
  const mine = rows.filter((r) => r.speaker === id);
  if (!mine.length) { console.log(`没有找到说话人「${q}」的台词。`); return; }

  const learned = learnNames(rows, names);     // 日文写法(基名) -> {cn, n, suf}
  // 存货 = 已核验名字形态 + 已核验绰号 + 双语对齐自动学出的补充；带敬称的派生形式一律现算
  const FORMS = [];
  const seen = new Set();
  const addForm = (form, cn, kind) => {
    if (!form || seen.has(form)) return;
    seen.add(form); FORMS.push({ form, cn, kind });
  };
  for (const [sid, arr] of Object.entries(NAMEFORM)) {
    const cn = names.get(sid) || sid;
    for (const f of arr) addForm(f, cn, 'name');
    for (const f of FULLNAME[sid]) addForm(f, cn, 'name');
  }
  for (const [jp, cn] of Object.entries(NICK)) addForm(jp, cn, 'nick');
  for (const [jp, v] of learned) addForm(jp, v.cn, 'name');
  const EXPAND = [];
  for (const f of FORMS) {
    EXPAND.push(f);
    for (const s of HON_ALL) EXPAND.push({ form: f.form + s, cn: f.cn, kind: f.kind, base: f.form, hon: s });
  }
  EXPAND.sort((a, b) => b.form.length - a.form.length);
  const FMAP = new Map();
  for (const f of EXPAND) if (!FMAP.has(f.form)) FMAP.set(f.form, f);
  const MAXL = EXPAND[0].form.length;

  const wanted = target ? normCn(names.get(resolveId(target, names, nameToId)) || target) : null;
  const acc = new Map();     // cn|form -> {c, cn, form, ex}
  const addHit = (f, r) => {
    const k = f.cn + '|' + f.form;
    if (!acc.has(k)) acc.set(k, { c: 0, cn: f.cn, form: f.form, ex: [] });
    const e = acc.get(k); e.c++;
    if (e.ex.length < 2) e.ex.push(`${r.asset}#${r.idx}　${r.jp.replace(/\n/g, ' ').slice(0, 42)}`);
  };
  for (const r of mine) {
    const jp = r.jp;
    for (let i = 0; i < jp.length; i++) {
      if (!KANA_LET.test(jp[i])) continue;
      let m = null;
      for (let L = Math.min(MAXL, jp.length - i); L >= 1; L--) {
        const f = FMAP.get(jp.slice(i, i + L));
        if (!f) continue;
        if ((/^[\u3041-\u309fー]+$/.test(f.form) && !f.hon) || f.form.length === 1) {
          const prev = i > 0 ? jp[i - 1] : '';
          const next = jp[i + L] || '';
          const two = next + (jp[i + L + 1] || '');
          const okPrev = !prev || !KANA_LET.test(prev);
          const okHon = HON_ALL.some((h) => next.startsWith(h) || two.startsWith(h));
          const okNext = !next || !KANA_LET.test(next) || BOUND_PART.test(next) || okHon;
          const ok = (f.kind === 'nick' || f.form.length === 1) ? (okPrev || okNext) : (okPrev || okHon);
          if (!ok) continue;
        }
        m = { f, L };
        break;
      }
      if (!m) continue;
      if (!wanted || normCn(m.f.cn) === wanted) addHit(m.f, r);
      i += m.L - 1;                      // 最长匹配：吃掉整个称呼，避免子串重复计数
    }
  }

  console.log(`角色\t${names.get(id) || ''}（${id}）　台词 ${mine.length} 句${target ? `　对象：${target}` : ''}`);
  console.log(`口径\t最长匹配 + 假名边界 + 绰号进存货（与 references/03b 一致）`);
  console.log('\n称呼\t对象\t次数');
  const list = [...acc.values()].sort((a, b) => b.c - a.c).slice(0, opt.limit);
  if (!list.length) console.log('（未命中）');
  for (const x of list) {
    console.log(`${x.form}\t${x.cn}\t${x.c} 次`);
    for (const e of x.ex) console.log(`    ${e}`);
  }
  if (acc.size > opt.limit) console.log(`\n（还有 ${acc.size - opt.limit} 种写法，用 --limit 调整）`);
  console.log('\n提示：① 日语常省略称呼直接说事，本表只统计「说出口的名字」；');
  console.log('      ② 名字形态与绰号来自已核验清单（见 03c 第三、四节），其余由双语对齐自动补；');
  console.log('      ③ 用姓称呼的人（如「そよさん」指爽世）仍可能并入同姓角色——可疑时用 `map` 看全表。');
}

// ---------- map（中日名对应表，调试用） ----------
async function cmdMap(who) {
  const { rows, names, nameToId } = await loadAll(); loadRoles(names, nameToId);
  const learned = learnNames(rows, names);
  let list = [...learned.entries()].map(([jp, v]) => ({ jp, ...v }));
  if (who) { const cn = names.get(resolveId(who, names, nameToId)) || who; list = list.filter((x) => x.cn === cn); }
  list.sort((a, b) => b.n - a.n);
  console.log(`自动学出的「日文写法 → 中文名」共 ${list.length} 条（出现≥3 次）\n`);
  console.log('日文写法\t中文名\t中日同现次数');
  for (const x of list.slice(0, opt.limit * 5)) console.log(`${x.jp}\t${x.cn}\t${x.n}`);
  console.log('\n用法：call 子命令即用此表；若某绰号缺失，说明它在中译里没被写成该角色的中文名。');
}

// ---------- exp ----------
async function cmdExp(asset, who) {
  if (!fs.existsSync(IDX)) { console.log(`找不到 ${IDX}\n→ exp 子命令需要 ournotes_index.tsv（含 exp / motion 列）；没有就跳过这条。`); return; }
  const { names, nameToId } = await loadAll(); loadRoles(names, nameToId);
  const rows = [];
  const rl = readline.createInterface({ input: fs.createReadStream(IDX) });
  let head = true;
  await new Promise((res) => {
    rl.on('line', (l) => {
      if (head) { head = false; return; }
      const c = l.split('\t');
      if (c.length < 11) return;
      const [advId, series, speaker, exp, motion, cue, , , , , advAsset] = c;
      if (advAsset !== asset && advId !== asset) return;
      if (who && resolveId(who, names, nameToId) !== speaker.split('・')[0]) return;
      rows.push({ speaker, exp, motion, cue });
    });
    rl.on('close', res);
  });
  console.log(`集\t${asset}\t命中\t${rows.length} 行`);
  if (!rows.length) { console.log('（该集不在索引里，或没有表情标注）'); return; }
  console.log('\n说话人\texp\tmotion\tcue');
  for (const r of rows.slice(0, opt.limit)) console.log(`${r.speaker}\t${r.exp}\t${r.motion}\t${r.cue}`);
  if (rows.length > opt.limit) console.log(`\n（还有 ${rows.length - opt.limit} 行，用 --limit 调整）`);
  console.log('\n（以上是游戏原始标注，仅供对齐参考；码不解释含义，按你自己的理解用）');
}

// ---------- line ----------
async function cmdLine(ref) {
  const m = String(ref).match(/^(.+)#(\d+)$/);
  if (!m) { console.log('用法： line <集号>#<行号>，例 line adv_script_millsage_004_1_07#12'); return; }
  const [, asset, idxS] = m;
  const idx = Number(idxS);
  const { rows, names } = await loadAll();
  const here = rows.filter((r) => r.asset === asset);
  if (!here.length) { console.log(`找不到集号 ${asset}`); return; }
  const pos = here.findIndex((r) => r.idx === idx);
  if (pos < 0) { console.log(`该集里没有 idx=${idx}（共 ${here.length} 行）`); return; }
  const from = Math.max(0, pos - 3), to = Math.min(here.length, pos + 4);
  console.log(`集\t${asset}`);
  for (let i = from; i < to; i++) {
    const r = here[i];
    const mark = i === pos ? '>>' : '  ';
    console.log(`${mark} #${r.idx} ${names.get(r.speaker) || r.speaker}：${r.jp.replace(/\n/g, ' ⏎ ')}`);
    if (opt.cn) console.log(`     中：${(r.zh || '').replace(/\n/g, ' ⏎ ')}`);
  }
}

// ---------- model（列出一个 Live2D 模型的可用表情/动作） ----------
// 用法： node vtool.mjs model <模型目录或 .model3.json 路径>
// 新模型（.model3.json）的表情就是游戏 exp_* 码；旧模型（model.json）里通常没有表情定义。
async function cmdModel(p) {
  if (!p) { console.log('用法： model <模型目录或 .model3.json 路径>'); return; }
  let file = p;
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
    const ents = fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isFile());
    const m3 = ents.find((e) => e.name.endsWith('.model3.json'));
    const m1 = ents.find((e) => e.name === 'model.json');
    if (m3) file = path.join(p, m3.name);
    else if (m1) file = path.join(p, m1.name);
    else {
      console.log(`${p} 里没找到 .model3.json 或 model.json。`);
      const others = ents.filter((e) => /\.(json|exp\.json|motion3\.json)$/i.test(e.name)).map((e) => e.name);
      if (others.length) console.log('同目录其它定义文件（可自行查看）：\n  ' + others.join('\n  '));
      return;
    }
  }
  if (!fs.existsSync(file)) { console.log(`找不到 ${file}`); return; }
  let j;
  try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log(`解析失败：${e.message}`); return; }
  const kind = file.endsWith('.model3.json') ? '新模型（.model3.json / Cubism 4）' : '旧模型（model.json / Cubism 2）';
  // 两种格式都认：Cubism4 在 FileReferences 下，Cubism2 在顶层
  const FR = j.FileReferences || {};
  const exps = [
    ...((FR.Expressions || []).map((e) => e && e.Name)),
    ...((Array.isArray(j.expressions) ? j.expressions : []).map((e) => e && (e.Name || e.name))),
  ].filter(Boolean);
  const mots = [
    ...Object.values(FR.Motions || {}).flat().map((m) => m && m.Name),
    ...((Array.isArray(j.motions) ? j.motions : []).flat().map((m) => m && (m.Name || m.name || m.file))),
  ].filter(Boolean);

  console.log(`模型\t${file}`);
  console.log(`类型\t${kind}`);
  console.log(`表情\t${exps.length} 个`);
  if (exps.length) console.log('  ' + exps.join('  '));
  else console.log('  （该文件里没有表情定义）');
  console.log(`动作\t${mots.length} 个`);
  if (mots.length) console.log('  ' + mots.join('  '));

  if (exps.some((e) => e.startsWith('exp_'))) {
    console.log('\n提示：以上是这份模型实际可用的表情名，写 changeFigure 时照抄即可。');
  } else if (exps.length) {
    console.log('\n提示：本模型的表达式名**不是**游戏码——不同模型含义可能不同，');
    console.log('      请先看文本定情绪，再挑名字能读懂的那个。见 references/08-WebGAL与模型.md');
  } else {
    console.log('\n提示：本模型文件里没有表情定义。旧模型请勿做表情匹配（见 references/08-WebGAL与模型.md）；');
    console.log('      可用表情可能在同目录的其它 json 里（如 model_*_mov.json），可自行查看。');
  }
}

// ---------- audit：稿子体检（不需要语料包） ----------
// 基线不另存一份，直接从 references/09-语体基线.md 的表读——改那张表就等于改基线，两处不会漂。
// 口径：敬体率＝「一次发言里出现です・ます 类的比例」（含句中，不是只数句末），与 05 第五节一致。
function loadBaseline() {
  const f = new URL('../references/09-语体基线.md', import.meta.url);
  if (!fs.existsSync(f)) return null;
  const base = {};
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const c = line.split('|').map((x) => x.trim());
    if (c.length < 7) continue;
    const m = (c[2] || '').match(/^`([a-z_]+)`$/);
    if (!m) continue;
    const polite = Number((c[4] || '').replace(/[^\d.]/g, ''));
    const len = Number((c[5] || '').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(polite) || !Number.isFinite(len) || !(c[4] || '').match(/\d/) || !(c[5] || '').match(/\d/)) continue;
    const selfW = ((c[3] || '').match(/`([^`]+)`/) || [])[1] || '';
    const selfPct = Number((((c[3] || '').match(/([\d.]+)\s*%/) || [])[1]) || 0);
    base[m[1]] = { cn: c[1].replace(/\*\*/g, ''), self: selfW, selfPct, polite, len };
  }
  return Object.keys(base).length >= 20 ? base : null;
}
// 这几个自称基本是「谁的专属」——用错人比用错语尾更刺耳
const OWNED_SELF = { わたくし: ['sakiko', 'oblivionis'], アタシ: ['nyamu', 'amoris'], ぼく: ['arale'], 僕: ['tomori', 'doloris', 'uika'], 俺: ['yomogi', 'amoris'] };
const cnLen = (s) => (s.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
const jpLen = (s) => (s.replace(/[。、！？…〜～♪「」『』（）\s]/g, '').match(/[\u4e00-\u9fff\u3040-\u30ff々ー]/g) || []).length;

function cmdAudit(file, srcFile) {
  if (!file || !fs.existsSync(file)) { console.error('用法：audit <稿子.txt> [--src <中文原文.txt>]'); process.exit(2); }
  const base = loadBaseline();
  if (!base) { console.error('读不到 references/09-语体基线.md 的表，无法取基线'); process.exit(2); }
  const byCn = {};
  for (const id of Object.keys(base)) byCn[base[id].cn] = id;
  // 作者常写简称（只写名、或用另一个通行汉字写法）；这里认这些，免得整段判成「名单外」
  const ALIAS_CN = {
    灯: 'tomori', 爱音: 'anon', 乐奈: 'rana', 素世: 'soyo', 爽世: 'soyo', 立希: 'taki',
    祥子: 'sakiko', 初华: 'uika', 睦: 'mutsumi', 海铃: 'umiri', 若麦: 'nyamu', 喵梦: 'nyamu',
    阿拉蕾: 'arale', 野乃花: 'nonoka', 律: 'ritsu', 都子: 'miyako', 由乃: 'yuno',
    萤: 'hotaru', 枣: 'natsume', 凪: 'nagi', 茉幌: 'mahoro', 真幌: 'mahoro', 朋花: 'houka',
    蕾叶: 'raika', 心玖: 'miku', 蓬咲: 'yomogi', 千樱梨: 'chieri', 宁月: 'shizuku', 奏多: 'kanata',
  };
  const resolve = (s) => {
    const k = String(s || '').trim();
    if (base[k]) return k;
    if (byCn[k]) return byCn[k];
    if (ALIAS_CN[k] && base[ALIAS_CN[k]]) return ALIAS_CN[k];
    const hit = Object.keys(base).filter((id) => k && base[id].cn.includes(k));
    return hit.length === 1 ? hit[0] : '';
  };
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim() || /^[【\[]/.test(line.trim()) || /^#/.test(line)) continue;
    const i = line.search(/[：:]/);
    if (i < 0) continue;
    rows.push({ who: line.slice(0, i).trim(), jp: line.slice(i + 1).trim() });
  }
  if (!rows.length) { console.error('稿子里没读到「说话人：台词」的行'); process.exit(2); }
  const spk = {};
  for (const r of rows) (spk[r.who] ||= []).push(r.jp);
  const flag = [];
  console.log(`稿子\t${file}\t${rows.length} 句\t${Object.keys(spk).length} 个说话人\n`);
  console.log('说话人\t句数\t敬体率(实测/基线)\t句长(实测/基线)\t自称');
  for (const who of Object.keys(spk)) {
    const list = spk[who], id = resolve(who), b = base[id];
    const n = list.length;
    const polite = list.filter((x) => POLITE_END.test(x)).length / n;
    const len = list.reduce((a, x) => a + jpLen(x), 0) / n;
    const selves = [...new Set(list.flatMap((x) => Object.keys(OWNED_SELF).concat(['わたし', '私', 'あたし', 'うち', '自分']).filter((s) => x.includes(s))))];
    const pct = (x) => (x * 100).toFixed(0) + '%';
    if (!b) {
      console.log(`${who}\t${n}\t${pct(polite)}\t${len.toFixed(1)}\t${selves.join(' ') || '—'}\t（名单外，无基线）`);
      for (const s of selves) if (OWNED_SELF[s]) flag.push(`${who}「${who}」用了专属自称 ${s}——名单外的角色，先确认这是你要的语体`);
      continue;
    }
    console.log(`${who}\t${n}\t${pct(polite)} / ${b.polite}%\t${len.toFixed(1)} / ${b.len}${n < 8 ? '（句太少不判句长）' : ''}\t${selves.join(' ') || '—'}`);
    if (n >= 4) {
      const dp = Math.abs(polite * 100 - b.polite);
      if (dp > 15) flag.push(`${who} 敬体率 ${pct(polite)}，基线 ${b.polite}%——差 ${dp.toFixed(0)} 个百分点${b.polite > 15 && b.polite < 85 ? '（她是混合档，随场合浮动；先确认这一场的关系）' : '，先查 05 第五节的敬体档'}`);
    }
    if (n >= 8) {
      const dl = Math.abs(len - b.len) / b.len;
      if (dl > 0.4) flag.push(`${who} 平均句长 ${len.toFixed(1)}，基线 ${b.len}——差 ${(dl * 100).toFixed(0)}%，短句型角色要砍句、长句型角色不许缩`);
      const tails = [...new Set(list.map((x) => (x.replace(/[。！？…〜～♪\s]+$/, '').slice(-1) || '')))];
      if (tails.length <= 2 && b.len >= 15) flag.push(`${who} 句尾只有 ${tails.length} 种（${tails.join(' ')}）——话多的角色不该只有一个收尾，像逐句套模板`);
    }
    for (const s of selves) {
      const owners = OWNED_SELF[s];
      if (owners && !owners.includes(id)) flag.push(`${who} 用了 ${s}——那是 ${owners.map((o) => base[o] ? base[o].cn : o).join('／')} 的自称`);
    }
    if (b.self && selves.length && !selves.includes(b.self) && /^[\u3040-\u30ff]/.test(b.self)) {
      flag.push(`${who} 稿里没出现她的主自称 ${b.self}（基线 ${b.selfPct}%）——自称出现率低是常态，但一句都没有要先确认`);
    }
  }
  // 全篇级
  const you = rows.filter((r) => /あなた|あんた/.test(r.jp)).length;
  if (you / rows.length > 0.05) flag.push(`全篇 ${you} 句用了 あなた／あんた（${((you / rows.length) * 100).toFixed(0)}%）——日语里熟人之间默认是名字或省略，查 03d`);
  if (srcFile && fs.existsSync(srcFile)) {
    const cn = fs.readFileSync(srcFile, 'utf8').split('\n').filter((l) => l.trim() && !/^[【\[]/.test(l.trim()));
    if (cn.length === rows.length) {
      const ratios = rows.map((r, i) => jpLen(r.jp) / Math.max(1, cnLen(cn[i].replace(/^[^：:]*[：:]/, ''))));
      const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      const sd = Math.sqrt(ratios.reduce((a, b) => a + (b - mean) ** 2, 0) / ratios.length);
      const cv = sd / mean;
      console.log(`\n中日行数一致（${cn.length}），逐句长度比 ${mean.toFixed(2)} ± ${cv.toFixed(2)}（变异系数）`);
      if (cv < 0.18 && cn.length >= 12) flag.push(`中日逐句长度几乎等比（变异系数 ${cv.toFixed(2)}）——人做会拆句合句、长短不齐，这个形状像逐句直译`);
    } else {
      console.log(`\n中日行数不一致（中 ${cn.length} / 日 ${rows.length}）——正常，说明有拆句或合句`);
    }
  }
  console.log('');
  if (!flag.length) { console.log('✓ 机器查得动的项都过。剩下的只有「这句为什么这么说」——抽查任意一句，答不出就回炉。'); return; }
  console.log(`⚠ ${flag.length} 项提示（机器只查得动形式，查不动意思）：`);
  for (const f2 of flag) console.log('  · ' + f2);
  console.log('\n逐条核对：形式对了不代表逐句想过；形式不对基本可以确定没想过。');
  process.exit(1);
}

// ---------- 分发 ----------
switch (cmd) {
  case 'self': await cmdSelf(args[0]); break;
  case 'tail': await cmdTail(args[0], args[1]); break;
  case 'read': cmdRead(); break;
  case 'audit': cmdAudit(args[0] || opt.in, opt.src); break;
  case 'call': await cmdCall(args[0], args[1]); break;
  case 'map': await cmdMap(args[0]); break;
  case 'model': await cmdModel(args[0]); break;
  case 'exp': await cmdExp(args[0], args[1]); break;
  case 'line': await cmdLine(args[0]); break;
  default: console.error(`未知子命令「${cmd}」`); usage(); process.exit(2);
}
