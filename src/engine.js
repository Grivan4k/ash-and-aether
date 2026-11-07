'use strict';
/* =====================================================================
   ДВИЖОК: утилиты, геометрия, генерация мира, правила
   ===================================================================== */

/* ---------- утилиты ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let R = Math.random;
const ri = (a,b)=>a+Math.floor(R()*(b-a+1));
const pickR = arr=>arr[Math.floor(R()*arr.length)];
function shuffle(a, rng){rng=rng||R;for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;}
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const round1=v=>Math.round(v*10)/10;
function plural(n,a,b,c){n=Math.abs(n)%100;const n1=n%10;if(n>10&&n<20)return c;if(n1>1&&n1<5)return b;if(n1===1)return a;return c;}
const clone=o=>JSON.parse(JSON.stringify(o));

class Heap{constructor(){this.k=[];this.v=[];}get size(){return this.k.length;}
  push(v,p){const k=this.k,vs=this.v;let i=k.length;k.push(p);vs.push(v);while(i>0){const pa=(i-1)>>1;if(k[pa]<=p)break;k[i]=k[pa];vs[i]=vs[pa];i=pa;}k[i]=p;vs[i]=v;}
  pop(){const k=this.k,vs=this.v;const top=vs[0];const lp=k.pop(),lv=vs.pop();if(k.length){let i=0;const n=k.length;for(;;){const l=2*i+1,r=l+1;let m=i,mp=lp;if(l<n&&k[l]<mp){m=l;mp=k[l];}if(r<n&&k[r]<mp){m=r;}if(m===i)break;k[i]=k[m];vs[i]=vs[m];i=m;}k[i]=lp;vs[i]=lv;}return top;}}

function valueNoise(salt){
  function rv(ix,iy){let h=Math.imul(ix,374761393)+Math.imul(iy,668265263)+Math.imul(salt,1442695041);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
  return function(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const a=rv(ix,iy),b=rv(ix+1,iy),c=rv(ix,iy+1),d=rv(ix+1,iy+1);return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;};
}
function fbm(n,x,y,oct){let s=0,amp=1,f=1,norm=0;for(let o=0;o<oct;o++){s+=amp*n(x*f,y*f);norm+=amp;amp*=.5;f*=2;}return s/norm;}

/* ---------- геометрия (гексы, смещённые нечётные ряды) ---------- */
let G=null, W=0, H=0, N=0, NBD=null, NBR=null;
let ownerOf=new Int16Array(0), armyIdx=new Map(), cityIdx=new Map();
const MODS=new Map();
const NB_EVEN=[[1,0],[-1,0],[-1,-1],[0,-1],[-1,1],[0,1]]; // В, З, СЗ, СВ, ЮЗ, ЮВ
const NB_ODD =[[1,0],[-1,0],[0,-1],[1,-1],[0,1],[1,1]];

function initGeometry(w,h){
  W=w;H=h;N=w*h;NBD=new Array(N);NBR=new Array(N);
  for(let i=0;i<N;i++){const q=i%W,r=(i/W)|0;const d=(r&1)?NB_ODD:NB_EVEN;const dirs=[],list=[];
    for(const [dq,dr] of d){const nq=q+dq,nr=r+dr;const j=(nq>=0&&nq<W&&nr>=0&&nr<H)?nr*W+nq:-1;dirs.push(j);if(j>=0)list.push(j);}
    NBD[i]=dirs;NBR[i]=list;}
}
function hexDist(a,b){const aq=a%W,ar=(a/W)|0,bq=b%W,br=(b/W)|0;const ax=aq-((ar-(ar&1))>>1),bx=bq-((br-(br&1))>>1);
  const dx=ax-bx,dz=ar-br,dy=-dx-dz;return Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz));}
function inRadius(c,rad){const out=[];const q=c%W,r=(c/W)|0;
  for(let rr=Math.max(0,r-rad);rr<=Math.min(H-1,r+rad);rr++)for(let qq=Math.max(0,q-rad-1);qq<=Math.min(W-1,q+rad+1);qq++){const j=rr*W+qq;if(hexDist(c,j)<=rad)out.push(j);}
  return out;}
const isWater=i=>!!TERRAIN[G.ter[i]].water;
const adjacent=(a,b)=>NBR[a].includes(b);

/* ---------- доступ к состоянию ---------- */
const P=id=>G.players[id];
function human(){return G&&!G.demo?G.players[G.human]:null;}
function cityAt(i){const id=cityIdx.get(i);return id!=null?G.cities[id]:null;}
function armyAt(i){const id=armyIdx.get(i);return id!=null?G.armies[id]:null;}
function citiesOf(pid){const o=[];for(const k in G.cities){const c=G.cities[k];if(c.owner===pid)o.push(c);}return o;}
function armiesOf(pid){const o=[];for(const k in G.armies){const a=G.armies[k];if(a.owner===pid)o.push(a);}return o;}
function relKey(a,b){return a<b?a+'-'+b:b+'-'+a;}
function relation(a,b){if(a===b)return 'self';if(a<0||b<0)return 'war';return G.rel[relKey(a,b)]||'peace';}
function atWar(a,b){return relation(a,b)==='war';}
function warsOf(pid){const o=[];for(const q of G.players)if(q.alive&&q.id!==pid&&atWar(pid,q.id))o.push(q.id);return o;}
const ZERO_MODS={atk:0,def:0,prod:0,growth:0,sci:0,gold:0,mv:0,vis:0,appr:0};
function fmods(p){if(!p)return ZERO_MODS;let m=MODS.get(p.id);if(m)return m;m=Object.assign({},ZERO_MODS);
  for(const t of p.f.traits){const T=TRAITS[t];if(!T)continue;for(const k in m)if(T[k])m[k]+=T[k];}
  if(p.qmods)for(const k in p.qmods)if(k in m)m[k]+=p.qmods[k];
  if(p.perks)for(const id of p.perks){const d=PERKS[id];if(d&&d.mods)for(const k in d.mods)if(k in m)m[k]+=d.mods[k];}MODS.set(p.id,m);return m;}
