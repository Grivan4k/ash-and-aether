'use strict';
/* =====================================================================
   БОЙ (автобой). Отдельный модуль: позже его заменит тактическая арена.
   Вход: атакующая армия и клетка цели. Выход: отчёт о сражении.
   ===================================================================== */

function fightersOf(a,isDef,tile,inCity){
  const owner=a.owner,p=owner>=0?P(owner):null;const m=fmods(p);
  let atkM=1+m.atk,defM=1+m.def;const mods=[];
  if(p&&p.f.mech==='discipline'&&a.units.length>=armyCap(p)){const db=.2+fbonus(p,'disc');atkM+=db;defM+=db;mods.push(`Дисциплина +${Math.round(db*100)}%`);}
  const T=TERRAIN[G.ter[tile]];
  if(isDef){
    if(T.def){defM+=T.def;mods.push(`${T.name} ${T.def>0?'+':''}${Math.round(T.def*100)}% защ.`);}
    if(p&&p.f.mech==='forest'&&G.ter[tile]==='forest'){defM+=.25;mods.push('Сердце леса +25% защ.');}
    if(a.fort){defM+=.2;mods.push('Укрепление +20% защ.');}
    if(inCity){const b=.15+(hasWalls(inCity)?.10:0);defM+=b;mods.push(`В городе +${Math.round(b*100)}% защ.`);
      const st=inCity.apSt==null?2:inCity.apSt;const pen=AP_UNIT_DEF[st]-Math.min(SIEGE.unitDefMax,siegePower(inCity)*SIEGE.unitDefPerTurn);
      if(pen){defM+=pen;mods.push(`Гарнизон: ${st>=3?APPROVAL_STATES[st].name.toLowerCase()+(siegeTurns(inCity)?', ':''):''}${siegeTurns(inCity)?'голод в осаде':''} −${Math.round(-pen*100)}% защ.`);}}
  }
  if(T.water&&!(p&&p.f.mech==='tide')){defM-=.4;mods.push('На воде −40% защ.');}
  const list=a.units.map(u=>{const d=udef(p,u.t);const lm=1+.1*unitLevel(u,p);
    return {u,side:isDef?1:0,name:d.name,atk:d.atk*atkM*lm,def:Math.max(.5,d.def*defM*lm),hp:u.hp,max:d.hp,
      ranged:!!d.ranged,cav:!!d.cav,anti:!!d.antiCav,siege:!!d.siege,civ:!!d.civ||d.atk===0,city:false};});
  list.mods=mods;return list;}

function cityFighter(c){const p=P(c.owner),m=fmods(p),w=hasWalls(c);const dm=cityDefMul(c);
  return {city:c,side:1,name:w?'Стены':'Частокол',atk:(3+c.pop*.3+(w?3:0))*(1-siegeDefPenalty(c)*.5),def:(4+c.pop*.35+(w?5:0))*(1+m.def+perkSum(p,'cityDef'))*dm,hp:c.hp,max:cityMaxHp(c),ranged:true,cav:false,anti:false,siege:false,civ:false};}

function sideAlive(arr){for(const f of arr)if(f.hp>0)return true;return false;}
function pickTarget(f,foes){
  const live=foes.filter(x=>x.hp>0);if(!live.length)return null;
  const units=live.filter(x=>!x.city&&!x.civ);const city=live.find(x=>x.city);
  if(f.siege&&city&&R()<.75)return city;
  if(units.length){if(!f.ranged){const front=units.filter(x=>!x.ranged);if(front.length&&R()<.7)return pickR(front);}return pickR(units);}
  if(city)return city;return pickR(live);}
function strike(f,t,log,r){
  let a=f.atk*(f.anti&&t.cav?2:1)*(f.siege&&t.city?3:1)*(f.cav&&t.ranged&&!t.city?1.25:1);
  const d=t.def*(t.anti&&f.cav?1.5:1);
  a*=.55+.45*Math.max(0,f.hp)/f.max;
  let dmg=5*Math.pow(a/Math.max(.5,d),.8)*(.8+R()*.4);dmg=Math.max(1,Math.round(dmg));
  t.hp-=dmg;if(t.hp<=0&&!t._dead){t._dead=1;f.kills=(f.kills||0)+1;}
  if(log)log.push({r,a:f.name,as:f.side,t:t.name,ts:t.side,dmg,left:Math.max(0,Math.round(t.hp)),max:t.max,kill:t.hp<=0,rng:f.ranged});}

