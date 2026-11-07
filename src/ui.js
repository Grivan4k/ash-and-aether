'use strict';
/* =====================================================================
   ИНТЕРФЕЙС: рендер ASCII-карты, ввод, панели, окна, меню
   ===================================================================== */
const $=id=>document.getElementById(id);
const FONT_STACK='"PT Mono","DejaVu Sans Mono","Cascadia Mono",Consolas,"Liberation Mono",monospace';
const MON_COLOR='#ff5d7a';
const UI={sel:null,pending:-1,pendPath:null,hover:-1,hoverPath:null,reach:null,busy:false,blink:true,popq:[],mobile:false,attack:null,gameStr:null,crt:true};
const VIEW={fs:16,cw:9.6,ch:20,x:0,y:0,w:0,h:0,dpr:1};
let cv,ctx,gcv,gctx,mcv,mctx,miniBase=null,VIS=new Uint8Array(0),needDraw=true,miniDirty=true,PC=[];
let DL=null;

const AP_COL=['var(--good)','var(--good)','var(--amber)','var(--warn)','var(--bad)'];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sgn=n=>(n>=0?'+':'')+n;
function hexRgb(h){const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255];}
function bar(cur,max,len,col){len=len||10;const f=max>0?clamp(cur/max,0,1):0;const n=Math.round(f*len);
  return `<span class="bar"><span style="color:${col||(f>.5?'var(--good)':f>.25?'var(--warn)':'var(--bad)')}">${'█'.repeat(n)}</span><span style="color:#3a2e1d">${'░'.repeat(len-n)}</span></span>`;}
function turnsWord(n){return plural(n,'ход','хода','ходов');}
function toast(t){const el=$('toast');el.textContent=t;el.style.opacity=1;clearTimeout(toast._t);toast._t=setTimeout(()=>el.style.opacity=0,2600);}
function onLog(){if(G&&!G.demo)UI.logDirty=true;}

function buildColors(){PC=G.players.map(p=>{const [r,g,b]=hexRgb(p.f.color);
  return {c:p.f.color,tint:`rgba(${r},${g},${b},.16)`,tintD:`rgba(${r},${g},${b},.07)`,line:`rgba(${r},${g},${b},.95)`,lineD:`rgba(${r},${g},${b},.42)`,bgD:`rgba(${r},${g},${b},.5)`};});}

/* ---------- рендер карты ---------- */
function fontStr(fs,bold){return (bold?'bold ':'')+fs+'px '+FONT_STACK;}
function measure(){ctx.font=fontStr(VIEW.fs);const m=ctx.measureText('MMMMMMMMMM').width/10;VIEW.cw=Math.max(3,m);VIEW.ch=Math.round(VIEW.fs*1.2);}
function req(){needDraw=true;}
function tilePos(i){const q=i%W,r=(i/W)|0;return {x:(q*2+((r&1)?1:0))*VIEW.cw-VIEW.x,y:r*VIEW.ch-VIEW.y};}
function screenToTile(px,py){const mx=px+VIEW.x,my=py+VIEW.y;const r=Math.floor(my/VIEW.ch);if(r<0||r>=H)return -1;const off=(r&1)?VIEW.cw:0;
  const q=Math.floor((mx-off)/(VIEW.cw*2));if(q<0||q>=W)return -1;return r*W+q;}
function clampCam(){if(!G)return;const mw=(2*W+1)*VIEW.cw,mh=H*VIEW.ch;
  VIEW.x=mw<VIEW.w?(mw-VIEW.w)/2:clamp(VIEW.x,-VIEW.w*.3,mw-VIEW.w*.7);VIEW.y=mh<VIEW.h?(mh-VIEW.h)/2:clamp(VIEW.y,-VIEW.h*.3,mh-VIEW.h*.7);}
function centerOn(i){if(i<0)return;const q=i%W,r=(i/W)|0;VIEW.x=(q*2+((r&1)?1:0)+1)*VIEW.cw-VIEW.w/2;VIEW.y=(r+.5)*VIEW.ch-VIEW.h/2;clampCam();req();}
function setZoom(fs,px,py){fs=clamp(Math.round(fs),8,32);if(fs===VIEW.fs)return;if(px==null){px=VIEW.w/2;py=VIEW.h/2;}
  const mx=(px+VIEW.x)/VIEW.cw,my=(py+VIEW.y)/VIEW.ch;VIEW.fs=fs;measure();VIEW.x=mx*VIEW.cw-px;VIEW.y=my*VIEW.ch-py;clampCam();req();}
function resize(){const r=$('mapwrap').getBoundingClientRect();if(!r.width)return;VIEW.w=r.width;VIEW.h=r.height;VIEW.dpr=Math.min(2,window.devicePixelRatio||1);
  for(const c of [cv,gcv]){c.width=Math.round(r.width*VIEW.dpr);c.height=Math.round(r.height*VIEW.dpr);}
  UI.mobile=matchMedia('(max-width:860px)').matches;measure();clampCam();layoutMini();
  if(G&&!G.demo&&UI.sel){const si=selIdx();if(si>=0){const t=tilePos(si);if(t.y<VIEW.ch||t.y>VIEW.h-VIEW.ch*2||t.x<0||t.x>VIEW.w-VIEW.cw*2)centerOn(si);}}
  req();}

function edge(p,d,x,y,cw,ch,ins){const CW=2*cw;switch(d){
  case 0:p.moveTo(x+CW-ins,y);p.lineTo(x+CW-ins,y+ch);break;case 1:p.moveTo(x+ins,y);p.lineTo(x+ins,y+ch);break;
  case 2:p.moveTo(x,y+ins);p.lineTo(x+cw,y+ins);break;case 3:p.moveTo(x+cw,y+ins);p.lineTo(x+CW,y+ins);break;
  case 4:p.moveTo(x,y+ch-ins);p.lineTo(x+cw,y+ch-ins);break;case 5:p.moveTo(x+cw,y+ch-ins);p.lineTo(x+CW,y+ch-ins);break;}}

function isIdle(a){return a.owner===G.human&&a.mp>0&&!a.path&&!a.fort&&!a.sleep&&!a.auto;}
function idleArmies(){return armiesOf(G.human).filter(isIdle).sort((a,b)=>a.id-b.id);}

function draw(){
  needDraw=false;if(!G||G.demo||!cv||VIEW.w<2||VIEW.h<2||!cv.width||!cv.height)return;
  const {w,h,dpr}=VIEW;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=BG;ctx.fillRect(0,0,w,h);
  const cw=VIEW.cw,ch=VIEW.ch,CW=cw*2,ty=ch*.55;
  const r0=Math.max(0,Math.floor(VIEW.y/ch)),r1=Math.min(H-1,Math.floor((VIEW.y+h)/ch));
  const q0=Math.max(0,Math.floor(VIEW.x/CW)-1),q1=Math.min(W-1,Math.ceil((VIEW.x+w)/CW));
  const hp=human();const exp=hp.explored;const lair=new Set(G.lairs);
  ctx.font=fontStr(VIEW.fs);ctx.textAlign='center';ctx.textBaseline='middle';
  for(let r=r0;r<=r1;r++){const y=r*ch-VIEW.y,off=(r&1)?cw:0;
    for(let q=q0;q<=q1;q++){const i=r*W+q;if(!exp[i])continue;const x=q*CW+off-VIEW.x;const v=VIS[i];const o=ownerOf[i];
      if(o>=0){ctx.fillStyle=v?PC[o].tint:PC[o].tintD;ctx.fillRect(x,y,CW,ch);}
      if(UI.reach&&UI.reach[i]){ctx.fillStyle='rgba(255,179,64,.14)';ctx.fillRect(x,y,CW,ch);}
      const T=TERRAIN[G.ter[i]];const g=G.gly[i];let g1=g[0],c1=T.c,g2=g[1],c2=T.c;
      if(G.ruins[i]){g1='Π';c1='#ffd166';}else if(lair.has(i)){g1='Ω';c1=MON_COLOR;}
      const qs=G.qsites[i];if(qs&&qs.pid===G.human){g1='!';c1='#fff07a';}
      if(G.res[i]){g2='*';c2=RES[G.res[i]].c;}
      if(g1!==' '){ctx.fillStyle=c1;ctx.fillText(g1,x+cw*.5,y+ty);}
      if(g2!==' '){ctx.fillStyle=c2;ctx.fillText(g2,x+cw*1.5,y+ty);}
      if(!v){ctx.fillStyle='rgba(13,11,8,.55)';ctx.fillRect(x,y,CW,ch);}
    }}
  // границы
  const paths=new Map();const regPath=new Path2D();
  for(let r=r0;r<=r1;r++){const y=r*ch-VIEW.y,off=(r&1)?cw:0;
    for(let q=q0;q<=q1;q++){const i=r*W+q;if(!exp[i])continue;const x=q*CW+off-VIEW.x;const o=ownerOf[i],rg=G.reg[i],nb=NBD[i];
      for(let d=0;d<6;d++){const j=nb[d];
        if(o>=0&&(j<0||ownerOf[j]!==o)){const key=o*2+(VIS[i]?0:1);let p=paths.get(key);if(!p){p=new Path2D();paths.set(key,p);}edge(p,d,x,y,cw,ch,1.5);}
        else if(rg>=0&&j>=0&&(d===0||d===4||d===5)&&G.reg[j]>=0&&G.reg[j]!==rg&&exp[j])edge(regPath,d,x,y,cw,ch,0);}}}
  ctx.setLineDash([2,3]);ctx.strokeStyle='rgba(255,190,110,.24)';ctx.lineWidth=1;ctx.stroke(regPath);ctx.setLineDash([]);
  ctx.lineWidth=2;for(const [key,p] of paths){const o=key>>1;ctx.strokeStyle=(key&1)?PC[o].lineD:PC[o].line;ctx.stroke(p);}
  const inView=(x,y)=>x>-CW*2&&y>-ch*2&&x<w+CW&&y<h+ch;
  // путь
  const path=UI.pendPath||UI.hoverPath;const sa=UI.sel&&UI.sel.type==='army'?G.armies[UI.sel.id]:null;
  if(path&&sa&&path.tiles.length){const marks=pathTurns(sa,path.tiles);ctx.font=fontStr(VIEW.fs,true);
    path.tiles.forEach((t,k)=>{const {x,y}=tilePos(t);if(!inView(x,y))return;const last=k===path.tiles.length-1;
      const endTurn=!last&&marks[k]!==marks[k+1];
      if(last&&path.attack){ctx.fillStyle='rgba(13,11,8,.8)';ctx.fillRect(x+cw*.5-cw*.6,y+2,cw*1.2,ch-4);ctx.fillStyle='#ff6a5a';ctx.fillText('×',x+cw*.5,y+ty);return;}
      if(last||endTurn){ctx.fillStyle='rgba(13,11,8,.85)';ctx.fillRect(x+2,y+2,CW-4,ch-4);ctx.strokeStyle='#ffb340';ctx.lineWidth=1;ctx.strokeRect(x+2.5,y+2.5,CW-5,ch-5);
        ctx.fillStyle='#ffd27a';ctx.fillText(String(marks[k]+1),x+cw,y+ty);}
      else{ctx.fillStyle='#ffb340';ctx.fillText('•',x+cw,y+ty);}});}
  // города
  ctx.font=fontStr(VIEW.fs,true);
  for(const id in G.cities){const c=G.cities[id];if(!exp[c.idx])continue;const {x,y}=tilePos(c.idx);if(!inView(x,y))continue;const v=VIS[c.idx];const col=PC[c.owner];
    ctx.fillStyle=v?col.c:col.bgD;ctx.fillRect(x+1,y+1,CW-2,ch-2);ctx.fillStyle='#120c05';
    ctx.fillText(c.capital?'♜':'⌂',x+cw*.5,y+ty);ctx.fillText(c.pop>9?'+':String(c.pop),x+cw*1.5,y+ty);
    const ga=armyAt(c.idx);if(ga&&v){ctx.fillStyle='#fff3da';ctx.fillRect(x+3,y+ch-4,CW-6,2);}
    if(v&&isBesieged(c)){ctx.save();ctx.strokeStyle='#ff4d3d';ctx.lineWidth=2;ctx.setLineDash([3,2]);ctx.strokeRect(x-1,y-1,CW+2,ch+2);ctx.restore();}
    const mx=cityMaxHp(c);if(v&&c.hp<mx){const f=c.hp/mx;ctx.fillStyle='#3a1210';ctx.fillRect(x,y+ch,CW,3);ctx.fillStyle=f>.5?'#8ee07e':'#ff6a5a';ctx.fillRect(x,y+ch,CW*f,3);}}
  // армии
  ctx.font=fontStr(VIEW.fs,true);
  for(const id in G.armies){const a=G.armies[id];if(!VIS[a.idx]||cityAt(a.idx))continue;const {x,y}=tilePos(a.idx);if(!inView(x,y))continue;
    const mon=a.owner<0;const col=mon?MON_COLOR:PC[a.owner].c;
    ctx.fillStyle='rgba(10,8,6,.93)';ctx.fillRect(x+1,y+1,CW-2,ch-2);ctx.strokeStyle=col;ctx.lineWidth=1;ctx.strokeRect(x+1.5,y+1.5,CW-3,ch-3);
    ctx.fillStyle=col;ctx.fillText(mon?'&':P(a.owner).f.symbol,x+cw*.5,y+ty);
    const idle=isIdle(a);ctx.fillStyle=idle?'#fff3da':col;ctx.fillText(hasSettler(a)?'S':String(a.units.length),x+cw*1.5,y+ty);
    if(idle){ctx.fillStyle='#ffd27a';ctx.fillRect(x+CW-5,y+2,3,3);}
    if(a.fort&&a.owner===G.human){ctx.fillStyle=col;ctx.fillRect(x+3,y+ch-4,CW-6,1);}}
  if(VIEW.fs>=11){const lf=Math.max(9,Math.round(VIEW.fs*.72));ctx.font=fontStr(lf,true);
    for(const id in G.cities){const c=G.cities[id];if(!exp[c.idx])continue;const {x,y}=tilePos(c.idx);if(!inView(x,y))continue;
      const unrest=c.owner===G.human&&c.apSt>=3;const t=(c.origCap!=null?'★':'')+(unrest?c.name+' !':c.name);const tw=ctx.measureText(t).width;const lx=x+cw,ly=y-lf*.62;ctx.fillStyle='rgba(13,11,8,.86)';ctx.fillRect(lx-tw/2-3,ly-lf*.6,tw+6,lf*1.2);
      ctx.fillStyle=unrest?(c.apSt>=4?'#ff6a5a':'#ffd24d'):PC[c.owner].c;ctx.fillText(t,lx,ly);}}
  if(VIEW.fs>=11){const lf=Math.max(9,Math.round(VIEW.fs*.7));ctx.font=fontStr(lf,true);const lab=(i,t,col,up)=>{const {x,y}=tilePos(i);if(!inView(x,y))return;const tw=ctx.measureText(t).width;const lx=x+cw,ly=up?y-lf*.62:y+ch+lf*.6;
      ctx.fillStyle='rgba(13,11,8,.86)';ctx.fillRect(lx-tw/2-3,ly-lf*.6,tw+6,lf*1.2);ctx.fillStyle=col;ctx.fillText(t,lx,ly);};
    for(const k in G.qsites){const s=G.qsites[k];if(s.pid===G.human&&exp[+k])lab(+k,s.name,'#fff07a');}
    const sq=hp.quests&&hp.quests.side;if(sq&&sq.target&&G.armies[sq.target]&&VIS[G.armies[sq.target].idx])lab(G.armies[sq.target].idx,'Атаман',MON_COLOR,true);}
  // курсоры
  if(UI.hover>=0&&!UI.mobile){const {x,y}=tilePos(UI.hover);ctx.strokeStyle='rgba(255,210,122,.55)';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,CW-1,ch-1);}
  const si=selIdx();if(si>=0&&UI.blink){const {x,y}=tilePos(si);ctx.strokeStyle='#ffd27a';ctx.lineWidth=2;ctx.strokeRect(x-2,y-2,CW+4,ch+4);}
  if(UI.crt){gctx.setTransform(1,0,0,1,0,0);gctx.clearRect(0,0,gcv.width,gcv.height);gctx.drawImage(cv,0,0);}
  drawMini();
}
function selIdx(){const s=UI.sel;if(!s)return -1;if(s.type==='army'){const a=G.armies[s.id];return a?a.idx:-1;}if(s.type==='city'){const c=G.cities[s.id];return c?c.idx:-1;}return s.idx;}

