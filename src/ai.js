'use strict';
/* =====================================================================
   ИИ соперников
   ===================================================================== */

function aiTurn(p){
  computeVision(p.id);
  if(!p.research)p.research=aiPickTech(p);
  aiDiplomacy(p);
  if(p.f.mech==='coin'&&avgApproval(p)>=55)aiBuyRegion(p);
  aiMoveArmies(p);
  aiProduction(p);
}

function aiPickTech(p){const av=availTechs(p);if(!av.length)return null;const A=p.f.ai;let best=null,bs=-1e9;
  for(const t of av){let s=R()*1.2;if(MIL_TECHS.has(t))s+=A.agg*1.2;else s+=(A.build+A.sci)*.6;
    if(t==='writing'||t==='alchemy')s+=A.sci;if(t==='agri'||t==='crafts')s+=.5;if(p.f.uu.tech===t)s+=1.4;if(p.f.ub.tech===t)s+=.8;
    if(t==='sailing')s+=p.f.mech==='tide'?-2:(p.ai.noSites?1.6:-.4);
    if(warsOf(p.id).length&&MIL_TECHS.has(t))s+=.8;s-=TECHS[t].era*.15;
    if(TECHS[t].era===3)s+=A.sci*.8+.4;if(TECHS[t].final)s+=G.vic&&G.vic.science?2+A.sci*2:-3;
    if(s>bs){bs=s;best=t;}}
  return best;}

function aiDiplomacy(p){
  const majors=G.players.filter(q=>q.alive&&q.id!==p.id&&p.met[q.id]);
  const myStr=militaryStrength(p.id)+5;const wars=warsOf(p.id);
  for(const q of majors){const rel=relation(p.id,q.id);const theirStr=militaryStrength(q.id)+5;
    if(rel==='peace'){
      if(G.turn<14||warTurns(p.id,q.id)<12&&G.relSince[relKey(p.id,q.id)])continue;
      let near=1e9;for(const a of citiesOf(p.id))for(const b of citiesOf(q.id))near=Math.min(near,hexDist(a.idx,b.idx));
      const gs=(q.gate?q.gate.stage:0)+(q.gate&&q.gate.building?.5:0);const gateFear=(q.techs.aethertheory&&G.vic.science?.15:0)+(gs?(.3*gs+(gs>=1.5?.3:0)):0);const dipl=hasPerk(q,'diplomats')?.35:0;
      const desire=gateFear-dipl+p.f.ai.agg*DIFFS[G.diff].agg*.9+(myStr/theirStr-1)*.5+R()*.25-wars.length*.5-(near>16?.5:0)-(near>24?1:0)-(G.turn<30?.25:0)+Math.max(0,(G.turn-70)/250);
      if(desire>.78){declareWar(p.id,q.id);wars.push(q.id);}
    }else if(rel==='war'){
      if(aiAcceptsPeace(p,q.id,false)){
        if(q.human){if(G._popups&&!G._popups.some(x=>x.type==='peace'&&x.by===p.id))G._popups.push({type:'peace',by:p.id});}
        else if(aiAcceptsPeace(q,p.id,true))makePeace(p.id,q.id);}
    }}
}

function aiBuyRegion(p){const cost=regionBuyCost(p);if(p.gold<cost+25)return;let best=null,bs=-1e9;
  for(const rg of G.regions){if(!regionBuyable(p,rg.id))continue;const s=rg.score+R()*3;if(s>bs){bs=s;best=rg;}}
  if(best)buyRegion(p,best.id);}

/* ---------- производство ---------- */
function threatNear(pid,idx,r){let s=0;for(const k in G.armies){const a=G.armies[k];if(a.owner<0||a.owner===pid||!atWar(pid,a.owner))continue;if(hexDist(a.idx,idx)<=r)s+=armyStrength(a);}return s;}
function defenseNear(pid,idx,r){let s=0;for(const a of armiesOf(pid))if(hexDist(a.idx,idx)<=r)s+=armyStrength(a);const c=cityAt(idx);if(c&&c.owner===pid)s+=cityFighter(c).def*1.2;return s;}
function countUnits(pid,pred){let n=0;const p=P(pid);for(const a of armiesOf(pid))for(const u of a.units)if(pred(udef(p,u.t),u))n++;return n;}