function battle(A,D,log){
  if(!sideAlive(D))return 'att';if(!sideAlive(A))return 'def';
  for(let r=1;r<=3;r++){
    const sh=shuffle([...A,...D].filter(f=>f.hp>0&&f.ranged&&f.atk>0));
    for(const f of sh){if(f.hp<=0)continue;const t=pickTarget(f,f.side?A:D);if(!t)break;strike(f,t,log,r);}
    if(!sideAlive(A)||!sideAlive(D))break;
    const ml=shuffle([...A,...D].filter(f=>f.hp>0&&!f.ranged&&!f.civ));
    for(const f of ml){if(f.hp<=0)continue;const t=pickTarget(f,f.side?A:D);if(!t)break;strike(f,t,log,r);}
    if(!sideAlive(A)||!sideAlive(D))break;}
  if(!sideAlive(A))return 'def';if(!sideAlive(D))return 'att';return 'draw';}

function defendersAt(ti){const da=armyAt(ti),c=cityAt(ti);const owner=da?da.owner:c?c.owner:null;return {da,c,owner};}
function buildSides(a,ti){const {da,c,owner}=defendersAt(ti);const A=fightersOf(a,false,a.idx,null);
  const D=da?fightersOf(da,true,ti,c&&c.owner===da.owner?c:null):[];const dm=D.mods||[];
  if(c&&c.owner===owner){D.push(cityFighter(c));const sp=siegeDefPenalty(c),st=c.apSt==null?2:c.apSt;
    if(sp)dm.push(`Город в осаде ${siegeTurns(c)} ${plural(siegeTurns(c),'ход','хода','ходов')}: стены −${Math.round(sp*100)}%`);
    if(AP_DEF_MUL[st]!==1)dm.push(`Город: ${APPROVAL_STATES[st].name.toLowerCase()}, стены ${AP_DEF_MUL[st]>1?'+':'−'}${Math.round(Math.abs(AP_DEF_MUL[st]-1)*100)}%`);}
  D.mods=dm;
  if(owner===-1&&a.owner>=0&&hasPerk(P(a.owner),'monsterHunters')){A.forEach(f=>f.atk*=1.5);A.mods.push('Охотники на чудовищ +50% атк.');}
  if(a.owner===-1&&owner>=0&&hasPerk(P(owner),'monsterHunters')){D.forEach(f=>{if(!f.city)f.atk*=1.5;});D.mods.push('Охотники на чудовищ +50% атк.');}
  return {A,D,da,c,owner};}

function hasMelee(a){const p=a.owner>=0?P(a.owner):null;return a.units.some(u=>{const d=udef(p,u.t);return !d.ranged&&!d.civ&&d.atk>0;});}

/* прогноз: многократная симуляция */
function predict(a,ti,n){n=n||60;let w=0,l=0,aL=0,dL=0;const melee=hasMelee(a);
  for(let k=0;k<n;k++){const {A,D}=buildSides(a,ti);const res=battle(A,D,null);
    if(res==='att')w++;else if(res==='def')l++;
    for(const f of A)if(f.hp<=0)aL++;for(const f of D)if(f.hp<=0&&!f.city)dL++;}
  const {c,owner}=defendersAt(ti);
  return {win:w/n,lose:l/n,draw:(n-w-l)/n,aLoss:aL/n,dLoss:dL/n,capture:!!(c&&c.owner===owner&&melee)};}