/* мини-карта */
function layoutMini(){if(!G||G.demo)return;const ws=UI.mobile?120:184;mcv.width=W*2+1;mcv.height=H*2;mcv.style.width=ws+'px';mcv.style.height=Math.round(ws*H*2/(W*2+1))+'px';miniDirty=true;}
function drawMini(){if(!mcv||!G||G.demo)return;
  if(miniDirty||!miniBase){miniDirty=false;if(!miniBase)miniBase=document.createElement('canvas');miniBase.width=mcv.width;miniBase.height=mcv.height;const m=miniBase.getContext('2d');
    m.fillStyle='#070604';m.fillRect(0,0,miniBase.width,miniBase.height);const exp=human().explored;
    for(let i=0;i<N;i++){if(!exp[i])continue;const q=i%W,r=(i/W)|0;const o=ownerOf[i];const T=TERRAIN[G.ter[i]];
      m.fillStyle=o>=0?PC[o].c:T.water?(G.ter[i]==='ocean'?'#152c47':'#1f4a68'):T.c;m.globalAlpha=o>=0?(T.water?.45:.85):(T.water?1:.55);m.fillRect(q*2+(r&1),r*2,2,2);}
    m.globalAlpha=1;for(const id in G.cities){const c=G.cities[id];if(!exp[c.idx])continue;const q=c.idx%W,r=(c.idx/W)|0;m.fillStyle='#fff3da';m.fillRect(q*2+(r&1),r*2,2,2);}}
  mctx.drawImage(miniBase,0,0);const sx=2/(2*VIEW.cw),sy=2/VIEW.ch;mctx.strokeStyle='#ffd27a';mctx.lineWidth=1;
  mctx.strokeRect(Math.round(VIEW.x*sx)+.5,Math.round(VIEW.y*sy)+.5,Math.round(VIEW.w*sx),Math.round(VIEW.h*sy));}

function loop(){if(needDraw)draw();requestAnimationFrame(loop);}
setInterval(()=>{UI.blink=!UI.blink;if(UI.sel&&G&&!G.demo)req();},520);

/* ---------- ввод ---------- */
const ptrs=new Map();let drag=null,pinch=null;
function evPos(e){const r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function initInput(){
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('pointerdown',e=>{try{cv.setPointerCapture(e.pointerId);}catch(_){};const p=evPos(e);ptrs.set(e.pointerId,p);
    if(ptrs.size===1)drag={x:p.x,y:p.y,vx:VIEW.x,vy:VIEW.y,moved:false,btn:e.button,type:e.pointerType};
    else if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,fs:VIEW.fs};if(drag)drag.moved=true;}});
  cv.addEventListener('pointermove',e=>{const p=evPos(e);
    if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,p);
    if(pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);setZoom(pinch.fs*d/pinch.d,(a.x+b.x)/2,(a.y+b.y)/2);return;}
    if(drag&&ptrs.size===1){const dx=p.x-drag.x,dy=p.y-drag.y;if(!drag.moved&&Math.hypot(dx,dy)>7)drag.moved=true;
      if(drag.moved){VIEW.x=drag.vx-dx;VIEW.y=drag.vy-dy;clampCam();req();}return;}
    if(e.pointerType==='mouse'&&!ptrs.size)onHover(screenToTile(p.x,p.y));});
  const up=e=>{const had=ptrs.has(e.pointerId);ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;
    if(had&&drag&&!drag.moved&&ptrs.size===0){const p=evPos(e);handleTap(screenToTile(p.x,p.y),{right:drag.btn===2,mouse:drag.type==='mouse'});}
    if(ptrs.size===0)drag=null;};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',e=>{ptrs.delete(e.pointerId);if(!ptrs.size){drag=null;pinch=null;}});
  cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!ptrs.size){UI.hover=-1;UI.hoverPath=null;setHint(1,'');req();}});
  cv.addEventListener('wheel',e=>{e.preventDefault();const p=evPos(e);setZoom(VIEW.fs+(e.deltaY<0?2:-2),p.x,p.y);},{passive:false});
  mcv.addEventListener('pointerdown',e=>{const r=mcv.getBoundingClientRect();const mx=(e.clientX-r.left)*mcv.width/r.width,my=(e.clientY-r.top)*mcv.height/r.height;
    const rr=clamp(Math.floor(my/2),0,H-1);const q=clamp(Math.floor((mx-(rr&1))/2),0,W-1);centerOn(rr*W+q);});
  $('z-in').onclick=()=>setZoom(VIEW.fs+2);$('z-out').onclick=()=>setZoom(VIEW.fs-2);
  document.addEventListener('keydown',onKey);
  new ResizeObserver(()=>resize()).observe($('mapwrap'));
}
function onKey(e){
  if($('app').classList.contains('hidden')||!G||G.demo)return;
  if(e.target.matches&&e.target.matches('input,textarea,select'))return;
  if(!$('modal-back').classList.contains('hidden')){if(e.code==='Escape'&&!UI.modalLock)closeModal();return;}
  const step=VIEW.cw*8;let used=true;
  switch(e.code){
    case 'Enter':case 'NumpadEnter':endTurn();break;
    case 'KeyN':case 'Tab':nextArmy();break;
    case 'KeyT':openTech();break;case 'KeyP':openPerks();break;case 'KeyQ':openJournal();break;case 'KeyD':openDiplo();break;case 'KeyH':openHelp();break;
    case 'KeyF':act('fort');break;case 'KeyB':act('found');break;case 'Space':act('skip');break;case 'KeyE':act('explore');break;
    case 'Escape':select(null);break;
    case 'Equal':case 'NumpadAdd':setZoom(VIEW.fs+2);break;case 'Minus':case 'NumpadSubtract':setZoom(VIEW.fs-2);break;
    case 'ArrowLeft':case 'KeyA':VIEW.x-=step;clampCam();req();break;case 'ArrowRight':VIEW.x+=step;clampCam();req();break;
    case 'ArrowUp':case 'KeyW':VIEW.y-=step;clampCam();req();break;case 'ArrowDown':case 'KeyS':VIEW.y+=step;clampCam();req();break;
    default:used=false;}
  if(used)e.preventDefault();}

function tileSummary(i){const h=human();if(i<0||!h.explored[i])return i<0?'':'Неизведанные земли';const T=TERRAIN[G.ter[i]];
  const y=tileYield(i,h);const ys=[y.f&&`еда ${y.f}`,y.p&&`произв ${y.p}`,y.g&&`золото ${y.g}`,y.s&&`наука ${y.s}`].filter(Boolean).join(', ');
  const rg=G.reg[i]>=0?G.regions[G.reg[i]]:null;const o=ownerOf[i];
  return `${T.name}${G.res[i]?' · '+RES[G.res[i]].name:''}${ys?' · '+ys:''}${rg?' · '+rg.name+(o>=0?' ('+P(o).f.name+')':''):''}`;}
function setHint(n,t){const el=$('hint'+n);if(el.textContent!==t)el.textContent=t;}
function onHover(i){if(i===UI.hover)return;UI.hover=i;setHint(1,tileSummary(i));
  const sa=UI.sel&&UI.sel.type==='army'?G.armies[UI.sel.id]:null;UI.hoverPath=null;
  if(sa&&sa.owner===G.human&&i>=0&&i!==sa.idx&&!UI.pendPath){const oa=armyAt(i);if(!(oa&&oa.owner===G.human)){const path=findPath(G.human,sa.idx,i,{attack:true});
    if(path){const {owner}=defendersAt(i);const atk=owner!=null&&owner!==G.human;UI.hoverPath={tiles:path,attack:atk};
      const m=pathTurns(sa,path);const t=m[m.length-1]+1;setHint(2,atk?(adjacent(sa.idx,i)?'Клик: атаковать':'Клик: подойти и атаковать'):`Клик: идти · ${t} ${turnsWord(t)}`);}else setHint(2,'Туда не пройти');}}
  else if(!UI.pendPath)setHint(2,'');req();}
function clearPending(){UI.pending=-1;UI.pendPath=null;UI.hoverPath=null;setHint(2,'');}

/* ---------- выбор и действия на карте ---------- */
function select(s){UI.sel=s;clearPending();UI.reach=null;
  if(s&&s.type==='army'){const a=G.armies[s.id];if(a&&a.owner===G.human)UI.reach=reachable(a);}
  if(UI.mobile)$('side').classList.toggle('collapsed',!s);
  renderSide();req();}
function handleTap(i,o){
  if(UI.busy||!G||G.demo||i<0)return;const h=human();if(!h.alive)return;const sel=UI.sel;
  if(sel&&sel.type==='army'){const a=G.armies[sel.id];
    if(a&&a.owner===h.id){
      if(i===a.idx){const c=cityAt(i);if(c&&c.owner===h.id)select({type:'city',id:c.id});else clearPending();req();return;}
      const oa=armyAt(i);if(oa&&oa.owner===h.id&&!o.right){const oc=cityAt(i);select(oc&&oc.owner===h.id?{type:'city',id:oc.id}:{type:'army',id:oa.id});return;}
      const dA=armyAt(i),dC=cityAt(i);const visEnemy=(dA&&dA.owner!==h.id&&VIS[i])||(dC&&dC.owner!==h.id&&h.explored[i]);
      const owner=visEnemy?(dA&&dA.owner!==h.id?dA.owner:dC.owner):null;const enemy=owner!=null;
      if(enemy&&owner>=0&&!atWar(h.id,owner)){askWar(owner);return;}
      if(enemy&&adjacent(a.idx,i)){if(a.mp<=0){toast('Армия уже потратила все очки движения.');return;}openBattlePreview(a,i);return;}
      if(o.mouse||o.right||UI.pending===i){executeMove(a,i);return;}
      const path=findPath(h.id,a.idx,i,{attack:true});if(!path){toast('Туда не пройти.');clearPending();req();return;}
      UI.pending=i;UI.pendPath={tiles:path,attack:enemy};const m=pathTurns(a,path);const t=m[m.length-1]+1;
      setHint(2,`Коснитесь ещё раз: ${enemy?'идти в атаку':'идти'} · ${t} ${turnsWord(t)}`);req();return;}}
  const c=cityAt(i),oa=armyAt(i);
  if(c&&c.owner===h.id){if(sel&&sel.type==='city'&&sel.id===c.id&&oa&&oa.owner===h.id)select({type:'army',id:oa.id});else select({type:'city',id:c.id});return;}
  if(oa&&oa.owner===h.id){select({type:'army',id:oa.id});return;}
  select({type:'tile',idx:i});}

function executeMove(a,i){const h=human();const path=findPath(h.id,a.idx,i,{attack:true});if(!path){toast('Туда не пройти.');return;}
  const {owner}=defendersAt(i);const atk=owner!=null&&owner!==h.id;if(atk)path.pop();
  a.path=path.length?path:null;a.fort=false;a.sleep=false;a.auto=null;const res=stepArmy(a);clearPending();
  afterAction();
  if(res.merged){select({type:'army',id:res.merged.id});return;}
  if(!G.armies[a.id]){select(null);return;}
  if(atk&&a.mp>0&&adjacent(a.idx,i)&&atWar(h.id,owner)){select({type:'army',id:a.id});openBattlePreview(a,i);return;}
  select({type:'army',id:a.id});
  if(a.mp<=0&&UI.mobile===false){}}
function afterAction(){const h=human();computeVision(h.id);VIS=h._vis;try{questCheck(h);}catch(e){console.error(e);}miniDirty=true;renderTop();renderLog();req();if(G.over){showGameOver();return;}queueQuestUI();}
function queueQuestUI(){const h=human();if(!h||!h.quests)return;G._popups=G._popups||[];
  for(const pp of G._popups.splice(0))UI.popq.push(()=>showPopup(pp));
  UI.pendQ=UI.pendQ||new Set();for(const it of h.quests.pend)if(!UI.pendQ.has(it)){UI.pendQ.add(it);UI.popq.push(()=>showPend(it));}
  if(UI.popq.length&&$('modal-back').classList.contains('hidden')){const f=UI.popq.shift();f();}}
function nextArmy(){const list=idleArmies();if(!list.length){toast('Все армии получили приказы.');return;}
  let k=0;if(UI.sel&&UI.sel.type==='army'){const cur=list.findIndex(a=>a.id===UI.sel.id);if(cur>=0)k=(cur+1)%list.length;}
  select({type:'army',id:list[k].id});centerOn(list[k].idx);}

