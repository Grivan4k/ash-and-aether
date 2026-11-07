'use strict';
/* =====================================================================
   КВЕСТЫ: сюжетные цепочки фракций, поручения, события
   Цели проверяются автоматически; награды — на выбор.
   ===================================================================== */

/* goal.type: cities, pop, techs, build(arg), buildany, kills, monsters, ruins, lairs, capture,
   gold, terrain(arg: forest|mounthill|water), fullarmies, explore, visit, killarmy.  delta:1 — считать с начала главы */
const QUEST_CHAINS = {
  legion:{title:'Последний Орёл',ch:[
    {title:'Новый лагерь',intro:'Легат собирает центурионов: «Империя пала, но Легион жив, пока у нас есть земля под лагерем». Нужны новые города.',
     goal:{type:'cities',n:3},done:'Над тремя лагерями поднялись вымпелы. Ветераны впервые за годы спят под крышей.',
     choices:[{label:'Раздать жалование',r:{gold:70}},{label:'Устроить учения',r:{xp:3}}]},
    {title:'След Орла',intro:'Разведчик принёс обломок древка с бронзовым пером. Где-то рядом лежит Орёл — штандарт Девятого легиона. Место отмечено на карте знаком «!», его стерегут.',
     goal:{type:'visit'},site:{name:'Курган Орла',guard:2,kinds:['bandits','troll']},done:'Орёл найден под костями тех, кто его охранял. Легионеры молчат, но идут теперь твёрже.',
     choices:[{label:'Поднять Орла над войском',r:{mods:{atk:.10}}},{label:'Отдать жрецам на изучение',r:{sci:60,reveal:1}}]},
    {title:'Сталь и строй',intro:'«Один легион — это отряд. Три легиона — это армия», — говорит легат. Соберите три полные армии.',
     goal:{type:'fullarmies',n:3},done:'Три полных легиона выстроились на смотр. Земля гудит под их шагом.',
     choices:[{label:'Строй «черепаха»',r:{mods:{def:.10}}},{label:'Военные мастерские',r:{mods:{prod:.10}}}]},
    {title:'Возрождённая Империя',intro:'Соседи ещё помнят, чьими были эти земли. Захватите два чужих города.',
     goal:{type:'capture',n:2,delta:1},done:'Имперские знамёна вновь над чужими стенами. Легион снова стал Империей.',
     choices:[{label:'Призвать Легата',r:{hero:'legate'}},{label:'Триумф в столице',r:{gold:150,pop:'all'}}]}]},
  grove:{title:'Песнь корней',ch:[
    {title:'Голос рощи',intro:'Старейшая друидка слышит, как стонут корни: им нужен простор. Возьмите под защиту двенадцать лесных клеток.',
     goal:{type:'terrain',arg:'forest',n:12},done:'Корни перестали стонать. Теперь они поют.',
     choices:[{label:'Записать песню',r:{sci:50}},{label:'Посадить новую рощу',r:{pop:'cap'}}]},
    {title:'Сердце Древа',intro:'В глуши стоит выжженное молнией древо — Сердце, из которого вышел ваш народ. Призраки не дают к нему подойти.',
     goal:{type:'visit'},site:{name:'Сердце Древа',guard:2,kinds:['wraith'],terrain:['forest']},done:'Под ладонью друида кора стала тёплой. Сердце ещё бьётся.',
     choices:[{label:'Слушать Сердце',r:{mods:{sci:.10}}},{label:'Пробудить Древней',r:{unit:'uu',n:2}}]},
    {title:'Очищение',intro:'Чудовища топчут молодую поросль. Роща просит уничтожить пять отрядов чудовищ.',
     goal:{type:'monsters',n:5,delta:1},done:'Тропы чисты. Олени вернулись к водопою.',
     choices:[{label:'Благословить поля',r:{mods:{growth:.15}}},{label:'Продать трофеи',r:{gold:80}}]},
    {title:'Мировое Древо',intro:'Семя Мирового Древа прорастёт лишь в мудрой земле. Изучите пятнадцать технологий.',
     goal:{type:'techs',n:15},done:'Семя раскрылось. Над столицей поднимается росток, который переживёт всех нас.',
     choices:[{label:'Призвать Стража Древа',r:{hero:'treeguard'}},{label:'Сок мудрости',r:{mods:{sci:.15}}}]}]},
  forge:{title:'Глубинный зов',ch:[
    {title:'Первая жила',intro:'Старые кланы говорят: кузнец без горы — что меч без рукояти. Возьмите под власть десять клеток гор и холмов.',
     goal:{type:'terrain',arg:'mounthill',n:10},done:'Кирки звенят в новых штреках. Руда пошла.',
     choices:[{label:'Продать первую плавку',r:{gold:60}},{label:'Выковать броню хирду',r:{unit:'uu',n:1}}]},
    {title:'Забытый чертог',intro:'Под перевалом нашёлся вход в чертог предков. Внутри кто-то ворочается и рычит.',
     goal:{type:'visit'},site:{name:'Забытый чертог',guard:2,kinds:['troll'],terrain:['hills','mount']},done:'Тролль повержен. На стенах чертога — чертежи забытых горнов.',
     choices:[{label:'Восстановить горны',r:{mods:{prod:.15}}},{label:'Скопировать чертежи',r:{sci:60}}]},
    {title:'Горн предков',intro:'Чтобы разжечь горн предков, нужны мастерские в трёх городах.',
     goal:{type:'build',arg:'workshop',n:3},done:'Три горна горят одним пламенем. Сталь выходит прочнее прежней.',
     choices:[{label:'Закалённая броня',r:{mods:{def:.10}}},{label:'Продать излишки',r:{gold:100}}]},
    {title:'Сердце горы',intro:'Последняя руна высечена, но гора ждёт, когда кланы станут многолюдны, как в древности: сорок жителей.',
     goal:{type:'pop',n:40},done:'Гора открыла сердце. Внутри — живой камень, который помнит имена.',
     choices:[{label:'Призвать Рунного тана',r:{hero:'runelord'}},{label:'Неиссякаемая жила',r:{mods:{prod:.20}}}]}]},
  necro:{title:'Вечная Ночь',ch:[
    {title:'Первые души',intro:'Склепы пусты, а голод Некрополя растёт. Принесите ему шесть душ: уничтожьте шесть вражеских отрядов.',
     goal:{type:'kills',n:6,delta:1},done:'Склепы наполнились шёпотом. Город довольно затих.',
     choices:[{label:'Поднять павших',r:{pop:'cap'}},{label:'Обобрать мёртвых',r:{gold:50}}]},
    {title:'Склеп Короля',intro:'Шёпот указывает на курган, где лежит первый король-мертвец. Его стража ещё не упокоена.',
     goal:{type:'visit'},site:{name:'Склеп Короля',guard:2,kinds:['wraith','troll']},done:'Король открыл глаза и поклонился. Мёртвые признали новую власть.',
     choices:[{label:'Корона мертвеца',r:{mods:{atk:.10}}},{label:'Королевская стража',r:{unit:'uu',n:3}}]},
    {title:'Пепел живых',intro:'Живые должны увидеть, что их стены ничего не значат. Захватите город.',
     goal:{type:'capture',n:1,delta:1},done:'Над захваченным городом стоит тишина. Жители больше не боятся — они не помнят как.',
     choices:[{label:'Новые склепы',r:{mods:{growth:.15}}},{label:'Сжечь библиотеки, забрав знания',r:{sci:80}}]},
    {title:'Вечная Ночь',intro:'Когда тьма соберёт двадцать пять душ, проснётся Лич-владыка.',
     goal:{type:'kills',n:25,delta:1},done:'Луна потемнела. Лич-владыка открыл глаза.',
     choices:[{label:'Призвать Лича',r:{hero:'lich'}},{label:'Неупокоенные легионы',r:{mods:{def:.12,atk:.05}}}]}]},
  tide:{title:'Голос глубин',ch:[
    {title:'Жемчужные отмели',intro:'Старейшины рифа хотят, чтобы море вокруг ваших городов стало вашим. Владейте четырнадцатью клетками воды.',
     goal:{type:'terrain',arg:'water',n:14},done:'Отмели засветились жемчугом. Рыбаки возвращаются с полными сетями.',
     choices:[{label:'Продать жемчуг',r:{gold:60}},{label:'Изучить течения',r:{sci:40}}]},
    {title:'Затонувший храм',intro:'Ныряльщики нашли храм под водой. Его сторожат чудовища. Место отмечено на карте.',
     goal:{type:'visit'},site:{name:'Затонувший храм',guard:2,kinds:['harpy','wraith'],water:1},done:'Двери храма открылись сами. На алтаре — раковина, в которой шумит всё море.',
     choices:[{label:'Морская торговля',r:{mods:{gold:.15}}},{label:'Песни глубин',r:{mods:{sci:.10}}}]},
    {title:'Морской путь',intro:'Чем больше гаваней, тем громче голос глубин. Владейте шестью городами.',
     goal:{type:'cities',n:6},done:'Шесть гаваней перекликаются колоколами. Море слушает.',
     choices:[{label:'Пошлины',r:{gold:100}},{label:'Отряд гарпунщиков',r:{unit:'uu',n:2}}]},
    {title:'Королева приливов',intro:'Королева приливов придёт лишь к тем, чья казна полна жемчуга: накопите 400 золота.',
     goal:{type:'gold',n:400},done:'Волна поднялась выше башен — и опустилась к ногам Королевы.',
     choices:[{label:'Призвать Левиафана',r:{hero:'leviathan'}},{label:'Корона приливов',r:{mods:{gold:.20,sci:.10}}}]}]},
  guild:{title:'Великая сделка',ch:[
    {title:'Первый контракт',intro:'Совет гильдии ждёт доказательств, что колония приносит прибыль: накопите 150 золота.',
     goal:{type:'gold',n:150},done:'Совет доволен. Вам открыт кредит.',
     choices:[{label:'Купить чертежи',r:{sci:40}},{label:'Нанять охрану',r:{unit:'uu',n:1}}]},
    {title:'Караван в песках',intro:'Караван с векселями совета пропал. Последний раз его видели здесь — у разбойничьего лагеря.',
     goal:{type:'visit'},site:{name:'Брошенный караван',guard:2,kinds:['bandits']},done:'Векселя целы. Разбойники так и не поняли, что держали в руках.',
     choices:[{label:'Пустить векселя в оборот',r:{mods:{gold:.15}}},{label:'Обналичить',r:{gold:120}}]},
    {title:'Скупка земель',intro:'Земля — лучшее вложение. Совет хочет видеть семь торговых городов.',
     goal:{type:'cities',n:7},done:'Семь городов — семь голосов в совете. Ваш голос теперь решающий.',
     choices:[{label:'Школы счетоводов',r:{mods:{sci:.10}}},{label:'Цеха и мануфактуры',r:{mods:{prod:.10}}}]},
    {title:'Монополия',intro:'Рынки в четырёх городах — и мир начнёт платить вам за всё.',
     goal:{type:'build',arg:'market',n:4},done:'Цены во всём мире теперь назначаете вы.',
     choices:[{label:'Нанять Золотую гвардию',r:{hero:'goldguard'}},{label:'Золотой век',r:{mods:{gold:.25}}}]}]},
  generic:{title:'Путь народа',ch:[
    {title:'Опора',intro:'Народу нужна опора: владейте тремя городами.',goal:{type:'cities',n:3},done:'Три города стоят крепко.',
     choices:[{label:'Казна',r:{gold:70}},{label:'Учёные',r:{sci:50}}]},
    {title:'Древнее место',intro:'Разведчики нашли место силы. Оно охраняется.',goal:{type:'visit'},site:{name:'Место силы',guard:2},done:'Место силы покорено.',
     choices:[{label:'Сила',r:{mods:{atk:.10}}},{label:'Знание',r:{mods:{sci:.10}}}]},
    {title:'Мощь',intro:'Соберите две полные армии.',goal:{type:'fullarmies',n:2},done:'Армии готовы.',
     choices:[{label:'Защита',r:{mods:{def:.10}}},{label:'Ремесло',r:{mods:{prod:.10}}}]},
    {title:'Наследие',intro:'Изучите пятнадцать технологий.',goal:{type:'techs',n:15},done:'Наследие сохранено.',
     choices:[{label:'Золотой век',r:{mods:{gold:.2}}},{label:'Век мудрости',r:{mods:{sci:.15}}}]}]},
};