function attack(a,ti){
  const {A,D,da,c,owner}=buildSides(a,ti);if(owner==null||owner===a.owner||!atWar(a.owner,owner))return null;
  const attOwner=a.owner;
  const before={att:A.map(f=>({name:f.name,hp:Math.round(f.hp),max:f.max})),def:D.map(f=>({name:f.name,hp:Math.round(f.hp),max:f.max,city:f.city?1:0}))};
  const log=[];const w=battle(A,D,log);
  let attLoss=0,defLoss=0;
  for(const f of A){f.u.hp=Math.max(0,Math.round(f.hp));if(f.u.hp<=0)attLoss++;}
  a.units=a.units.filter(u=>u.hp>0);
  if(da){for(const f of D){if(f.city)continue;f.u.hp=Math.max(0,Math.round(f.hp));if(f.u.hp<=0)defLoss++;}da.units=da.units.filter(u=>u.hp>0);}
  if(c&&c.owner===owner){const cf=D.find(f=>f.city);c.hp=Math.max(0,Math.round(cf.hp));c.hitTurn=G.turn;}
  const after={att:A.map(f=>({name:f.name,hp:Math.max(0,Math.round(f.hp)),max:f.max})),def:D.map(f=>({name:f.name,hp:Math.max(0,Math.round(f.hp)),max:f.max,city:f.city?1:0}))};
  const pa=attOwner>=0?P(attOwner):null,pd=owner>=0?P(owner):null;
  const ups={att:grantXp(A,pa,w==='att'),def:grantXp(D,pd,w==='def')};
  const tro={att:{g:0,s:0},def:{g:0,s:0}};
  if(pa&&pd){const vd=fallenValue(D,pd),va=fallenValue(A,pa);
    if(vd){tro.att.g=Math.round(vd*TROPHY.gold);tro.att.s=Math.round(vd*TROPHY.sci);pa.gold+=tro.att.g;pa.sciPool+=tro.att.s;}
    if(va){tro.def.g=Math.round(va*TROPHY.gold);tro.def.s=Math.round(va*TROPHY.sci);pd.gold+=tro.def.g;pd.sciPool+=tro.def.s;}}
  if(defLoss)onKills(attOwner,defLoss,ti);if(attLoss)onKills(owner,attLoss,ti);
  if(attOwner>=0){P(attOwner).stats.kills+=defLoss;P(attOwner).stats.losses+=attLoss;if(owner<0)P(attOwner).stats.mkills=(P(attOwner).stats.mkills||0)+defLoss;}
  if(attOwner<0&&owner>=0)P(owner).stats.mkills=(P(owner).stats.mkills||0)+attLoss;
  if(owner>=0){P(owner).stats.kills+=attLoss;P(owner).stats.losses+=defLoss;}
  a.mp=0;a.fort=false;a.fought=true;a.path=null;if(da){da.fought=true;}
  let outcome=w;let loot=0;let plunder=null;
  const attName=pname(attOwner),defName=pname(owner);
  if(!a.units.length)removeArmy(a);
  if(da&&!da.units.length){removeArmy(da);if(owner<0&&attOwner>=0){loot=ri(8,20)*Math.max(1,defLoss)*(hasPerk(P(attOwner),'monsterHunters')?2:1);P(attOwner).gold+=loot;}}
  if(w==='att'&&a.units.length){
    if(c&&c.owner===owner){if(hasMelee(a)&&attOwner>=0){plunder=captureCity(c,attOwner);if(!armyAt(ti)){placeArmy(a,ti);}outcome='capture';}else outcome='breach';}
    else if(hasMelee(a)&&!armyAt(ti)&&!cityAt(ti)){placeArmy(a,ti);onEnterTile(a,ti);}
  }
  const rep={outcome,attOwner,defOwner:owner,tile:ti,attName,defName,attLoss,defLoss,city:c?c.name:null,before,after,log,loot,ups,tro,plunder,
    modsA:A.mods||[],modsD:D.mods||[],turn:G.turn};
  if(G._reports&&(attOwner===G.human||owner===G.human))G._reports.push(rep);
  return rep;}

function grantXp(list,p,won){const ups=[];for(const f of list){if(f.city||!f.u||f.u.hp<=0)continue;const d=udef(p,f.u.t);if(d.civ)continue;
    const before=unitLevel(f.u,p);const gain=Math.max(1,Math.round((1+(won?1:0)+(f.kills||0))*xpMul(p)));f.u.xp=(f.u.xp||0)+gain;f.xpGain=gain;
    const after=unitLevel(f.u,p);if(after>before){f.u.hp=Math.min(d.hp,f.u.hp+Math.round(d.hp*.3));ups.push({name:f.name,lvl:after,rank:RANKS[after]});}}
  return ups;}
function fallenValue(list,p){let v=0;for(const f of list){if(f.city||!f.u||f.hp>0)continue;const d=udef(p,f.u.t);v+=d.cost||((d.atk+d.def)*2);}return v;}
function trophyEstimate(a,ti){const {D,owner,c}=buildSides(a,ti);if(a.owner<0||owner==null||owner<0)return null;const pd=P(owner);
  let v=0;for(const f of D){if(f.city)continue;const d=udef(pd,f.u.t);v+=d.cost||0;}
  const r={g:Math.round(v*TROPHY.gold),s:Math.round(v*TROPHY.sci)};if(c&&c.owner===owner&&hasMelee(a)){r.pg=Math.round(c.pop*TROPHY.plunderPop+pd.gold*TROPHY.plunderTreasury);r.ps=Math.round(c.pop*TROPHY.plunderSci);}return r;}