const ACTS={
  'found':()=>{const a=selArmy();if(!a)return;const h=human();if(!hasSettler(a)){return;}const why=canFoundHere(h,a.idx);if(why){toast(why);return;}
    const c=foundCity(a);if(c){afterAction();select({type:'city',id:c.id});}},
  'fort':()=>{const a=selArmy();if(!a)return;a.fort=!a.fort;a.path=null;a.auto=null;afterAction();if(a.fort)nextOrStay();else renderSide();},
  'skip':()=>{const a=selArmy();if(!a)return;a.sleep=true;a.path=null;afterAction();nextOrStay();},
  'explore':()=>{const a=selArmy();if(!a)return;a.auto='explore';a.fort=false;const ok=aiScout(human(),a);if(!ok){a.auto=null;toast('Исследовать больше нечего.');}afterAction();if(G.armies[a.id])select({type:'army',id:a.id});},
  'cancel-path':()=>{const a=selArmy();if(!a)return;a.path=null;a.auto=null;a.sleep=false;afterAction();renderSide();},
  'wake':()=>{const a=selArmy();if(!a)return;a.sleep=false;a.fort=false;a.auto=null;renderSide();req();},
  'merge':d=>{const a=selArmy();const b=G.armies[d.id];if(!a||!b)return;if(a.mp<=0){toast('Нет очков движения.');return;}
    const res=mergeInto(a,b);a.mp=0;afterAction();select({type:'army',id:res?b.id:a.id});},
  'split':d=>{const a=selArmy();if(!a)return;const b=splitUnit(a,+d.u);if(!b){toast('Рядом нет свободной клетки.');return;}afterAction();select({type:'army',id:a.id});},
  'disband':d=>{const a=selArmy();if(!a)return;const u=a.units[+d.u];if(!u)return;
    confirmBox(`Распустить отряд «${udef(human(),u.t).name}»?`,'Распустить',()=>{a.units.splice(+d.u,1);if(!a.units.length){removeArmy(a);select(null);}else{a.mpMax=armyMpMax(a);select({type:'army',id:a.id});}afterAction();});},
  'q-add':d=>{const c=selCity();if(!c)return;c.queue.push({k:d.k,id:d.id});renderSide();renderTop();},
  'q-del':d=>{const c=selCity();if(!c)return;const n=+d.n;const rm=c.queue[n];if(rm&&rm.k==='proj'){const h=human();h.gate.building=0;if(!h.gate.stage)h.gate.city=null;}if(n===0&&c.queue[0]&&c.queue[0].k!=='fest')c.prog=Math.floor(c.prog*.5);c.queue.splice(n,1);renderSide();renderTop();},
  'fest-on':()=>{const c=selCity();if(!c)return;c.queue.unshift({k:'fest',id:'fest'});renderSide();renderTop();toast('Празднества начались.');},
  'q-top':d=>{const c=selCity();if(!c)return;const n=+d.n;const it=c.queue.splice(n,1)[0];c.queue.unshift(it);c.prog=Math.floor(c.prog*.5);renderSide();},
  'buy':()=>{const c=selCity();if(!c)return;const h=human();if(buyItem(h,c)){toast('Куплено. Будет готово в начале следующего хода.');renderSide();renderTop();}},
  'focus':d=>{const c=selCity();if(!c)return;c.focus=d.f;renderSide();renderTop();},
  'buy-region':d=>{const h=human();const c=buyRegion(h,+d.r);if(c){afterAction();select({type:'city',id:c.id});}else toast('Не хватает золота.');},
  'sel-city':d=>{const c=G.cities[d.id];if(!c)return;select({type:'city',id:c.id});centerOn(c.idx);if(!$('modal-back').classList.contains('hidden'))closeModal();},
  'sel-army':d=>{const a=G.armies[d.id];if(!a)return;select({type:'army',id:a.id});centerOn(a.idx);},
  'goto':d=>{centerOn(+d.idx);},
  'tech':d=>{const h=human();h.research=d.t;renderTop();closeModal();toast(`Исследуем: ${TECHS[d.t].name}`);},
  'war':d=>{const pid=+d.p;confirmBox(`Объявить войну: ${P(pid).f.name}?`,'Объявить войну',()=>{declareWar(G.human,pid);afterAction();renderSide();openDiplo();},true);},
  'peace':d=>{const pid=+d.p;const ok=aiAcceptsPeace(P(pid),G.human,true);if(ok){makePeace(G.human,pid);afterAction();toast('Мир заключён.');}else{P(pid).ai.refused=G.turn;toast(`Фракция «${P(pid).f.name}» отвергла мир.`);}openDiplo();},
  'attack-go':()=>{const at=UI.attack;UI.attack=null;closeModal(true);if(!at)return;const a=G.armies[at.a];if(!a||a.mp<=0)return;const rep=attack(a,at.ti);
    if(G._reports){const k=G._reports.indexOf(rep);if(k>=0)G._reports.splice(k,1);}
    afterAction();if(G.armies[at.a])select({type:'army',id:at.a});else select(null);if(rep)showReport(rep);},
  'modal-close':()=>closeModal(),
  'show-report':d=>{const r=UI.lastReports&&UI.lastReports[+d.n];if(r){closeModal(true);showReport(r,true);}},
  'end':()=>endTurn(),
};
function act(name,d){const f=ACTS[name];if(f)f(d||{});}
function nextOrStay(){const list=idleArmies();if(list.length){select({type:'army',id:list[0].id});centerOn(list[0].idx);}else{select(null);}}
function selArmy(){const s=UI.sel;if(!s||s.type!=='army')return null;const a=G.armies[s.id];return a&&a.owner===G.human?a:null;}
function selCity(){const s=UI.sel;if(!s||s.type!=='city')return null;const c=G.cities[s.id];return c&&c.owner===G.human?c:null;}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b||b.disabled)return;e.preventDefault();act(b.dataset.act,b.dataset);});

/* ---------- верхняя панель и журнал ---------- */
function researchLine(h,inc){if(!h.research)return '<span class="warn">исследование не выбрано</span>';const cost=tcost(h,h.research);
  const t=inc.sci>0?Math.max(1,Math.ceil(Math.max(0,cost-h.sciPool)/inc.sci)):'∞';return `${esc(TECHS[h.research].name)} <span class="muted">${t} ${typeof t==='number'?turnsWord(t):''}</span>`;}
function renderTop(){if(!G||G.demo)return;const h=human();const inc=empireIncome(h);
  $('fac').innerHTML=`<span class="sym" style="background:${h.f.color}">${esc(h.f.symbol)}</span><span class="nm">${esc(h.f.name)}</span>`;
  let apS=0,apBad=0;const hc=citiesOf(h.id);for(const c of hc){const a=cityCalc(c).ap;apS+=a.v;if(a.st>=3)apBad++;}const apAvg=hc.length?Math.round(apS/hc.length):100;
  const apSt=APPROVAL_STATES.findIndex(s=>apAvg>=s.min);
  $('res').innerHTML=`<span><span class="lbl">ХОД</span>${G.turn}</span><span><span class="lbl"><span class="full">ЗОЛОТО</span><span class="short">ЗОЛ</span></span>${h.gold} <span class="${inc.gold>=0?'good':'bad'}">${sgn(inc.gold)}</span></span><span><span class="lbl"><span class="full">ОДОБРЕНИЕ</span><span class="short">ОДОБР</span></span><span class="${APPROVAL_STATES[apSt].cls}">${apAvg}%</span>${apBad?` <span class="warn" title="Городов с ропотом или бунтом">!${apBad}</span>`:''}</span><span><span class="lbl"><span class="full">НАУКА</span><span class="short">НАУК</span></span>+${inc.sci}<span class="rs"> → ${researchLine(h,inc)}</span></span>`;
  const pn=h.perkPts||0;$('b-perk').innerHTML=`<span class="full">Перки</span><span class="short">Перк</span>${pn?`<span class="badge">${pn}</span>`:''}`;
  const qn=h.quests?h.quests.pend.length:0;$('b-quest').innerHTML=`<span class="full">Квесты</span><span class="short">Квест</span>${qn?`<span class="badge">${qn}</span>`:''}`;
  const n=idleArmies().length;$('b-next').innerHTML=`<span class="full">След. армия${n?` (${n})`:''}</span><span class="short">Арм.${n?' '+n:''}</span>`;$('b-next').disabled=!n;}
function renderLog(){if(!G||G.demo)return;UI.logDirty=false;const el=$('log');const items=G.log.slice(-80);
  el.innerHTML=items.map(l=>`<div class="l ${l.kind}"${l.idx>=0?` data-act="goto" data-idx="${l.idx}"`:''}><span class="t">${l.t}</span><span class="x">${esc(l.text)}</span></div>`).join('');el.scrollTop=el.scrollHeight;}

/* ---------- боковая панель ---------- */
function renderSide(){if(!G||G.demo)return;const s=UI.sel;let ttl='Обзор',html='';
  try{
    if(s&&s.type==='army'&&G.armies[s.id]){const a=G.armies[s.id];[ttl,html]=a.owner===G.human?armyPanel(a):foreignArmyPanel(a);}
    else if(s&&s.type==='city'&&G.cities[s.id]){const c=G.cities[s.id];[ttl,html]=c.owner===G.human?cityPanel(c):foreignCityPanel(c);}
    else if(s&&s.type==='tile'){[ttl,html]=tilePanel(s.idx);}
    else{UI.sel=null;[ttl,html]=overviewPanel();}
  }catch(e){console.error(e);html='<p class="bad">Ошибка панели</p>';}
  $('side-ttl').textContent=ttl;$('sidebody').innerHTML=html;renderTop();}

function unitStats(p,u){const d=udef(p,u.t);const tags=Object.keys(UNIT_TAGS).filter(k=>d[k]).map(k=>UNIT_TAGS[k]);
  return `атк ${d.atk} · защ ${d.def} · ход ${d.mv}${tags.length?' · '+tags.join(', '):''}`;}
function lvlStars(u,p){const l=unitLevel(u,p);return l?' <span class="amb">'+'★'.repeat(l)+'</span>':'';}
function rankLine(u,p){const d=udef(p,u.t);if(d.civ)return '';const l=unitLevel(u,p);const x=unitXp(u);const mx=maxLevel(p);const next=l<mx?XP_LEVELS[l+1]:null;
  return `<span class="${l?'amb':'muted'}">${RANKS[l]}${l?' '+'★'.repeat(l)+' (+'+l*10+'%)':''}</span> · опыт ${x}${next?'/'+next:l>=4?'':' — выше ранг откроет Рунная ковка'}`;}

function armyPanel(a){const h=human();const cap=armyCap(h);let o='';
  const status=a.auto==='explore'?'исследует':a.path?`идёт к цели (${a.path.length} кл.)`:a.fort?'укреплена (+20% защ.)':a.sleep?'ждёт':a.mp>0?'ждёт приказа':'ход потрачен';
  o+=`<div class="row"><span class="muted">Движение</span><span class="v">${a.mp}/${a.mpMax}</span></div>`;
  o+=`<div class="row"><span class="muted">Состав</span><span class="v">${a.units.length}/${cap}</span></div>`;
  o+=`<div class="row"><span class="muted">Статус</span><span class="v">${status}</span></div>`;
  o+=`<div class="row"><span class="muted">Сила</span><span class="v">${Math.round(armyStrength(a))}</span></div>`;
  for(const j of NBR[a.idx]){const ec=cityAt(j);if(ec&&ec.owner!==h.id&&atWar(h.id,ec.owner))o+=`<div class="row"><span class="muted">Осада</span><span class="v good">${esc(ec.name)}: ${siegeTurns(ec)} ${turnsWord(siegeTurns(ec))}, стены −${Math.round(siegeDefPenalty(ec)*100)}%</span></div>`;}
  if(h.f.mech==='discipline')o+=`<div class="row"><span class="muted">Дисциплина</span><span class="v ${a.units.length>=cap?'good':'muted'}">${a.units.length>=cap?'+20% активна':'нужен полный состав'}</span></div>`;
  o+='<div class="actions">';
  if(hasSettler(a)){const why=canFoundHere(h,a.idx);o+=`<button class="btn primary" data-act="found" ${why?'disabled':''} title="${esc(why||'')}">Основать город [B]</button>`;}
  o+=`<button class="btn" data-act="fort">${a.fort?'Снять укрепление':'Укрепиться [F]'}</button>`;
  if(a.mp>0)o+=`<button class="btn" data-act="skip">Пропустить [␣]</button>`;
  if(a.units.every(u=>udef(h,u.t).scout))o+=`<button class="btn" data-act="explore">Авторазведка [E]</button>`;
  if(a.path||a.auto)o+=`<button class="btn" data-act="cancel-path">Отменить путь</button>`;
  o+='</div>';
  if(hasSettler(a)){const why=canFoundHere(h,a.idx);o+=`<p class="${why?'muted':'good'}">${why?why+'. ':'Здесь можно основать город. '}В каждом регионе — только один город, он забирает весь регион.</p>`;}
  const nbrs=NBR[a.idx].map(armyAt).filter(b=>b&&b.owner===h.id&&b.units.length<cap);
  if(nbrs.length&&a.mp>0)o+='<div class="actions">'+nbrs.map(b=>`<button class="btn sm" data-act="merge" data-id="${b.id}">Влиться в соседнюю армию (${b.units.length}/${cap})</button>`).join('')+'</div>';
  o+='<div class="hd">Отряды</div>';
  a.units.forEach((u,k)=>{const d=udef(h,u.t);o+=`<div class="urow"><div><span class="nm">${esc(d.name)}</span>${lvlStars(u,h)}</div><div class="acts">${a.units.length>1?`<button class="btn sm" data-act="split" data-u="${k}" title="Отделить в новую армию">⇱</button>`:''}<button class="btn sm danger" data-act="disband" data-u="${k}" title="Распустить">✕</button></div><div class="st">${unitStats(h,u)}<br>${bar(u.hp,d.hp,10)} <span class="k">${u.hp}/${d.hp}</span>${rankLine(u,h)?'<br>'+rankLine(u,h):''}</div></div>`;});
  o+=`<p class="muted" style="font-size:12px;margin-top:10px">${UI.mobile?'Коснитесь клетки, чтобы проложить путь, и ещё раз — чтобы идти.':'Наведите на клетку, чтобы увидеть путь, клик — идти. Клик по врагу рядом — атака.'} Цифры на пути — номер хода прибытия.</p>`;
  return [`Армия ${h.f.symbol}`,o];}

function foreignArmyPanel(a){const h=human();const mon=a.owner<0;const p=mon?null:P(a.owner);let o='';
  o+=`<div class="row"><span class="muted">Владелец</span><span class="v" style="color:${mon?MON_COLOR:p.f.color}">${mon?'Чудовища':esc(p.f.name)}</span></div>`;
  if(!mon)o+=`<div class="row"><span class="muted">Отношения</span><span class="v ${atWar(h.id,a.owner)?'bad':'good'}">${atWar(h.id,a.owner)?'война':'мир'}</span></div>`;
  o+=`<div class="row"><span class="muted">Сила</span><span class="v">${Math.round(armyStrength(a))}</span></div>`;
  if(VIS[a.idx]){o+='<div class="hd">Отряды</div>';a.units.forEach(u=>{const d=udef(p,u.t);o+=`<div class="urow"><div><span class="nm">${esc(d.name)}</span>${lvlStars(u,p)}</div><div></div><div class="st">атк ${d.atk} · защ ${d.def}<br>${bar(u.hp,d.hp,10)} <span class="k">${u.hp}/${d.hp}</span></div></div>`;});}
  if(mon)o+='<p class="muted">Нейтральные чудовища. Нападают на слабые армии рядом с логовом. За победу дают золото.</p>';
  o+=`<p class="muted" style="font-size:12px">Выберите свою армию рядом и коснитесь врага, чтобы увидеть прогноз боя.</p>`;
  return [mon?'Чудовища':'Армия: '+p.f.name,o];}