/* Поручения: появляются раз в 12–18 ходов, на выполнение отведён срок */
const SIDE_QUESTS = [
  {id:'hunt',title:'Чудовища на дорогах',text:'Купцы просят защиты: чудовища грабят обозы. Уничтожьте три отряда чудовищ.',
   goal:{type:'monsters',n:3,delta:1},turns:16,reward:{gold:70},cond:p=>countMonsters()>=2},
  {id:'ruins',title:'Тайны прошлого',text:'Учёные хотят знать, что скрывают руины. Исследуйте двое руин.',
   goal:{type:'ruins',n:2,delta:1},turns:20,reward:{sci:50},cond:p=>Object.keys(G.ruins).length>=3},
  {id:'build',title:'Великая стройка',text:'Горожане готовы трудиться без устали. Завершите две постройки.',
   goal:{type:'buildany',n:2,delta:1},turns:14,reward:{gold:60}},
  {id:'grow',title:'Сытые годы',text:'Урожай обилен — пусть города растут. Прибавьте четырёх жителей.',
   goal:{type:'pop',n:4,delta:1},turns:14,reward:{sci:45}},
  {id:'treasury',title:'Казна на чёрный день',text:'Совет просит скопить золото: прибавьте к казне 120 монет.',
   goal:{type:'gold',n:120,delta:1},turns:12,reward:{sci:60}},
  {id:'scout',title:'Белые пятна',text:'Картографы просят исследовать ещё восьмую часть суши.',
   goal:{type:'explore',n:8,delta:1},turns:15,reward:{gold:50},cond:p=>qstat(p,'explore')<85},
  {id:'lair',title:'Гнездо зла',text:'Из логова выходят всё новые чудовища. Разорите одно логово.',
   goal:{type:'lairs',n:1,delta:1},turns:20,reward:{gold:90},cond:p=>G.lairs.length>0},
  {id:'bandits',title:'Разбойничий атаман',text:'У границы объявился атаман с шайкой. Разбейте его, пока он не разорил окрестности.',
   goal:{type:'killarmy'},turns:10,reward:{gold:80},fail:{gold:-40},spawn:'bandits'},
  {id:'expedition',title:'Экспедиция',text:'Странник рассказал о месте силы в диких землях. Доберитесь туда.',
   goal:{type:'visit'},turns:20,reward:{sci:60,xp:2},site:{name:'Место силы',guard:1,min:5,max:12}},
];