function techN(p){let n=0;for(const k in p.techs)n++;return n;}
function factionBonuses(p){const list=MECH_TECH[p.f.mech]||[];return list.filter(b=>p.techs[b.tech]);}
function fbonus(p,key){if(!p)return 0;let s=0;for(const b of factionBonuses(p))if(b[key])s+=b[key];return s;}
function fbDesc(p,b){return b.desc.replace('{uu}',p.f.uu.name).replace('{ub}',p.f.ub.name);}
function addEff(d,eff){for(const k in eff)d[k]=(d[k]||0)+eff[k];}
function uuDef(p){const n=techN(p);if(p._uuN===n&&p._uuD)return p._uuD;const d=Object.assign({},p.f.uu);
  for(const b of factionBonuses(p)){if(b.uu)addEff(d,b.uu);if(b.uuCost)d.cost=Math.round(d.cost*(1+b.uuCost));}p._uuN=n;p._uuD=d;return d;}
function udef(p,t){if(t==='uu')return p?uuDef(p):UNITS.militia;return UNITS[t]||HEROES[t]||MONSTERS[t];}
function bdef(p,b){const base=b==='ub'?(p?p.f.ub:null):BUILDINGS[b];if(!base||!p)return base;
  const n=techN(p);if(p._bdN!==n||!p._bd){p._bdN=n;p._bd={};}let d=p._bd[b];if(d)return d;
  d=Object.assign({},base);const ups=[];for(const u of BUILD_UPS)if(u.b===b&&p.techs[u.tech]){addEff(d,u.eff);ups.push({name:u.name,text:effText(u.eff)});}
  if(b==='ub')for(const fb of factionBonuses(p))if(fb.ub){addEff(d,fb.ub);ups.push({name:fb.name,text:effText(fb.ub)});}
  d.ups=ups;p._bd[b]=d;return d;}
function armyCap(p){if(!p)return 4;return 4+(p.techs.warfare?1:0)+(p.techs.tactics?1:0)+perkSum(p,'cap');}
function mkUnit(p,t,vet){const d=udef(p,t);return {t,hp:d.hp,xp:(p&&p.techs&&p.techs.tactics&&!d.civ?3:0)+(d.hero?7:0)+(t==='uu'&&p?fbonus(p,'uuXp'):0),vet:vet?1:0};}
function armyMpMax(a){if(!a.units.length)return 0;const p=a.owner>=0?P(a.owner):null;const m=fmods(p);let mv=99;
  for(const u of a.units)mv=Math.min(mv,udef(p,u.t).mv+m.mv);return mv;}
function hasSettler(a){return a.units.some(u=>u.t==='settler');}
function isMilitaryUnit(p,u){const d=udef(p,u.t);return !d.civ&&!d.scout&&d.atk>0;}
function unitXp(u){return (u.xp||0)+(u.vet?3:0);}
function maxLevel(p){return p&&p.techs&&p.techs.runes?4:3;}
function unitLevel(u,p){const x=unitXp(u);let l=0;for(let k=1;k<XP_LEVELS.length;k++)if(x>=XP_LEVELS[k])l=k;return Math.min(l,maxLevel(p));}
function xpMul(p){return p?1+(p.techs.warfare?.5:0):1;}

/* ---------- сообщения ---------- */
function msg(text,kind,idx,pid){
  if(!G||G.demo)return;
  if(pid!==undefined&&pid!==null&&pid!==G.human)return;
  G.log.push({t:G.turn,text,kind:kind||'',idx:idx==null?-1:idx});
  if(G.log.length>220)G.log.splice(0,G.log.length-220);
  if(typeof onLog==='function')onLog();
}
function knowsOf(pid){const h=human();return h&&(pid===h.id||h.met[pid]);}
function pname(pid){return pid<0?'Чудовища':P(pid).f.name;}

/* ---------- генерация мира ---------- */
function regionName(rng,used){for(let k=0;k<40;k++){let s=RN_A[Math.floor(rng()*RN_A.length)]+RN_B[Math.floor(rng()*RN_B.length)]+RN_C[Math.floor(rng()*RN_C.length)];
  s=s.replace(/(.)\1\1/g,'$1$1');if(!used.has(s)){used.add(s);return s;}}return 'Земля '+used.size;}

function baseYield(i){const T=TERRAIN[G.ter[i]];let f=T.f,p=T.p,g=T.g,s=T.s;const r=G.res[i];if(r){const Rr=RES[r];f+=Rr.f||0;p+=Rr.p||0;g+=Rr.g||0;s+=Rr.s||0;}return {f,p,g,s};}
function siteScore(i){
  const ter=G.ter[i];if(TERRAIN[ter].water||ter==='mount')return -1;const rg=G.reg[i];if(rg<0)return -1;
  let sc=0;for(const j of inRadius(i,2)){if(G.reg[j]!==rg)continue;if(G.ter[j]==='ocean')continue;const y=baseYield(j);sc+=y.f*1.3+y.p*1.1+y.g*.6+y.s*.8;if(G.res[j])sc+=1;}
  if(ter==='hills')sc+=2;if(ter==='plains'||ter==='grass')sc+=1;if(NBR[i].some(j=>TERRAIN[G.ter[j]].water))sc+=1;
  if(NBR[i].length<6)sc-=4;return sc;
}