function cityPanel(c){const h=human();const y=cityCalc(c);const need=growNeed(c.pop);let o='';
  const grow=y.net>0?Math.ceil((need-c.food)/y.net):null;
  o+=`<div class="row"><span class="muted">Население</span><span class="v">${c.pop}${c.capital?' · столица':''}</span></div>`;
  o+=`<div class="row"><span class="muted">Рост</span><span class="v">${bar(c.food,need,8,'var(--good)')} ${Math.floor(c.food)}/${need} ${y.net>=0?'+':''}${y.net}${grow?` · ${grow} ${turnsWord(grow)}`:''}</span></div>`;
  o+=`<div class="row"><span class="muted">Прочность</span><span class="v">${bar(c.hp,cityMaxHp(c),8)} ${c.hp}/${cityMaxHp(c)}</span></div>`;
  {const ap=y.ap,S=APPROVAL_STATES[ap.st];o+=`<div class="row"><span class="muted">Одобрение</span><span class="v ${S.cls}">${bar(ap.v,100,8,AP_COL[ap.st])} ${ap.v}% · ${S.name}</span></div>`;
    o+=`<details class="apd"><summary>${esc(S.fx)}. Почему так?</summary>${ap.parts.map(([l,v])=>`<div class="row"><span>${esc(l)}</span><span class="v ${v<0?'bad':'good'}">${v>0?'+':''}${v}</span></div>`).join('')}<p class="muted" style="font-size:12px">Поднять одобрение: Храм, Амфитеатр, Суд, гарнизон, новые виды ресурсов, празднества, перки «Хлеб и зрелища», «Имперская администрация», «Акведуки и бани».</p></details>`;}
  if(y.siege){const g=armyAt(c.idx);o+=`<div class="qcard" style="border-color:var(--bad)"><b class="bad">Осада: ${y.siege} ${turnsWord(y.siege)}</b><div style="font-size:12.5px">Доходы и еда отрезаны, производство стоит. Стены −${Math.round(siegeDefPenalty(c)*100)}%, одобрение −${Math.min(SIEGE.apMax,y.siege*SIEGE.apPerTurn)}%.${y.siege>=SIEGE.attritionFrom-1?' Гарнизон голодает.':''}${(()=>{const n=siegeSurrenderIn(c);return n!=null?` <span class="bad">Город сдастся через ${n} ${turnsWord(n)}, если не снять осаду или не успокоить жителей!</span>`:(c.apSt>=3?' <span class="warn">Волнения: без гарнизона город может сдаться.</span>':'');})()} Купите защитников за золото или разбейте осаждающих.</div></div>`;}
  o+=`<div class="row"><span class="muted">Регион</span><span class="v">${esc(G.regions[c.region].name)}</span></div>`;
  o+=`<div class="yields"><div><small>Еда</small>${y.food}${h.f.mech==='undead'?'':` <span class="muted">−${y.eat}</span>`}</div><div><small>Произв.</small>${y.prod}</div><div><small>Золото</small>${y.gold}</div><div><small>Наука</small>${y.sci}</div></div>`;
  o+=`<div class="hd">Фокус жителей</div><div class="chips">${Object.keys(FOCUS).map(k=>`<button class="chip ${c.focus===k?'on':''}" data-act="focus" data-f="${k}">${FOCUS[k].name}</button>`).join('')}</div>`;
  o+='<div class="hd">Производство</div>';
  if(c.queue.length&&c.queue[0].k==='fest'){o+=`<div class="item cur"><span>Празднества</span><span class="c">+${Math.min(AP.festMax,Math.round(y.prod*.8))}% одобрения</span><span class="s">Всё производство города уходит на праздники. Остальная очередь ждёт.</span></div><div class="actions"><button class="btn sm danger" data-act="q-del" data-n="0">Закончить празднества</button></div>`;
    if(c.queue.length>1)o+='<div class="list">'+c.queue.slice(1).map((q,k)=>`<div class="item" style="cursor:default"><span>${k+2}. ${esc(itemName(h,q))}</span><span class="c"><button class="btn sm danger" data-act="q-del" data-n="${k+1}">✕</button></span></div>`).join('')+'</div>';}
  else if(c.queue.length){const it=c.queue[0];const cost=itemCost(h,it);const rate=y.prod+(it.k==='proj'&&!y.siege?gateBonus(h,empireIncome(h).sci):0);const t=rate>0?Math.max(1,Math.ceil((cost-c.prog)/rate)):'∞';const bc=buyCost(h,c);
    o+=`<div class="item cur"><span>${esc(itemName(h,it))}</span><span class="c">${c.bought?'куплено':t+' '+turnsWord(t)}</span><span class="s">${bar(c.prog,cost,14,'var(--amber)')} ${Math.floor(c.prog)}/${cost}</span></div>`;
    o+=`<div class="actions"><button class="btn sm" data-act="buy" ${canBuy(h,c)&&!c.bought?'':'disabled'}>Купить за ${bc} золота</button><button class="btn sm danger" data-act="q-del" data-n="0">Отменить</button></div>`;
    if(it.id==='settler'&&c.pop<2)o+='<p class="warn" style="font-size:12px">Поселенцам нужно население 2+.</p>';
    if(it.k==='proj')o+=`<p class="amb" style="font-size:12px">${esc(PROJECTS[it.id].desc)} Учёные державы добавляют +${gateBonus(h,empireIncome(h).sci)} в ход. Проект нельзя купить.</p>`;
    if(c.queue.length>1){o+='<div class="list">'+c.queue.slice(1).map((q,k)=>`<div class="item" style="cursor:default"><span>${k+2}. ${esc(itemName(h,q))}</span><span class="c"><button class="btn sm" data-act="q-top" data-n="${k+1}" title="Сделать первым">↑</button> <button class="btn sm danger" data-act="q-del" data-n="${k+1}">✕</button></span></div>`).join('')+'</div>';}
  }else o+=`<p class="warn">Очередь пуста: половина производства идёт в казну. Выберите, что строить.</p>`;
  const tt=cost=>{if(!y.prod)return `${cost} · стоит`;const t=Math.max(1,Math.ceil(cost/y.prod));return `${cost} · ${t} ${turnsWord(t)}`;};
  if(!(c.queue[0]&&c.queue[0].k==='fest'))o+=`<div class="hd">Особое</div><div class="list"><button class="item" data-act="fest-on"><span>Празднества</span><span class="c">+${Math.min(AP.festMax,Math.round(y.prod*.8))}% одобрения</span><span class="s">Производство уходит на праздники, пока вы их не закончите. Помогает быстро погасить ропот или бунт.</span></button></div>`;
  o+='<div class="hd">Отряды</div><div class="list">';
  for(const k of availUnits(h)){const d=udef(h,k);o+=`<button class="item" data-act="q-add" data-k="unit" data-id="${k}"><span>${esc(d.name)}${k==='uu'?' <span class="tag">уник.</span>':''}</span><span class="c">${tt(d.cost)}</span><span class="s">${k==='settler'?'Основывают новый город. Население города −1.':unitStats(h,{t:k})} · ОЗ ${d.hp}</span></button>`;}
  o+='</div><div class="hd">Постройки</div><div class="list">';
  const bl=availBuildings(h,c);if(!bl.length)o+='<p class="muted">Всё доступное уже построено. Новые здания откроют технологии.</p>';
  for(const k of bl){const b=bdef(h,k);o+=`<button class="item" data-act="q-add" data-k="bld" data-id="${k}"><span>${esc(b.name)}${k==='ub'?' <span class="tag">уник.</span>':''}</span><span class="c">${tt(b.cost)}</span><span class="s">${esc(b.desc)}</span></button>`;}
  o+='</div>';
  const pj=availProjects(h,c);if(pj.length||h.gate.city===c.id&&h.gate.stage>0){o+='<div class="hd">Великий проект</div>';
    if(h.gate.city===c.id&&h.gate.stage>0)o+=`<p class="amb">Врата Эфира: этап ${h.gate.stage} из 3.</p>`;
    for(const k of pj){const P2=PROJECTS[k];const bonus=gateBonus(h,empireIncome(h).sci);o+=`<button class="item" data-act="q-add" data-k="proj" data-id="${k}"><span>${esc(P2.name)}</span><span class="c">${tt(P2.cost)}</span><span class="s">${esc(P2.desc)} Наука державы добавляет +${bonus} в ход.</span></button>`;}}
  if(c.buildings.length){o+='<div class="hd">Построено</div><div class="list">';for(const b of c.buildings){const B=bdef(h,b);
      o+=`<div class="item" style="cursor:default"><span>${esc(B.name)}${B.ups&&B.ups.length?` <span class="good">↑${B.ups.length}</span>`:''}</span><span class="c"></span><span class="s">${esc(B.desc||'')}${B.ups&&B.ups.length?'<br><span class="good">'+B.ups.map(u=>esc(u.name+': '+u.text)).join('<br>')+'</span>':''}</span></div>`;}o+='</div>';}
  const g=armyAt(c.idx);if(g&&g.owner===h.id)o+=`<div class="hd">Гарнизон</div><div class="actions"><button class="btn" data-act="sel-army" data-id="${g.id}">Выбрать армию: ${g.units.length} ${plural(g.units.length,'отряд','отряда','отрядов')}</button></div>`;
  return [(c.capital?'♜ ':'⌂ ')+c.name,o];}

function foreignCityPanel(c){const h=human();const p=P(c.owner);let o='';
  o+=`<div class="row"><span class="muted">Владелец</span><span class="v" style="color:${p.f.color}">${esc(p.f.name)}</span></div>`;
  o+=`<div class="row"><span class="muted">Отношения</span><span class="v ${atWar(h.id,c.owner)?'bad':'good'}">${atWar(h.id,c.owner)?'война':'мир'}</span></div>`;
  o+=`<div class="row"><span class="muted">Население</span><span class="v">${c.pop}${c.capital?' · столица':''}</span></div>`;
  if(isBesieged(c)&&VIS[c.idx])o+=`<p class="${besiegers(c).some(a=>a.owner===G.human)?'good':'warn'}" style="font-size:12.5px">В осаде ${siegeTurns(c)} ${turnsWord(siegeTurns(c))}: стены −${Math.round(siegeDefPenalty(c)*100)}%, доходы отрезаны.${c.apSt>=3?' В городе волнения.':''}${(()=>{const n=siegeSurrenderIn(c);return n!=null?` Сдастся через ${n} ${turnsWord(n)}.`:'';})()}</p>`;
  else if(VIS[c.idx]&&c.apSt>=3)o+=`<p class="warn" style="font-size:12.5px">В городе волнения: стены слабее.</p>`;
  if(c.origCap!=null)o+=`<p class="amb" style="font-size:12.5px">★ Исходная столица фракции «${esc(P(c.origCap).f.name)}». Для победы завоеванием нужны все исходные столицы.</p>`;
  if(VIS[c.idx]){o+=`<div class="row"><span class="muted">Прочность</span><span class="v">${bar(c.hp,cityMaxHp(c),8)} ${c.hp}/${cityMaxHp(c)}</span></div>`;
    o+=`<div class="row"><span class="muted">Стены</span><span class="v">${hasWalls(c)?'есть':'нет'}</span></div>`;
    const g=armyAt(c.idx);o+=`<div class="row"><span class="muted">Гарнизон</span><span class="v">${g?g.units.length+' '+plural(g.units.length,'отряд','отряда','отрядов'):'нет'}</span></div>`;}
  o+='<p class="muted" style="font-size:12px">Чтобы захватить город, разбейте гарнизон и стены армией, в которой есть пехота или конница.</p>';
  return [c.name,o];}

function tilePanel(i){const h=human();if(!h.explored[i])return ['Неизведанное','<p class="muted">Сюда ещё не ступала нога ваших разведчиков.</p>'];
  const T=TERRAIN[G.ter[i]];const y=tileYield(i,h);let o='';
  o+=`<div class="yields"><div><small>Еда</small>${y.f}</div><div><small>Произв.</small>${y.p}</div><div><small>Золото</small>${y.g}</div><div><small>Наука</small>${y.s}</div></div>`;
  const mc=moveCost(h.id,i);o+=`<div class="row"><span class="muted">Движение</span><span class="v">${mc===Infinity?'непроходимо':mc}</span></div>`;
  if(T.def)o+=`<div class="row"><span class="muted">Защита</span><span class="v">${T.def>0?'+':''}${Math.round(T.def*100)}%</span></div>`;
  if(G.res[i])o+=`<div class="row"><span class="muted">Ресурс</span><span class="v" style="color:${RES[G.res[i]].c}">${RES[G.res[i]].name}</span></div>`;
  if(G.qsites[i]&&G.qsites[i].pid===G.human)o+=`<p style="color:#fff07a">! ${esc(G.qsites[i].name)} — цель квеста. Приведите сюда армию${armyAt(i)&&armyAt(i).owner<0?', сначала разбив стражу':''}.</p>`;
  if(G.ruins[i])o+='<p class="amb">Π Руины. Приведите армию, чтобы найти золото, знания или союзников.</p>';
  if(G.lairs.includes(i))o+='<p style="color:'+MON_COLOR+'">Ω Логово чудовищ. Пока оно цело, отсюда выходят чудовища. Разорите его армией.</p>';
  const rid=G.reg[i];if(rid>=0){const rg=G.regions[rid];const o2=ownerOf[i];o+=`<div class="hd">Регион ${esc(rg.name)}</div>`;
    o+=`<div class="row"><span class="muted">Владелец</span><span class="v">${o2>=0?`<span style="color:${P(o2).f.color}">${esc(P(o2).f.name)}</span>`:'свободен'}</span></div>`;
    o+=`<div class="row"><span class="muted">Клеток</span><span class="v">${rg.tiles.length}</span></div>`;
    if(regionBuyable(h,rid)){const cost=regionBuyCost(h);o+=`<div class="actions"><button class="btn primary" data-act="buy-region" data-r="${rid}" ${h.gold<cost?'disabled':''}>Выкупить регион за ${cost} золота</button></div>`;}
    else if(o2<0)o+='<p class="muted" style="font-size:12px">Свободный регион: приведите сюда поселенцев.</p>';}
  return [T.name,o];}