function aiBestUnit(p,role){const av=availUnits(p).filter(k=>{const d=udef(p,k);return !d.civ&&!d.scout;});let best=null,bs=-1e9;const war=warsOf(p.id).length>0;
  for(const k of av){const d=udef(p,k);let s=(d.atk+d.def)*d.hp/d.cost;
    if(role==='def')s*=1+d.def/(d.atk+d.def);if(role==='ranged')s*=d.ranged?1.6:.8;if(role==='melee')s*=d.ranged?.6:1.1;
    if(d.siege)s*=war&&role!=='def'?1.3:.3;if(k==='uu')s*=1.25;s*=.85+R()*.3;
    if(s>bs){bs=s;best=k;}}
  return best?{k:'unit',id:best}:null;}

function aiBestBuilding(p,c){const av=availBuildings(p,c);if(!av.length)return null;const y=cityCalc(c);const A=p.f.ai;let best=null,bs=0;
  for(const k of av){const B=bdef(p,k);let v=(B.f||0)*1.1+(B.p||0)*1.4+(B.g||0)*.9+(B.s||0)*(.8+A.sci*.6);
    v+=(B.pp||0)*y.prod*1.4+(B.gp||0)*y.gold*.9+(B.sp||0)*y.sci*(.8+A.sci*.6)+(B.growthP||0)*Math.max(0,y.net)*1.5+(B.growthFlat||0)*1.2;
    if(B.appr){const need=Math.max(0,72-y.ap.v);v+=B.appr*need/10+(y.ap.st>=3?6:0);}if(B.adminHalf)v+=Math.max(0,citiesOf(p.id).length-4)*1.2;
    if(B.walls)v+=threatNear(p.id,c.idx,8)>0?6:(c.capital?2.2:1.2);if(B.vet)v+=A.agg*2.4;if(k==='ub')v+=2;
    const s=v/B.cost*40*(.85+R()*.3);if(s>bs){bs=s;best=k;}}
  return best&&bs>.5?{k:'bld',id:best}:null;}

function aiProduction(p){
  const cities=citiesOf(p.id);if(!cities.length)return;const wars=warsOf(p.id);const A=p.f.ai;
  const mil=countUnits(p.id,d=>!d.civ&&!d.scout);
  let settlers=countUnits(p.id,d=>d.settler)+cities.filter(c=>c.queue.some(q=>q.id==='settler')).length;
  const scouts=countUnits(p.id,d=>d.scout)+cities.filter(c=>c.queue.some(q=>q.id==='scout')).length;
  const free=G.regions.filter(r=>r.city==null&&r.site>=0&&cities.some(c=>hexDist(c.idx,r.site)<=14)).length;
  const sz={small:-1,medium:0,large:2}[G.size]||0;const targetCities=Math.round(4+A.exp*5+sz);
  const inc=empireIncome(p);
  const capUnits=Math.round(cities.length*(wars.length?4.5:3)+5+A.agg*3);
  let desired=Math.min(capUnits,Math.round(2+cities.length*1.5+(wars.length?cities.length*1.4:0)+G.turn/30+A.agg*2));
  if(inc.gold<0&&p.gold<40)desired=Math.min(desired,mil);
  let milQueued=cities.reduce((s,c)=>s+c.queue.filter(q=>q.k==='unit'&&q.id!=='settler'&&q.id!=='scout').length,0);
  // Врата Эфира: лучший город ставит проект первым
  if(p.techs.aethertheory&&G.vic&&G.vic.science&&p.gate.stage<3&&!cities.some(c=>c.queue.some(q=>q.k==='proj'))){
    let gc=p.gate.city!=null&&G.cities[p.gate.city]&&G.cities[p.gate.city].owner===p.id?G.cities[p.gate.city]:null;
    if(!gc)gc=cities.slice().sort((a,b)=>cityCalc(b).prod-cityCalc(a).prod)[0];
    const pr=availProjects(p,gc);if(pr.length){gc.queue.unshift({k:'proj',id:pr[0]});gc.prog=0;}}
  // одобрение: празднества при бунте, отмена при порядке
  const avgAp=cities.reduce((s,c)=>s+cityCalc(c).ap.v,0)/cities.length;
  for(const c of cities){const y=cityCalc(c);if(c.queue[0]&&c.queue[0].k==='fest'){if(y.ap.st<=2)c.queue.shift();continue;}
    if(y.ap.st>=4){const b=aiBestBuilding(p,c);if(b&&bdef(p,b.id).appr&&!c.queue.some(q=>q.id===b.id)){c.queue.unshift(b);c.prog=Math.floor(c.prog*.5);}else c.queue.unshift({k:'fest',id:'fest'});}}
  for(const c of cities.sort((a,b)=>b.pop-a.pop)){
    if(c.queue.length)continue;
    const threat=threatNear(p.id,c.idx,6),local=defenseNear(p.id,c.idx,3);let it=null;
    if(threat>0&&threat>local*.7)it=aiBestUnit(p,R()<.4?'ranged':'def');
    else if(!scouts&&c.capital&&R()<.5&&(G.turn<35||(G.turn%12===0&&qstat(p,'explore')<75)))it={k:'unit',id:'scout'};
    else if(settlers<(A.exp>.6?2:1)&&cities.length+settlers<targetCities&&c.pop>=2&&free>0&&!(wars.length&&threat>0)&&(avgAp>=55||cities.length<4)){it={k:'unit',id:'settler'};settlers++;}
    else if(mil+milQueued<desired&&R()<.85){it=aiBestUnit(p,R()<.33?'ranged':'melee');milQueued++;}
    else it=aiBestBuilding(p,c)||(mil+milQueued<capUnits?aiBestUnit(p,R()<.33?'ranged':'melee'):null);
    if(it)c.queue.push(it);}
  if(p.gold>250&&mil<capUnits){for(const c of cities){if(c.queue.length)continue;const it=aiBestUnit(p,R()<.33?'ranged':'melee');if(it){c.queue.push(it);}}}
  if(p.gold>110){const rich=p.gold>300;for(const c of cities){if(!c.queue[0])continue;const t=threatNear(p.id,c.idx,6);const cost=buyCost(p,c);
    if(cost<=p.gold-60&&(t>0||rich||R()<.25)&&canBuy(p,c)){buyItem(p,c);}}}
}

