'use strict';
/* =====================================================================
   ПЕРКИ ДЕРЖАВЫ: очки за прогресс, три яруса
   ===================================================================== */
const PERKS = {
  warDoctrine:   {tier:1,cost:1,kind:'war', name:'Военная доктрина',      desc:'+10% к атаке всех отрядов.',mods:{atk:.10}},
  fortress:      {tier:1,cost:1,kind:'war', name:'Крепостное дело',       desc:'Стены городов прочнее на 40%, гарнизон защищается на 25% лучше.',cityHp:.4,cityDef:.25},
  tradeRoutes:   {tier:1,cost:1,kind:'eco', name:'Торговые пути',         desc:'+15% золота.',mods:{gold:.15}},
  guilds:        {tier:1,cost:1,kind:'eco', name:'Ремесленные гильдии',   desc:'+10% производства.',mods:{prod:.10}},
  mageAcademy:   {tier:1,cost:1,kind:'sci', name:'Академия магов',        desc:'+10% науки.',mods:{sci:.10}},
  breadGames:    {tier:1,cost:1,kind:'eco', name:'Хлеб и зрелища',        desc:'+10% одобрения во всех городах.',mods:{appr:10}},
  colonial:      {tier:1,cost:1,kind:'eco', name:'Колониальная политика', desc:'Поселенцы дешевле на 40%, новые города начинают с населением 2.',settler:1},
  marches:       {tier:2,cost:1,kind:'war', name:'Маршевые колонны',      desc:'+1 к движению всех армий.',mods:{mv:1}},
  bigArmies:     {tier:2,cost:1,kind:'war', name:'Большие армии',         desc:'+1 место в каждой армии.',cap:1},
  taxReform:     {tier:2,cost:1,kind:'eco', name:'Налоговая реформа',     desc:'Содержание армий вдвое дешевле.',upkeep:.5},
  enlightenment: {tier:2,cost:1,kind:'sci', name:'Просвещение',           desc:'Каждый житель даёт ещё +0,25 науки.',sciPop:.25},
  monsterHunters:{tier:2,cost:1,kind:'war', name:'Охотники на чудовищ',   desc:'+50% к атаке против чудовищ, двойная добыча с них и с руин.',hunt:1},
  administration:{tier:2,cost:1,kind:'eco', name:'Имперская администрация',desc:'Штраф одобрения за число городов вдвое меньше.'},
  baths:         {tier:2,cost:1,kind:'eco', name:'Акведуки и бани',       desc:'Штраф одобрения за тесноту в городах вдвое меньше.'},
  diplomats:     {tier:2,cost:1,kind:'eco', name:'Дипломатический корпус',desc:'Соперники реже объявляют вам войну и охотнее соглашаются на мир.',diplo:1},
  ironWill:      {tier:3,cost:2,kind:'war', name:'Железная воля',         desc:'+10% к защите, отряды лечатся вдвое быстрее.',mods:{def:.10},heal:2},
  warlord:       {tier:3,cost:2,kind:'war', name:'Владыка войны',         desc:'+15% к атаке, захваченные города не теряют население.',mods:{atk:.15},keepPop:1},
  ascendMind:    {tier:3,cost:2,kind:'sci', name:'Вознесение разума',     desc:'Технологии дешевле на 15%.',techCheap:.15},
  aetherKeepers: {tier:3,cost:2,kind:'sci', name:'Хранители Эфира',       desc:'Врата Эфира дешевле на 20%, учёные дают им 30% науки вместо 20%.',gate:1,needSci:1},
  goldenAge:     {tier:3,cost:2,kind:'eco', name:'Золотой век',           desc:'+10% к производству, золоту, науке и росту.',mods:{prod:.10,gold:.10,sci:.10,growth:.10}},
};
const PERK_TIER_REQ = {1:0,2:2,3:4};
const PERK_TIER_NAME = {1:'Ярус I',2:'Ярус II',3:'Ярус III'};
const CITY_MILESTONES = [4,8,12];

function perkInit(p){p.perks=p.perks||[];if(p.perkPts==null)p.perkPts=0;if(p.perkTotal==null)p.perkTotal=0;p.perkEras=p.perkEras||[];if(p.perkCities==null)p.perkCities=0;if(p.sideDone==null)p.sideDone=0;}
function hasPerk(p,id){return !!(p&&p.perks&&p.perks.includes(id));}
function perkSum(p,key){if(!p||!p.perks)return 0;let s=0;for(const id of p.perks){const v=PERKS[id]&&PERKS[id][key];if(v)s+=v;}return s;}
function perkAvailable(p,id){const d=PERKS[id];if(!d||hasPerk(p,id))return false;if(d.needSci&&G.vic&&!G.vic.science)return false;return p.perks.length>=PERK_TIER_REQ[d.tier];}
function perkWhyNot(p,id){const d=PERKS[id];if(hasPerk(p,id))return 'взят';if(d.needSci&&G.vic&&!G.vic.science)return 'научная победа выключена';
  if(p.perks.length<PERK_TIER_REQ[d.tier])return `нужно взять ${PERK_TIER_REQ[d.tier]} ${plural(PERK_TIER_REQ[d.tier],'перк','перка','перков')} (взято ${p.perks.length})`;
  if(p.perkPts<d.cost)return `нужно очков: ${d.cost}`;return '';}
function takePerk(p,id){if(!perkAvailable(p,id)||p.perkPts<PERKS[id].cost)return false;p.perkPts-=PERKS[id].cost;p.perks.push(id);MODS.delete(p.id);
  for(const a of armiesOf(p.id))a.mpMax=armyMpMax(a);
  if(p.human)msg(`Перк взят: ${PERKS[id].name}.`,'good');else if(knowsOf(p.id))msg(`Фракция «${p.f.name}» получила перк «${PERKS[id].name}».`,'info');return true;}
function awardPerk(p,reason){perkInit(p);p.perkPts++;p.perkTotal++;
  if(p.human){msg(`+1 очко перков: ${reason}.`,'good');G._perkNew=true;}else aiSpendPerks(p);}

function perkTick(p){perkInit(p);
  for(let e=1;e<ERAS.length;e++)if(eraOpen(p,e)&&!p.perkEras.includes(e)){p.perkEras.push(e);awardPerk(p,`наступила ${ERAS[e].name}`);}
  const n=citiesOf(p.id).length;while(p.perkCities<CITY_MILESTONES.length&&n>=CITY_MILESTONES[p.perkCities]){awardPerk(p,`держава выросла до ${CITY_MILESTONES[p.perkCities]} городов`);p.perkCities++;}}

function aiSpendPerks(p){const A=p.f.ai;let guard=0;
  while(p.perkPts>0&&guard++<10){const opts=Object.keys(PERKS).filter(id=>perkAvailable(p,id));if(!opts.length)return;
    let best=null,bs=-1e9;for(const id of opts){const d=PERKS[id];let s=R()*.8+d.tier*.4;
      if(d.kind==='war')s+=A.agg*1.6;if(d.kind==='eco')s+=A.build*1.2+A.exp*.4;if(d.kind==='sci')s+=A.sci*1.6;
      if(id==='aetherKeepers'&&p.techs.astronomy)s+=1;if(id==='monsterHunters'&&G.turn>80)s-=1;if(id==='colonial'&&G.turn>60)s-=1;if(s>bs){bs=s;best=id;}}
    if(p.perkPts<PERKS[best].cost){if(R()<.6)return;const cheap=opts.filter(id=>PERKS[id].cost<=p.perkPts);if(!cheap.length)return;best=pickR(cheap);}
    takePerk(p,best);}}