function overviewPanel(){const h=human();const inc=empireIncome(h);let o='';
  o+=`<div class="row"><span class="muted">Доход золота</span><span class="v">${h.gold} (${sgn(inc.gold)}, содержание армий −${inc.upkeep})</span></div>`;
  o+=`<div class="row"><span class="muted">Наука</span><span class="v">+${inc.sci}</span></div>`;
  o+=`<div class="row"><span class="muted">Механика</span><span class="v">${esc(MECHS[h.f.mech].name)}</span></div>`;
  o+=`<p class="muted" style="font-size:12px">${esc(MECHS[h.f.mech].desc)}</p>`;
  o+='<div class="hd">Города</div><div class="list">';
  for(const c of citiesOf(h.id)){const y=cityCalc(c);const it=c.queue[0];const t=it?(y.prod?Math.max(1,Math.ceil((itemCost(h,it)-c.prog)/y.prod)):'осада'):0;
    o+=`<button class="item" data-act="sel-city" data-id="${c.id}"><span>${c.capital?'♜':'⌂'} ${esc(c.name)} <span class="muted">${c.pop}</span> <span class="${APPROVAL_STATES[y.ap.st].cls}">${y.ap.v}%</span></span><span class="c">${it?(it.k==='fest'?'празднества':esc(itemName(h,it))+' · '+t):'<span class="warn">пусто</span>'}</span></button>`;}
  o+='</div><div class="hd">Армии</div><div class="list">';
  for(const a of armiesOf(h.id)){o+=`<button class="item" data-act="sel-army" data-id="${a.id}"><span>${esc(h.f.symbol)} ${a.units.map(u=>udef(h,u.t).name).slice(0,3).join(', ')}${a.units.length>3?'…':''}</span><span class="c">${isIdle(a)?'<span class="warn">ждёт</span>':a.mp+'/'+a.mpMax}</span></button>`;}
  o+='</div>';
  o+=`<div class="hd">Перки державы</div><p style="font-size:12.5px">${h.perks.length?h.perks.map(id=>esc(PERKS[id].name)).join(', '):'<span class="muted">пока не взяты</span>'}</p><div class="actions"><button class="btn sm" onclick="openPerks()">Перки${h.perkPts?` <span class="badge">${h.perkPts}</span>`:''}</button></div>`;
  const q=h.quests;if(q){o+='<div class="hd">Квесты</div>';
    if(q.chain&&q.chain.state!=='done'){const ch=chainDef(h).ch[q.chain.i];o+=`<div class="qcard"><b class="amb">${esc(ch.title)}</b>${progRow(h,q.chain,q.chain.state==='reward')}</div>`;}
    if(q.side){const left=Math.max(0,q.side.until-G.turn);o+=`<div class="qcard"><b>${esc(q.side.title)}</b> <span class="muted">· ${left} ${turnsWord(left)}</span>${progRow(h,q.side,false)}</div>`;}
    o+=`<div class="actions"><button class="btn sm" onclick="openJournal()">Журнал квестов${q.pend.length?` <span class="badge">${q.pend.length}</span>`:''}</button></div>`;}
  o+='<div class="hd">Цели</div>';
  if(G.vic.conquest){const ch=capitalsHeld(h.id);o+=`<p style="font-size:12.5px">Завоевание: захватите все исходные столицы (★ на карте). У вас ${ch.held} из ${ch.total}.</p>`;
    for(const p of G.players)if(p.id!==h.id&&p.alive&&h.met[p.id]){const cp=capitalsHeld(p.id);if(cp.held>=2)o+=`<div class="row"><span style="color:${p.f.color}">${esc(p.f.name)}</span><span class="v bad">столиц ${cp.held} из ${cp.total}</span></div>`;}}
  if(G.vic.science){o+=`<p style="font-size:12.5px">Наука: изучите Теорию Эфира и постройте Врата Эфира в три этапа. Мы: ${h.techs.aethertheory?'<span class="good">теория изучена</span>':`изучено ${Object.keys(h.techs).length}/${Object.keys(TECHS).length} технологий`}${h.gate.stage?`, Врата ${h.gate.stage}/3`:''}.</p>`;
    const rivals=G.players.filter(p=>p.id!==h.id&&p.alive&&h.met[p.id]&&(p.gate.stage||p.techs.aethertheory));
    for(const p of rivals)o+=`<div class="row"><span style="color:${p.f.color}">${esc(p.f.name)}</span><span class="v ${p.gate.stage?'bad':'warn'}">${p.gate.stage?`Врата ${p.gate.stage}/3`:'изучили Теорию Эфира'}</span></div>`;}
  return [h.f.name,o];}

/* ---------- окна ---------- */
function openModal(html,cls){const m=$('modal');m.className=cls||'';m.innerHTML=html;$('modal-back').classList.remove('hidden');m.scrollTop=0;
  const f=m.querySelector('.btn.primary,.btn');if(f&&!UI.mobile)setTimeout(()=>f.focus({preventScroll:true}),20);}
function closeModal(silent){$('modal-back').classList.add('hidden');$('modal').innerHTML='';UI.attack=null;UI.modalLock=false;
  if(!silent&&UI.popq.length){const f=UI.popq.shift();setTimeout(f,60);}}
$('modal-back')&&$('modal-back').addEventListener('click',e=>{if(e.target.id==='modal-back'&&!UI.modalLock)closeModal();});
function confirmBox(text,okLabel,fn,danger){openModal(`<h2>Подтвердите</h2><p>${esc(text)}</p><div class="mfoot"><button class="btn" data-act="modal-close">Отмена</button><button class="btn ${danger?'danger':'primary'}" id="cf-ok">${esc(okLabel)}</button></div>`,'narrow');
  $('cf-ok').onclick=()=>{closeModal(true);fn();};}
function askWar(pid){confirmBox(`Мы в мире с фракцией «${P(pid).f.name}». Объявить войну и атаковать?`,'Объявить войну',()=>{declareWar(G.human,pid);afterAction();renderSide();},true);}

function openTech(){const h=human();const inc=empireIncome(h);
  let o=`<h2>Технологии</h2><p class="muted">Наука: +${inc.sci} в ход, в запасе ${Math.floor(h.sciPool)}. Новая эпоха открывается, когда изучено достаточно технологий предыдущей.</p><div class="techgrid">`;
  ERAS.forEach((e,ei)=>{const open=eraOpen(h,ei);o+=`<div><div class="hd">${e.name}</div>`;
    if(!open)o+=`<p class="muted" style="font-size:12px">Изучите ${ERA_REQS[ei]} ${plural(ERA_REQS[ei],'технологию','технологии','технологий')} эпохи «${ERAS[ei-1].name}» (${eraCount(h,ei-1)}/${ERA_REQS[ei]}).</p>`;
    for(const k in TECHS){if(TECHS[k].era!==ei)continue;const known=h.techs[k],cur=h.research===k;const cost=tcost(h,k);const lf=TECHS[k].final&&!finalOpen(h);
      const t=inc.sci>0?Math.max(1,Math.ceil(Math.max(0,cost-h.sciPool)/inc.sci)):null;
      o+=`<button class="tech ${known?'known':''} ${cur?'cur':''} ${!known&&(!open||lf)?'locked':''}" ${known||!open||lf?'disabled':''} data-act="tech" data-t="${k}"><div class="n">${known?'✓ ':cur?'▶ ':''}${esc(TECHS[k].name)}</div><div class="u">${esc(techUnlocks(h,k).join(' · '))}</div>${lf&&open?`<div class="u warn">Нужны остальные ${FINAL_REQ} технологии этой эпохи</div>`:''}${known?'':`<div class="u k">${cost} науки${t?` · ${t} ${turnsWord(t)}`:''}</div>`}</button>`;}
    o+='</div>';});
  o+='</div><div class="mfoot"><button class="btn" data-act="modal-close">Закрыть</button></div>';openModal(o);}

function openDiplo(){const h=human();let o='<h2>Дипломатия</h2><p class="muted">Сила армий считается по атаке, защите и здоровью всех отрядов.</p>';
  const my=Math.round(militaryStrength(h.id));
  for(const p of G.players){if(p.id===h.id)continue;
    if(!h.met[p.id]){o+=`<div class="drow"><span class="sym" style="background:#2a2218;color:var(--muted)">?</span><div><b class="muted">Неизвестная фракция</b><div class="muted" style="font-size:12px">Ещё не встречены</div></div><div></div></div>`;continue;}
    const rel=relation(h.id,p.id);const st=Math.round(militaryStrength(p.id));const wt=warTurns(h.id,p.id);
    let btn='';if(!p.alive)btn='<span class="muted">уничтожены</span>';
    else if(rel==='war')btn=`<button class="btn sm" data-act="peace" data-p="${p.id}" ${wt<6||p.ai.refused===G.turn?'disabled':''}>Предложить мир</button>`;
    else btn=`<button class="btn sm danger" data-act="war" data-p="${p.id}">Объявить войну</button>`;
    o+=`<div class="drow"><span class="sym" style="background:${p.f.color}">${esc(p.f.symbol)}</span><div><b style="color:${p.f.color}">${esc(p.f.name)}</b>
      <div style="font-size:12px">${p.alive?`<span class="${rel==='war'?'bad':'good'}">${rel==='war'?'Война':'Мир'}</span> · ${wt} ${turnsWord(wt)} · городов ${citiesOf(p.id).length} · сила ${st} (наша ${my})${p.gate&&p.gate.stage?` · <span class="bad">Врата ${p.gate.stage}/3</span>`:''}`:''}</div>
      ${rel==='war'&&wt<6&&p.alive?'<div class="muted" style="font-size:12px">О мире можно говорить через 6 ходов войны.</div>':''}</div><div>${btn}</div></div>`;}
  o+='<div class="mfoot"><button class="btn" data-act="modal-close">Закрыть</button></div>';openModal(o,'narrow');}

function sideList(list){return list.map(f=>`<div class="row"><span>${esc(f.name)}</span><span class="v">${bar(f.hp,f.max,8)} <span class="k">${Math.max(0,Math.round(f.hp))}/${f.max}</span></span></div>`).join('');}
function openBattlePreview(a,ti){const h=human();const pr=predict(a,ti,120);const {A,D,c,owner}=buildSides(a,ti);UI.attack={a:a.id,ti};
  const enemyName=owner<0?'Чудовища':P(owner).f.name;const col=owner<0?MON_COLOR:P(owner).f.color;
  let o=`<h2>Сражение</h2><div class="bvs"><div><div class="hd">Мы</div>${sideList(A)}${A.mods.length?`<p class="muted" style="font-size:12px">${A.mods.map(esc).join('<br>')}</p>`:''}</div>
   <div class="mid"><div class="big">${Math.round(pr.win*100)}%</div><div class="muted">шанс ${pr.capture?'взять город':'победы'}</div>
   <div style="font-size:12px;margin-top:6px">ничья ${Math.round(pr.draw*100)}% · поражение ${Math.round(pr.lose*100)}%</div>
   <div style="font-size:12px">потери: наши ≈${round1(pr.aLoss)}, их ≈${round1(pr.dLoss)}</div></div>
   <div><div class="hd" style="color:${col}">${esc(enemyName)}</div>${sideList(D)}${D.mods.length?`<p class="muted" style="font-size:12px">${D.mods.map(esc).join('<br>')}</p>`:''}</div></div>`;
  if(c&&c.owner===owner&&!hasMelee(a))o+='<p class="warn">В армии только стрелки: стены можно разбить, но захватить город некому.</p>';
  const te=trophyEstimate(a,ti);if(te&&(te.g||te.pg))o+=`<p class="good" style="font-size:12.5px">Трофеи, если разбить всех: ≈${te.g} золота и ${te.s} науки${te.pg?`; добыча с города ≈${te.pg} золота и ${te.ps} науки`:''}.</p>`;
  if(owner<0)o+='<p class="good" style="font-size:12.5px">За разбитых чудовищ дают золото.</p>';
  o+='<p class="muted" style="font-size:12px">Бой длится до 3 раундов: стрелки бьют первыми, затем рукопашная. Если обе стороны устояли — ничья.</p>';
  o+=`<div class="mfoot"><button class="btn" data-act="modal-close">Отмена</button><button class="btn primary" data-act="attack-go">Атаковать</button></div>`;
  openModal(o);}

function reportTitle(r){const we=r.attOwner===G.human?'att':'def';const o=r.outcome;
  if(we==='att'){if(o==='capture')return ['good',`Город ${r.city} взят`];if(o==='att')return ['good','Победа'];if(o==='breach')return ['warn','Стены разбиты, но город не взят'];if(o==='draw')return ['warn','Ничья: стороны отошли'];return ['bad','Поражение'];}
  if(o==='capture')return ['bad',`Город ${r.city} пал`];if(o==='att'||o==='breach')return ['bad','Нас разбили'];if(o==='draw')return ['warn','Атака отбита с потерями'];return ['good','Оборона выдержала'];}
function reportHtml(r){const [cls,t]=reportTitle(r);const we=r.attOwner===G.human;
  const col=(side)=>side===(we?0:1)?'var(--amber)':'var(--muted)';
  const ul=(b,a)=>b.map((x,k)=>{const y=a[k];const dead=y.hp<=0;return `<div class="row"><span>${esc(x.name)}</span><span class="v">${dead?'<span class="bad">пал</span>':bar(y.hp,y.max,6)} <span class="k muted">${x.hp}→${y.hp}</span></span></div>`;}).join('');
  let o=`<h2 class="${cls}">${esc(t)}</h2><p class="muted">Атака: ${esc(r.attName)} → ${esc(r.defName)}${r.city?` · город ${esc(r.city)}`:''}</p>
  <div class="bvs"><div><div class="hd">${we?'Мы':esc(r.attName)} · атака</div>${ul(r.before.att,r.after.att)}</div><div></div><div><div class="hd">${we?esc(r.defName):'Мы'} · оборона</div>${ul(r.before.def,r.after.def)}</div></div>`;
  if(r.loot)o+=`<p class="good">Добыча с чудовищ: +${r.loot} золота.</p>`;
  const mt=r.tro&&(we?r.tro.att:r.tro.def),et=r.tro&&(we?r.tro.def:r.tro.att);
  if(mt&&(mt.g||mt.s))o+=`<p class="good">Трофеи: +${mt.g} золота, +${mt.s} науки.</p>`;
  if(et&&(et.g||et.s))o+=`<p class="muted">Враг взял трофеев: ${et.g} золота, ${et.s} науки.</p>`;
  if(r.plunder)o+=we?`<p class="good">Добыча с города: +${r.plunder.g} золота, +${r.plunder.s} науки.</p>`:`<p class="bad">Враг вывез ${r.plunder.stolen} золота из нашей казны.</p>`;
  const myUps=r.ups&&(we?r.ups.att:r.ups.def);if(myUps&&myUps.length)o+=`<p class="amb">Повышение: ${myUps.map(u=>`${esc(u.name)} → ${u.rank} ${'★'.repeat(u.lvl)}`).join(', ')}. Повышенные отряды подлечились.</p>`;
  o+='<div class="blog">';let lr=0;
  for(const l of r.log){if(l.r!==lr){lr=l.r;o+=`<div class="r">— раунд ${lr} —</div>`;}
    o+=`<div><span style="color:${col(l.as)}">${esc(l.a)}</span> ${l.rng?'стреляют в':'бьют'} <span style="color:${col(l.ts)}">${esc(l.t)}</span>: −${l.dmg}${l.kill?' <span class="bad">— пали</span>':` <span class="muted">(${l.left}/${l.max})</span>`}</div>`;}
  o+='</div>';return o;}