/* ---------- армии ---------- */
function armyKind(a){const p=a.owner>=0?P(a.owner):null;if(hasSettler(a))return 'settler';if(a.units.every(u=>udef(p,u.t).scout))return 'scout';return 'mil';}
function monsterNear(j,r){for(const k in G.armies){const a=G.armies[k];if(a.owner===-1&&hexDist(a.idx,j)<=r)return true;}return false;}
function nearestOwnCity(p,idx){let best=null,bd=1e9;for(const c of citiesOf(p.id)){const d=hexDist(c.idx,idx);if(d<bd){bd=d;best=c;}}return best;}

function aiMoveArmies(p){
  const ids=Object.keys(G.armies).map(Number).filter(id=>G.armies[id].owner===p.id);
  const wars=warsOf(p.id);
  const enemyCities=Object.values(G.cities).filter(c=>wars.includes(c.owner)&&(p.explored[c.idx]||c.origCap!=null));
  const gateCity=c=>{const o=P(c.owner);return o.gate&&o.gate.city===c.id&&(o.gate.stage>0||o.gate.building);};
  const claimed=new Set();for(const id of ids){const a=G.armies[id];if(a.ai&&a.ai.target!=null&&hasSettler(a))claimed.add(G.reg[a.ai.target]);}
  // сначала поселенцы и разведчики, потом армии
  ids.sort((x,y)=>{const o={settler:0,scout:1,mil:2};return o[armyKind(G.armies[x])]-o[armyKind(G.armies[y])];});
  for(const id of ids){const a=G.armies[id];if(!a||a.mp<=0)continue;a.ai=a.ai||{};
    try{const kind=armyKind(a);
      if(kind==='settler')aiSettler(p,a,claimed);else if(kind==='scout')aiScout(p,a);else aiMilitary(p,a,wars,enemyCities,gateCity);}
    catch(e){console.error('AI army',e);}}
}