function genWorld(seed,size){
  const rng=mulberry32((seed^0x9e3779b9)>>>0);
  const [w,h]=MAP_SIZES[size].dims;initGeometry(w,h);
  const nE=valueNoise(seed*3+1|0),nM=valueNoise(seed*3+2|0),nT=valueNoise(seed*3+3|0),nR=valueNoise(seed*7+5|0);
  const elev=new Float32Array(N),moist=new Float32Array(N),temp=new Float32Array(N),ridge=new Float32Array(N);
  const ox=rng()*1000,oy=rng()*1000;
  for(let i=0;i<N;i++){const q=i%W,r=(i/W)|0;const x=q+.5*(r&1),y=r*.866;
    let e=fbm(nE,(x+ox)/13,(y+oy)/13,5);
    const nx=x/W*2-1,ny=y/(H*.866)*2-1;const d=Math.max(Math.abs(nx),Math.abs(ny)*1.1);
    e-=Math.pow(Math.max(0,d-.5)/.5,2)*.5;
    if(q===0||q===W-1||r===0||r===H-1)e=-1;
    elev[i]=e;moist[i]=fbm(nM,(x+ox)/9,(y+oy)/9,4);
    const lat=Math.abs(y/(H*.866)-.5)*2;temp[i]=1-lat*1.05+(fbm(nT,(x+ox)/10,(y+oy)/10,3)-.5)*.45;
    ridge[i]=1-Math.abs(2*fbm(nR,(x+ox)/6,(y+oy)/6,3)-1);}
  const sorted=Array.from(elev).sort((a,b)=>a-b);const thr=sorted[Math.floor(N*(1-.47))];
  const ter=new Array(N).fill('ocean');const land=[];
  for(let i=0;i<N;i++)if(elev[i]>=thr)land.push(i);
  // горы и холмы
  const ms=land.map(i=>({i,s:(elev[i]-thr)*1.4+ridge[i]*.35})).sort((a,b)=>b.s-a.s);
  const nMount=Math.floor(land.length*.07),nHill=Math.floor(land.length*.13);
  const relief={};ms.forEach((o,k)=>{if(k<nMount)relief[o.i]='mount';else if(k<nMount+nHill)relief[o.i]='hills';});
  // влажность — по рангу среди суши
  const mo=land.map(i=>moist[i]).sort((a,b)=>a-b);const mq=f=>mo[Math.floor(clamp(f,0,.999)*mo.length)];
  const mForest=mq(.68),mGrass=mq(.42),mDry=mq(.35),mSwamp=mq(.93);
  for(const i of land){
    if(relief[i]){ter[i]=relief[i];continue;}
    const t=temp[i],m=moist[i];
    if(t<.14)ter[i]='tundra';
    else if(m>=mSwamp&&t>.35&&elev[i]-thr<.06)ter[i]='swamp';
    else if(m>=mForest)ter[i]=t<.25?'tundra':'forest';
    else if(t>.70&&m<mDry)ter[i]='desert';
    else if(m>=mGrass)ter[i]='grass';
    else ter[i]=t>.78?'desert':'plains';
  }
  G={demo:true,W,H,ter,res:new Array(N).fill(null),reg:null,gly:null,regions:[]};
  for(let i=0;i<N;i++)if(ter[i]==='ocean'&&NBR[i].some(j=>!TERRAIN[ter[j]].water))ter[i]='coast';
  // ресурсы
  const res=G.res;
  for(let i=0;i<N;i++){const t=ter[i];const pr=t==='coast'?.06:t==='ocean'?0:.085;if(rng()>=pr)continue;
    const opts=Object.keys(RES).filter(k=>RES[k].on.includes(t));if(!opts.length)continue;
    let tot=0;for(const k of opts)tot+=RES[k].w;let x=rng()*tot;for(const k of opts){x-=RES[k].w;if(x<=0){res[i]=k;break;}}}
  // символы клеток
  const gly=new Array(N);
  for(let i=0;i<N;i++){const T=TERRAIN[ter[i]];const g1=T.gl[Math.floor(rng()*T.gl.length)];const g2=rng()<T.dn?T.gl[Math.floor(rng()*T.gl.length)]:' ';gly[i]=g1+g2;}
  G.gly=gly;
  // регионы
  const reg=new Int16Array(N).fill(-1);const landT=[];for(let i=0;i<N;i++)if(!TERRAIN[ter[i]].water)landT.push(i);
  const REG_SIZE=22;const seeds=[];const order=shuffle(landT.slice(),rng);const md=4;
  for(const i of order){if(seeds.length>=Math.round(landT.length/REG_SIZE)*1.15)break;if(seeds.every(s=>hexDist(s,i)>=md))seeds.push(i);}
  const fr=[];seeds.forEach((s,k)=>{reg[s]=k;fr.push(s);});
  while(fr.length){const k=Math.floor(rng()*fr.length);const u=fr[k];const nb=NBR[u];const st=Math.floor(rng()*nb.length);let any=false;
    for(let t=0;t<nb.length;t++){const v=nb[(st+t)%nb.length];if(reg[v]<0&&!TERRAIN[ter[v]].water){reg[v]=reg[u];fr.push(v);any=true;break;}}
    if(!any){fr[k]=fr[fr.length-1];fr.pop();}}
  let nextR=seeds.length;
  for(const i of landT){if(reg[i]>=0)continue;const id=nextR++;const q=[i];reg[i]=id;while(q.length){const u=q.pop();for(const v of NBR[u])if(reg[v]<0&&!TERRAIN[ter[v]].water){reg[v]=id;q.push(v);}}}
  // слить крошечные регионы с соседями
  for(let pass=0;pass<2;pass++){const cnt=new Map();for(const i of landT)cnt.set(reg[i],(cnt.get(reg[i])||0)+1);
    for(const [rid,n] of cnt){if(n>=6)continue;const votes=new Map();for(const i of landT)if(reg[i]===rid)for(const j of NBR[i])if(reg[j]>=0&&reg[j]!==rid&&!TERRAIN[ter[j]].water)votes.set(reg[j],(votes.get(reg[j])||0)+1);
      let best=-1,bv=0;for(const [r2,v] of votes)if(v>bv){bv=v;best=r2;}if(best>=0)for(const i of landT)if(reg[i]===rid)reg[i]=best;}}
  // прибрежная вода принадлежит соседнему региону
  for(let i=0;i<N;i++){if(ter[i]!=='coast')continue;const votes=new Map();for(const j of NBR[i])if(reg[j]>=0&&!TERRAIN[ter[j]].water)votes.set(reg[j],(votes.get(reg[j])||0)+1);
    let best=-1,bv=0;for(const [r2,v] of votes)if(v>bv){bv=v;best=r2;}reg[i]=best;}
  // перенумеровать
  const remap=new Map();const regions=[];const used=new Set();
  for(let i=0;i<N;i++){const r=reg[i];if(r<0)continue;if(!remap.has(r)){remap.set(r,regions.length);regions.push({id:regions.length,name:'',tiles:[],land:0,city:null,site:-1,score:0});}
    const nr=remap.get(r);reg[i]=nr;regions[nr].tiles.push(i);if(!TERRAIN[ter[i]].water)regions[nr].land++;}
  G.reg=Array.from(reg);G.regions=regions;
  for(const rg of regions){rg.name=regionName(rng,used);let best=-1,bs=-1e9;for(const i of rg.tiles){const s=siteScore(i);if(s>bs){bs=s;best=i;}}rg.site=best;rg.score=bs+rg.land*.1;}
  return G;
}

