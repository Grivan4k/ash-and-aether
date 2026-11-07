const fs=require('fs');const load=f=>fs.readFileSync(f,'utf8').trim().split('\n').map(l=>JSON.parse(l));
const A=load(process.argv[2]||'results_v4.jsonl'),B=load('results.jsonl');const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:'-';};
function summary(rows){const o={};
  o.wins=rows.filter(r=>r.res.win).length;o.conq=rows.filter(r=>r.res.win&&r.res.type==='conquest').length;
  o.elim=rows.filter(r=>r.res.type==='eliminated').length;o.sciLoss=rows.filter(r=>!r.res.win&&r.res.type==='science').length;o.timeout=rows.filter(r=>r.res.timeout).length;
  o.endTurn=med(rows.map(r=>r.turns));o.aiElims=rows.reduce((s,r)=>s+r.log.elims.filter(e=>!e.human).length,0);o.captures=med(rows.map(r=>r.log.captures.length));
  o.humanCaps=rows.reduce((s,r)=>s+r.log.captures.filter(c=>c.byHuman).length,0);o.errors=rows.reduce((s,r)=>s+r.errors.length,0);return o;}
console.log('              ',' было       ','стало     ');const a=summary(A),b=summary(B);for(const k in a)console.log(k.padEnd(12),String(a[k]).padStart(8),String(b[k]).padStart(12));
const byFac=(rows)=>{const m={};for(const r of rows){const f=r.cfg.faction;m[f]=m[f]||[0,0];m[f][1]++;if(r.res.win)m[f][0]++;}return m;};
const fa=byFac(A),fb=byFac(B);console.log('\nпобеды игрока по фракции: было → стало');for(const f in fa)console.log(f.padEnd(8),`${fa[f][0]}/${fa[f][1]}`.padStart(6),' → ',`${fb[f][0]}/${fb[f][1]}`);
const bySt=(rows)=>{const m={};for(const r of rows){const f=r.cfg.strategy;m[f]=m[f]||[0,0];m[f][1]++;if(r.res.win)m[f][0]++;}return m;};
const sa=bySt(A),sb=bySt(B);console.log('\nпобеды по стратегии: было → стало');for(const f in sa)console.log(f.padEnd(8),`${sa[f][0]}/${sa[f][1]}`.padStart(6),' → ',`${sb[f][0]}/${sb[f][1]}`);
const sciW=(rows)=>{const m={};for(const r of rows)if(r.res.type==='science')m[r.res.by]=(m[r.res.by]||0)+1;return JSON.stringify(m);};
console.log('\nнаучные победы (кто):\n было ',sciW(A),'\n стало',sciW(B));
const war=B.filter(r=>r.cfg.strategy==='war');console.log('\nагрессор: захватил городов (медиана) было',med(A.filter(r=>r.cfg.strategy==='war').map(r=>r.log.captures.filter(c=>c.byHuman).length)),'стало',med(war.map(r=>r.log.captures.filter(c=>c.byHuman).length)),
  '| техн. в конце было',med(A.filter(r=>r.cfg.strategy==='war').map(r=>r.human.techs)),'стало',med(war.map(r=>r.human.techs)));
const aiT=(rows,f)=>med(rows.flatMap(r=>r.ais.filter(a=>a.f===f).map(a=>a.techs)));console.log('техн. ИИ к концу: legion',aiT(A,'legion'),'→',aiT(B,'legion'),' necro',aiT(A,'necro'),'→',aiT(B,'necro'),' forge',aiT(A,'forge'),'→',aiT(B,'forge'),' grove',aiT(A,'grove'),'→',aiT(B,'grove'));