function siteFree(p,t){const rid=G.reg[t];if(rid<0||G.regions[rid].city!=null)return false;const o=armyAt(t);if(o&&o.owner!==p.id)return false;return !canFoundHere(p,t);}
function aiFindSite(p,a,claimed){const cand=[];
  for(const rg of G.regions){if(rg.city!=null||rg.site<0||claimed.has(rg.id))continue;if(!p.explored[rg.site]&&hexDist(rg.site,a.idx)>6)continue;
    const d=hexDist(a.idx,rg.site);if(d>18)continue;if(monsterNear(rg.site,1))continue;
    let s=rg.score-d*1.4;if(p.f.mech==='tide')s+=rg.tiles.filter(i=>isWater(i)).length*.15;
    if(p.f.mech==='mountain')s+=rg.tiles.filter(i=>G.ter[i]==='mount'||G.ter[i]==='hills').length*.3;
    if(p.f.mech==='forest')s+=rg.tiles.filter(i=>G.ter[i]==='forest').length*.3;
    cand.push({rg,s});}
  cand.sort((x,y)=>y.s-x.s);
  for(const c of cand.slice(0,4)){const path=findPath(p.id,a.idx,c.rg.site,{avoid:j=>monsterNear(j,1)});if(path)return c.rg.site;}
  return null;}
function aiSettler(p,a,claimed){
  if(!canFoundHere(p,a.idx)){const rg=G.regions[G.reg[a.idx]];if(a.idx===a.ai.target||siteScore(a.idx)>=rg.score*.85){foundCity(a);return;}}
  let t=a.ai.target;
  if(t==null||!siteFree(p,t)){t=aiFindSite(p,a,claimed);a.ai.target=t;if(t!=null)claimed.add(G.reg[t]);}
  if(t==null){a.ai.idle=(a.ai.idle||0)+1;p.ai.noSites=true;
    if(a.ai.idle>6){const c=nearestOwnCity(p,a.idx);if(c){c.pop++;}removeArmy(a);}return;}
  p.ai.noSites=false;
  const path=findPath(p.id,a.idx,t,{avoid:j=>monsterNear(j,1)})||findPath(p.id,a.idx,t);if(!path){a.ai.target=null;return;}
  a.path=path;stepArmy(a);
  if(G.armies[a.id]&&a.idx===t&&!canFoundHere(p,a.idx))foundCity(a);}

function exploreTarget(p,a){const seen=new Uint8Array(N);const q=[a.idx];seen[a.idx]=1;let head=0;
  while(head<q.length&&head<4000){const u=q[head++];
    if(u!==a.idx&&!armyAt(u)&&!cityAt(u)){for(const v of NBR[u])if(!p.explored[v])return u;}
    for(const v of NBR[u]){if(seen[v])continue;seen[v]=1;if(moveCost(p.id,v)===Infinity||tileBlocked(p.id,v))continue;q.push(v);}}
  return null;}
function aiScout(p,a){
  let t=null;for(const k in G.ruins){const i=+k;if(p.explored[i]&&!armyAt(i)&&hexDist(i,a.idx)<=8){t=i;break;}}
  if(t==null)t=exploreTarget(p,a);
  if(t==null){a.ai.idleScout=(a.ai.idleScout||0)+1;if(!p.human&&a.ai.idleScout>6)removeArmy(a);else if(p.human)a.auto=null;return false;}
  a.ai.idleScout=0;
  const path=findPath(p.id,a.idx,t,{avoid:j=>monsterNear(j,1)})||findPath(p.id,a.idx,t);
  if(!path){return false;}a.path=path;stepArmy(a);return true;}

function tryAttackAdjacent(p,a,thr){let best=null,bs=-1;
  for(const j of NBR[a.idx]){const {da,c,owner}=defendersAt(j);if(owner==null||owner===p.id||!atWar(p.id,owner))continue;
    if(owner<0&&!da)continue;const pr=predict(a,j,36);
    let ok=pr.win>=(c?thr.city:owner<0?thr.monster:thr.army);
    if(!ok&&c&&c.owner===owner&&pr.lose<.15&&armyHpFrac(a)>.6)ok=true;
    if(ok){const s=pr.win+(c?.3:0);if(s>bs){bs=s;best=j;}}}
  if(best!=null){attack(a,best);return true;}return false;}

