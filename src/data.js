'use strict';
/* =====================================================================
   ПЕПЕЛ И ЭФИР — данные игры
   ===================================================================== */
const GAME_TITLE = 'Пепел и Эфир';
const SAVE_KEY = 'pepel-efir-save-v1';
const SAVE_VERSION = 1;
const BG = '#0d0b08';

/* Местность. gl — набор символов, dn — плотность второго символа в клетке */
const TERRAIN = {
  ocean:  {name:'Океан',      water:1, f:1,p:0,g:0,s:0, gl:['≈','~',' ','≈'], dn:.30, c:'#24507f', move:1, def:0},
  coast:  {name:'Мелководье', water:1, f:2,p:0,g:1,s:0, gl:['~','-','~','≈'], dn:.40, c:'#3f8fc4', move:1, def:0},
  grass:  {name:'Луга',       f:2,p:0,g:0,s:0, gl:[',','"',"'",'.'], dn:.45, c:'#6fae47', move:1, def:0},
  plains: {name:'Равнины',    f:1,p:1,g:0,s:0, gl:['.','·',',','-'], dn:.40, c:'#bba45a', move:1, def:0},
  forest: {name:'Лес',        f:1,p:2,g:0,s:0, gl:['♣','♠','♣','↑'], dn:.80, c:'#3c9a50', move:2, def:.25},
  hills:  {name:'Холмы',      f:0,p:2,g:0,s:0, gl:['∩','n','∩'],     dn:.60, c:'#b48552', move:2, def:.35, vis:1},
  mount:  {name:'Горы',       f:0,p:1,g:1,s:0, gl:['▲','^','▲'],     dn:.70, c:'#cfcfcf', move:3, def:.50, vis:2},
  desert: {name:'Пустыня',    f:0,p:1,g:1,s:0, gl:['∴',':','·','.'], dn:.50, c:'#d9b56e', move:1, def:-.10},
  tundra: {name:'Тундра',     f:1,p:1,g:0,s:0, gl:['·',"'",'˙','.'], dn:.40, c:'#9fb4c0', move:1, def:0},
  swamp:  {name:'Болото',     f:1,p:0,g:0,s:1, gl:['¨','"',';',','], dn:.60, c:'#8a9a48', move:2, def:-.10},
};

/* Ресурсы на клетках (рисуются звёздочкой своего цвета) */
const RES = {
  wheat:  {name:'Пшеница',      f:2,        c:'#f2d04b', on:['grass','plains'], w:1},
  game:   {name:'Дичь',         f:1, p:1,   c:'#d39b5f', on:['forest','tundra'], w:1},
  iron:   {name:'Железо',       p:2,        c:'#9fb7d6', on:['hills','plains','tundra'], w:1},
  goldr:  {name:'Золотая жила', g:3,        c:'#ffcf3f', on:['hills','desert','mount'], w:.8},
  aether: {name:'Эфирит',       s:2, g:1,   c:'#d27bff', on:['swamp','mount','desert','forest','tundra','grass'], w:.35},
  fish:   {name:'Рыба',         f:2,        c:'#7fe0e0', on:['coast'], w:1},
};

