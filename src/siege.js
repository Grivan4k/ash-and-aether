'use strict';
/* =====================================================================
   ОСАДА И ИЗМОР
   Город в осаде, если рядом стоит военная армия врага (или его мятежники).
   В осаде: нет доходов и еды, защита и одобрение падают с каждым ходом,
   гарнизон голодает, бунтующий город может сдаться без боя.
   ===================================================================== */
const SIEGE = {defPerTurn:.10, defMax:.50, apPerTurn:5, apMax:25, attritionFrom:3, attrition:.10,
  surrenderAfter:5, desertAfter:15, starveAfter:12, mathMul:1.5, unitDefPerTurn:.05, unitDefMax:.30};
const AP_DEF_MUL = [1.10,1,1,.80,.60];     // множитель защиты города по состоянию одобрения
const AP_UNIT_DEF = [0,0,0,-.10,-.20];     // штраф защиты гарнизона по состоянию одобрения

function besiegers(c){const out=[];for(const j of NBR[c.idx]){const a=armyAt(j);if(!a||a.owner===c.owner)continue;
    if(a.owner<0){if(a.rebel===c.id)out.push(a);continue;}
    if(atWar(a.owner,c.owner)&&armyStrength(a)>0)out.push(a);}
  return out;}
function isBesieged(c){return besiegers(c).length>0;}
function siegeTurns(c){return isBesieged(c)?Math.max(1,c.siege||0):0;}
/* сила измора: ходы осады, Математика у осаждающих ускоряет ослабление (но не сдачу) */
function siegePower(c){const t=siegeTurns(c);if(!t)return 0;return besiegers(c).some(a=>a.owner>=0&&P(a.owner).techs.math)?t*SIEGE.mathMul:t;}
function siegeDefPenalty(c){return Math.min(SIEGE.defMax,siegePower(c)*SIEGE.defPerTurn);}
/* через сколько ходов город сдастся при нынешнем положении (null — не сдастся) */
function siegeSurrenderIn(c){if(!isBesieged(c)||!besiegers(c).some(a=>a.owner>=0))return null;const g=armyAt(c.idx),gar=g&&g.owner===c.owner,t=c.siege||0,st=c.apSt==null?2:c.apSt;
  const opts=[];if(!gar&&st===4)opts.push(SIEGE.surrenderAfter);if(gar&&st>=3)opts.push(SIEGE.desertAfter);if(!gar&&c.pop<=1)opts.push(SIEGE.starveAfter);
  if(!opts.length)return null;return Math.max(1,Math.min(...opts)-t);}
function cityDefMul(c){const st=c.apSt==null?2:c.apSt;return AP_DEF_MUL[st]*(1-siegeDefPenalty(c));}

/* конец хода владельца города: счётчик осады, голод гарнизона, сдача */
function siegeTick(p,c){const bs=besiegers(c);
  if(!bs.length){if(c.siege&&p.human)msg(`Осада города ${c.name} снята.`,'good',c.idx);c.siege=0;return false;}
  const was=c.siege||0;c.siege=was+1;
  if(!was){if(p.human)msg(`Город ${c.name} в осаде: доходы отрезаны, запасы тают.`,'bad',c.idx);
    for(const a of bs)if(a.owner===G.human)msg(`Мы осаждаем город ${c.name}: он отрезан от доходов и слабеет.`,'info',c.idx);}
  // сдача без боя
  const maj=bs.filter(a=>a.owner>=0).sort((x,y)=>armyStrength(y)-armyStrength(x));if(!maj.length)return false;
  const g=armyAt(c.idx);const garrison=g&&g.owner===c.owner;
  let surrender=false;
  if(c.siege>=SIEGE.surrenderAfter&&c.apSt===4&&!garrison)surrender=true;
  if(c.siege>=SIEGE.desertAfter&&c.apSt>=3&&garrison){removeArmy(g);surrender=true;if(p.human)msg(`Гарнизон города ${c.name} дезертировал.`,'bad',c.idx);}
  if(c.siege>=SIEGE.starveAfter&&c.pop<=1&&!garrison)surrender=true;
  if(!surrender)return false;
  const to=maj[0].owner;const name=c.name;
  if(to===G.human||p.human)msg(`Город ${name} сдался без боя${to===G.human?'':': '+P(to).f.name}.`,to===G.human?'good':'bad',c.idx);
  else if(knowsOf(to)||knowsOf(p.id))msg(`Город ${name} сдался без боя: ${P(to).f.name}.`,'info',c.idx);
  if(G._popups&&(to===G.human||p.human))G._popups.push({type:'qinfo',title:to===G.human?`Город ${name} сдался`:`Мы потеряли город ${name}`,
    text:to===G.human?'Измор сделал своё дело: горожане открыли ворота без боя.':'Осада и бунт сломили город: он сдался без боя.',site:c.idx});
  c.siege=0;captureCity(c,to);const a=maj[0];if(G.armies[a.id]&&!armyAt(c.idx)&&hasMelee(a))placeArmy(a,c.idx);
  return true;}

/* голод гарнизона в начале хода */
function siegeAttrition(a){const c=cityAt(a.idx);if(!c||c.owner!==a.owner||!(c.siege>=SIEGE.attritionFrom)||!isBesieged(c))return false;
  const p=P(a.owner);for(const u of a.units){const d=udef(p,u.t);u.hp=Math.max(1,u.hp-Math.ceil(d.hp*SIEGE.attrition));}return true;}