function moveTowardTarget(p,a,target,thr){
  const path=findPath(p.id,a.idx,target,{attack:true});if(!path||!path.length)return false;
  if(tileBlocked(p.id,path[path.length-1]))path.pop();
  a.path=path;stepArmy(a);if(!G.armies[a.id])return true;
  if(a.mp>0&&adjacent(a.idx,target))tryAttackAdjacent(p,a,thr);return true;}

function aiMilitary(p,a,wars,enemyCities,gateCity){
  const thr={city:.45,army:.6,monster:.72};const cap=armyCap(p);
  if(tryAttackAdjacent(p,a,thr))return;
  const here=cityAt(a.idx);
  // гарнизон стоит на месте
  if(here&&here.owner===p.id){a.fort=true;return;}
  // лечение
  if(armyHpFrac(a)<.45){const c=nearestOwnCity(p,a.idx);if(c&&!armyAt(c.idx)){a.path=findPath(p.id,a.idx,c.idx);stepArmy(a);return;}
    if(ownerOf[a.idx]===p.id){a.fort=true;return;}if(c){const path=findPath(p.id,a.idx,c.idx);if(path){path.pop();a.path=path;stepArmy(a);}}return;}
  // пустой город — занять
  const myCities=citiesOf(p.id);
  const empty=myCities.filter(c=>!armyAt(c.idx)).sort((x,y)=>hexDist(x.idx,a.idx)-hexDist(y.idx,a.idx))[0];
  if(empty&&hexDist(empty.idx,a.idx)<=9){const path=findPath(p.id,a.idx,empty.idx);if(path){a.path=path;stepArmy(a);return;}}
  // угроза городу — к нему
  for(const c of myCities){if(threatNear(p.id,c.idx,4)>defenseNear(p.id,c.idx,2)&&hexDist(c.idx,a.idx)<=8){
    const path=findPath(p.id,a.idx,c.idx);if(path){if(armyAt(c.idx))path.pop();a.path=path;stepArmy(a);if(G.armies[a.id]&&a.mp>0)tryAttackAdjacent(p,a,thr);return;}}}
  // объединиться с соседней полевой армией
  if(a.units.length<cap){let best=null,bd=1e9;for(const b of armiesOf(p.id)){if(b===a||b.units.length>=cap||cityAt(b.idx)||armyKind(b)!=='mil')continue;const d=hexDist(a.idx,b.idx);if(d<bd&&d<=5){bd=d;best=b;}}
    if(best&&(a.units.length<=best.units.length)){const path=findPath(p.id,a.idx,best.idx);if(path){a.path=path;stepArmy(a);return;}}}
  // наступление
  if(wars.length&&enemyCities.length&&(a.units.length>=Math.min(cap,3)||armyStrength(a)>30)){
    const key=c=>hexDist(c.idx,a.idx)-(gateCity&&gateCity(c)?14:0)-(c.origCap!=null?6:0);const tgt=enemyCities.slice().sort((x,y)=>key(x)-key(y))[0];
    if(moveTowardTarget(p,a,tgt.idx,thr))return;}
  // враги в поле
  if(wars.length){let best=null,bd=1e9;for(const b of Object.values(G.armies)){if(b.owner<0||!wars.includes(b.owner)||!p._vis||!p._vis[b.idx])continue;const d=hexDist(a.idx,b.idx);if(d<bd&&d<=7){bd=d;best=b;}}
    if(best&&predict(a,best.idx,24).win>.6&&moveTowardTarget(p,a,best.idx,thr))return;}
  // цель квеста
  {const qt=questTarget(p);if(qt>=0&&hexDist(qt,a.idx)<=16&&armyStrength(a)>12){const g=armyAt(qt);
    if(!g||g.owner===p.id||predict(a,qt,24).win>.7){if(g&&g.owner!==p.id){if(moveTowardTarget(p,a,qt,thr))return;}else{const path=findPath(p.id,a.idx,qt);if(path){a.path=path;stepArmy(a);return;}}}}}
  // охота на чудовищ
  {let best=null,bd=1e9;for(const b of Object.values(G.armies)){if(b.owner!==-1||!p.explored[b.idx])continue;const d=hexDist(a.idx,b.idx);if(d<bd&&d<=9){bd=d;best=b;}}
    if(best&&predict(a,best.idx,24).win>.75&&moveTowardTarget(p,a,best.idx,thr))return;}
  a.fort=true;}