function onKills(pid,n,tile){if(pid<0)return;const p=P(pid);
  if(p.f.mech==='undead'){let best=null,bd=1e9;for(const c of citiesOf(pid)){const d=hexDist(c.idx,tile);if(d<bd){bd=d;best=c;}}if(best){best.food+=(6+fbonus(p,'soul'))*n;}}}

function captureCity(c,no){const old=c.owner;const np=P(no);const op0=P(old);
  const pl={g:Math.round(c.pop*TROPHY.plunderPop+op0.gold*TROPHY.plunderTreasury),s:Math.round(c.pop*TROPHY.plunderSci),stolen:Math.floor(op0.gold*TROPHY.plunderTreasury)};
  op0.gold=Math.max(0,op0.gold-pl.stolen);np.gold+=pl.g;np.sciPool+=pl.s;
  const op=P(old);if(op.gate&&op.gate.city===c.id&&(op.gate.stage>0||op.gate.building)){const st=op.gate.stage;op.gate={city:null,stage:0,building:0};
    if(old===G.human)msg(`Врата Эфира потеряны вместе с городом ${c.name} (было этапов: ${st}).`,'bad',c.idx);else if(no===G.human)msg(`Мы разрушили Врата Эфира в городе ${c.name}!`,'good',c.idx);else msg(`Врата Эфира в городе ${c.name} разрушены захватчиками.`,'info',c.idx);}
  c.owner=no;if(!hasPerk(np,'warlord'))c.pop=Math.max(1,c.pop-1);c.queue=[];c.prog=0;c.food=0;c.buildings=c.buildings.filter(b=>b!=='ub');
  c.capturedTurn=G.turn;c.apSt=null;const wasCap=c.capital;c.capital=false;c.hp=Math.round(cityMaxHp(c)*.25);
  setRegionOwner(c.region);np.stats.captured++;
  if(no===G.human)msg(`Город ${c.name} захвачен! Добыча: +${pl.g} золота, +${pl.s} науки.`,'good',c.idx);
  if(old===G.human&&pl.stolen)msg(`Захватчики вывезли из казны ${pl.stolen} золота.`,'bad',c.idx);
  else if(old===G.human)msg(`Наш город ${c.name} захвачен. Захватчик: ${np.f.name}.`,'bad',c.idx);
  else if(knowsOf(no)||knowsOf(old))msg(`Город ${c.name} (${P(old).f.name}) захвачен. Захватчик: ${np.f.name}.`,'info',c.idx);
  const rest=citiesOf(old);
  if(!rest.length)eliminate(old,no);
  else if(wasCap||!rest.some(x=>x.capital)){rest.sort((x,y)=>y.pop-x.pop);rest[0].capital=true;}
  if(!citiesOf(no).some(x=>x.capital))c.capital=true;
  checkVictory();return pl;}

function eliminate(pid,by){const p=P(pid);if(!p.alive)return;p.alive=false;
  for(const a of armiesOf(pid))removeArmy(a);
  if(pid===G.human)msg('Наша последняя крепость пала.','bad');
  else if(knowsOf(pid)||by===G.human)msg(`Фракция «${p.f.name}» уничтожена${by!=null&&by>=0?'. Победитель: '+P(by).f.name:''}.`,by===G.human?'good':'info');}

function capitalsHeld(pid){const caps=Object.values(G.cities).filter(c=>c.origCap!=null);return {held:caps.filter(c=>c.owner===pid).length,total:caps.length};}
function checkVictory(){if(G.over)return;const h=human();if(!h.alive){G.over={win:false,turn:G.turn};return;}
  const alive=G.players.filter(p=>p.alive);if(G.vic&&!G.vic.conquest)return;
  if(alive.length===1){G.over={win:alive[0].id===h.id,type:'conquest',by:alive[0].id,turn:G.turn};return;}
  const caps=Object.values(G.cities).filter(c=>c.origCap!=null);if(caps.length>=2){const o=caps[0].owner;if(caps.every(c=>c.owner===o))G.over={win:o===h.id,type:'conquest',by:o,turn:G.turn};}}