function showReport(r,fromList){openModal(reportHtml(r)+`<div class="mfoot">${r.tile>=0?`<button class="btn" data-act="goto" data-idx="${r.tile}">Показать на карте</button>`:''}<button class="btn primary" data-act="modal-close">Понятно</button></div>`);}
function showReportList(list){UI.lastReports=list;let o=`<h2>Сражения за ход</h2><div class="list">`;
  list.forEach((r,k)=>{const [cls,t]=reportTitle(r);o+=`<button class="item" data-act="show-report" data-n="${k}"><span class="${cls}">${esc(t)}</span><span class="c">подробнее</span><span class="s">${esc(r.attName)} → ${esc(r.defName)}${r.city?' · '+esc(r.city):''} · потери ${r.attLoss}/${r.defLoss}</span></button>`;});
  o+='</div><div class="mfoot"><button class="btn primary" data-act="modal-close">Понятно</button></div>';openModal(o,'narrow');}

function showGameOver(){if(!G.over||UI.overShown)return;UI.overShown=true;const h=human();const ov=G.over;const win=ov.win;let title,text;
  if(ov.type==='science'){if(win){title='Научная победа';text=`Врата Эфира открыты. Фракция «${esc(h.f.name)}» шагнула за пределы этого мира. Ход ${ov.turn}.`;}
    else{title='Поражение';text=`Фракция «${esc(P(ov.by).f.name)}» первой открыла Врата Эфира. Ход ${ov.turn}.`;}}
  else if(win){title='Победа завоеванием';text=`Фракция «${esc(h.f.name)}» держит все исходные столицы мира. Ход ${ov.turn}.`;}
  else if(ov.type==='conquest'&&ov.by!=null&&ov.by!==h.id){title='Поражение';text=`Фракция «${esc(P(ov.by).f.name)}» захватила все исходные столицы мира. Ход ${ov.turn}.`;}
  else{title='Поражение';text=`Фракция «${esc(h.f.name)}» потеряла последний город.`;}
  let o=`<h2 class="${win?'good':'bad'}">${title}</h2><p>${text}</p>`;
  o+='<div class="hd">Итоги</div>';
  for(const p of G.players){o+=`<div style="padding:5px 0;border-bottom:1px dashed var(--line)"><b style="color:${p.f.color}">${esc(p.f.symbol)} ${esc(p.f.name)}</b>${p.alive?'':' <span class="muted">(уничтожены)</span>'}<div class="muted k" style="font-size:12px">городов ${citiesOf(p.id).length} · технологий ${Object.keys(p.techs).length} · Врата ${p.gate?p.gate.stage:0}/3 · захвачено городов ${p.stats.captured}</div></div>`;}
  o+='<div class="mfoot"><button class="btn" data-act="modal-close">Осмотреть карту</button><button class="btn primary" id="go-menu">В главное меню</button></div>';
  openModal(o,'narrow');$('go-menu').onclick=()=>{closeModal(true);toMenu();};}

function openHelp(){const sw=(g,c,t)=>`<div class="row" style="justify-content:flex-start;gap:12px"><b style="color:${c};min-width:26px;display:inline-block">${esc(g)}</b><span>${t}</span></div>`;
  let o='<h2>Как играть</h2><div class="techgrid"><div><div class="hd">Карта</div>';
  for(const k of ['grass','plains','forest','hills','mount','desert','tundra','swamp','coast','ocean'])o+=sw(TERRAIN[k].gl[0]+TERRAIN[k].gl[1],TERRAIN[k].c,`${TERRAIN[k].name}${TERRAIN[k].move>1&&!TERRAIN[k].water?' · ход '+TERRAIN[k].move:''}${TERRAIN[k].def?' · защ '+(TERRAIN[k].def>0?'+':'')+Math.round(TERRAIN[k].def*100)+'%':''}`);
  o+=sw(' *','#f2d04b','Ресурс (цвет — вид ресурса)')+sw('Π','#ffd166','Руины: награда за исследование')+sw('Ω',MON_COLOR,'Логово чудовищ')+sw('!','#fff07a','Цель квеста')+'</div><div><div class="hd">Знаки</div>';
  o+=sw('♜3','#ffb340','Столица и её население')+sw('⌂2','#ffb340','Город')+sw('Λ4','#ff5a4f','Армия: символ фракции и число отрядов')+sw('ΛS','#ff5a4f','Армия с поселенцами')+sw('&2',MON_COLOR,'Чудовища')+sw('• 2','#ffb340','Путь армии, цифра — ход прибытия');
  o+='<div class="hd">Правила</div><p style="font-size:12.5px">Карта поделена на регионы (пунктир). В регионе может быть только один город, и он забирает весь регион. Поселенцы основывают города в свободных регионах.</p><p style="font-size:12.5px">Армия вмещает 4 отряда (технологии добавляют места). Бой рассчитывается автоматически, перед атакой показан шанс победы.</p><p style="font-size:12.5px">Опыт: отряды получают опыт за бой (больше — победители и те, кто добил врага). Ранги: Новобранцы, Опытные ★, Ветераны ★★, Элита ★★★, Легенда ★★★★ — каждый +10% к атаке и защите. Военное дело ускоряет опыт, Тактика даёт новым отрядам ранг «Опытные», Рунная ковка открывает «Легенду». Трофеи: за разбитые вражеские отряды — четверть их стоимости золотом и наукой; за захват города — добыча и часть вражеской казны.</p><p style="font-size:12.5px">Научная победа: изучите Теорию Эфира (последняя эпоха) и постройте в одном городе Врата Эфира в три этапа, каждый не быстрее '+GATE_MIN_TURNS+' ходов. Часть науки державы помогает стройке. Если город захватят, Врата будут разрушены.</p><p style="font-size:12.5px">Победа завоеванием: захватите все исходные столицы (★).</p><p style="font-size:12.5px">Осада: если рядом с городом стоит вражеская армия, он отрезан — нет еды, производства, золота и науки, стены не чинятся и слабеют на 10% за ход (до −50%), одобрение падает, с третьего хода голодает гарнизон. Сдача без боя: бунтующий город без гарнизона — через 5 ходов осады; город в волнениях с гарнизоном — через 15 ходов (гарнизон дезертирует); вымерший до 1 жителя город без гарнизона — через 12. Низкое одобрение ослабляет стены: ропот −20%, бунт −40%. Математика ускоряет ослабление стен в 1,5 раза. Защитник может выкупать отряды за золото.</p><p style="font-size:12.5px">Исследования дают не только новое: многие улучшают уже построенные здания (↑ в городе), а у каждой фракции есть свои особые исследования (★ в дереве технологий) для её отряда, постройки и механики.</p><p style="font-size:12.5px">Одобрение: у каждого города от 0 до 100%. Его снижают число городов (после третьего), теснота в больших городах, общее число жителей, долгие войны и оккупация. Поднимают — Храм, Амфитеатр, Суд, гарнизон, разные виды ресурсов, празднества и перки. При ропоте доходы падают, при бунте рост стоит и появляются мятежники.</p><p style="font-size:12.5px">Квесты: сюжет фракции из четырёх глав с наградой на выбор, поручения со сроком и события, где решать вам.</p></div>';
  o+='<div><div class="hd">Управление</div><p style="font-size:12.5px">Мышь: клик — выбрать, наведение — путь, клик — идти. Колесо — масштаб, перетаскивание — сдвиг карты.<br>Телефон: касание — выбрать или проложить путь, повторное касание — идти. Двумя пальцами — масштаб.</p>';
  o+='<p style="font-size:12.5px" class="muted">Клавиши: Enter — конец хода, N — следующая армия, F — укрепиться, B — основать город, E — авторазведка, Пробел — пропустить, T — технологии, D — дипломатия, стрелки/WASD — сдвиг, +/− — масштаб.</p></div></div>';
  o+='<div class="mfoot"><button class="btn primary" data-act="modal-close">Понятно</button></div>';openModal(o);}

function openGameMenu(){let o=`<h2>Меню</h2><div class="list" style="max-width:360px">
  <button class="btn" data-act="modal-close">Продолжить игру</button>
  <button class="btn" id="gm-save">Сохранение</button>
  <button class="btn" id="gm-load">Загрузить сохранение</button>
  <button class="btn" id="gm-help">Как играть</button>
  <button class="btn" id="gm-crt">Эффект старого монитора: ${UI.crt?'вкл':'выкл'}</button>
  <button class="btn danger" id="gm-exit">Выйти в главное меню</button></div>
  <p class="muted" style="font-size:12px">Игра сохраняется автоматически в начале каждого хода в этом браузере.</p>`;
  openModal(o,'narrow');
  $('gm-save').onclick=()=>openSave();$('gm-load').onclick=()=>openLoad();$('gm-help').onclick=()=>openHelp();
  $('gm-crt').onclick=()=>{UI.crt=!UI.crt;document.body.classList.toggle('nocrt',!UI.crt);try{localStorage.setItem('pe-crt',UI.crt?'1':'0');}catch(_){};req();openGameMenu();};
  $('gm-exit').onclick=()=>{closeModal(true);toMenu();};}

function saveCode(){return 'PE1:'+btoa(unescape(encodeURIComponent(serialize())));}
function decodeSave(s){s=s.trim();if(s.startsWith('PE1:'))s=decodeURIComponent(escape(atob(s.slice(4))));return s;}
function openSave(){const code=saveCode();let o=`<h2>Сохранение</h2><p class="muted">Код ниже — вся партия. Сохраните его или скачайте файлом, чтобы продолжить на другом устройстве.</p>
  <textarea id="sv-code" readonly>${esc(code)}</textarea><div class="mfoot"><button class="btn" data-act="modal-close">Закрыть</button>${'<button class="btn" id="sv-dl">Скачать файл</button>'}<button class="btn primary" id="sv-copy">Скопировать код</button></div>`;
  openModal(o,'narrow');
  $('sv-copy').onclick=async()=>{try{await navigator.clipboard.writeText(code);toast('Код скопирован.');}catch(e){$('sv-code').select();toast('Выделите код и скопируйте вручную.');}};
  $('sv-dl').onclick=async()=>{const fn=`pepel-i-efir-hod-${G.turn}.txt`;try{if(DL)await DL.save({filename:fn,data:code});else{const u=URL.createObjectURL(new Blob([code],{type:'text/plain'}));const l=document.createElement('a');l.href=u;l.download=fn;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}}catch(e){if(!e||e.code!=='declined')toast('Скачать не получилось. Скопируйте код вручную.');}};}
function openLoad(){let o=`<h2>Загрузить сохранение</h2><p class="muted">Вставьте код сохранения или выберите файл.</p><textarea id="ld-code" placeholder="PE1:..."></textarea>
  <div class="actions"><input type="file" id="ld-file" accept=".txt,.json,text/plain"></div><p class="bad" id="ld-err"></p>
  <div class="mfoot"><button class="btn" data-act="modal-close">Отмена</button><button class="btn primary" id="ld-go">Загрузить</button></div>`;
  openModal(o,'narrow');
  $('ld-file').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$('ld-code').value=r.result;};r.readAsText(f);};
  $('ld-go').onclick=()=>{try{const s=decodeSave($('ld-code').value);deserialize(s);closeModal(true);enterGame(false);toast('Партия загружена.');}catch(e){$('ld-err').textContent='Не получилось прочитать сохранение: '+e.message;}};}

function showPopup(pp){
  if(pp.type==='qinfo'){openModal(`<h2>${esc(pp.title)}</h2><p class="qtext">${esc(pp.text)}</p>${pp.goal?`<div class="row"><span class="muted">Цель</span><span class="v amb">${esc(pp.goal)}</span></div>`:''}<div class="mfoot">${pp.site>=0?questGoto(pp.site):''}<button class="btn primary" data-act="modal-close">Понятно</button></div>`,'narrow');return;}
  const p=P(pp.by);
  if(pp.type==='theory'){const who=knowsOf(pp.by)?`Фракция «${esc(p.f.name)}»`:'Неизвестная фракция';openModal(`<h2 class="warn">Теория Эфира</h2><p class="qtext">${who} изучила Теорию Эфира и может начать строить Врата. Три этапа займут у неё не меньше ${GATE_MIN_TURNS*3} ходов.</p><div class="mfoot"><button class="btn primary" data-act="modal-close">Понятно</button></div>`,'narrow');return;}
  if(pp.type==='gateStart'){const kn=knowsOf(pp.by);openModal(`<h2 class="bad">Начато строительство Врат</h2><p class="qtext">${kn?`Фракция «${esc(p.f.name)}» начала строить Врата Эфира в городе ${esc(pp.city)}`:'Неизвестная фракция начала строить Врата Эфира'}. Каждый из трёх этапов займёт не меньше ${GATE_MIN_TURNS} ходов. Захват города разрушит Врата.</p><div class="mfoot">${kn?questGoto(pp.idx):''}<button class="btn primary" data-act="modal-close">Понятно</button></div>`,'narrow');return;}
  if(pp.type==='gate'){const who=knowsOf(pp.by)?`Фракция «${esc(p.f.name)}»`:'Неизвестная фракция';openModal(`<h2 class="bad">Врата Эфира: этап ${pp.stage} из 3</h2><p class="qtext">${who} завершила этап ${pp.stage} строительства Врат Эфира в городе ${esc(pp.city)}. Если она закончит третий этап, мы проиграем. Захват этого города разрушит Врата.</p><div class="mfoot"><button class="btn" id="pg-d">Дипломатия</button><button class="btn primary" data-act="modal-close">Понятно</button></div>`,'narrow');$('pg-d').onclick=()=>{closeModal(true);openDiplo();};return;}
  if(pp.type==='war'){openModal(`<h2 class="bad">Война</h2><p>Фракция «<b style="color:${p.f.color}">${esc(p.f.name)}</b>» объявила нам войну. Её армии могут атаковать наши города и войска.</p><div class="mfoot"><button class="btn" id="pw-d">Дипломатия</button><button class="btn primary" data-act="modal-close">К оружию</button></div>`,'narrow');$('pw-d').onclick=()=>{closeModal(true);openDiplo();};}
  else if(pp.type==='peace'){if(!atWar(G.human,pp.by)){closeModal();return;}openModal(`<h2>Предложение мира</h2><p>Фракция «<b style="color:${p.f.color}">${esc(p.f.name)}</b>» предлагает прекратить войну.</p><div class="mfoot"><button class="btn" id="pp-no">Отказать</button><button class="btn primary" id="pp-yes">Заключить мир</button></div>`,'narrow');
    $('pp-yes').onclick=()=>{makePeace(G.human,pp.by);afterAction();closeModal();};$('pp-no').onclick=()=>{G.relSince[relKey(G.human,pp.by)]=G.turn-2;closeModal();};}}