function landComponents(){const comp=new Int32Array(N).fill(-1);const sizes=[];
  for(let i=0;i<N;i++){if(comp[i]>=0||isWater(i))continue;const id=sizes.length;let n=0;const q=[i];comp[i]=id;while(q.length){const u=q.pop();n++;for(const v of NBR[u])if(comp[v]<0&&!isWater(v)){comp[v]=id;q.push(v);}}sizes.push(n);}
  return {comp,sizes};}

function pickStarts(n,rng){
  const {comp,sizes}=landComponents();const main=sizes.indexOf(Math.max(...sizes));
  let minLand=14,cands=[];
  while(minLand>=4){cands=G.regions.filter(r=>r.land>=minLand&&r.site>=0);if(cands.length>=n*2)break;minLand-=3;}
  // все стартуют на материке: сначала главный, иначе — крупные земли
  const onMain=cands.filter(r=>comp[r.site]===main);
  if(onMain.length>=Math.ceil(n*1.6))cands=onMain;
  else{const cnt=new Map();for(const r of cands)cnt.set(comp[r.site],(cnt.get(comp[r.site])||0)+1);const big=cands.filter(r=>cnt.get(comp[r.site])>=3);if(big.length>=n)cands=big;}
  let best=null,bestQ=-1e9;
  for(let t=0;t<80;t++){const pool=shuffle(cands.slice(),rng);const sel=[pool[0]];
    while(sel.length<n){let bc=null,bd=-1e9;for(const c of pool){if(sel.includes(c))continue;const d=Math.min(...sel.map(s=>hexDist(s.site,c.site)));
        const sc=Math.min(d,20)*(0.85+rng()*.3)+c.score*.25+(comp[c.site]===main?8:0);if(sc>bd){bd=sc;bc=c;}}if(!bc)break;sel.push(bc);}
    if(sel.length<n)continue;let md=1e9;for(let a=0;a<sel.length;a++)for(let b=a+1;b<sel.length;b++)md=Math.min(md,hexDist(sel[a].site,sel[b].site));
    const q=Math.min(md,16)*2+Math.min(...sel.map(c=>c.score))*.6+sel.reduce((s,c)=>s+(comp[c.site]===main?2:0),0);if(q>bestQ){bestQ=q;best=sel;}}
  return best;
}

/* ---------- новая игра ---------- */
function createGame(opt){
  const seed=opt.seed>>>0;const rng=mulberry32(seed+77);
  genWorld(seed,opt.size);const world=G;
  G={v:SAVE_VERSION,seed,size:opt.size,diff:opt.diff,turn:1,W,H,ter:world.ter,res:world.res,reg:world.reg,gly:world.gly,regions:world.regions,
     players:[],cities:{},armies:{},ruins:{},lairs:[],rel:{},relSince:{},nextId:1,log:[],human:0,over:null,vic:Object.assign({conquest:true,science:true},opt.vic||{}),qsites:{}};
  MODS.clear();reindex();
  const n=clamp(opt.players|0,2,6);
  const others=shuffle((opt.pool||PRESETS).filter(f=>f.id!==opt.faction.id),rng).slice(0,n-1);
  const facs=[clone(opt.faction),...others.map(clone)];
  const usedC=new Set(),usedS=new Set();
  for(const f of facs){if(usedC.has(f.color))f.color=ED_COLORS.find(c=>!usedC.has(c))||f.color;usedC.add(f.color);
    if(usedS.has(f.symbol))f.symbol=ED_SYMBOLS.find(s=>!usedS.has(s))||f.symbol;usedS.add(f.symbol);}
  const starts=pickStarts(n,rng);
  facs.forEach((f,k)=>{
    G.players.push({id:k,f,human:k===0,alive:true,gold:k===0?30:30+opt.diff*15,sciPool:0,research:null,techs:{},explored:new Uint8Array(N),met:{},
      stats:{kills:0,losses:0,founded:0,captured:0},nameIdx:0,ai:{}});
  });
  ensureState();
  G.players.forEach((p,k)=>{
    const rg=starts[k];const site=rg.site;
    const c=foundCityAt(p,site,true);
    const near=NBR[site].filter(j=>!isWater(j)&&G.ter[j]!=='mount'&&!armyAt(j));
    newArmy(p.id,site,[mkUnit(p,'militia'),mkUnit(p,'militia')]);
    if(near.length)newArmy(p.id,near[0],[mkUnit(p,'scout')]);
    if(!p.human&&opt.diff>=2&&near.length>1)newArmy(p.id,near[1],[mkUnit(p,'militia'),mkUnit(p,p.f.uu.tech?'militia':'uu')]);
    c.pop=1;
  });
  // руины и логова
  const startTiles=starts.map(s=>s.site);const landT=[];for(let i=0;i<N;i++)if(!isWater(i)&&G.ter[i]!=='mount')landT.push(i);
  const farFromStarts=(i,d)=>startTiles.every(s=>hexDist(s,i)>=d);
  const lairN=Math.round(landT.length/150)+n;let placed=0;
  for(const i of shuffle(landT.slice(),rng)){if(placed>=lairN)break;if(!farFromStarts(i,6)||cityAt(i)||armyAt(i)||G.lairs.some(l=>hexDist(l,i)<6))continue;
    G.lairs.push(i);spawnMonsters(i,2+(rng()<.35?1:0),rng);placed++;}
  const ruinN=Math.round(landT.length/60);placed=0;
  for(const i of shuffle(landT.slice(),rng)){if(placed>=ruinN)break;if(!farFromStarts(i,3)||cityAt(i)||armyAt(i)||G.lairs.includes(i)||G.ruins[i])continue;
    G.ruins[i]=1;if(rng()<.3&&farFromStarts(i,5))spawnMonsters(i,1+(rng()<.4?1:0),rng);placed++;}
  for(const p of G.players)computeVision(p.id);
  for(const a of Object.values(G.armies)){a.mpMax=armyMpMax(a);a.mp=a.mpMax;}
  const h=human();msg(`Ход 1. Столица ${citiesOf(h.id)[0].name} основана. Разведайте земли и займите новые регионы.`,'good',citiesOf(h.id)[0].idx);
  return G;
}