/* Базовые отряды. Уникальный отряд фракции хранится в faction.uu и имеет тип 'uu' */
const UNITS = {
  militia:  {name:'Ополчение',   atk:3,  def:3, hp:10, mv:2, cost:18},
  scout:    {name:'Разведчики',  atk:1,  def:2, hp:8,  mv:4, cost:14, vis:1, scout:1},
  settler:  {name:'Поселенцы',   atk:0,  def:1, hp:8,  mv:2, cost:40, civ:1, settler:1},
  archer:   {name:'Лучники',     atk:5,  def:3, hp:10, mv:2, cost:28, ranged:1, tech:'archery'},
  spear:    {name:'Копейщики',   atk:4,  def:6, hp:14, mv:2, cost:28, antiCav:1, tech:'bronze'},
  sword:    {name:'Мечники',     atk:7,  def:5, hp:14, mv:2, cost:38, tech:'iron'},
  horse:    {name:'Всадники',    atk:6,  def:3, hp:12, mv:4, cost:40, cav:1, tech:'horse'},
  catapult: {name:'Катапульта',  atk:8,  def:2, hp:8,  mv:1, cost:45, ranged:1, siege:1, tech:'math'},
  knight:   {name:'Рыцари',      atk:10, def:7, hp:18, mv:3, cost:65, cav:1, tech:'steel'},
  mage:     {name:'Боевые маги', atk:10, def:4, hp:12, mv:2, cost:60, ranged:1, tech:'aether'},
  golem:    {name:'Рунные големы', atk:12, def:13, hp:24, mv:2, cost:85, tech:'runes'},
  griffin:  {name:'Грифоны',     atk:13, def:6, hp:16, mv:5, cost:80, cav:1, tech:'skyships'},
};
/* Герои — только награды за квесты */
const HEROES = {
  legate:    {name:'Легат Последнего Орла', atk:14, def:12, hp:30, mv:3, hero:1},
  treeguard: {name:'Страж Мирового Древа',  atk:10, def:16, hp:40, mv:2, hero:1, regen:4},
  runelord:  {name:'Рунный тан',            atk:13, def:15, hp:32, mv:2, hero:1, antiCav:1},
  lich:      {name:'Лич-владыка',           atk:15, def:9,  hp:26, mv:2, hero:1, ranged:1, regen:3},
  leviathan: {name:'Левиафан',              atk:15, def:12, hp:34, mv:3, hero:1},
  goldguard: {name:'Золотая гвардия',       atk:12, def:12, hp:28, mv:3, hero:1},
};
/* Опыт: пороги рангов и бонус +10% к атаке и защите за ранг */
const XP_LEVELS = [0,3,7,12,18];
const RANKS = ['Новобранцы','Опытные','Ветераны','Элита','Легенда'];
/* Трофеи: доля стоимости уничтоженных отрядов; добыча при захвате города */
const TROPHY = {gold:.25, sci:.15, plunderPop:15, plunderSci:10, plunderTreasury:.2};
const UNIT_TAGS = {hero:'герой', ranged:'стрелки', cav:'конница', antiCav:'против конницы', siege:'осада', scout:'разведка', civ:'мирные', regen:'регенерация'};

/* Монстры — нейтральные обитатели мира */
const MONSTERS = {
  wolves:  {name:'Волки',       atk:4, def:2, hp:9,  mv:3},
  bandits: {name:'Разбойники',  atk:4, def:4, hp:11, mv:2},
  troll:   {name:'Тролль',      atk:8, def:6, hp:22, mv:2},
  harpy:   {name:'Гарпии',      atk:5, def:3, hp:9,  mv:3, ranged:1},
  wraith:  {name:'Призраки',    atk:6, def:5, hp:12, mv:2},
  rebels:  {name:'Мятежники',   atk:5, def:4, hp:12, mv:2},
};
const MONSTER_BY_TER = {forest:['wolves','wolves','wraith'], hills:['troll','harpy','bandits'], mount:['troll','harpy'],
  desert:['bandits','bandits','harpy'], swamp:['wraith','wraith','troll'], tundra:['wolves','troll'], plains:['bandits','wolves'], grass:['bandits','wolves']};