/* События: выбор сразу, без срока. {cap} — столица, {big} — крупнейший город */
const EVENTS = [
  {id:'refugees',title:'Беженцы у ворот',text:'Сотни беженцев из разорённых земель просят приюта в городе {cap}.',choices:[
    {label:'Принять всех',r:{pop:'cap',gold:-20}},{label:'Взять годных к службе',r:{unit:'militia',n:1}},{label:'Закрыть ворота',r:{}}]},
  {id:'sage',title:'Странствующий мудрец',text:'Старик с посохом из чёрного дерева предлагает свои записи за плату.',cond:p=>p.gold>=40,choices:[
    {label:'Заплатить',r:{gold:-40,sci:65}},{label:'Прогнать',r:{}}]},
  {id:'plague',title:'Серая хворь',text:'В городе {big} вспыхнула болезнь. Лекари просят денег на карантин.',cond:p=>citiesOf(p.id).some(c=>c.pop>2),choices:[
    {label:'Оплатить карантин',r:{gold:-50}},{label:'Пусть пройдёт сама',r:{pop:'big-'}}]},
  {id:'mine',title:'Находка в шахте',text:'Рудокопы наткнулись на пустоту, полную древних вещей.',choices:[
    {label:'Переплавить',r:{gold:70}},{label:'Изучить',r:{sci:45}}]},
  {id:'mercs',title:'Вольный отряд',text:'Наёмники предлагают свои клинки за честную плату.',cond:p=>p.gold>=60,choices:[
    {label:'Нанять',r:{gold:-60,unit:'best',n:2}},{label:'Отказать',r:{}}]},
  {id:'harvest',title:'Богатый урожай',text:'Поля дали небывалый урожай.',choices:[
    {label:'Запасти зерно',r:{food:12}},{label:'Продать излишки',r:{gold:50}}]},
  {id:'star',title:'Упавшая звезда',text:'Ночью за горизонт упал огненный камень. Его ещё можно найти.',choices:[
    {label:'Послать учёных',r:{chance:.6,win:{sci:110},lose:{}}},{label:'Послать кузнецов',r:{prod:45}}]},
  {id:'deserters',title:'Усталость войск',text:'Солдаты устали от походов и требуют жалования.',cond:p=>countUnits(p.id,d=>!d.civ&&!d.scout)>=6,choices:[
    {label:'Выплатить',r:{gold:-45}},{label:'Отпустить недовольных',r:{disband:1}}]},
  {id:'festival',title:'Праздник Эфира',text:'Горожане {cap} просят устроить праздник в честь лилового неба.',cond:p=>p.gold>=30,choices:[
    {label:'Устроить праздник',r:{gold:-30,apbuff:{v:12,t:8}}},{label:'Не до праздников',r:{}}]},
  {id:'unrest',title:'Ропот на площадях',text:'В городе {worst} толпа требует хлеба и справедливости. Стража ждёт приказа.',cond:p=>citiesOf(p.id).some(c=>c.apSt>=3),choices:[
    {label:'Раздать хлеб и монеты',r:{gold:-50,apbuff:{v:15,t:8}}},{label:'Пообещать реформы',r:{apbuff:{v:6,t:5}}},{label:'Разогнать толпу',r:{pop:'worst-',apbuff:{v:10,t:4}}}]},
  {id:'map',title:'Карта древних',text:'Торговец продаёт выцветшую карту с пометками на незнакомом языке.',cond:p=>p.gold>=30,choices:[
    {label:'Купить',r:{gold:-30,reveal:1}},{label:'Отказаться',r:{}}]},
  {id:'duel',title:'Вызов чемпиона',text:'Вожак чудовищ вызывает вашего лучшего воина на поединок у всех на виду.',choices:[
    {label:'Принять вызов',r:{chance:.6,win:{xp:3},lose:{disband:1}}},{label:'Отказаться',r:{}}]},
  {id:'scholars',title:'Спор учёных',text:'Две школы учёных спорят, чему учить молодых: звёздам или ремеслу.',choices:[
    {label:'Звёздам',r:{sci:50}},{label:'Ремеслу',r:{prod:40}}]},
];

