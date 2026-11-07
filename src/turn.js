'use strict';
/* =====================================================================
   ХОД: экономика, рост, производство, исследования, дипломатия, чудовища
   ===================================================================== */

function upkeepOf(p){let n=0;for(const a of armiesOf(p.id))for(const u of a.units){const d=udef(p,u.t);if(!d.civ)n++;}return Math.max(0,Math.floor(n*.5*(hasPerk(p,'taxReform')?.5:1))-1);}
function empireIncome(p){let gold=0,sci=0;for(const c of citiesOf(p.id)){const y=cityCalc(c);gold+=y.gold;sci+=y.sci;if(!c.queue.length)gold+=Math.floor(y.prod*.5);}
  const up=upkeepOf(p);return {gold:gold-up,gross:gold,upkeep:up,sci:round1(sci)};}

function completeItem(p,c,it){
  if(it.k==='bld'){c.buildings.push(it.id);msg(`${c.name}: построено — ${bdef(p,it.id).name}.`,'good',c.idx,p.id);return true;}
  if(it.k==='proj'){completeGateStage(p,c,PROJECTS[it.id].stage);return true;}
  const d=udef(p,it.id);const vet=c.buildings.some(b=>{const B=bdef(p,b);return B&&B.vet;});const u=mkUnit(p,it.id,vet);
  const g=armyAt(c.idx);
  if(d.civ||d.scout){const j=!g?c.idx:freeNeighbor(p.id,c.idx);if(j<0)return false;
    if(it.id==='settler'){c.pop--;c.food=Math.min(c.food,growNeed(c.pop)-1);}
    newArmy(p.id,j,[u]);msg(`${c.name}: готовы ${d.name}.`,'good',j,p.id);return true;}
  if(g&&g.owner===p.id&&g.units.length<armyCap(p)&&!hasSettler(g)&&!g.units.every(x=>udef(p,x.t).scout)){g.units.push(u);g.mpMax=armyMpMax(g);msg(`${c.name}: ${d.name} вступили в гарнизон.`,'good',c.idx,p.id);return true;}
  if(!g){newArmy(p.id,c.idx,[u]);msg(`${c.name}: готовы ${d.name}.`,'good',c.idx,p.id);return true;}
  const j=freeNeighbor(p.id,c.idx);if(j<0)return false;newArmy(p.id,j,[u]);msg(`${c.name}: готовы ${d.name}.`,'good',j,p.id);return true;}

function gateBonus(p,sci){return Math.floor(sci*(hasPerk(p,'aetherKeepers')?.3:GATE_SCI_SHARE));}
function gateStarted(p,c,it){const st=PROJECTS[it.id].stage;p.gate.building=st;p.gate.city=c.id;
  if(p.id===G.human)msg(`Врата Эфира: начат этап ${st} из 3 в городе ${c.name}. Он займёт не меньше ${GATE_MIN_TURNS} ходов.`,'info',c.idx);
  else{const kn=knowsOf(p.id);msg(`${kn?'Фракция «'+p.f.name+'»':'Неизвестная фракция'} начала этап ${st} из 3 Врат Эфира${kn?' в городе '+c.name:''}.`,'bad',kn?c.idx:-1);if(G._popups&&st===1)G._popups.push({type:'gateStart',by:p.id,city:c.name,idx:c.idx});}}
function completeGateStage(p,c,st){p.gate={city:c.id,stage:st};
  if(p.id===G.human)msg(`Врата Эфира: этап ${st} из 3 завершён в городе ${c.name}.`,'good',c.idx);
  else{const who=knowsOf(p.id)?`Фракция «${p.f.name}»`:'Неизвестная фракция';msg(`${who} завершила этап ${st} из 3 Врат Эфира (${c.name}).`,'bad',knowsOf(p.id)?c.idx:-1);if(G._popups)G._popups.push({type:'gate',by:p.id,stage:st,city:c.name});}
  if(st>=3){if(G.vic&&G.vic.science&&!G.over)G.over={win:p.id===G.human,type:'science',by:p.id,turn:G.turn};}
  else c.queue.unshift({k:'proj',id:'gate'+(st+1)});}