/* Постройки */
const BUILDINGS = {
  granary:    {name:'Амбар',       cost:40, tech:'agri',        f:3,            desc:'+3 еды'},
  workshop:   {name:'Мастерская',  cost:50, tech:'crafts',      p:2, pp:.10,    desc:'+2 произв., +10% произв.'},
  library:    {name:'Библиотека',  cost:50, tech:'writing',     s:3, sp:.15,    desc:'+3 науки, +15% науки'},
  walls:      {name:'Стены',       cost:50, tech:'masonry',     walls:1,        desc:'+25 прочности, город сильнее в обороне'},
  market:     {name:'Рынок',       cost:60, tech:'trade',       g:3, gp:.15,    desc:'+3 золота, +15% золота'},
  barracks:   {name:'Казармы',     cost:45, tech:'warfare',     vet:1,          desc:'Новые отряды получают +3 опыта (ранг «Опытные»)'},
  aqueduct:   {name:'Акведук',     cost:75, tech:'engineering', f:2, growthP:.25, desc:'+2 еды, +25% к росту'},
  university: {name:'Академия',    cost:95, tech:'alchemy',     s:4, sp:.25,    desc:'+4 науки, +25% науки'},
  bank:       {name:'Банк',        cost:95, tech:'banking',     g:4, gp:.20,    desc:'+4 золота, +20% золота'},
  forge:      {name:'Кузня',       cost:85, tech:'steel',       p:3, pp:.15,    desc:'+3 произв., +15% произв.'},
  observatory:{name:'Обсерватория',cost:120,tech:'astronomy',   s:5, sp:.25,    desc:'+5 науки, +25% науки'},
  temple:     {name:'Храм',        cost:40, tech:null,          appr:12,        desc:'+12% одобрения'},
  arena:      {name:'Амфитеатр',   cost:70, tech:'trade',       appr:15, g:1,   desc:'+15% одобрения, +1 золота'},
  court:      {name:'Суд',         cost:90, tech:'banking',     appr:5, adminHalf:1, desc:'+5% одобрения, штраф за число городов здесь вдвое меньше'},
  infirmary:  {name:'Лечебница',   cost:100,tech:'medicine',    f:3, growthP:.20, heal:1, desc:'+3 еды, +20% к росту, армии в регионе лечатся быстрее'},
};
/* Врата Эфира — проект научной победы, три этапа в одном городе */
const PROJECTS = {
  gate1: {name:'Врата Эфира · фундамент',   cost:380, stage:1, desc:'Этап 1 из 3. Каменное кольцо на линиях силы.'},
  gate2: {name:'Врата Эфира · резонатор',   cost:460, stage:2, desc:'Этап 2 из 3. Кристаллы настраиваются на поток Эфира.'},
  gate3: {name:'Врата Эфира · пробуждение', cost:540, stage:3, desc:'Этап 3 из 3. Врата открываются — научная победа.'},
};
const GATE_SCI_SHARE = .2; // доля науки державы, которая идёт в строительство Врат

/* Эпохи и технологии */
const ERAS = [
  {name:'Эпоха Пепла', cost:22},
  {name:'Эпоха Огня',  cost:72},
  {name:'Эпоха Эфира', cost:200},
  {name:'Эпоха Вознесения', cost:820},
];
const ERA_REQS = [0,3,4,5]; // сколько технологий прошлой эпохи нужно для перехода
const TECHS = {
  agri:        {name:'Земледелие',        era:0},
  archery:     {name:'Стрельба из лука',  era:0},
  bronze:      {name:'Обработка бронзы',  era:0},
  masonry:     {name:'Каменное дело',     era:0},
  writing:     {name:'Письменность',      era:0},
  crafts:      {name:'Ремёсла',           era:0},
  trade:       {name:'Торговля',          era:1},
  horse:       {name:'Верховая езда',     era:1},
  iron:        {name:'Железное литьё',    era:1},
  warfare:     {name:'Военное дело',      era:1, cap:1, effect:'В армии +1 место; опыт в бою ×1,5'},
  math:        {name:'Математика',        era:1, effect:'Осадные лагеря: стены осаждённых городов слабеют в 1,5 раза быстрее'},
  sailing:     {name:'Мореходство',       era:1, effect:'Армии могут ходить по воде'},
  steel:       {name:'Сталь',             era:2},
  alchemy:     {name:'Алхимия',           era:2},
  banking:     {name:'Банковое дело',     era:2},
  engineering: {name:'Инженерия',         era:2, effect:'Города прочнее: +15 к стенам'},
  tactics:     {name:'Тактика',           era:2, cap:1, effect:'В армии +1 место; новые отряды сразу «Опытные»'},
  aether:      {name:'Эфирная магия',     era:2},
  astronomy:   {name:'Астрономия',        era:3},
  medicine:    {name:'Врачевание',        era:3},
  runes:       {name:'Рунная ковка',      era:3, effect:'Открывает высший ранг отрядов «Легенда»'},
  skyships:    {name:'Воздухоплавание',   era:3},
  aethertheory:{name:'Теория Эфира',      era:3, final:1, effect:'Можно строить Врата Эфира (научная победа)'},
};
const FINAL_REQ = 4; // сколько других технологий Эпохи Вознесения нужно для Теории Эфира
const MIL_TECHS = new Set(['archery','bronze','horse','iron','warfare','math','steel','tactics','aether','runes','skyships']);

