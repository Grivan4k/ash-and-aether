'use strict';
/* =====================================================================
   ОДОБРЕНИЕ: штрафы за число городов и жителей, состояния городов, мятежи
   ===================================================================== */
const AP = {
  base:58, capital:10,
  freeCities:3, perCity:6,          // разрастание: −6 за каждый город после 3-го
  freePop:4, perPop:1.5,            // теснота: −1,5 за каждого жителя города после 4-го
  popPerPoint:8,                    // многолюдность державы: −1 за каждые 8 жителей во всех городах
  lux:2.5, garrison:5, warAfter:15, perWar:3, warMax:9, occupy:20, occupyTurns:15, festMax:25,
};
const APPROVAL_STATES = [
  {min:85, name:'Ликование',  mul:1.15, grow:1.15, cls:'good', fx:'+15% к доходам и росту'},
  {min:65, name:'Довольство', mul:1.05, grow:1,    cls:'good', fx:'+5% к доходам'},
  {min:45, name:'Спокойствие',mul:1,    grow:1,    cls:'',     fx:'без бонусов и штрафов'},
  {min:25, name:'Ропот',      mul:.85,  grow:.5,   cls:'warn', fx:'−15% к доходам, рост вдвое медленнее'},
  {min:-1e9,name:'Бунт',      mul:.65,  grow:0,    cls:'bad',  fx:'−35% к доходам, рост остановлен, появляются мятежники'},
];

function luxTypes(p){const key=G.turn+':'+(G._ov||0);if(p._luxK===key)return p._lux;const set=new Set();
  for(let i=0;i<N;i++)if(ownerOf[i]===p.id&&G.res[i])set.add(G.res[i]);p._luxK=key;p._lux=set.size;return set.size;}
function empirePop(p){let s=0;for(const c of citiesOf(p.id))s+=c.pop;return s;}

function cityApproval(c,p,festProd){const parts=[];const add=(l,v)=>{v=Math.round(v);if(v)parts.push([l,v]);};
  add('Основа',AP.base);if(c.capital)add('Столица',AP.capital);
  const n=citiesOf(p.id).length;let exp=Math.max(0,n-AP.freeCities)*AP.perCity;
  if(hasPerk(p,'administration'))exp*=.5;if(c.buildings.some(b=>{const B=bdef(p,b);return B&&B.adminHalf;}))exp*=.5;
  add(`Разрастание: ${n} ${plural(n,'город','города','городов')}`,-exp);
  let size=Math.max(0,c.pop-AP.freePop)*AP.perPop;if(p.f.mech==='undead')size*=.5;if(hasPerk(p,'baths'))size*=.5;
  add(`Теснота: ${c.pop} ${plural(c.pop,'житель','жителя','жителей')}`,-size);
  const ep=empirePop(p);add(`Многолюдность: ${ep} ${plural(ep,'житель','жителя','жителей')} в державе`,-Math.floor(ep/AP.popPerPoint));
  const lux=luxTypes(p);add(`Ресурсы: ${lux} ${plural(lux,'вид','вида','видов')}`,lux*(p.f.mech==='coin'?AP.lux+1.5:AP.lux));
  const g=armyAt(c.idx);if(g&&g.owner===p.id)add('Гарнизон',p.f.mech==='discipline'?AP.garrison*2:AP.garrison);
  for(const b of c.buildings){const B=bdef(p,b);if(B&&B.appr)add(B.name,B.appr);}
  const m=fmods(p);if(m.appr)add('Черты, перки, сюжет',m.appr);
  const wars=warsOf(p.id).filter(o=>warTurns(p.id,o)>AP.warAfter).length;if(wars)add('Усталость от войны',-Math.min(AP.warMax,wars*AP.perWar));
  if(c.capturedTurn!=null&&G.turn-c.capturedTurn<AP.occupyTurns)add('Оккупация',-AP.occupy);
  const sg=siegeTurns(c);if(sg)add(`Осада: ${sg} ${plural(sg,'ход','хода','ходов')}`,-Math.min(SIEGE.apMax,sg*SIEGE.apPerTurn));
  const buff=(p.apBuff||[]).filter(x=>x.until>=G.turn).reduce((s,x)=>s+x.v,0);add('События',buff);
  if(c.queue[0]&&c.queue[0].k==='fest')add('Празднества',Math.min(AP.festMax,(festProd||0)*.8));
  const v=clamp(parts.reduce((s,x)=>s+x[1],0),0,100);const st=APPROVAL_STATES.findIndex(s=>v>=s.min);
  return {v,parts,st};}

/* после расчёта города в конце хода */
function approvalTick(p,c,ap){const prev=c.apSt==null?2:c.apSt;c.apSt=ap.st;
  if(p.human){if(ap.st>=3&&ap.st>prev)msg(`${c.name}: ${APPROVAL_STATES[ap.st].name.toLowerCase()}, одобрение ${ap.v}%.`,ap.st===4?'bad':'warn',c.idx);
    else if(prev>=3&&ap.st<3)msg(`${c.name}: порядок восстановлен, одобрение ${ap.v}%.`,'good',c.idx);}
  if(ap.st===4&&R()<.2&&!rebelsOf(c))spawnRebels(p,c);}
function rebelsOf(c){for(const k in G.armies){const a=G.armies[k];if(a.rebel===c.id)return a;}return null;}
function spawnRebels(p,c){const j=freeNeighbor(-1,c.idx);if(j<0)return;const n=2+(c.pop>8?1:0)+(G.turn>100?1:0);
  const a=spawnMonsters(j,n,null,['rebels']);a.home=c.idx;a.rebel=c.id;
  if(p.human)msg(`Бунт в городе ${c.name}: у стен собрались мятежники!`,'bad',j);}
/* ход мятежников: грабят город без гарнизона, расходятся при порядке */
function rebelsAct(a){const c=G.cities[a.rebel];if(!c){a.rebel=null;return;}const p=P(c.owner);
  if(c.apSt!=null&&c.apSt<=2){if(p.human)msg(`Мятежники у города ${c.name} разошлись по домам.`,'good',a.idx);removeArmy(a);return true;}
  if(!adjacent(a.idx,c.idx))return false;const g=armyAt(c.idx);if(g&&g.owner===c.owner)return false;
  const lost=Math.floor(c.prog*.5);c.prog-=lost;const gold=Math.min(p.gold,15);p.gold-=gold;let popLoss=false;if(c.pop>1&&R()<.35){c.pop--;popLoss=true;}
  if(p.human)msg(`Мятежники грабят ${c.name}: −${lost} произв., −${gold} золота${popLoss?', −1 житель':''}. Нужен гарнизон.`,'bad',c.idx);return false;}
function avgApproval(p){const cs=citiesOf(p.id);if(!cs.length)return 100;let s=0;for(const c of cs)s+=cityCalc(c).ap.v;return s/cs.length;}