/* ---------- состояние ---------- */
function qInit(p){p.quests=p.quests||{chain:null,side:null,pend:[],nextEvent:7+ri(0,5),nextSide:10+ri(0,6),done:[]};
  p.qmods=p.qmods||{};p.gate=p.gate||{city:null,stage:0};const s=p.stats;for(const k of ['mkills','ruins','lairs','bought'])s[k]=s[k]||0;}
function ensureState(){G.vic=G.vic||{conquest:true,science:true};G.qsites=G.qsites||{};
  if(G.cities)for(const c of Object.values(G.cities))if(c.origCap===undefined)c.origCap=c.founded===1?c.origOwner:null;for(const p of G.players){qInit(p);perkInit(p);}MODS.clear();}
function chainDef(p){return QUEST_CHAINS[p.f.story]||QUEST_CHAINS[p.f.id]||QUEST_CHAINS.generic;}
function countMonsters(){let n=0;for(const k in G.armies)if(G.armies[k].owner===-1)n++;return n;}

function landTotal(){if(G._landN)return G._landN;let n=0;for(let i=0;i<N;i++)if(!isWater(i))n++;G._landN=n;return n;}
function qstat(p,type,arg){switch(type){
  case 'cities':return citiesOf(p.id).length;
  case 'pop':return citiesOf(p.id).reduce((s,c)=>s+c.pop,0);
  case 'techs':return Object.keys(p.techs).length;
  case 'build':return citiesOf(p.id).filter(c=>c.buildings.includes(arg)).length;
  case 'buildany':return citiesOf(p.id).reduce((s,c)=>s+c.buildings.length,0);
  case 'kills':return p.stats.kills;case 'monsters':return p.stats.mkills;case 'ruins':return p.stats.ruins;case 'lairs':return p.stats.lairs;
  case 'capture':return p.stats.captured;case 'gold':return p.gold;
  case 'terrain':{let n=0;for(let i=0;i<N;i++){if(ownerOf[i]!==p.id)continue;const t=G.ter[i];
    if(arg==='forest'?t==='forest':arg==='mounthill'?(t==='mount'||t==='hills'):TERRAIN[t].water)n++;}return n;}
  case 'fullarmies':{const cap=armyCap(p);return armiesOf(p.id).filter(a=>a.units.length>=cap&&!hasSettler(a)).length;}
  case 'explore':{let n=0;for(let i=0;i<N;i++)if(p.explored[i]&&!isWater(i))n++;return Math.floor(n*100/landTotal());}
  }return 0;}