/* Черты фракций (для редактора: положительные стоят очков, отрицательные дают) */
const TRAITS = {
  martial:     {name:'Воинственные', cost:2,  atk:.10,    desc:'+10% к атаке'},
  stalwart:    {name:'Стойкие',      cost:2,  def:.10,    desc:'+10% к защите'},
  industrious: {name:'Трудолюбивые', cost:2,  prod:.10,   desc:'+10% производства'},
  fertile:     {name:'Плодовитые',   cost:2,  growth:.15, desc:'+15% к росту городов'},
  wise:        {name:'Мудрые',       cost:2,  sci:.10,    desc:'+10% науки'},
  traders:     {name:'Торговцы',     cost:1,  gold:.15,   desc:'+15% золота'},
  swift:       {name:'Быстрые',      cost:3,  mv:1,       desc:'+1 к движению армий'},
  keen:        {name:'Зоркие',       cost:1,  vis:1,      desc:'+1 к обзору'},
  slowminds:   {name:'Неучи',        cost:-1, sci:-.10,   desc:'−10% науки'},
  wasteful:    {name:'Расточительные',cost:-1, gold:-.15, desc:'−15% золота'},
  frail:       {name:'Хрупкие',      cost:-2, def:-.10,   desc:'−10% к защите'},
  barren:      {name:'Малоплодные',  cost:-1, growth:-.15,desc:'−15% к росту городов'},
  meek:        {name:'Миролюбивые',  cost:-2, atk:-.10,   desc:'−10% к атаке'},
  content:     {name:'Покладистые',  cost:2,  appr:10,    desc:'+10% одобрения во всех городах'},
  restless:    {name:'Своевольные',  cost:-1, appr:-10,   desc:'−10% одобрения во всех городах'},
};

/* Уникальные механики */
const MECHS = {
  discipline: {name:'Дисциплина',     desc:'Армии в полном составе получают +20% к атаке и защите. Гарнизон в городе даёт вдвое больше одобрения.'},
  forest:     {name:'Сердце леса',    desc:'Леса дают +1 еды и +0,5 науки. По лесу армии ходят как по равнине и получают там +25% к защите.'},
  mountain:   {name:'Горные тропы',   desc:'Армии ходят по горам. Горы можно обрабатывать (+2 произв.), холмы дают +1 произв.'},
  undead:     {name:'Жатва душ',      desc:'Население не ест. Город растёт на 2 в ход, каждый убитый враг даёт +6 к росту ближайшего города. Половина еды с клеток идёт в производство. Мертвецы не ропщут: штраф за тесноту вдвое меньше.'},
  tide:       {name:'Дети моря',      desc:'Армии ходят по воде с первого хода без штрафов. Водные клетки дают +1 еды и +1 золота.'},
  coin:       {name:'Всё продаётся',  desc:'Свободный регион у границы можно выкупить золотом, и там сразу появится город. Покупка за золото на 25% дешевле. Каждый вид ресурса даёт +4% одобрения вместо +2,5%.'},
};