function spawnMonsters(i,count,rng,kinds){rng=rng||R;const t=G.ter[i];kinds=kinds||MONSTER_BY_TER[t]||['bandits'];const units=[];
  for(let k=0;k<count;k++){const mk=kinds[Math.floor(rng()*kinds.length)];units.push({t:mk,hp:MONSTERS[mk].hp,xp:0,vet:0});}
  const a=newArmy(-1,i,units);a.home=i;return a;}

function reindex(){
  ownerOf=new Int16Array(N).fill(-1);
  for(const rg of G.regions)if(rg.city!=null){const c=G.cities[rg.city];if(c)for(const i of rg.tiles)ownerOf[i]=c.owner;}
  armyIdx=new Map();for(const id in G.armies)armyIdx.set(G.armies[id].idx,+id);
  cityIdx=new Map();for(const id in G.cities)cityIdx.set(G.cities[id].idx,+id);
}
function setRegionOwner(rid){G._ov=(G._ov||0)+1;const rg=G.regions[rid];const o=rg.city!=null?G.cities[rg.city].owner:-1;for(const i of rg.tiles)ownerOf[i]=o;}

/* ---------- армии ---------- */
function newArmy(owner,idx,units){const id=G.nextId++;const a={id,owner,idx,units,mp:0,mpMax:0,path:null,fort:false,sleep:false,auto:null,fought:false,ai:{}};
  G.armies[id]=a;armyIdx.set(idx,id);a.mpMax=armyMpMax(a);a.mp=a.mpMax;return a;}
function removeArmy(a){delete G.armies[a.id];if(armyIdx.get(a.idx)===a.id)armyIdx.delete(a.idx);}
function placeArmy(a,j){if(armyIdx.get(a.idx)===a.id)armyIdx.delete(a.idx);a.idx=j;armyIdx.set(j,a.id);}

function moveCost(owner,j){const ter=G.ter[j],T=TERRAIN[ter];
  if(owner<0){if(T.water||ter==='mount')return Infinity;return T.move;}
  const p=P(owner),mech=p.f.mech;
  if(T.water){if(mech==='tide')return 1;if(p.techs.sailing)return 2;return Infinity;}
  if(ter==='mount')return mech==='mountain'?2:Infinity;
  if(ter==='forest'&&mech==='forest')return 1;
  return T.move;}
function tileBlocked(owner,j){const a=armyAt(j);if(a&&a.owner!==owner)return true;const c=cityAt(j);if(c&&c.owner!==owner)return true;return false;}

function findPath(owner,from,to,opt){opt=opt||{};
  if(from===to)return [];if(to<0||moveCost(owner,to)===Infinity)return null;
  if(tileBlocked(owner,to)){const da=armyAt(to),dc=cityAt(to);const o=da&&da.owner!==owner?da.owner:dc.owner;if(!opt.attack||!atWar(owner,o))return null;}
  const g=new Float32Array(N).fill(Infinity),came=new Int32Array(N).fill(-1),closed=new Uint8Array(N);const hp=new Heap();
  g[from]=0;hp.push(from,hexDist(from,to));let exp=0;const lim=opt.limit||Infinity;
  while(hp.size){const u=hp.pop();if(u===to)break;if(closed[u])continue;closed[u]=1;if(++exp>7000)break;
    for(const v of NBR[u]){if(closed[v])continue;const c=moveCost(owner,v);if(c===Infinity)continue;if(v!==to&&tileBlocked(owner,v))continue;if(opt.avoid&&v!==to&&opt.avoid(v))continue;
      const ng=g[u]+c;if(ng<g[v]&&ng<=lim){g[v]=ng;came[v]=u;hp.push(v,ng+hexDist(v,to));}}}
  if(came[to]<0)return null;const path=[];let x=to;while(x!==from){path.push(x);x=came[x];}path.reverse();return path;}

/* клетки, куда армия дойдёт в этот ход */
function reachable(a){const out=new Uint8Array(N);if(a.mp<=0)return out;const d=new Float32Array(N).fill(Infinity);const hp=new Heap();d[a.idx]=0;hp.push(a.idx,0);
  while(hp.size){const u=hp.pop();const du=d[u];if(du>=a.mp)continue;
    for(const v of NBR[u]){const c=moveCost(a.owner,v);if(c===Infinity)continue;if(tileBlocked(a.owner,v))continue;const nd=du+c;
      if(nd<d[v]){d[v]=nd;out[v]=1;if(nd<a.mp&&!armyAt(v))hp.push(v,nd);}}}
  out[a.idx]=0;return out;}
function pathTurns(a,path){let mp=a.mp,turns=0;if(mp<=0){turns=1;mp=a.mpMax;}const marks=[];
  for(const j of path){if(mp<=0){turns++;mp=a.mpMax;}mp-=moveCost(a.owner,j);marks.push(turns);}return marks;}