function goalProgress(p,q){const g=q.goal;
  if(g.type==='visit')return {cur:q.visited?1:0,need:1};
  if(g.type==='killarmy')return {cur:G.armies[q.target]?0:1,need:1};
  let v=qstat(p,g.type,g.arg);if(g.delta)v-=q.base;return {cur:Math.max(0,v),need:g.n};}
function goalDone(p,q){const pr=goalProgress(p,q);return pr.cur>=pr.need;}
const TERR_NAMES={forest:'лесных клеток',mounthill:'клеток гор и холмов',water:'водных клеток'};
function goalText(g){switch(g.type){
  case 'cities':return `Городов: ${g.n}`;case 'pop':return g.delta?`Прирост населения: ${g.n}`:`Население державы: ${g.n}`;case 'techs':return `Изучено технологий: ${g.n}`;
  case 'build':return `«${BUILDINGS[g.arg].name}» в городах: ${g.n}`;case 'buildany':return `Новых построек: ${g.n}`;
  case 'kills':return `Уничтожено вражеских отрядов: ${g.n}`;case 'monsters':return `Уничтожено отрядов чудовищ: ${g.n}`;
  case 'ruins':return `Исследовано руин: ${g.n}`;case 'lairs':return `Разорено логов: ${g.n}`;case 'capture':return `Захвачено городов: ${g.n}`;
  case 'gold':return g.delta?`Прибавить к казне: ${g.n} золота`:`Золота в казне: ${g.n}`;case 'terrain':return `В ваших землях ${TERR_NAMES[g.arg]}: ${g.n}`;
  case 'fullarmies':return `Полных армий: ${g.n}`;case 'explore':return `Исследовать суши: +${g.n}%`;
  case 'visit':return 'Привести армию к отмеченному месту «!»';case 'killarmy':return 'Разбить отряд атамана';}return '';}