/* Готовые фракции */
const PRESETS = [
  {id:'legion', name:'Железный Легион', symbol:'Λ', color:'#ff5a4f', mech:'discipline',
   traits:['martial','industrious'],
   lore:'Последние центурии рухнувшей Империи. Столицы давно нет, но они всё ещё маршируют строем и строят дороги в никуда.',
   uu:{name:'Легионеры', atk:7, def:7, hp:16, mv:2, cost:40, tech:'bronze'},
   ub:{name:'Плац', cost:40, tech:null, p:1, vet:1, desc:'+1 произв., новые отряды получают +3 опыта'},
   cities:['Аквилон','Кастра','Ферратум','Новый Форум','Виктрикс','Децима','Галея','Тривий','Мурус','Сигнифер','Претория','Колона'],
   ai:{agg:.75, exp:.55, sci:.35, build:.5}},
  {id:'grove', name:'Хранители Рощ', symbol:'Ψ', color:'#62e07c', mech:'forest',
   traits:['content','fertile','keen','meek'],
   lore:'Друиды, которые слышат корни. Для них каждый лес одновременно библиотека и крепость.',
   uu:{name:'Древни', atk:5, def:9, hp:22, mv:2, cost:46, tech:'agri', regen:3},
   ub:{name:'Священная роща', cost:45, tech:null, f:2, s:2, desc:'+2 еды, +2 науки'},
   cities:['Ильвен','Листопад','Корнеград','Мшистый Дол','Тисовый Круг','Омела','Ясеневая Тень','Зелёный Шёпот','Дубрава','Вереск'],
   ai:{agg:.30, exp:.60, sci:.80, build:.70}},
  {id:'forge', name:'Подгорные Кузнецы', symbol:'Ж', color:'#ff9f2e', mech:'mountain',
   traits:['industrious','stalwart'],
   lore:'Кланы, вырубившие города в теле гор. Их тропы идут там, где другие видят только камень.',
   uu:{name:'Хирдманы', atk:6, def:8, hp:16, mv:2, cost:36, tech:'bronze', antiCav:1},
   ub:{name:'Глубинная кузня', cost:50, tech:null, p:4, desc:'+4 произв.'},
   cities:['Карак-Дум','Наковальня','Глубь','Железный Зуб','Горн','Каменный Чертог','Рудня','Молотов Пик','Сумрачный Штрек','Кремень'],
   ai:{agg:.50, exp:.45, sci:.40, build:.80}},
  {id:'necro', name:'Некрополь', symbol:'Ø', color:'#b98cff', mech:'undead',
   traits:['martial','stalwart','wasteful'],
   lore:'Город, который отказался умирать. Его жители не едят и не спят: они ждут новых душ.',
   uu:{name:'Костяная орда', atk:4, def:3, hp:11, mv:2, cost:16, tech:null},
   ub:{name:'Склеп', cost:40, tech:null, s:1, growthFlat:3, desc:'+3 к росту в ход, +1 науки'},
   cities:['Нагльфар','Тлен','Курган','Шепчущий Склеп','Пепельный Двор','Костница','Безмолвие','Вечная Ночь','Саван','Мглистый Предел'],
   ai:{agg:.80, exp:.50, sci:.40, build:.40}},
  {id:'tide', name:'Дети Прилива', symbol:'§', color:'#3fd0ff', mech:'tide',
   traits:['traders','keen','swift','frail'],
   lore:'Народ отмелей и рифов. Для них море не граница, а самая короткая дорога.',
   uu:{name:'Наги-гарпунщики', atk:6, def:4, hp:12, mv:3, cost:32, tech:'archery', ranged:1},
   ub:{name:'Жемчужный порт', cost:45, tech:null, g:3, f:1, desc:'+3 золота, +1 еды'},
   cities:['Перламутр','Солёный Венец','Коралл','Отмель','Пенная Гавань','Риф Сирен','Глубоководье','Бриз','Лагуна','Волнорез'],
   ai:{agg:.45, exp:.70, sci:.50, build:.60}},
  {id:'guild', name:'Гильдия Монет', symbol:'$', color:'#ffe14a', mech:'coin',
   traits:['traders','wise','keen','frail'],
   lore:'Торговые дома, для которых у всего есть цена. Особенно у земли.',
   uu:{name:'Наёмники', atk:6, def:5, hp:13, mv:3, cost:34, tech:null},
   ub:{name:'Банкирский дом', cost:50, tech:null, g:4, desc:'+4 золота'},
   cities:['Златоград','Векселия','Меняла','Каравансарай','Аукцион','Монетный Двор','Ростовщик','Ярмарка','Торжок','Залог'],
   ai:{agg:.35, exp:.80, sci:.50, build:.60}},
];