function stepArmy(a){let moved=false;
  while(a.path&&a.path.length&&a.mp>0){const j=a.path[0];const cost=moveCost(a.owner,j);if(cost===Infinity){a.path=null;break;}
    const oa=armyAt(j),oc=cityAt(j);
    if((oa&&oa.owner!==a.owner)||(oc&&oc.owner!==a.owner))break;
    if(oa&&oa.owner===a.owner){
      if(a.path.length===1){if(mergeInto(a,oa)){return {moved:true,merged:oa};}a.path=null;break;}
      const k=a.path[1];const ck=moveCost(a.owner,k);
      if(a.mp-cost>0&&ck!==Infinity&&!armyAt(k)&&!(cityAt(k)&&cityAt(k).owner!==a.owner)){a.mp=Math.max(0,a.mp-cost-ck);placeArmy(a,k);a.path.splice(0,2);moved=true;a.fort=false;onEnterTile(a,k);if(!G.armies[a.id])return {moved};continue;}
      break;}
    a.mp=Math.max(0,a.mp-cost);placeArmy(a,j);a.path.shift();moved=true;a.fort=false;onEnterTile(a,j);if(!G.armies[a.id])return {moved};}
  if(a.path&&!a.path.length)a.path=null;return {moved};}

function mergeInto(a,b){const cap=armyCap(a.owner>=0?P(a.owner):null);
  while(a.units.length&&b.units.length<cap)b.units.push(a.units.shift());
  b.mpMax=armyMpMax(b);b.mp=Math.min(b.mp,a.mp);b.fort=false;
  if(!a.units.length){removeArmy(a);return true;}a.mpMax=armyMpMax(a);return false;}
function freeNeighbor(owner,i){for(const j of shuffle(NBR[i].slice()))if(moveCost(owner,j)!==Infinity&&!armyAt(j)&&!(cityAt(j)&&cityAt(j).owner!==owner))return j;return -1;}
function splitUnit(a,k){if(a.units.length<2)return null;const j=freeNeighbor(a.owner,a.idx);if(j<0)return null;
  const u=a.units.splice(k,1)[0];const b=newArmy(a.owner,j,[u]);b.mp=Math.min(a.mp,b.mpMax);a.mpMax=armyMpMax(a);a.mp=Math.min(a.mp,a.mpMax);return b;}

function onEnterTile(a,j){if(a.owner<0)return;const p=P(a.owner);
  if(G.ruins[j]){delete G.ruins[j];const roll=R();let text;
    const mul=hasPerk(p,'monsterHunters')?2:1;
    if(roll<.3){const g=ri(25,60)*mul;p.gold+=g;text=`тайник с монетами, +${g} золота`;}
    else if(roll<.55){const s=ri(12,30)*mul;p.sciPool+=s;text=`древние свитки, +${s} науки`;}
    else if(roll<.72){reveal(p,j,7);text='карта окрестностей';}
    else if(roll<.88&&a.units.length<armyCap(p)){const t=p.techs.archery?'archer':'militia';a.units.push(mkUnit(p,t));a.mpMax=armyMpMax(a);text=`к армии присоединились ${udef(p,t).name}`;}
    else{for(const u of a.units)u.xp=(u.xp||0)+3;text='испытания древних, отряды набрались опыта';}
    p.stats.ruins=(p.stats.ruins||0)+1;msg(`Руины: ${text}.`,'good',j,a.owner);}
  const li=G.lairs.indexOf(j);
  if(li>=0){G.lairs.splice(li,1);const g=ri(30,55);p.gold+=g;p.stats.lairs=(p.stats.lairs||0)+1;msg(`Логово чудовищ разорено: +${g} золота.`,'good',j,a.owner);}
  if(G.qsites&&G.qsites[j])onQuestSite(a,j);
}
function reveal(p,c,rad){for(const j of inRadius(c,rad))p.explored[j]=1;}

/* ---------- обзор ---------- */
function computeVision(pid){const p=P(pid);const vis=new Uint8Array(N);const m=fmods(p);
  for(const c of citiesOf(pid)){for(const j of G.regions[c.region].tiles)vis[j]=1;for(const j of inRadius(c.idx,2+m.vis))vis[j]=1;}
  for(const a of armiesOf(pid)){let r=2+m.vis;if(a.units.some(u=>udef(p,u.t).scout))r++;r+=TERRAIN[G.ter[a.idx]].vis||0;for(const j of inRadius(a.idx,r))vis[j]=1;}
  for(let i=0;i<N;i++)if(vis[i]){p.explored[i]=1;const o=ownerOf[i];if(o>=0&&o!==pid&&!p.met[o])meet(pid,o);const a=armyAt(i);if(a&&a.owner>=0&&a.owner!==pid&&!p.met[a.owner])meet(pid,a.owner);}
  p._vis=vis;return vis;}
function meet(a,b){P(a).met[b]=true;P(b).met[a]=true;
  for(const [x,y] of [[a,b],[b,a]])for(const c of Object.values(G.cities))if(c.origCap===y&&c.owner===y)reveal(P(x),c.idx,1);if(a===G.human||b===G.human){const o=a===G.human?b:a;msg(`Встреча: ${P(o).f.name}. Отношения: мир.`,'info',citiesOf(o)[0]?citiesOf(o)[0].idx:-1);}}

/* ---------- города ---------- */
function workable(i,p){const t=G.ter[i];if(t==='ocean')return false;if(t==='mount'&&p.f.mech!=='mountain')return false;return true;}
function tileYield(i,p){const y=baseYield(i);const t=G.ter[i],m=p.f.mech;
  if(m==='forest'&&t==='forest'){y.f+=1;y.s+=.5;}
  if(m==='mountain'){if(t==='mount'){y.p+=2;y.s+=fbonus(p,'mtnSci');y.g+=fbonus(p,'mtnGold');}if(t==='hills')y.p+=1;}
  if(m==='tide'&&TERRAIN[t].water){y.f+=1;y.g+=1;y.s+=fbonus(p,'waterSci');}
  return y;}