/* ---------- места на карте ---------- */
function questCapital(p){return citiesOf(p.id).find(c=>c.capital)||citiesOf(p.id)[0];}
function makeSite(p,spec,tag){spec=spec||{};const cap=questCapital(p);if(!cap)return -1;const cands=[];
  for(let i=0;i<N;i++){const ter=G.ter[i];const T=TERRAIN[ter];
    if(spec.water&&p.f.mech==='tide'){if(ter!=='coast')continue;}else if(T.water||ter==='mount')continue;
    if(cityAt(i)||armyAt(i)||G.qsites[i]||G.ruins[i]||G.lairs.includes(i))continue;const o=ownerOf[i];if(o>=0&&o!==p.id)continue;
    const d=hexDist(cap.idx,i);if(d<(spec.min||6)||d>(spec.max||14))continue;
    let sc=-Math.abs(d-9)+R()*4;if(spec.terrain&&spec.terrain.includes(ter))sc+=5;if(o<0)sc+=2;cands.push({i,sc});}
  cands.sort((a,b)=>b.sc-a.sc);
  for(const c of cands.slice(0,14)){if(!findPath(p.id,cap.idx,c.i))continue;
    G.qsites[c.i]={pid:p.id,tag,name:spec.name||'Место силы'};
    if(spec.guard){const n=spec.guard+(G.turn>60?1:0)+(G.turn>110?1:0);const a=spawnMonsters(c.i,n,null,spec.kinds);a.home=c.i;a.guard=1;}
    reveal(p,c.i,1);return c.i;}
  return -1;}
function clearSite(i){if(i>=0&&G.qsites[i])delete G.qsites[i];}
function onQuestSite(a,j){const s=G.qsites[j];if(!s||s.pid!==a.owner)return;const p=P(a.owner);delete G.qsites[j];
  const q=p.quests;if(q.chain&&q.chain.site===j)q.chain.visited=true;if(q.side&&q.side.site===j)q.side.visited=true;
  msg(`Армия достигла места «${s.name}».`,'good',j,p.id);}

/* ---------- награды ---------- */
function giveUnits(p,t,n,vet){const cap=questCapital(p);if(!cap){p.gold+=20*n;return;}
  for(let k=0;k<n;k++){const u=mkUnit(p,t,vet);const g=armyAt(cap.idx);
    if(g&&g.owner===p.id&&g.units.length<armyCap(p)&&!hasSettler(g)){g.units.push(u);g.mpMax=armyMpMax(g);continue;}
    if(!g){newArmy(p.id,cap.idx,[u]);continue;}
    const j=freeNeighbor(p.id,cap.idx);if(j>=0)newArmy(p.id,j,[u]);else p.gold+=20;}}
function revealRandom(p){const cand=[];for(let i=0;i<N;i++)if(!p.explored[i]&&!isWater(i))cand.push(i);for(let k=0;k<2&&cand.length;k++)reveal(p,pickR(cand),4);}
function applyReward(p,r){if(!r)return null;
  if(r.chance!=null){const win=R()<r.chance;applyReward(p,win?r.win:r.lose);return win?'win':'lose';}
  if(r.gold)p.gold=Math.max(0,p.gold+r.gold);if(r.sci)p.sciPool+=r.sci;
  if(r.mods){for(const k in r.mods)p.qmods[k]=(p.qmods[k]||0)+r.mods[k];MODS.delete(p.id);}
  if(r.unit){const t=r.unit==='best'?((aiBestUnit(p,'melee')||{id:'militia'}).id):r.unit;giveUnits(p,t,r.n||1,r.vet);}
  if(r.hero)giveUnits(p,r.hero,1,true);
  const cs=citiesOf(p.id);const cap=questCapital(p);
  if(r.pop==='cap'&&cap)cap.pop++;else if(r.pop==='all')cs.forEach(c=>c.pop++);
  else if(r.pop==='big-'){const b=cs.slice().sort((x,y)=>y.pop-x.pop)[0];if(b&&b.pop>1)b.pop--;}
  else if(r.pop==='worst-'){const b=cs.slice().sort((x,y)=>(y.apSt||0)-(x.apSt||0)||y.pop-x.pop)[0];if(b&&b.pop>1)b.pop--;}
  if(r.apbuff){p.apBuff=(p.apBuff||[]).filter(x=>x.until>=G.turn);p.apBuff.push({v:r.apbuff.v,until:G.turn+r.apbuff.t});}
  if(r.food)cs.forEach(c=>c.food+=r.food);if(r.prod&&cap)cap.prog+=r.prod;
  if(r.xp)for(const a of armiesOf(p.id))for(const u of a.units)u.xp=(u.xp||0)+r.xp;
  if(r.reveal)revealRandom(p);if(r.disband)disbandWeakest(p);
  return null;}