const MAP_SIZES = {
  small:  {name:'Малая',   dims:[44,28], players:3},
  medium: {name:'Средняя', dims:[58,36], players:5},
  large:  {name:'Большая', dims:[74,46], players:6},
};
const DIFFS = [
  {name:'Лёгкая',   mul:.80, agg:.6},
  {name:'Обычная',  mul:1.0, agg:.85},
  {name:'Сложная',  mul:1.2, agg:1.0},
  {name:'Безумная', mul:1.4, agg:1.15},
];
const FOCUS = {
  bal:  {name:'Баланс',   w:[1.5,1.4,.9,1.0]},
  food: {name:'Еда',      w:[3,1,.6,.6]},
  prod: {name:'Произв.',  w:[1,3,.6,.6]},
  gold: {name:'Золото',   w:[1,1,3,.8]},
  sci:  {name:'Наука',    w:[1,1,.8,3]},
};

const RN_A = ['Ар','Бер','Вал','Гар','Дор','Ел','Жар','Зел','Ир','Кар','Лан','Мор','Нар','Ор','Пер','Рав','Сел','Тар','Ур','Фел','Хар','Чар','Шер','Эл','Яр','Аль','Бран','Вер','Глен','Дун','Кель','Мир','Ост','Рун','Сар','Тир','Ульф','Хель','Вин','Тал'];
const RN_B = ['а','е','и','о','ан','ен','ил','ор','ар','ун','','',''];
const RN_C = ['ния','дол','гард','мор','вель','тан','ск','лес','рия','вал','мир','дар','хольм','фьорд','поле','кряж','топь','брег','лог','степь','ведь','град'];

/* ---------- редактор фракций: справочники ---------- */
const ED_BUDGET = 5, ED_MAX_TRAITS = 5, UU_BUDGET = 4;
const TRAIT_CONFLICTS = [['martial','meek'],['stalwart','frail'],['wise','slowminds'],['traders','wasteful'],['fertile','barren'],['content','restless']];
const ED_SYMBOLS = ['Λ','Ψ','Ж','Ø','§','$','Δ','Σ','Φ','Θ','Ξ','†','‡','¥','€','Я','Ю','Щ','¤','@','#','%','λ','ψ','Þ','Ħ','₽','ß'];
const ED_FORBIDDEN = '&ΠΩ!*♜⌂•×.,"\'~≈^▲♣♠↑∩n:∴·¨;-˙ ';
const ED_COLORS = ['#ff5a4f','#62e07c','#ff9f2e','#b98cff','#3fd0ff','#ffe14a','#ff7ad9','#7dffd8','#e8e8e8','#9db7ff','#d4ff5a','#ffb3a3'];
const UU_BASES = {
  infantry:{name:'Пехота',    atk:6,def:6,hp:14,mv:2,tech:'bronze', tags:{}},
  ranged:  {name:'Стрелки',   atk:6,def:3,hp:11,mv:2,tech:'archery',tags:{ranged:1}},
  cavalry: {name:'Конница',   atk:7,def:4,hp:13,mv:4,tech:'horse',  tags:{cav:1}},
  guard:   {name:'Защитники', atk:4,def:8,hp:16,mv:2,tech:'bronze', tags:{antiCav:1}},
  siege:   {name:'Осадные',   atk:9,def:2,hp:9, mv:1,tech:'math',   tags:{ranged:1,siege:1}},
};
const UU_UPS = [
  {k:'atk',  label:'+1 к атаке',      c:1, max:3},
  {k:'def',  label:'+1 к защите',     c:1, max:3},
  {k:'hp',   label:'+3 здоровья',     c:1, max:3},
  {k:'mv',   label:'+1 к движению',   c:2, max:1},
  {k:'regen',label:'Регенерация +3 в ход', c:2, max:1},
  {k:'early',label:'Доступен с начала игры, без технологии', c:2, max:1},
];
const UB_EFFECTS = [
  {k:'f',v:3,label:'+3 еды'},{k:'p',v:3,label:'+3 произв.'},{k:'g',v:4,label:'+4 золота'},{k:'s',v:3,label:'+3 науки'},
  {k:'pp',v:.15,label:'+15% произв.'},{k:'gp',v:.2,label:'+20% золота'},{k:'sp',v:.15,label:'+15% науки'},
  {k:'growthFlat',v:3,label:'+3 к росту в ход'},{k:'vet',v:1,label:'Новые отряды +3 опыта'},{k:'walls',v:1,label:'Работает как стены'},
];
const MECH_STORY = {discipline:'legion',forest:'grove',mountain:'forge',undead:'necro',tide:'tide',coin:'guild'};

