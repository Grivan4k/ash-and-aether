// Загружает настоящий движок игры (те же файлы, что собираются в страницу) и боты-стратегии для слота игрока.
const fs=require('fs'),vm=require('vm'),path=require('path');
const SRC=path.join(__dirname,'..','src');
function loadEngine(){
  let code=['data','engine','combat','turn','quests','perks','approval','siege','ai'].map(f=>fs.readFileSync(path.join(SRC,f+'.js'),'utf8').replace(/'use strict';/,'')).join('\n');
  // крючки только для бота «wide»: игнорировать одобрение при расселении
  const p1="(avgAp>=55||cities.length<4)",p2="const targetCities=Math.round(4+A.exp*5+sz);";
  if(!code.includes(p1)||!code.includes(p2))throw new Error('patch anchors missing');
  code=code.replace(p1,"(avgAp>=55||cities.length<4||p._wide)").replace(p2,"const targetCities=Math.round(4+A.exp*5+sz+(p._wide?6:0));");
  const errors=[];
  const ctx={console:{log(){},warn(){},error:(...a)=>{if(errors.length<50)errors.push(a.map(x=>x&&x.stack?x.stack.split('\n').slice(0,2).join(' | '):String(x)).join(' ').slice(0,300));}},
    Math,JSON,Map,Set,Uint8Array,Int16Array,Int32Array,Float32Array,Array,Object,Number,String,Error,Infinity,Date};
  vm.createContext(ctx);vm.runInContext(code,ctx);vm.runInContext(HARNESS,ctx);ctx.__ERR=errors;return ctx;}

const HARNESS=String.raw`
var LOG=null;
function wrap(name,after){const orig=globalThis[name];globalThis[name]=function(...a){const r=orig.apply(this,a);try{if(LOG)after(a,r);}catch(e){}return r;};}
wrap('declareWar',([a,b])=>{LOG.wars.push({t:G.turn,a:P(a).f.id,b:P(b).f.id,onHuman:b===G.human,byHuman:a===G.human});});
wrap('makePeace',([a,b])=>{LOG.peace.push({t:G.turn,a:P(a).f.id,b:P(b).f.id,human:a===G.human||b===G.human});});
const _cap=captureCity;captureCity=function(c,no){const old=c.owner;const r=_cap(c,no);if(LOG){LOG.captures.push({t:G.turn,from:P(old).f.id,to:P(no).f.id,fromHuman:old===G.human,byHuman:no===G.human});
  if(old===G.human&&LOG.firstHumanLoss==null)LOG.firstHumanLoss=G.turn;}return r;};
wrap('eliminate',([pid,by])=>{LOG.elims.push({t:G.turn,who:P(pid).f.id,by:by!=null&&by>=0?P(by).f.id:null,human:pid===G.human});});
wrap('spawnRebels',([p])=>{if(p.human)LOG.rebH++;else LOG.rebAI++;});
wrap('completeGateStage',([p,c,st])=>{LOG.gate.push({t:G.turn,who:p.f.id,st,human:p.human});});
wrap('takePerk',([p,id],ok)=>{if(ok&&p.human)LOG.hPerks.push(id);});

const PERS={sci:{agg:.15,exp:.6,sci:1,build:.8},war:{agg:1,exp:.5,sci:.3,build:.45},wide:{agg:.4,exp:1,sci:.4,build:.6},turtle:{agg:0,exp:.35,sci:.6,build:1}};
const _aiDip=aiDiplomacy;
aiDiplomacy=function(p){if(!p.human)return _aiDip(p);const S=p._strat;
  if(S==='ai')return _aiDip(p);
  if(S==='war'){if(G.turn>=20&&!warsOf(p.id).length){let best=null,bd=1e9;
      for(const q of G.players){if(!q.alive||q.id===p.id||!p.met[q.id])continue;let d=1e9;for(const a of citiesOf(p.id))for(const b of citiesOf(q.id))d=Math.min(d,hexDist(a.idx,b.idx));if(d<bd){bd=d;best=q;}}
      if(best)declareWar(p.id,best.id);}return;}
  for(const o of warsOf(p.id))if(warTurns(p.id,o)>=6&&aiAcceptsPeace(P(o),p.id,true))makePeace(p.id,o);};

function stateOf(p){const cs=citiesOf(p.id);return {alive:p.alive,cities:cs.length,pop:cs.reduce((s,c)=>s+c.pop,0),techs:Object.keys(p.techs).length,
  gate:p.gate?p.gate.stage:0,units:countUnits(p.id,d=>!d.civ&&!d.scout),gold:p.gold,str:Math.round(militaryStrength(p.id)),
  ap:cs.length?Math.round(avgApproval(p)):0,unrest:cs.filter(c=>c.apSt>=3).length,chain:p.quests&&p.quests.chain?(p.quests.chain.state==='done'?4:p.quests.chain.i):0,perks:(p.perks||[]).length,wars:warsOf(p.id).length};}

globalThis.__runGame=function(cfg){
  const t0=Date.now();
  const fac=PRESETS.find(f=>f.id===cfg.faction);
  createGame({seed:cfg.seed,size:cfg.size,players:cfg.players,diff:cfg.diff,faction:fac,vic:cfg.vic});
  const h=human();const S=cfg.strategy;h._strat=S;if(PERS[S])h.f.ai=Object.assign({},PERS[S]);if(S==='wide')h._wide=true;
  LOG={wars:[],peace:[],captures:[],elims:[],rebH:0,rebAI:0,gate:[],hPerks:[],firstHumanLoss:null,series:[]};
  let maxCities=1,unrestTurns=0;
  for(let k=0;k<cfg.maxTurns&&!G.over;k++){
    G._reports=[];G._popups=[];
    for(const p of G.players){if(!p.alive)continue;
      try{if(p.human){if(S!=='idle'){autoResolvePend(p);aiSpendPerks(p);aiTurn(p);}}else aiTurn(p);}catch(e){console.error('turn',e);}
      if(G.over)break;}
    for(const pp of G._popups)if(pp.type==='peace'&&h.alive&&atWar(h.id,pp.by)){
      if(S==='sci'||S==='turtle'||S==='wide'||(S==='ai'&&aiAcceptsPeace(h,pp.by,true)))makePeace(h.id,pp.by);}
    monstersTurn();for(const p of G.players)if(p.alive)processPlayer(p);G.turn++;newTurnReset();checkVictory();
    if(h.alive){const n=citiesOf(h.id).length;maxCities=Math.max(maxCities,n);if(citiesOf(h.id).some(c=>c.apSt>=3))unrestTurns++;}
    if(G.turn%25===0)LOG.series.push({t:G.turn,h:stateOf(h),ai:G.players.filter(p=>!p.human).map(p=>({f:p.f.id,...stateOf(p)}))});
  }
  const res=G.over?{win:G.over.win,type:G.over.type||'conquest',by:G.over.by!=null&&G.over.by>=0?P(G.over.by).f.id:null,turn:G.over.turn}:{timeout:true,turn:G.turn};
  if(G.over&&!G.over.win&&!h.alive)res.type='eliminated';
  return {cfg,res,ms:Date.now()-t0,turns:G.turn,human:{...stateOf(h),maxCities,unrestTurns,perkList:LOG.hPerks},
    ais:G.players.filter(p=>!p.human).map(p=>({f:p.f.id,...stateOf(p),captured:p.stats.captured,kills:p.stats.kills})),log:LOG};
};`;
module.exports={loadEngine};