const MOD_NAMES={atk:'к атаке',def:'к защите',prod:'производства',sci:'науки',gold:'золота',growth:'к росту'};
function rewardText(r,p){if(!r)return '';if(r.chance!=null)return `${Math.round(r.chance*100)}%: ${rewardText(r.win,p)||'ничего'}${r.lose&&Object.keys(r.lose).length?`, иначе: ${rewardText(r.lose,p)}`:', иначе ничего'}`;
  const o=[];if(r.gold)o.push(`${r.gold>0?'+':'−'}${Math.abs(r.gold)} золота`);if(r.sci)o.push(`+${r.sci} науки`);
  if(r.mods)for(const k in r.mods)o.push(`+${Math.round(r.mods[k]*100)}% ${MOD_NAMES[k]} навсегда`);
  if(r.unit){const nm=r.unit==='best'?'лучших бойцов':udef(p,r.unit).name;o.push(`${r.n||1} × ${nm}`);}
  if(r.hero)o.push(`герой: ${HEROES[r.hero].name} (атк ${HEROES[r.hero].atk}, защ ${HEROES[r.hero].def})`);
  if(r.pop==='cap')o.push('+1 житель в столице');if(r.pop==='all')o.push('+1 житель в каждом городе');if(r.pop==='big-')o.push('−1 житель в крупнейшем городе');if(r.pop==='worst-')o.push('−1 житель в бунтующем городе');if(r.apbuff)o.push(`+${r.apbuff.v}% одобрения во всех городах на ${r.apbuff.t} ${plural(r.apbuff.t,'ход','хода','ходов')}`);
  if(r.food)o.push(`+${r.food} к росту каждого города`);if(r.prod)o.push(`+${r.prod} производства в столице`);if(r.xp)o.push(`+${r.xp} опыта всем отрядам`);
  if(r.reveal)o.push('открывает часть карты');if(r.disband)o.push('распущен один отряд');return o.join(', ');}
function choiceOk(p,ch){if((ch.r||{}).pop==='worst-'&&!citiesOf(p.id).some(c=>c.apSt>=3&&c.pop>1))return false;const r=ch.r||{};if(r.gold<0&&p.gold<-r.gold)return false;return true;}

/* ---------- сюжетная цепочка ---------- */
function startChapter(p,i){const ch=chainDef(p).ch[i];const c={i,state:'active',base:0,visited:false,site:-1,goal:Object.assign({},ch.goal),started:G.turn};
  if(c.goal.delta)c.base=qstat(p,c.goal.type,c.goal.arg);
  if(c.goal.type==='visit'){const s=makeSite(p,ch.site,'chain');if(s<0){c.goal={type:'monsters',n:2,delta:1};c.base=qstat(p,'monsters');}else c.site=s;}
  p.quests.chain=c;
  if(p.human&&G._popups)G._popups.push({type:'qinfo',title:`${chainDef(p).title}. Глава ${i+1}: ${ch.title}`,text:ch.intro,goal:goalText(c.goal),site:c.site});}
function chainComplete(p){const q=p.quests;const c=q.chain;c.state='reward';clearSite(c.site);
  if(p.human){if(!q.pend.some(x=>x.kind==='reward'))q.pend.push({kind:'reward'});msg(`Глава «${chainDef(p).ch[c.i].title}» завершена. Выберите награду.`,'good');}
  else{const ch=chainDef(p).ch[c.i];applyReward(p,pickR(ch.choices).r);advanceChain(p);}}
function claimChainReward(p,k){const q=p.quests;const c=q.chain;if(!c||c.state!=='reward')return;const ch=chainDef(p).ch[c.i];
  applyReward(p,ch.choices[k].r);q.done.push({t:G.turn,title:ch.title,choice:ch.choices[k].label});q.pend=q.pend.filter(x=>x.kind!=='reward');advanceChain(p);}
function advanceChain(p){const q=p.quests;const c=q.chain;const def=chainDef(p);awardPerk(p,`глава «${def.ch[c.i].title}» завершена`);
  if(c.i+1<def.ch.length)startChapter(p,c.i+1);
  else{c.state='done';if(p.human)msg(`Сюжет «${def.title}» завершён.`,'good');else if(knowsOf(p.id))msg(`Фракция «${p.f.name}» завершила свой сюжет «${def.title}».`,'info');}}

/* ---------- поручения ---------- */
function offerSide(p){const q=p.quests;const list=SIDE_QUESTS.filter(t=>(!t.cond||t.cond(p))&&t.id!==q.lastSide);q.nextSide=G.turn+ri(13,19);if(!list.length)return;
  const t=pickR(list);const inst={id:t.id,title:t.title,text:t.text,goal:Object.assign({},t.goal),turns:t.turns,reward:t.reward,fail:t.fail||null,site:-1,target:null,visited:false,base:0,until:0};
  if(p.human)q.pend.push({kind:'offer',inst});else acceptSide(p,inst);}
function acceptSide(p,inst){const q=p.quests;const t=SIDE_QUESTS.find(x=>x.id===inst.id);
  if(inst.goal.delta)inst.base=qstat(p,inst.goal.type,inst.goal.arg);inst.until=G.turn+inst.turns;
  if(inst.goal.type==='visit'){const s=makeSite(p,t.site,'side');if(s<0)return false;inst.site=s;}
  if(t.spawn==='bandits'){const j=banditSpot(p);if(j<0)return false;const a=spawnMonsters(j,2+(G.turn>50?1:0),null,['bandits']);a.home=j;a.boss=1;inst.target=a.id;inst.site=j;reveal(p,j,1);}
  q.side=inst;q.lastSide=inst.id;return true;}