/* ---------- второй эффект исследований: улучшения построек ---------- */
const BUILD_UPS = [
  {tech:'masonry',    b:'temple',     name:'Каменные храмы',          eff:{appr:4}},
  {tech:'trade',      b:'granary',    name:'Зерновые рынки',          eff:{f:1,g:1}},
  {tech:'math',       b:'workshop',   name:'Чертежи',                 eff:{p:2}},
  {tech:'sailing',    b:'market',     name:'Морская торговля',        eff:{g:2}},
  {tech:'horse',      b:'arena',      name:'Скачки',                  eff:{appr:3,g:1}},
  {tech:'alchemy',    b:'library',    name:'Алхимические трактаты',   eff:{s:2}},
  {tech:'banking',    b:'market',     name:'Векселя',                 eff:{gp:.10}},
  {tech:'engineering',b:'granary',    name:'Мельницы',                eff:{f:2}},
  {tech:'engineering',b:'walls',      name:'Бастионы',                eff:{appr:2}},
  {tech:'steel',      b:'workshop',   name:'Стальные станки',         eff:{pp:.10}},
  {tech:'aether',     b:'temple',     name:'Эфирные алтари',          eff:{appr:4,s:1}},
  {tech:'astronomy',  b:'university', name:'Звёздные карты',          eff:{s:3}},
  {tech:'medicine',   b:'aqueduct',   name:'Бани',                    eff:{growthP:.10,appr:3}},
  {tech:'runes',      b:'forge',      name:'Рунные горны',            eff:{p:3}},
  {tech:'skyships',   b:'arena',      name:'Воздушные представления', eff:{appr:4,g:2}},
  {tech:'writing',    b:'court',      name:'Своды законов',           eff:{appr:3}},
];
const EFF_NAMES = {f:['еды',''],p:['произв.',''],g:['золота',''],s:['науки',''],appr:['одобрения','%'],pp:['произв.','%'],gp:['золота','%'],sp:['науки','%'],growthP:['к росту','%'],growthFlat:['к росту в ход','']};
function effText(eff){return Object.keys(eff).filter(k=>EFF_NAMES[k]).map(k=>{const [n,u]=EFF_NAMES[k];const v=u==='%'&&eff[k]<1&&k!=='appr'?Math.round(eff[k]*100):eff[k];return `+${v}${u} ${n}`;}).join(', ');}