function processPlayer(p){
  let gold=0,sci=0;const cs=citiesOf(p.id);const ys=new Map();let sciAll=0;for(const c of cs){const y=cityCalc(c);ys.set(c.id,y);sciAll+=y.sci;}
  for(const c of cs){
    const y=ys.get(c.id);gold+=y.gold;sci+=y.sci;
    c.food+=y.net;const need=growNeed(c.pop);
    if(c.food>=need){c.pop++;c.food-=need;msg(`${c.name} вырос до ${c.pop}.`,'info',c.idx,p.id);}
    else if(c.food<0){if(c.pop>1){c.pop--;c.food=Math.floor(growNeed(c.pop)*.3);msg(`${c.name}: голод, население уменьшилось.`,'bad',c.idx,p.id);}else c.food=0;}
    try{approvalTick(p,c,y.ap);}catch(e){console.error(e);}
    if(siegeTick(p,c))continue;
    if(c.queue.length&&c.queue[0].k==='fest'){}
    else if(c.queue.length){c.prog+=y.prod+(c.queue[0].k==='proj'?gateBonus(p,sciAll):0);const it=c.queue[0];const cost=itemCost(p,it);
      if(it.k==='proj'&&it.start==null){it.start=G.turn;gateStarted(p,c,it);}
      if(c.prog>=cost){
        if(it.k==='proj'&&G.turn-it.start<GATE_MIN_TURNS-1){c.prog=cost;}
        else if(it.id==='settler'&&c.pop<2){c.prog=cost;if(!c.warnPop){c.warnPop=1;msg(`${c.name}: поселенцам нужно население 2+.`,'warn',c.idx,p.id);}}
        else if(completeItem(p,c,it)){c.prog=Math.min(c.prog-cost,Math.floor(cost*.5));const ix=c.queue.indexOf(it);if(ix>=0)c.queue.splice(ix,1);c.bought=false;c.warnPop=0;
          if(!c.queue.length&&p.human)msg(`${c.name}: очередь производства пуста.`,'warn',c.idx,p.id);}
        else c.prog=cost;}}
    else gold+=Math.floor(y.prod*.5);
    const mx=cityMaxHp(c);const sieged=NBR[c.idx].some(j=>{const e=armyAt(j);return e&&e.owner>=0&&e.owner!==c.owner&&atWar(e.owner,c.owner);});
    if(c.hitTurn<G.turn&&!sieged)c.hp=Math.min(mx,c.hp+Math.max(3,Math.round(mx*.10)));else c.hp=Math.min(c.hp,mx);
  }
  const up=upkeepOf(p);p.gold+=Math.round(gold-up);
  while(p.gold<0){const victim=disbandWeakest(p);if(!victim)break;p.gold+=8;msg(`Казна пуста: распущен отряд «${victim}».`,'bad',-1,p.id);}
  if(p.gold<0)p.gold=0;
  p.sciPool+=sci;
  if(!p.research&&!p.human)p.research=aiPickTech(p);
  while(p.research){const cost=tcost(p,p.research);if(p.sciPool<cost)break;p.sciPool-=cost;const t=p.research;p.techs[t]=true;p.research=null;
    if(t==='aethertheory'&&!p.human&&G.vic&&G.vic.science){msg(`${knowsOf(p.id)?'Фракция «'+p.f.name+'»':'Неизвестная фракция'} изучила Теорию Эфира и может начать Врата.`,'warn');if(G._popups)G._popups.push({type:'theory',by:p.id});}
    if(p.human){msg(`Исследовано: ${TECHS[t].name}. ${techUnlocks(p,t).join(', ')}.`,'good');G._techDone=true;}
    else p.research=aiPickTech(p);
    for(const a of armiesOf(p.id))a.mpMax=armyMpMax(a);}
  if(p.techs.aethertheory&&p.human&&!p.gateNoted&&G.vic&&G.vic.science){p.gateNoted=1;msg('Теория Эфира открыта: в любом городе можно начать Врата Эфира.','good');}
  try{questTick(p);perkTick(p);}catch(e){console.error('quest',e);}
}
function disbandWeakest(p){let best=null,bs=1e9,ba=null;for(const a of armiesOf(p.id))a.units.forEach((u,k)=>{const d=udef(p,u.t);if(d.civ)return;const s=unitStr(p,u);if(s<bs){bs=s;best=k;ba=a;}});
  if(!ba)return null;const nm=udef(p,ba.units[best].t).name;ba.units.splice(best,1);if(!ba.units.length)removeArmy(ba);else ba.mpMax=armyMpMax(ba);return nm;}

function newTurnReset(){
  for(const a of Object.values(G.armies)){const p=a.owner>=0?P(a.owner):null;
    if(a.owner>=0&&siegeAttrition(a)){}
    else if(!a.fought){const c=cityAt(a.idx);const inCity=c&&c.owner===a.owner;const own=a.owner>=0&&ownerOf[a.idx]===a.owner;let heal=inCity?4:own?2:1;
      if(own&&G.reg[a.idx]>=0){const rc=G.cities[G.regions[G.reg[a.idx]].city];if(rc&&rc.buildings.includes('infirmary'))heal+=3;}
      if(p&&hasPerk(p,'ironWill'))heal*=2;
      for(const u of a.units){const d=udef(p,u.t);u.hp=Math.min(d.hp,u.hp+heal+(d.regen||0));}}
    a.fought=false;a.mpMax=armyMpMax(a);a.mp=a.mpMax;}
  lairSpawns();
  for(const p of G.players)if(p.alive)computeVision(p.id);
}