function banditSpot(p){const cs=citiesOf(p.id);const cand=[];for(const c of cs)for(const j of inRadius(c.idx,4)){const d=hexDist(c.idx,j);if(d<2)continue;
  if(isWater(j)||G.ter[j]==='mount'||armyAt(j)||cityAt(j))continue;const o=ownerOf[j];if(o>=0&&o!==p.id)continue;cand.push(j);}return cand.length?pickR(cand):-1;}
function sideComplete(p){const q=p.quests;const s=q.side;applyReward(p,s.reward);perkInit(p);p.sideDone++;if(p.sideDone%2===0)awardPerk(p,'выполнено ещё два поручения');clearSite(s.site);q.side=null;q.nextSide=Math.max(q.nextSide,G.turn+ri(8,14));
  if(p.human){msg(`Поручение «${s.title}» выполнено: ${rewardText(s.reward,p)}.`,'good');if(G._popups)G._popups.push({type:'qinfo',title:`Поручение выполнено: ${s.title}`,text:`Награда: ${rewardText(s.reward,p)}.`});}}
function sideFail(p){const q=p.quests;const s=q.side;if(s.fail)applyReward(p,s.fail);clearSite(s.site);q.side=null;
  if(p.human)msg(`Поручение «${s.title}» провалено${s.fail?': '+rewardText(s.fail,p):''}.`,'bad');}

/* ---------- события ---------- */
function eventCtx(p){const cs=citiesOf(p.id);const cap=questCapital(p);const big=cs.slice().sort((a,b)=>b.pop-a.pop)[0];const worst=cs.slice().sort((a,b)=>(b.apSt||0)-(a.apSt||0))[0];return {cap:cap?cap.name:'столица',big:big?big.name:'город',worst:worst?worst.name:'город'};}
function fillText(t,ctx){return t.replace(/\{(\w+)\}/g,(_,k)=>ctx[k]||'');}
function fireEvent(p){const q=p.quests;q.nextEvent=G.turn+ri(9,15);const list=EVENTS.filter(e=>!e.cond||e.cond(p));if(!list.length||!citiesOf(p.id).length)return;
  const e=pickR(list);if(p.human){q.pend.push({kind:'event',id:e.id,ctx:eventCtx(p)});return;}
  const ok=e.choices.filter(ch=>choiceOk(p,ch));applyReward(p,pickR(ok.length?ok:[{r:{}}]).r);}
function resolveEvent(p,item,k){const e=EVENTS.find(x=>x.id===item.id);const ch=e.choices[k];if(!choiceOk(p,ch))return null;
  const res=applyReward(p,ch.r);p.quests.pend=p.quests.pend.filter(x=>x!==item);return res;}

/* ---------- ход ---------- */
function questCheck(p){const q=p.quests;if(!q)return;
  if(q.chain&&q.chain.state==='active'&&goalDone(p,q.chain))chainComplete(p);
  if(q.side&&goalDone(p,q.side))sideComplete(p);}
function questTick(p){qInit(p);const q=p.quests;if(!citiesOf(p.id).length)return;
  if(!q.chain)startChapter(p,0);
  questCheck(p);
  if(q.side&&G.turn>=q.side.until)sideFail(p);
  if(!q.side&&G.turn>=q.nextSide&&!q.pend.some(x=>x.kind==='offer'))offerSide(p);
  if(G.turn>=q.nextEvent&&!q.pend.some(x=>x.kind==='event'))fireEvent(p);}
function autoResolvePend(p){const q=p.quests;if(!q)return;for(const it of q.pend.slice()){
  if(it.kind==='reward')claimChainReward(p,ri(0,1));
  else if(it.kind==='offer'){q.pend=q.pend.filter(x=>x!==it);acceptSide(p,it.inst);}
  else if(it.kind==='event'){const e=EVENTS.find(x=>x.id===it.id);const ok=e.choices.map((c,k)=>k).filter(k=>choiceOk(p,e.choices[k]));resolveEvent(p,it,ok.length?pickR(ok):e.choices.length-1);}}}
function questTarget(p){const q=p.quests;if(!q)return -1;if(q.chain&&q.chain.state==='active'&&q.chain.site>=0&&!q.chain.visited)return q.chain.site;
  if(q.side&&q.side.site>=0&&!q.side.visited&&G.qsites[q.side.site])return q.side.site;if(q.side&&q.side.target&&G.armies[q.side.target])return G.armies[q.side.target].idx;return -1;}