/* ---------- особые исследования фракций (по механике: работают и для своих фракций) ---------- */
const MECH_TECH = {
  discipline:[
    {tech:'bronze',     name:'Строевая выучка',    desc:'{uu}: +3 к здоровью',                      uu:{hp:3}},
    {tech:'writing',    name:'Военные хроники',    desc:'{ub}: +2 науки',                            ub:{s:2}},
    {tech:'iron',       name:'Сегментата',         desc:'{uu}: +1 к атаке и защите',                uu:{atk:1,def:1}},
    {tech:'warfare',    name:'Железная дисциплина',desc:'Дисциплина даёт +30% вместо +20%',          disc:.1},
    {tech:'engineering',name:'Дороги легиона',     desc:'{uu}: +1 к движению',                      uu:{mv:1}}],
  forest:[
    {tech:'agri',       name:'Глубокие корни',     desc:'{uu}: регенерация +2',                      uu:{regen:2}},
    {tech:'crafts',     name:'Саженцы',            desc:'{uu} дешевле на 20%',                       uuCost:-.2},
    {tech:'writing',    name:'Песни леса',         desc:'{ub}: +1 произв., +1 науки',                ub:{p:1,s:1}},
    {tech:'alchemy',    name:'Живая кора',         desc:'{uu}: +2 к защите, +4 к здоровью',          uu:{def:2,hp:4}},
    {tech:'medicine',   name:'Шаг древня',         desc:'{uu}: +1 к движению',                      uu:{mv:1}}],
  mountain:[
    {tech:'crafts',     name:'Горная кузня',       desc:'{ub}: +2 произв.',                          ub:{p:2}},
    {tech:'writing',    name:'Руны памяти',        desc:'Горы в ваших землях дают +1 науки',        mtnSci:1},
    {tech:'iron',       name:'Хирд',               desc:'{uu}: +1 к атаке и защите',                uu:{atk:1,def:1}},
    {tech:'steel',      name:'Закалка',            desc:'{uu}: +3 к здоровью; горы дают +1 золота',  uu:{hp:3},mtnGold:1},
    {tech:'runes',      name:'Рунная броня',       desc:'{uu}: +2 к атаке',                          uu:{atk:2}}],
  undead:[
    {tech:'bronze',     name:'Кости в строй',      desc:'{uu}: +1 к атаке и защите',                uu:{atk:1,def:1}},
    {tech:'writing',    name:'Книга мёртвых',      desc:'{ub}: +2 науки',                            ub:{s:2}},
    {tech:'alchemy',    name:'Некромантия',        desc:'Каждый убитый враг даёт +10 к росту вместо +6',soul:4},
    {tech:'tactics',    name:'Неупокоенные',       desc:'{uu}: +4 к здоровью, регенерация +1',       uu:{hp:4,regen:1}}],
  tide:[
    {tech:'archery',    name:'Костяные гарпуны',   desc:'{uu}: +1 к атаке',                          uu:{atk:1}},
    {tech:'sailing',    name:'Жемчужные фермы',    desc:'{ub}: +2 золота, +1 науки',                 ub:{g:2,s:1}},
    {tech:'tactics',    name:'Чешуйчатая броня',   desc:'{uu}: +1 к защите, +3 к здоровью',          uu:{def:1,hp:3}},
    {tech:'astronomy',  name:'Звёздные течения',   desc:'Водные клетки дают +1 науки',              waterSci:1}],
  coin:[
    {tech:'trade',      name:'Земельные векселя',  desc:'Выкуп регионов дешевле на 25%',            buyRegion:-.25},
    {tech:'warfare',    name:'Контракты',          desc:'{uu}: +1 к атаке и защите',                uu:{atk:1,def:1}},
    {tech:'banking',    name:'Банковский союз',    desc:'{ub}: +3 золота и +10% золота',             ub:{g:3,gp:.10}},
    {tech:'steel',      name:'Ветераны-наёмники',  desc:'{uu}: +3 к здоровью, новые сразу «Опытные»',uu:{hp:3},uuXp:3}],
};
const GATE_MIN_TURNS = 9; // этап Врат не может завершиться быстрее