function monstersTurn(){
  for(const a of Object.values(G.armies)){if(a.owner!==-1||!G.armies[a.id])continue;
    let acted=false;
    if(a.rebel!=null&&rebelsAct(a))continue;
    for(const j of NBR[a.idx]){const t=armyAt(j);if(!t||t.owner<0||cityAt(j))continue;if(R()>.45)continue;const pr=predict(a,j,24);if(pr.win>.7){attack(a,j);acted=true;break;}}
    if(acted||!G.armies[a.id])continue;
    if(a.home!=null&&!a.guard&&R()<.3){const opts=NBR[a.idx].filter(j=>moveCost(-1,j)!==Infinity&&!armyAt(j)&&!cityAt(j)&&hexDist(j,a.home)<=3&&ownerOf[j]<0);if(opts.length)placeArmy(a,pickR(opts));}}
}
function lairSpawns(){
  for(const l of G.lairs){if(ownerOf[l]>=0||armyAt(l)||R()>.05)continue;
    let near=false;for(const id in G.armies){const a=G.armies[id];if(a.owner===-1&&hexDist(a.idx,l)<=4){near=true;break;}}if(near)continue;
    const a=spawnMonsters(l,2+(G.turn>60?1:0)+(G.turn>120?1:0));a.home=l;}
}

/* ---------- дипломатия ---------- */
function warTurns(a,b){return G.turn-(G.relSince[relKey(a,b)]||0);}
function declareWar(a,b){const k=relKey(a,b);if(G.rel[k]==='war')return;G.rel[k]='war';G.relSince[k]=G.turn;
  if(b===G.human){msg(`Фракция «${P(a).f.name}» объявила нам войну!`,'bad');if(G._popups)G._popups.push({type:'war',by:a});}
  else if(a===G.human)msg(`Мы объявили войну: ${P(b).f.name}.`,'bad');
  else if(knowsOf(a)||knowsOf(b))msg(`Война: ${P(a).f.name} против ${P(b).f.name}.`,'info');}
function makePeace(a,b){const k=relKey(a,b);if(G.rel[k]!=='war')return;G.rel[k]='peace';G.relSince[k]=G.turn;
  if(a===G.human||b===G.human)msg(`Заключён мир: ${P(a===G.human?b:a).f.name}.`,'good');
  else if(knowsOf(a)||knowsOf(b))msg(`Мир: ${P(a).f.name} и ${P(b).f.name}.`,'info');}
function citiesLostTo(a,b){let n=0;for(const c of citiesOf(b))if(c.origOwner===a)n++;return n;}
function aiAcceptsPeace(ai,other,proposedByOther){const since=warTurns(ai.id,other);if(since<6)return false;
  if(other>=0&&hasPerk(P(other),'diplomats')){const r0=(militaryStrength(ai.id)+5)/(militaryStrength(other)+5);if(r0<1.1||R()<.25)return true;}
  const r=(militaryStrength(ai.id)+5)/(militaryStrength(other)+5);const lost=citiesLostTo(ai.id,other);
  if(r<.8||lost>0&&r<1.2)return true;if(since>28)return R()<.5;return R()<(proposedByOther?.08:.03);}

/* ---------- полный оборот мира после хода игрока ---------- */
function runWorldTurn(opts){opts=opts||{};
  G._reports=G._reports||[];G._popups=G._popups||[];
  for(const p of G.players)if(p.alive&&(!p.human||opts.humanAI)){try{if(p.human){autoResolvePend(p);aiSpendPerks(p);}aiTurn(p);}catch(e){console.error('AI',p.f.name,e);}if(G.over)break;}
  monstersTurn();
  for(const p of G.players)if(p.alive)processPlayer(p);
  G.turn++;
  newTurnReset();
  checkVictory();
}

/* ---------- сохранения ---------- */
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function packBits(u8){let s='';for(let i=0;i<u8.length;i+=6){let v=0;for(let b=0;b<6;b++)if(u8[i+b])v|=1<<b;s+=B64[v];}return s;}
function unpackBits(s,n){const u=new Uint8Array(n);for(let k=0;k<s.length;k++){const v=B64.indexOf(s[k]);for(let b=0;b<6;b++){const i=k*6+b;if(i<n&&(v>>b)&1)u[i]=1;}}return u;}
function serialize(){const o={};for(const k in G){if(k[0]==='_')continue;o[k]=G[k];}
  o.players=G.players.map(p=>{const q={};for(const k in p){if(k[0]==='_')continue;q[k]=p[k];}q.explored=packBits(p.explored);return q;});
  return JSON.stringify(o);}
function deserialize(str){const o=JSON.parse(str);if(!o||o.v!==SAVE_VERSION||!Array.isArray(o.ter))throw new Error('Это не сохранение этой игры');
  initGeometry(o.W,o.H);for(const p of o.players)p.explored=unpackBits(p.explored,N);G=o;MODS.clear();reindex();ensureState();
  for(const p of G.players)if(p.alive)computeVision(p.id);return G;}