function growNeed(pop){return 10+6*pop;}
function hasWalls(c){const p=P(c.owner);return c.buildings.some(b=>{const B=bdef(p,b);return B&&B.walls;});}
function cityMaxHp(c){const p=P(c.owner);return Math.round((20+1.5*c.pop+(hasWalls(c)?25:0)+(p.techs.engineering?15:0))*(1+perkSum(p,'cityHp')));}
function aiMul(p){return p.human?1:DIFFS[G.diff].mul;}

function cityCalc(c){const p=P(c.owner);const m=fmods(p);const undead=p.f.mech==='undead';
  const rg=G.regions[c.region];const w=FOCUS[c.focus||'bal'].w.slice();if(undead)w[0]=w[1]*.5;
  const cand=[];for(const i of rg.tiles){if(i===c.idx||!workable(i,p))continue;const y=tileYield(i,p);cand.push({i,y,s:y.f*w[0]+y.p*w[1]+y.g*w[2]+y.s*w[3]});}
  const cy=tileYield(c.idx,p);let f=Math.max(2,cy.f)+1,pr=Math.max(2,cy.p)+1,g=cy.g+2,s=cy.s+2;
  if(c.capital){pr+=2;g+=2;s+=1;}
  // выбор клеток: следим, чтобы город не голодал
  const foc=c.focus||'bal';const worked=[];const pool=cand.slice();let fsum=f;const needF=undead?0:c.pop*2+(foc==='bal'||foc==='food'?2:0);
  for(let k=0;k<c.pop&&pool.length;k++){const left=c.pop-k;const avg=(needF-fsum)/left;const fw=avg>1.4?3.5:avg>.6?2:avg>0&&foc==='bal'?.8:0;
    let bi=0,bv=-1e9;for(let t=0;t<pool.length;t++){const v=pool[t].s+pool[t].y.f*fw;if(v>bv){bv=v;bi=t;}}
    const x=pool.splice(bi,1)[0];worked.push(x);fsum+=x.y.f;}
  for(const x of worked){f+=x.y.f;pr+=x.y.p;g+=x.y.g;s+=x.y.s;}
  s+=c.pop*(.45+perkSum(p,'sciPop'));
  let pp=m.prod,gp=m.gold,sp=m.sci,growthP=m.growth,growthFlat=0;
  for(const b of c.buildings){const B=bdef(p,b);if(!B)continue;f+=B.f||0;pr+=B.p||0;g+=B.g||0;s+=B.s||0;pp+=B.pp||0;gp+=B.gp||0;sp+=B.sp||0;growthP+=B.growthP||0;growthFlat+=B.growthFlat||0;}
  if(undead)pr+=f*.5;
  const am=aiMul(p);const ap=cityApproval(c,p,pr*(1+pp));const S=APPROVAL_STATES[ap.st];
  pr*=(1+pp)*am*S.mul;g*=(1+gp)*am*S.mul;s*=(1+sp)*am*S.mul;
  const eat=undead?0:c.pop*2;let net=undead?2:f-eat;net+=growthFlat;if(net>0)net*=(1+growthP)*am*S.grow;
  if(isBesieged(c))return {food:0,eat,net:undead?0:-eat,prod:0,gold:0,sci:0,worked:worked.map(x=>x.i),ap,siege:siegeTurns(c),rawProd:Math.max(1,Math.round(pr))};
  return {food:Math.round(f),eat,net:round1(net),prod:Math.max(1,Math.round(pr)),gold:Math.round(g),sci:round1(s),worked:worked.map(x=>x.i),ap};}

function itemCost(p,it){if(it.k==='fest')return 0;if(it.k==='unit'){const c=udef(p,it.id).cost;return it.id==='settler'&&hasPerk(p,'colonial')?Math.round(c*.6):c;}
  if(it.k==='proj')return Math.round(PROJECTS[it.id].cost*(hasPerk(p,'aetherKeepers')?.8:1));return bdef(p,it.id).cost;}
function itemName(p,it){if(it.k==='fest')return 'Празднества';return it.k==='unit'?udef(p,it.id).name:it.k==='proj'?PROJECTS[it.id].name:bdef(p,it.id).name;}
function availProjects(p,c){if(!G.vic||!G.vic.science||!p.techs.aethertheory)return [];const st=(p.gate?p.gate.stage:0)+1;if(st>3)return [];
  if(p.gate&&p.gate.city!=null&&p.gate.city!==c.id&&G.cities[p.gate.city]&&G.cities[p.gate.city].owner===p.id)return [];
  if(citiesOf(p.id).some(x=>x.queue.some(q=>q.k==='proj')))return [];return ['gate'+st];}
function availUnits(p){const o=[];for(const k in UNITS){const u=UNITS[k];if(u.tech&&!p.techs[u.tech])continue;o.push(k);}if(!p.f.uu.tech||p.techs[p.f.uu.tech])o.push('uu');return o;}
function availBuildings(p,c){const o=[];for(const k in BUILDINGS){const b=BUILDINGS[k];if(b.tech&&!p.techs[b.tech])continue;if(c.buildings.includes(k))continue;if(c.queue.some(q=>q.k==='bld'&&q.id===k))continue;o.push(k);}
  if((!p.f.ub.tech||p.techs[p.f.ub.tech])&&!c.buildings.includes('ub')&&!c.queue.some(q=>q.id==='ub'))o.push('ub');return o;}
function buyCost(p,c){const it=c.queue[0];if(!it)return 0;const rem=Math.max(0,itemCost(p,it)-c.prog);return Math.ceil(rem*(p.f.mech==='coin'?1.5:2)+8);}
function canBuy(p,c){const it=c.queue[0];if(!it||it.k==='proj'||it.k==='fest')return false;if(it.id==='settler'&&c.pop<2)return false;return p.gold>=buyCost(p,c);}
function buyItem(p,c){if(!canBuy(p,c))return false;p.gold-=buyCost(p,c);c.prog=itemCost(p,c.queue[0]);c.bought=true;return true;}

