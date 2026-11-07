const fs=require('fs');
const rows=fs.readFileSync(__dirname+'/results.jsonl','utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
const med=a=>{if(!a.length)return '-';const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const avg=a=>a.length?Math.round(a.reduce((s,x)=>s+x,0)/a.length*10)/10:'-';
const oc=r=>r.res.crash?'CRASH':r.res.timeout?'timeout':r.res.win?'win:'+r.res.type:'loss:'+r.res.type;
function table(key,label){const g={};for(const r of rows){const k=key(r);(g[k]=g[k]||[]).push(r);}
  console.log(`\n=== ${label} ===`);
  for(const k of Object.keys(g).sort()){const rs=g[k];const c={};for(const r of rs){const o=oc(r);c[o]=(c[o]||0)+1;}
    const wins=rs.filter(r=>r.res.win).length;
    console.log(`${k.padEnd(10)} n=${String(rs.length).padStart(3)} win ${String(wins).padStart(2)} (${Math.round(wins*100/rs.length)}%) | ${Object.entries(c).map(([o,n])=>o+' '+n).join(', ')} | ход конца (медиана) ${med(rs.map(r=>r.turns))}`);}}
console.log('Партий:',rows.length,' ошибок движка:',rows.reduce((s,r)=>s+(r.errors||[]).length,0),' падений:',rows.filter(r=>r.res.crash).length);
table(r=>r.cfg.strategy,'По стратегии игрока');
table(r=>r.cfg.faction,'По фракции игрока');
table(r=>'d'+r.cfg.diff,'По сложности (0 лёгк,1 обыч,2 сложн)');
table(r=>r.cfg.size,'По размеру карты');
table(r=>r.cfg.vic.science?'sci-on':'sci-off','Научная победа вкл/выкл');
// поражения
const losses=rows.filter(r=>!r.res.win&&!r.res.timeout);
console.log('\n=== Поражения ===');
console.log('уничтожен (ходы):',losses.filter(r=>r.res.type==='eliminated').map(r=>`${r.cfg.strategy}/${r.cfg.faction}@${r.turns}`).join(' '));
const sciL=losses.filter(r=>r.res.type==='science');
console.log('проигрыш по науке, ход медиана',med(sciL.map(r=>r.res.turn)),'мин',Math.min(...sciL.map(r=>r.res.turn)),'макс',Math.max(...sciL.map(r=>r.res.turn)));
const byW={};for(const r of sciL)byW[r.res.by]=(byW[r.res.by]||0)+1;console.log('кто из ИИ выиграл наукой:',JSON.stringify(byW));
// победы
const wins=rows.filter(r=>r.res.win);console.log('\n=== Победы игрока ===');
for(const r of wins)console.log(`  #${r.cfg.id} ${r.cfg.strategy}/${r.cfg.faction}/${r.cfg.size}/d${r.cfg.diff}: ${r.res.type} на ходу ${r.res.turn}`);
// ИИ
console.log('\n=== Наблюдения за ИИ ===');
const warsAll=rows.map(r=>r.log.wars||[]);
console.log('войн за партию (медиана):',med(warsAll.map(w=>w.length)),' войн ИИ против игрока (медиана):',med(warsAll.map(w=>w.filter(x=>x.onHuman).length)));
const firstWarOnH=rows.map(r=>(r.log.wars||[]).find(x=>x.onHuman)).filter(Boolean).map(x=>x.t);
console.log('первая война ИИ против игрока: медиана хода',med(firstWarOnH),' в',firstWarOnH.length,'из',rows.length,'партий');
console.log('захватов городов за партию (медиана):',med(rows.map(r=>(r.log.captures||[]).length)),' игрок терял город в',rows.filter(r=>r.log.firstHumanLoss!=null).length,'партиях, первый раз медиана хода',med(rows.map(r=>r.log.firstHumanLoss).filter(x=>x!=null)));
console.log('уничтожено фракций ИИ всего:',rows.reduce((s,r)=>s+(r.log.elims||[]).filter(e=>!e.human).length,0));
console.log('мятежи: у игрока',rows.reduce((s,r)=>s+(r.log.rebH||0),0),' у ИИ',rows.reduce((s,r)=>s+(r.log.rebAI||0),0));
const endAI=rows.flatMap(r=>r.ais||[]);
console.log('ИИ в конце: городов медиана',med(endAI.filter(a=>a.alive).map(a=>a.cities)),' одобрение среднее',avg(endAI.filter(a=>a.alive).map(a=>a.ap)),' золото медиана',med(endAI.filter(a=>a.alive).map(a=>a.gold)),' глав сюжета (медиана)',med(endAI.map(a=>a.chain)),' перков',med(endAI.map(a=>a.perks)));
const byFacAI={};for(const r of rows)for(const a of r.ais||[]){const o=byFacAI[a.f]=byFacAI[a.f]||{n:0,alive:0,cities:[],gate3:0};o.n++;if(a.alive)o.alive++;o.cities.push(a.cities);}
for(const r of sciL){byFacAI[r.res.by].gate3++;}
console.log('ИИ по фракциям (выжил/всего, городов медиана, науч. побед):');for(const [f,o] of Object.entries(byFacAI))console.log(`  ${f.padEnd(7)} ${o.alive}/${o.n}  ${med(o.cities)}  ${o.gate3}`);
const gateStarts=rows.map(r=>(r.log.gate||[]).find(g=>!g.human&&g.st===1)).filter(Boolean).map(g=>g.t);console.log('ИИ завершил 1-й этап Врат: медиана хода',med(gateStarts));
// игрок по стратегиям
console.log('\n=== Игрок в конце, по стратегии (медианы) ===');
for(const s of ['ai','sci','war','wide','turtle','idle']){const rs=rows.filter(r=>r.cfg.strategy===s);if(!rs.length)continue;const H=rs.map(r=>r.human);
  console.log(`${s.padEnd(7)} города ${med(H.map(h=>h.cities))} (макс ${med(H.map(h=>h.maxCities))}) нас. ${med(H.map(h=>h.pop))} техн ${med(H.map(h=>h.techs))} Врата ${med(H.map(h=>h.gate))} одобр ${med(H.map(h=>h.ap))} ходов с бунтом/ропотом ${med(H.map(h=>h.unrestTurns))} захватил ${med(rs.map(r=>(r.log.captures||[]).filter(c=>c.byHuman).length))} потерял ${med(rs.map(r=>(r.log.captures||[]).filter(c=>c.fromHuman).length))} перков ${med(H.map(h=>h.perks))}`);}
const errs=rows.flatMap(r=>(r.errors||[]).map(e=>`#${r.cfg.id}: ${e}`));if(errs.length){console.log('\n=== Ошибки ===');errs.slice(0,15).forEach(e=>console.log(e));}
const slow=rows.slice().sort((a,b)=>b.ms-a.ms).slice(0,3);console.log('\nсамые долгие партии:',slow.map(r=>`#${r.cfg.id} ${r.cfg.size} ${r.turns}х ${Math.round(r.ms/1000)}с`).join(', '),' среднее мс/ход',Math.round(rows.reduce((s,r)=>s+r.ms,0)/rows.reduce((s,r)=>s+r.turns,0)));