/* ---------- квесты: окна ---------- */
function questGoto(i){return i>=0?`<button class="btn sm" data-act="goto" data-idx="${i}" onclick="closeModal()">Показать на карте</button>`:'';}
function progRow(p,q,done){const pr=goalProgress(p,q);return `<div class="row"><span>${esc(goalText(q.goal))}</span><span class="v">${done?'<span class="good">выполнено</span>':`${bar(pr.cur,pr.need,8,'var(--amber)')} ${Math.min(pr.cur,pr.need)}/${pr.need}`}</span></div>`;}
function sideTargetIdx(s){if(!s)return -1;if(s.target&&G.armies[s.target])return G.armies[s.target].idx;return s.site>=0&&G.qsites[s.site]?s.site:-1;}
function openJournal(){const h=human();const q=h.quests;const def=chainDef(h);let o='<h2>Квесты</h2>';
  if(q.pend.length)o+=`<div class="actions"><button class="btn primary" id="qj-pend">Ждут решения: ${q.pend.length}</button></div>`;
  o+=`<div class="hd">Сюжет «${esc(def.title)}»</div>`;
  def.ch.forEach((ch,i)=>{const c=q.chain;
    if(!c||i>c.i){o+=`<div class="qcard muted">Глава ${i+1}. ···</div>`;return;}
    if(i<c.i||c.state==='done'){const d=q.done.find(x=>x.title===ch.title);o+=`<div class="qcard"><b class="good">✓ Глава ${i+1}. ${esc(ch.title)}</b>${d?`<div class="muted" style="font-size:12px">Награда: ${esc(d.choice)}</div>`:''}</div>`;return;}
    o+=`<div class="qcard cur"><b class="amb">▶ Глава ${i+1}. ${esc(ch.title)}</b><p class="qtext">${esc(ch.intro)}</p>${progRow(h,c,c.state==='reward')}
      <div class="actions">${c.site>=0&&!c.visited&&G.qsites[c.site]?questGoto(c.site):''}${c.state==='reward'?'<button class="btn primary sm" id="qj-claim">Выбрать награду</button>':''}</div></div>`;});
  o+='<div class="hd">Поручение</div>';
  if(q.side){const s=q.side;const left=Math.max(0,s.until-G.turn);
    o+=`<div class="qcard cur"><b class="amb">${esc(s.title)}</b><p class="qtext">${esc(s.text)}</p>${progRow(h,s,false)}
      <div class="row"><span class="muted">Осталось</span><span class="v ${left<=3?'warn':''}">${left} ${turnsWord(left)}</span></div>
      <div class="row"><span class="muted">Награда</span><span class="v">${esc(rewardText(s.reward,h))}</span></div>
      ${s.fail?`<div class="row"><span class="muted">Если провалить</span><span class="v bad">${esc(rewardText(s.fail,h))}</span></div>`:''}
      <div class="actions">${questGoto(sideTargetIdx(s))}</div></div>`;}
  else o+='<p class="muted">Сейчас поручений нет. Новые появляются примерно раз в 15 ходов.</p>';
  o+='<div class="mfoot"><button class="btn" data-act="modal-close">Закрыть</button></div>';openModal(o);
  const pb=$('qj-pend');if(pb)pb.onclick=()=>{closeModal(true);showPend(h.quests.pend[0]);};
  const cb=$('qj-claim');if(cb)cb.onclick=()=>{closeModal(true);showPend(h.quests.pend.find(x=>x.kind==='reward'));};}

function questDecided(){UI.modalLock=false;closeModal(true);afterAction();renderSide();if(!UI.popq.length&&$('modal-back').classList.contains('hidden'))queueQuestUI();}
function showPend(item){const h=human();if(!item||!h.quests.pend.includes(item)){closeModal();return;}UI.modalLock=true;let o='';
  if(item.kind==='reward'){const c=h.quests.chain;const ch=chainDef(h).ch[c.i];
    o=`<h2 class="good">Глава ${c.i+1} завершена: ${esc(ch.title)}</h2><p class="qtext">${esc(ch.done)}</p><div class="hd">Выберите награду</div><div class="list">`;
    ch.choices.forEach((x,k)=>{o+=`<button class="item" data-pick="${k}"><span>${esc(x.label)}</span><span class="c">выбрать</span><span class="s">${esc(rewardText(x.r,h))}</span></button>`;});
    openModal(o+'</div>','narrow');
    $('modal').querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{claimChainReward(h,+b.dataset.pick);toast('Награда получена.');questDecided();});}
  else if(item.kind==='offer'){const s=item.inst;
    o=`<h2>Поручение: ${esc(s.title)}</h2><p class="qtext">${esc(s.text)}</p>
      <div class="row"><span class="muted">Цель</span><span class="v">${esc(goalText(s.goal))}</span></div>
      <div class="row"><span class="muted">Срок</span><span class="v">${s.turns} ${turnsWord(s.turns)}</span></div>
      <div class="row"><span class="muted">Награда</span><span class="v good">${esc(rewardText(s.reward,h))}</span></div>
      ${s.fail?`<div class="row"><span class="muted">Если провалить</span><span class="v bad">${esc(rewardText(s.fail,h))}</span></div>`:''}
      <div class="mfoot"><button class="btn" id="qo-no">Отказаться</button><button class="btn primary" id="qo-yes">Взяться</button></div>`;
    openModal(o,'narrow');
    $('qo-yes').onclick=()=>{h.quests.pend=h.quests.pend.filter(x=>x!==item);const ok=acceptSide(h,s);if(!ok)toast('Поручение уже неактуально.');else{msg(`Новое поручение: ${s.title}.`,'info',sideTargetIdx(h.quests.side));const ti=sideTargetIdx(h.quests.side);if(ti>=0)centerOn(ti);}questDecided();};
    $('qo-no').onclick=()=>{h.quests.pend=h.quests.pend.filter(x=>x!==item);h.quests.nextSide=G.turn+8;questDecided();};}
  else if(item.kind==='event'){const e=EVENTS.find(x=>x.id===item.id);
    o=`<h2>${esc(e.title)}</h2><p class="qtext">${esc(fillText(e.text,item.ctx||{}))}</p><div class="list">`;
    e.choices.forEach((ch,k)=>{const ok=choiceOk(h,ch);const rt=rewardText(ch.r,h);o+=`<button class="item" data-pick="${k}" ${ok?'':'disabled style="opacity:.45;cursor:default"'}><span>${esc(ch.label)}</span><span class="c">${ok?'выбрать':'не хватает золота'}</span><span class="s">${esc(rt||'ничего не меняется')}</span></button>`;});
    openModal(o+'</div>','narrow');
    $('modal').querySelectorAll('[data-pick]').forEach(b=>{if(b.disabled)return;b.onclick=()=>{const res=resolveEvent(h,item,+b.dataset.pick);
      if(res==='win')toast('Удача на нашей стороне!');else if(res==='lose')toast('Не повезло.');questDecided();};});}
  else{h.quests.pend=h.quests.pend.filter(x=>x!==item);UI.modalLock=false;closeModal();}}

/* ---------- ход ---------- */
function endTurn(){if(UI.busy||!G||G.demo||G.over&&!human().alive)return;
  const hq=human().quests;if(hq&&hq.pend.length){if($('modal-back').classList.contains('hidden'))showPend(hq.pend[0]);toast('Сначала примите решение по квесту.');return;}
  if(!$('modal-back').classList.contains('hidden'))closeModal(true);UI.popq=[];UI.pendQ=new Set();
  UI.busy=true;$('busy').classList.remove('hidden');clearPending();
  setTimeout(()=>{let err=null;try{G._reports=[];G._popups=[];G._techDone=false;runWorldTurn();humanStartTurn();}catch(e){console.error(e);err=e;}
    UI.busy=false;$('busy').classList.add('hidden');afterTurnUI();if(err)toast('Ошибка при обработке хода: '+err.message);},30);}
function humanStartTurn(){const h=human();if(!h.alive)return;
  for(const a of armiesOf(h.id)){if(!G.armies[a.id])continue;
    if(a.auto==='explore'){if(!aiScout(h,a)){a.auto=null;msg('Разведчики: поблизости всё исследовано.','info',a.idx);}}
    else if(a.path){stepArmy(a);if(G.armies[a.id]&&a.path&&a.mp>0){a.path=null;msg('Путь армии перекрыт, нужен новый приказ.','warn',a.idx);}}
    else if(a.sleep)a.sleep=false;}
  computeVision(h.id);}
function afterTurnUI(){const h=human();VIS=h._vis||computeVision(h.id);miniDirty=true;
  if(UI.sel){const s=UI.sel;if(s.type==='army'&&!G.armies[s.id]||s.type==='city'&&(!G.cities[s.id]||G.cities[s.id].owner!==G.human))UI.sel=null;}
  if(UI.sel&&UI.sel.type==='army'){const a=G.armies[UI.sel.id];UI.reach=a?reachable(a):null;}
  renderTop();renderLog();renderSide();req();autosave();
  const reps=(G._reports||[]).slice();const pops=(G._popups||[]).slice();G._reports=[];G._popups=[];
  if(G.over){showGameOver();return;}
  for(const pp of pops)UI.popq.push(()=>showPopup(pp));
  UI.pendQ=new Set();for(const it of h.quests.pend){UI.pendQ.add(it);UI.popq.push(()=>showPend(it));}
  if(reps.length===1)UI.popq.push(()=>showReport(reps[0]));else if(reps.length>1)UI.popq.push(()=>showReportList(reps));
  if(!h.research&&availTechs(h).length)UI.popq.push(()=>openTech());
  if(UI.popq.length){const f=UI.popq.shift();f();}
  else{const list=idleArmies();if(list.length&&!UI.sel){select({type:'army',id:list[0].id});}}}
function autosave(){try{localStorage.setItem(SAVE_KEY,serialize());}catch(_){}}

/* ---------- меню, настройка партии ---------- */
function asciiTitle(lines,cols){const c=document.createElement('canvas'),x=c.getContext('2d');const fpx=72;const font=`900 ${fpx}px "Arial Black","Segoe UI Black","DejaVu Sans",Arial,sans-serif`;x.font=font;
  const tw=Math.max(...lines.map(l=>x.measureText(l).width));const lh=fpx*1.08;c.width=Math.ceil(tw)+6;c.height=Math.ceil(lh*lines.length)+6;
  x.font=font;x.fillStyle='#fff';x.textBaseline='top';lines.forEach((l,k)=>x.fillText(l,3,3+k*lh));
  const d=x.getImageData(0,0,c.width,c.height).data;const sw=c.width/cols,sh=sw/.56;const rows=Math.ceil(c.height/sh);const ramp=' ░▒▓█';let out='';
  for(let r=0;r<rows;r++){let line='';for(let q=0;q<cols;q++){let s=0,n=0;const y0=Math.floor(r*sh),y1=Math.min(c.height,Math.floor((r+1)*sh)),x0=Math.floor(q*sw),x1=Math.min(c.width,Math.floor((q+1)*sw));
      for(let yy=y0;yy<y1;yy+=2)for(let xx=x0;xx<x1;xx+=2){s+=d[(yy*c.width+xx)*4+3];n++;}const v=n?s/n/255:0;line+=ramp[Math.min(4,Math.floor(v*5.2))];}
    if(line.trim())out+=line.replace(/\s+$/,'')+'\n';}
  return out.replace(/\n+$/,'');}

let menuAnim=null;
function startMenuBg(){const c=$('menu-bg');const r=c.getBoundingClientRect();const dpr=Math.min(2,window.devicePixelRatio||1);
  c.width=Math.round(r.width*dpr);c.height=Math.round(r.height*dpr);
  const saved=G;const savedDims=[W,H];genWorld((Math.random()*1e9)>>>0,'medium');
  const fs=15,cw=9,ch=18;const off=document.createElement('canvas');off.width=(2*W+1)*cw;off.height=H*ch;const o=off.getContext('2d');
  o.fillStyle=BG;o.fillRect(0,0,off.width,off.height);o.font=fs+'px '+FONT_STACK;o.textAlign='center';o.textBaseline='middle';
  for(let i=0;i<N;i++){const q=i%W,rr=(i/W)|0;const x=(q*2+(rr&1))*cw,y=rr*ch;const T=TERRAIN[G.ter[i]];const g=G.gly[i];o.fillStyle=T.c;
    if(g[0]!==' ')o.fillText(g[0],x+cw*.5,y+ch*.55);if(G.res[i]){o.fillStyle=RES[G.res[i]].c;o.fillText('*',x+cw*1.5,y+ch*.55);}else if(g[1]!==' ')o.fillText(g[1],x+cw*1.5,y+ch*.55);}
  // восстановить партию, если она была
  G=saved;if(saved&&!saved.demo){initGeometry(savedDims[0],savedDims[1]);reindex();}else G=null;
  const ctx2=c.getContext('2d');const still=matchMedia('(prefers-reduced-motion: reduce)').matches;let t0=performance.now();
  const frame=now=>{if($('menu').classList.contains('hidden')){menuAnim=null;return;}const t=still?0:(now-t0)/1000;
    const vw=c.width/dpr,vh=c.height/dpr;const sc=Math.max(1,vw/off.width*1.25,vh/off.height*1.25);
    const maxX=Math.max(0,off.width*sc-vw),maxY=Math.max(0,off.height*sc-vh);
    const sx=maxX*(.5+.5*Math.sin(t*.025)),sy=maxY*(.5+.5*Math.sin(t*.018+1));
    ctx2.setTransform(dpr,0,0,dpr,0,0);ctx2.fillStyle=BG;ctx2.fillRect(0,0,vw,vh);ctx2.drawImage(off,-sx,-sy,off.width*sc,off.height*sc);
    if(!still)menuAnim=requestAnimationFrame(frame);};
  if(menuAnim)cancelAnimationFrame(menuAnim);menuAnim=requestAnimationFrame(frame);}

function hasSave(){try{return !!localStorage.getItem(SAVE_KEY);}catch(_){return false;}}
function toMenu(){if(G&&!G.demo){UI.gameStr=serialize();autosave();}
  $('app').classList.add('hidden');$('setup').classList.add('hidden');$('menu').classList.remove('hidden');
  $('m-cont').disabled=!(UI.gameStr||hasSave());
  const cols=window.innerWidth<520?46:64;$('title-art').textContent=asciiTitle(['ПЕПЕЛ','И ЭФИР'],cols);startMenuBg();}