function nextCityName(p){const list=p.f.cities||[];const used=new Set(Object.values(G.cities).map(c=>c.name));
  for(let k=0;k<list.length;k++){const nm=list[(p.nameIdx+k)%list.length];if(!used.has(nm)){p.nameIdx=(p.nameIdx+k+1)%list.length;return nm;}}
  const SUF=['град','бург','хольм','мор','дол','гард','ск','вель','полье','брод'];
  for(let t=0;t<60;t++){const nm=RN_A[Math.floor(R()*RN_A.length)]+RN_B[Math.floor(R()*RN_B.length)]+SUF[Math.floor(R()*SUF.length)];if(!used.has(nm))return nm;}
  let k=2;for(;;){const nm=(list[0]||'Город')+' '+k;if(!used.has(nm))return nm;k++;}}

function foundCityAt(p,i,capital){const rid=G.reg[i];const rg=G.regions[rid];const id=G.nextId++;
  const c={id,name:nextCityName(p),owner:p.id,idx:i,region:rid,pop:1,food:0,prog:0,queue:[],buildings:[],hp:0,focus:'bal',capital:!!capital,founded:G.turn,origOwner:p.id,hitTurn:-9,origCap:capital&&G.turn===1?p.id:null};
  if(!capital&&hasPerk(p,'colonial'))c.pop=2;
  G.cities[id]=c;cityIdx.set(i,id);rg.city=id;setRegionOwner(rid);c.hp=cityMaxHp(c);p.stats.founded++;
  // логова в регионе исчезают
  for(const l of G.lairs.slice())if(G.reg[l]===rid&&!armyAt(l))G.lairs.splice(G.lairs.indexOf(l),1);
  if(G.ruins[i])delete G.ruins[i];
  return c;}
function canFoundHere(p,i){if(isWater(i)||G.ter[i]==='mount')return 'Нельзя основать город на воде или в горах';const rid=G.reg[i];if(rid<0)return 'Здесь нет региона';
  if(G.regions[rid].city!=null)return 'В регионе уже есть город';if(cityAt(i))return 'Здесь уже город';return null;}
function foundCity(a){const p=P(a.owner);if(!hasSettler(a))return null;if(canFoundHere(p,a.idx))return null;
  const k=a.units.findIndex(u=>u.t==='settler');a.units.splice(k,1);
  const c=foundCityAt(p,a.idx,citiesOf(p.id).length===0);
  if(!a.units.length)removeArmy(a);else a.mpMax=armyMpMax(a);
  msg(`Основан город ${c.name} в регионе ${G.regions[c.region].name}.`,'good',c.idx,p.id);
  if(!p.human&&knowsOf(p.id))msg(`Новый город: ${c.name} (${p.f.name}).`,'info',c.idx);
  return c;}

/* Гильдия Монет: выкуп региона */
function regionBuyCost(p){return Math.round((60+30*citiesOf(p.id).length)*(1+fbonus(p,'buyRegion')));}
function regionBuyable(p,rid){if(p.f.mech!=='coin')return false;const rg=G.regions[rid];if(!rg||rg.city!=null||rg.site<0)return false;
  if(armyAt(rg.site)&&armyAt(rg.site).owner!==p.id)return false;
  return rg.tiles.some(i=>NBR[i].some(j=>ownerOf[j]===p.id));}
function buyRegion(p,rid){if(!regionBuyable(p,rid))return null;const cost=regionBuyCost(p);if(p.gold<cost)return null;p.gold-=cost;
  const c=foundCityAt(p,G.regions[rid].site,false);p.stats.bought=(p.stats.bought||0)+1;msg(`Регион ${G.regions[rid].name} выкуплен. Основан город ${c.name}.`,'good',c.idx,p.id);return c;}

/* ---------- технологии ---------- */
function eraCount(p,e){let n=0;for(const t in p.techs)if(TECHS[t].era===e)n++;return n;}
function eraOpen(p,e){return e===0||eraCount(p,e-1)>=ERA_REQS[e];}
function tcost(p,k){return Math.round(ERAS[TECHS[k].era].cost*(1+.12*Object.keys(p.techs).length)*(TECHS[k].final?2.5:1)*(1-perkSum(p,'techCheap')));}
function finalOpen(p){return eraCount(p,3)-(p.techs.aethertheory?1:0)>=FINAL_REQ;}
function availTechs(p){return Object.keys(TECHS).filter(k=>!p.techs[k]&&eraOpen(p,TECHS[k].era)&&(!TECHS[k].final||finalOpen(p)));}
function techUnlocks(p,k){const o=[];for(const u in UNITS)if(UNITS[u].tech===k)o.push(UNITS[u].name);if(p.f.uu.tech===k)o.push(p.f.uu.name+' (уник.)');
  for(const b in BUILDINGS)if(BUILDINGS[b].tech===k)o.push(BUILDINGS[b].name);if(p.f.ub.tech===k)o.push(p.f.ub.name+' (уник.)');if(TECHS[k].effect&&!(TECHS[k].final&&G.vic&&!G.vic.science))o.push(TECHS[k].effect);
  for(const u of BUILD_UPS)if(u.tech===k)o.push(`${BUILDINGS[u.b].name}: ${effText(u.eff)}`);
  for(const b of (MECH_TECH[p.f.mech]||[]))if(b.tech===k)o.push(`★ ${b.name}: ${fbDesc(p,b)}`);return o;}

/* ---------- сила ---------- */
function unitStr(p,u){const d=udef(p,u.t);if(d.civ||d.atk===0)return 0;return (d.atk+d.def)*(u.hp/d.hp)*(1+.1*unitLevel(u,p));}
function armyStrength(a){const p=a.owner>=0?P(a.owner):null;let s=0;for(const u of a.units)s+=unitStr(p,u);return s;}
function militaryStrength(pid){let s=0;for(const a of armiesOf(pid))s+=armyStrength(a);return s;}
function armyHpFrac(a){const p=a.owner>=0?P(a.owner):null;let h=0,m=0;for(const u of a.units){h+=u.hp;m+=udef(p,u.t).hp;}return m?h/m:1;}
