// Проверка осады и измора на настоящем движке (без браузера)
const {loadEngine}=require('../tourney/engine-host');
const ctx=loadEngine();
const run=code=>require('vm').runInContext(code,ctx);
let fails=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fails++;};

const R=JSON.parse(run(String.raw`(function(){
createGame({seed:4242,size:'medium',players:4,diff:1,faction:PRESETS.find(f=>f.id==='legion'),vic:{conquest:true,science:true}});
const h=P(G.human),e=G.players.find(p=>!p.human);
const c=citiesOf(h.id)[0];
// убрать гарнизон и всё вокруг города
for(const a of Object.values(G.armies))if(a.owner===h.id||hexDist(a.idx,c.idx)<=2)removeArmy(a);
meet&&meet(h.id,e.id);declareWar(e.id,h.id);
const spot=NBR[c.idx].find(j=>!isWater(j)&&G.ter[j]!=='mount'&&!armyAt(j)&&!cityAt(j));
const foe=newArmy(e.id,spot,[mkUnit(e,'sword'),mkUnit(e,'sword')]);
const out={};
const y0=cityCalc(c);
out.free=null;
out.besieged=isBesieged(c);out.y={prod:y0.prod,gold:y0.gold,sci:y0.sci,food:y0.food,siege:y0.siege};
out.apParts=cityApproval(c,h,0).parts.map(x=>x[0]).filter(s=>s.startsWith('Осада'));
// гарнизон из двух воинов
const g=newArmy(h.id,c.idx,[mkUnit(h,'militia'),mkUnit(h,'militia')]);
const hist=[];
for(let t=0;t<6;t++){processPlayer(h);G.turn++;newTurnReset();
  hist.push({siege:c.siege,def:Math.round(siegeDefPenalty(c)*100),hp:G.armies[g.id]?G.armies[g.id].units.map(u=>u.hp).join('/'):'—',owner:c.owner,pop:c.pop});}
out.hist=hist;
const pv=predict?null:null;
out.defMods=(function(){const D=defendersAt?null:null;return null;})();
// превью боя: моды защиты
try{const {A,D}=buildSides(foe,c.idx);out.pred=D.mods;out.cityDef=Math.round(D.find(f=>f.city).def*10)/10;}catch(err){out.predErr=String(err);}
// снятие осады
const saved=foe.idx;placeArmy(foe,G.players.length?(function(){for(let i=0;i<G.W*G.H;i++)if(hexDist(i,c.idx)>4&&!armyAt(i)&&!cityAt(i))return i;})():saved);
processPlayer(h);out.lifted={siege:c.siege,besieged:isBesieged(c),prod:cityCalc(c).prod};
// сдача бунтующего города без гарнизона
placeArmy(foe,saved);removeArmy(G.armies[g.id]);c.siege=0;
let turns=0;const force=()=>{};const _at=approvalTick;approvalTick=function(pp,cc,ap){_at(pp,cc,ap);if(cc===c)cc.apSt=4;};
for(;turns<8&&c.owner===h.id;turns++){processPlayer(h);force();G.turn++;newTurnReset();}
approvalTick=_at;out.surrender={turns,owner:c.owner===h.id?'human':(c.owner===e.id?'enemy':c.owner)};
return JSON.stringify(out);})()`));
console.log(JSON.stringify(R,null,0));
ok(R.besieged,'город рядом с врагом в осаде');
ok(R.y.prod===0&&R.y.gold===0&&R.y.sci===0&&R.y.food===0,'доходы отрезаны: '+JSON.stringify(R.y));
ok(R.apParts.length===1,'одобрение: строка осады '+R.apParts);
ok(R.hist[0].siege===1&&R.hist[5].siege===6,'счётчик ходов осады растёт');
ok(R.hist[5].def>R.hist[0].def&&R.hist[5].def<=50,'стены слабеют: '+R.hist.map(x=>x.def).join(','));
ok(R.hist.some(x=>x.hp!=='—'&&x.hp!==R.hist[0].hp),'гарнизон голодает: '+R.hist.map(x=>x.hp).join(' '));
ok(R.pred&&R.pred.some(m=>m.includes('осад')),'превью боя показывает осаду: '+(R.pred||[]).join(' | '));
ok(R.hist.every(x=>x.owner===R.hist[0].owner),'спокойный город с гарнизоном за 6 ходов не сдаётся');
ok(!R.lifted.besieged&&R.lifted.siege===0&&R.lifted.prod>0,'осада снята, производство вернулось');
ok(R.surrender.owner==='enemy'&&R.surrender.turns<=5,'бунтующий город без гарнизона сдался за '+R.surrender.turns+' ходов');
const R2=JSON.parse(run(String.raw`(function(){
createGame({seed:777,size:'medium',players:4,diff:1,faction:PRESETS.find(f=>f.id==='forge'),vic:{conquest:true,science:true}});
const h=P(G.human),e=G.players.find(p=>!p.human);const c=citiesOf(h.id)[0];
for(const a of Object.values(G.armies))if(a.owner===h.id||hexDist(a.idx,c.idx)<=2)removeArmy(a);
declareWar(e.id,h.id);const spot=NBR[c.idx].find(j=>!isWater(j)&&G.ter[j]!=='mount'&&!armyAt(j)&&!cityAt(j));
newArmy(e.id,spot,[mkUnit(e,'sword')]);newArmy(h.id,c.idx,[mkUnit(h,'militia')]);
const _at=approvalTick;approvalTick=function(pp,cc,ap){_at(pp,cc,ap);if(cc===c)cc.apSt=3;};
let t=0;const cd=[];for(;t<20&&c.owner===h.id;t++){processPlayer(h);G.turn++;newTurnReset();if(c.owner===h.id)cd.push(siegeSurrenderIn(c));}
approvalTick=_at;return JSON.stringify({t,owner:c.owner===h.id?'human':'enemy',cd:cd.slice(0,3).concat(cd.slice(-2))});})()`));
console.log(JSON.stringify(R2));
ok(R2.owner==='enemy'&&R2.t===15,'город в ропоте с гарнизоном держится 15 ходов, потом гарнизон дезертирует (сдался на '+R2.t+'-м)');
ok(R2.cd[0]===14,'счётчик «сдастся через N ходов» в интерфейсе: '+R2.cd.join(','));
console.log(fails?`ПРОВАЛОВ: ${fails}`:'ВСЕ ПРОВЕРКИ ПРОШЛИ');console.log('engine errors',ctx.__ERR.length,ctx.__ERR.slice(0,3));