const SETUP={facId:'legion',size:'medium',np:5,diff:1,seed:0,vic:{conquest:true,science:true},customAI:false};
function openSetup(){SETUP.seed=(Math.random()*1e6)>>>0;$('s-seed').value=SETUP.seed;$('menu').classList.add('hidden');$('setup').classList.remove('hidden');renderSetup();}
function renderSetup(){
  if(!findFaction(SETUP.facId))SETUP.facId=PRESETS[0].id;
  $('s-facs').innerHTML=allFactions().map(f=>facCardHtml(f,false,true)).join('')+`<button class="fac new" id="s-newfac"><div class="nm amb">+ Создать свою фракцию</div><div class="lore">Облик, механика, черты, уникальный отряд и постройка.</div></button><button class="fac new" id="s-impfac"><div class="nm">Импорт по коду</div><div class="lore">Вставьте код фракции, которым с вами поделились.</div></button>`;
  $('s-newfac').onclick=()=>openEditor(null);$('s-impfac').onclick=openImportFaction;
  $('s-size').innerHTML=Object.keys(MAP_SIZES).map(k=>`<button class="chip ${SETUP.size===k?'on':''}" data-size="${k}">${MAP_SIZES[k].name} ${MAP_SIZES[k].dims[0]}×${MAP_SIZES[k].dims[1]}</button>`).join('');
  $('s-np').innerHTML=[2,3,4,5,6].map(n=>`<button class="chip ${SETUP.np===n?'on':''}" data-np="${n}">${n}</button>`).join('');
  $('s-diff').innerHTML=DIFFS.map((d,k)=>`<button class="chip ${SETUP.diff===k?'on':''}" data-diff="${k}">${d.name}</button>`).join('');
  $('s-vic').innerHTML=[['conquest','Завоевание'],['science','Наука: Врата Эфира']].map(([k,n])=>`<button class="chip ${SETUP.vic[k]?'on':''}" data-vic="${k}">${SETUP.vic[k]?'✓ ':''}${n}</button>`).join('');
  $('s-cai').innerHTML=CUSTOM.length?`<button class="chip ${SETUP.customAI?'on':''}" data-cai="1">${SETUP.customAI?'✓ ':''}Мои фракции тоже среди соперников</button>`:'<span class="muted" style="font-size:12.5px">Создайте свою фракцию, чтобы ИИ мог играть за неё.</span>';}
function initMenus(){
  $('m-new').onclick=openSetup;
  $('m-cont').onclick=()=>{try{const s=UI.gameStr||localStorage.getItem(SAVE_KEY);deserialize(s);enterGame(false);}catch(e){toast('Сохранение не найдено.');}};
  $('m-load').onclick=()=>{openLoad();};$('m-help').onclick=()=>openHelp();
  $('s-back').onclick=()=>{$('setup').classList.add('hidden');$('menu').classList.remove('hidden');startMenuBg();};
  $('s-rnd').onclick=()=>{SETUP.seed=(Math.random()*1e6)>>>0;$('s-seed').value=SETUP.seed;};
  $('setup').addEventListener('click',e=>{const act=e.target.closest('[data-fedit],[data-fcopy],[data-fcode],[data-fdel]');
    if(act){e.stopPropagation();const f=findFaction(act.dataset.fedit||act.dataset.fcopy||act.dataset.fcode||act.dataset.fdel);if(!f)return;
      if(act.dataset.fedit)openEditor(f,false);else if(act.dataset.fcopy)openEditor(f,true);else if(act.dataset.fcode)openFactionCode(f);
      else if(act.dataset.fdel)confirmBox(`Удалить фракцию «${f.name}»?`,'Удалить',()=>{CUSTOM=CUSTOM.filter(x=>x.id!==f.id);saveCustom();if(SETUP.facId===f.id)SETUP.facId=PRESETS[0].id;renderSetup();},true);return;}
    const b=e.target.closest('[data-fac],[data-size],[data-np],[data-diff],[data-vic],[data-cai]');if(!b)return;
    if(b.dataset.cai){SETUP.customAI=!SETUP.customAI;}
    if(b.dataset.vic){const k=b.dataset.vic;const other=k==='conquest'?'science':'conquest';if(SETUP.vic[k]&&!SETUP.vic[other]){toast('Нужно хотя бы одно условие победы.');return;}SETUP.vic[k]=!SETUP.vic[k];}
    if(b.dataset.fac)SETUP.facId=b.dataset.fac;if(b.dataset.size){SETUP.size=b.dataset.size;SETUP.np=MAP_SIZES[SETUP.size].players;}if(b.dataset.np)SETUP.np=+b.dataset.np;if(b.dataset.diff)SETUP.diff=+b.dataset.diff;renderSetup();});
  $('s-go').onclick=()=>{const v=parseInt($('s-seed').value,10);const seed=isFinite(v)?v:hashSeed($('s-seed').value);
    const fac=findFaction(SETUP.facId)||PRESETS[0];const pool=PRESETS.concat(SETUP.customAI?CUSTOM:[]);
    createGame({seed,size:SETUP.size,players:SETUP.np,diff:SETUP.diff,faction:fac,pool,vic:Object.assign({},SETUP.vic)});UI.overShown=false;enterGame(true);};
  $('s-facs').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-fac]')){e.preventDefault();e.target.click();}});
  $('b-menu').onclick=openGameMenu;$('b-tech').onclick=openTech;$('b-diplo').onclick=openDiplo;$('b-quest').onclick=openJournal;$('b-perk').onclick=openPerks;$('b-next').onclick=nextArmy;$('b-end').onclick=endTurn;
  $('side-tog').onclick=()=>$('side').classList.toggle('collapsed');
  $('sidehead').addEventListener('click',e=>{if(UI.mobile&&e.target.id!=='side-tog')$('side').classList.toggle('collapsed');});
}
function hashSeed(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}

function enterGame(fresh){
  $('menu').classList.add('hidden');$('setup').classList.add('hidden');$('app').classList.remove('hidden');
  buildColors();UI.sel=null;UI.popq=[];UI.overShown=!!G.over;miniBase=null;
  resize();VIEW.fs=UI.mobile?15:18;measure();layoutMini();if(UI.mobile)$('side').classList.add('collapsed');
  const h=human();VIS=computeVision(h.id);const cap=citiesOf(h.id).find(c=>c.capital)||citiesOf(h.id)[0];
  centerOn(cap?cap.idx:(armiesOf(h.id)[0]||{idx:0}).idx);
  renderTop();renderLog();renderSide();req();
  if(fresh){autosave();UI.popq.push(()=>openTech());openIntro();}
  else{if(G.over)showGameOver();else if(!h.research&&availTechs(h).length)openTech();}}
function openIntro(){const h=human();const f=h.f;
  openModal(`<h2>${esc(f.name)}</h2><p class="muted">${esc(f.lore)}</p>
  <div class="hd">Особенность: ${esc(MECHS[f.mech].name)}</div><p>${esc(MECHS[f.mech].desc)}</p>
  <div class="hd">Первые шаги</div>
  <p>1. Выберите технологию для изучения.<br>2. В столице (♜) поставьте производство. Когда население станет 2, стройте поселенцев.<br>3. Отправьте разведчиков исследовать карту, руины Π дают награды.<br>4. Занимайте свободные регионы: один город забирает весь регион.</p>
  <p>5. Следите за квестами (кнопка «Квесты»): у фракции есть сюжет из четырёх глав, а ещё будут поручения и события.</p>
  <p>6. Следите за одобрением: чем больше городов и жителей, тем оно ниже. Храмы, гарнизоны и празднества помогают удержать порядок.</p>
  <p class="muted" style="font-size:12.5px">Цели: ${[G.vic.conquest?'завоевание — захватите все исходные столицы (★)':'',G.vic.science?'наука — изучите Теорию Эфира и постройте Врата Эфира':''].filter(Boolean).join('; ')}. С соперниками вы начинаете в мире; войну можно объявить в дипломатии.</p>
  <div class="mfoot"><button class="btn" id="in-help">Управление</button><button class="btn primary" data-act="modal-close">Начать</button></div>`,'narrow');
  $('in-help').onclick=()=>{closeModal(true);UI.popq.unshift(()=>openTech());openHelp();};}

/* ---------- запуск ---------- */
function bootUI(data){
  cv=$('cv');ctx=cv.getContext('2d');gcv=$('glow');gctx=gcv.getContext('2d');mcv=$('mini');mctx=mcv.getContext('2d');
  try{UI.crt=localStorage.getItem('pe-crt')!=='0';}catch(_){}document.body.classList.toggle('nocrt',!UI.crt);
  loadCustom();initInput();initMenus();initEditor();requestAnimationFrame(loop);
  setInterval(()=>{if(UI.logDirty)renderLog();},300);
  if(data&&data.save){try{deserialize(data.save);enterGame(false);if(data.cam){VIEW.fs=data.cam.fs||VIEW.fs;measure();VIEW.x=data.cam.x;VIEW.y=data.cam.y;clampCam();req();}return;}catch(e){console.error(e);}}
  toMenu();
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(G&&!G.demo){measure();req();}if(!$('menu').classList.contains('hidden')){$('title-art').textContent=asciiTitle(['ПЕПЕЛ','И ЭФИР'],window.innerWidth<520?46:64);}});
  (async()=>{try{if(window.claude&&window.claude.use){DL=await window.claude.use('downloads');}}catch(_){DL=null;}})();
}
(function start(){
  const hot=window.claude&&window.claude.hot;
  if(hot&&hot.snapshot){try{hot.snapshot(()=>G&&!G.demo&&!$('app').classList.contains('hidden')?{save:serialize(),cam:{x:VIEW.x,y:VIEW.y,fs:VIEW.fs}}:{});}catch(_){}}
  const go=d=>bootUI(d||{});
  if(hot&&hot.ready)hot.ready(go);else go(hot&&hot.data||{});
})();
window.__dbg={get G(){return G;},autoplay(n){for(let k=0;k<n;k++){G._reports=[];G._popups=[];runWorldTurn({humanAI:true});if(G.over)break;}afterTurnUI();},
  select,handleTap,endTurn,centerOn,openTech,openBattlePreview,predict,human};

/* ---------- карточка фракции, обмен кодом ---------- */
function facCardHtml(f,preview,actions){const sel=!preview&&SETUP.facId===f.id;const tp=traitPoints(f.traits);
  const acts=!actions?'':f.custom?`<div class="facts"><button class="btn sm" data-fedit="${f.id}">Изменить</button><button class="btn sm" data-fcode="${f.id}">Код</button><button class="btn sm danger" data-fdel="${f.id}">Удалить</button></div>`
    :`<div class="facts"><button class="btn sm" data-fcopy="${f.id}">Изменить копию</button></div>`;
  return `<div class="fac ${sel?'on':''}" ${preview?'':`data-fac="${f.id}" tabindex="0" role="button" aria-pressed="${sel}"`}><div class="top"><span class="sym" style="background:${f.color}">${esc(f.symbol)}</span><div><div class="nm" style="color:${f.color}">${esc(f.name)}${f.custom?' <span class="tag">своя</span>':''}</div><div class="muted" style="font-size:12px">${esc(MECHS[f.mech].name)} · черты ${tp}/${ED_BUDGET}</div></div></div>
    ${f.lore?`<div class="lore">${esc(f.lore)}</div>`:''}<div class="ln">${esc(MECHS[f.mech].desc)}</div>
    <div class="ln"><span class="muted">Черты:</span> ${f.traits.length?f.traits.map(t=>esc(TRAITS[t].name)+' <span class="muted">('+esc(TRAITS[t].desc)+')</span>').join(', '):'<span class="muted">нет</span>'}</div>
    <div class="ln"><span class="muted">Отряд:</span> ${esc(f.uu.name)} <span class="muted">атк ${f.uu.atk} · защ ${f.uu.def} · ОЗ ${f.uu.hp} · ход ${f.uu.mv}</span></div>
    <div class="ln"><span class="muted">Здание:</span> ${esc(f.ub.name)} <span class="muted">${esc(f.ub.desc)}</span></div>
    <div class="ln"><span class="muted">Особые исследования:</span> ${(MECH_TECH[f.mech]||[]).map(b=>`<span title="${esc(b.desc.replace('{uu}',f.uu.name).replace('{ub}',f.ub.name))}">${esc(b.name)}</span> <span class="muted">(${esc(TECHS[b.tech].name)})</span>`).join(', ')}</div>
    <div class="ln"><span class="muted">Сюжет:</span> ${esc((QUEST_CHAINS[f.story]||QUEST_CHAINS[f.id]||QUEST_CHAINS.generic).title)}</div>${acts}</div>`;}
function openFactionCode(f){const code=factionCode(f);openModal(`<h2>Код фракции «${esc(f.name)}»</h2><p class="muted">Отправьте этот код другу: он вставит его через «Импорт по коду».</p><textarea id="fc-code" readonly>${esc(code)}</textarea>
  <div class="mfoot"><button class="btn" data-act="modal-close">Закрыть</button><button class="btn primary" id="fc-copy">Скопировать</button></div>`,'narrow');
  $('fc-copy').onclick=async()=>{try{await navigator.clipboard.writeText(code);toast('Код скопирован.');}catch(_){$('fc-code').select();toast('Выделите код и скопируйте вручную.');}};}
function openImportFaction(){openModal(`<h2>Импорт фракции</h2><p class="muted">Вставьте код, который начинается с PEF1:</p><textarea id="fi-code" placeholder="PEF1:..."></textarea><p class="bad" id="fi-err"></p>
  <div class="mfoot"><button class="btn" data-act="modal-close">Отмена</button><button class="btn primary" id="fi-go">Импортировать</button></div>`,'narrow');
  $('fi-go').onclick=()=>{try{const f=factionFromCode($('fi-code').value);CUSTOM.push(f);saveCustom();SETUP.facId=f.id;closeModal(true);renderSetup();toast(`Фракция «${f.name}» добавлена.`);}
    catch(e){$('fi-err').textContent='Не получилось: '+e.message;}};}

/* ---------- перки ---------- */
function openPerks(){const h=human();if(!h)return;perkInit(h);
  let o=`<h2>Перки державы</h2><p>Очков: <b class="amb">${h.perkPts}</b> · получено всего ${h.perkTotal} · взято перков ${h.perks.length}</p>
   <p class="muted" style="font-size:12.5px">Очки дают: новая эпоха (+1), завершённая глава сюжета (+1), каждые два поручения (+1), рубежи в ${CITY_MILESTONES.join(', ')} городов (+1). Ярус II открывается после ${PERK_TIER_REQ[2]} перков, ярус III — после ${PERK_TIER_REQ[3]}. Выбор нельзя отменить.</p><div class="perkgrid">`;
  for(const t of [1,2,3]){o+=`<div><div class="hd">${PERK_TIER_NAME[t]}</div>`;
    for(const id in PERKS){const d=PERKS[id];if(d.tier!==t)continue;const taken=hasPerk(h,id);const why=perkWhyNot(h,id);const can=!taken&&!why;
      o+=`<button class="perk ${taken?'taken':can?'can':'locked'}" ${can?`data-perk="${id}"`:'disabled'}><div class="n">${taken?'✓ ':''}${esc(d.name)} <span class="muted" style="font-weight:normal">· ${d.cost} ${plural(d.cost,'очко','очка','очков')}</span></div><div class="u">${esc(d.desc)}</div>${!taken&&why?`<div class="u ${h.perkPts<d.cost&&why.startsWith('нужно оч')?'':'warn'}">${esc(why)}</div>`:''}</button>`;}
    o+='</div>';}
  o+='</div><div class="mfoot"><button class="btn" data-act="modal-close">Закрыть</button></div>';openModal(o);
  $('modal').querySelectorAll('[data-perk]').forEach(b=>b.onclick=()=>{const id=b.dataset.perk;confirmBox(`Взять перк «${PERKS[id].name}»? ${PERKS[id].desc}`,'Взять',()=>{takePerk(h,id);afterAction();renderSide();openPerks();});});}
