'use strict';
/* =====================================================================
   РЕДАКТОР ФРАКЦИЙ: модель, проверка, хранение, обмен кодом
   ===================================================================== */
const CF_KEY='pe-factions-v1';
let CUSTOM=[];
function loadCustom(){try{const s=localStorage.getItem(CF_KEY);if(s){const arr=JSON.parse(s);if(Array.isArray(arr))CUSTOM=arr.map(f=>{try{return finalizeFaction(draftFromFaction(f),f.id);}catch(_){return null;}}).filter(Boolean);}}catch(_){}}
function saveCustom(){try{localStorage.setItem(CF_KEY,JSON.stringify(CUSTOM));}catch(_){}}
function allFactions(){return PRESETS.concat(CUSTOM);}
function findFaction(id){return allFactions().find(f=>f.id===id);}

function traitPoints(list){return list.reduce((s,t)=>s+(TRAITS[t]?TRAITS[t].cost:0),0);}
function traitConflict(list,t){for(const [a,b] of TRAIT_CONFLICTS){if(t===a&&list.includes(b))return b;if(t===b&&list.includes(a))return a;}return null;}
function uuPoints(up){let s=0;for(const U of UU_UPS)s+=(up[U.k]||0)*U.c;return s;}

function buildUU(spec){const B=UU_BASES[spec.base]||UU_BASES.infantry;const up=spec.up||{};
  const u={name:(spec.name||'').trim()||'Гвардия',atk:B.atk+(up.atk||0),def:B.def+(up.def||0),hp:B.hp+3*(up.hp||0),mv:B.mv+(up.mv||0),tech:up.early?null:B.tech};
  Object.assign(u,B.tags);if(up.regen)u.regen=3;
  u.cost=Math.round((u.atk+u.def)*1.5+u.hp*.8+u.mv*3+(u.ranged?4:0)+(u.regen?5:0)+(u.siege?12:0)+(!u.tech?3:0));return u;}
function buildUB(spec){const b={name:(spec.name||'').trim()||'Святилище',cost:50,tech:null};const parts=[];
  for(const k of spec.eff||[]){const E=UB_EFFECTS.find(e=>e.k===k);if(!E)continue;b[E.k]=(b[E.k]||0)+E.v;parts.push(E.label);}b.desc=parts.join(', ');return b;}
function aiFromDraft(d){const t=d.traits;const has=x=>t.includes(x)?1:0;
  return {agg:clamp(.45+.2*has('martial')-.2*has('meek')+(d.mech==='discipline'||d.mech==='undead'?.15:0),.2,.9),
    exp:clamp(.55+.1*has('fertile')+(d.mech==='coin'?.2:0)+(d.mech==='tide'?.1:0),.3,.9),
    sci:clamp(.45+.3*has('wise')-.2*has('slowminds'),.2,.9),build:clamp(.5+.2*has('industrious')+.1*has('traders'),.3,.9)};}

function deriveUUSpec(uu){const base=uu.siege?'siege':uu.ranged?'ranged':uu.cav?'cavalry':uu.antiCav?'guard':'infantry';const B=UU_BASES[base];
  const up={atk:clamp((uu.atk||0)-B.atk,0,3),def:clamp((uu.def||0)-B.def,0,3),hp:clamp(Math.ceil(((uu.hp||0)-B.hp)/3),0,3),mv:(uu.mv||0)>B.mv?1:0,regen:uu.regen?1:0,early:uu.tech?0:1};
  for(const k of ['hp','def','atk','regen','mv','early'])while(uuPoints(up)>UU_BUDGET&&up[k]>0)up[k]--;
  return {name:uu.name||'',base,up};}
function deriveUBSpec(ub){const eff=UB_EFFECTS.filter(e=>ub[e.k]).map(e=>e.k).slice(0,2);return {name:ub.name||'',eff:eff.length?eff:['s']};}

function draftFromFaction(f){
  if(!f)return {name:'Новая фракция',symbol:ED_SYMBOLS.find(s=>!allFactions().some(x=>x.symbol===s))||'Δ',color:ED_COLORS[6],lore:'',mech:'discipline',traits:[],
    uu:{name:'Гвардия',base:'infantry',up:{atk:1,def:1,hp:1,mv:0,regen:0,early:0}},ub:{name:'Святилище',eff:['s','sp']},story:'legion',cities:''};
  const traits=(f.traits||[]).filter(t=>TRAITS[t]);
  return {name:f.name||'',symbol:f.symbol||'Δ',color:f.color||ED_COLORS[0],lore:f.lore||'',mech:MECHS[f.mech]?f.mech:'discipline',traits,
    uu:f.uuSpec?clone(f.uuSpec):deriveUUSpec(f.uu||{}),ub:f.ubSpec?clone(f.ubSpec):deriveUBSpec(f.ub||{}),
    story:QUEST_CHAINS[f.story]?f.story:(QUEST_CHAINS[f.id]?f.id:MECH_STORY[f.mech]||'generic'),cities:(f.cities||[]).join('\n')};}
function parseCities(s){const out=[];for(let x of String(s||'').split(/[\n,;]+/)){x=x.trim().slice(0,24);if(x&&!out.includes(x))out.push(x);if(out.length>=30)break;}return out;}
function validateDraft(d){const e=[];
  if(!d.name.trim())e.push('Нужно название фракции.');if(d.name.trim().length>24)e.push('Название длиннее 24 символов.');
  if([...d.symbol].length!==1||ED_FORBIDDEN.includes(d.symbol))e.push('Символ должен быть одним знаком и не совпадать со знаками карты.');
  if(!/^#[0-9a-f]{6}$/i.test(d.color))e.push('Выберите цвет.');if(!MECHS[d.mech])e.push('Выберите механику.');
  const tp=traitPoints(d.traits);if(tp>ED_BUDGET)e.push(`Черты стоят ${tp} очков, а можно не больше ${ED_BUDGET}.`);
  if(d.traits.length>ED_MAX_TRAITS)e.push(`Не больше ${ED_MAX_TRAITS} черт.`);
  for(const t of d.traits)if(traitConflict(d.traits,t))e.push(`Черта «${TRAITS[t].name}» противоречит другой выбранной черте.`);
  if(!d.uu.name.trim())e.push('Нужно название уникального отряда.');if(uuPoints(d.uu.up)>UU_BUDGET)e.push(`Улучшения отряда стоят больше ${UU_BUDGET} очков.`);
  if(!d.ub.name.trim())e.push('Нужно название уникальной постройки.');if(!d.ub.eff.length||d.ub.eff.length>2)e.push('У постройки должно быть 1–2 свойства.');
  return [...new Set(e)];}
function finalizeFaction(d,id){return {id:id||('c'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36)),custom:true,
  name:d.name.trim().slice(0,24),symbol:d.symbol,color:d.color.toLowerCase(),mech:d.mech,traits:d.traits.slice(0,ED_MAX_TRAITS),lore:String(d.lore||'').trim().slice(0,300),
  uu:buildUU(d.uu),uuSpec:clone(d.uu),ub:buildUB(d.ub),ubSpec:clone(d.ub),story:d.story,cities:parseCities(d.cities),ai:aiFromDraft(d)};}

function factionCode(f){const d=draftFromFaction(f);return 'PEF1:'+btoa(unescape(encodeURIComponent(JSON.stringify(d))));}
function factionFromCode(code){code=String(code||'').trim();if(!code.startsWith('PEF1:'))throw new Error('Код должен начинаться с PEF1:');
  let raw;try{raw=JSON.parse(decodeURIComponent(escape(atob(code.slice(5).replace(/\s+/g,'')))));}catch(_){throw new Error('код повреждён или скопирован не полностью');}
  if(!raw||typeof raw!=='object')throw new Error('код повреждён');
  const d=draftFromFaction({name:raw.name,symbol:raw.symbol,color:raw.color,lore:raw.lore,mech:raw.mech,traits:raw.traits,uuSpec:raw.uu&&raw.uu.up?{name:String(raw.uu.name||''),base:UU_BASES[raw.uu.base]?raw.uu.base:'infantry',up:raw.uu.up}:null,uu:{},
    ubSpec:raw.ub&&Array.isArray(raw.ub.eff)?{name:String(raw.ub.name||''),eff:raw.ub.eff.filter(k=>UB_EFFECTS.some(e=>e.k===k)).slice(0,2)}:null,ub:{},story:raw.story,cities:String(raw.cities||'').split('\n')});
  for(const U of UU_UPS)d.uu.up[U.k]=clamp(+d.uu.up[U.k]||0,0,U.max);
  const errs=validateDraft(d);if(errs.length)throw new Error(errs[0]);return finalizeFaction(d);}

/* ---------- экран редактора ---------- */
const ED={d:null,editId:null};
function openEditor(f,asCopy){ED.d=draftFromFaction(f||null);ED.editId=f&&f.custom&&!asCopy?f.id:null;
  if(f&&asCopy)ED.d.name=(f.name+' II').slice(0,24);
  if(f&&asCopy&&!f.custom){ED.d.color=ED_COLORS.find(c=>c!==f.color&&!PRESETS.some(x=>x.color===c))||ED.d.color;ED.d.symbol=ED_SYMBOLS.find(s=>!allFactions().some(x=>x.symbol===s))||ED.d.symbol;}
  $('setup').classList.add('hidden');$('editor').classList.remove('hidden');$('editor').scrollTop=0;renderEditor();}
function closeEditor(){$('editor').classList.add('hidden');$('setup').classList.remove('hidden');renderSetup();}
function edChip(on,attrs,label,extra){return `<button class="chip ${on?'on':''}" ${attrs} ${extra||''}>${label}</button>`;}
function renderEditor(){const d=ED.d;const tp=traitPoints(d.traits);const up=uuPoints(d.uu.up);const B=UU_BASES[d.uu.base];
  let o='';
  o+=`<div class="hd">Облик</div><div class="opts"><div class="opt"><label for="e-name">Название</label><input type="text" id="e-name" maxlength="24" value="${esc(d.name)}"></div>
    <div class="opt"><label for="e-lore">Предыстория (по желанию)</label><input type="text" id="e-lore" maxlength="300" value="${esc(d.lore)}" placeholder="Кто они и откуда пришли"></div></div>
    <div class="opt" style="margin-top:10px"><label>Символ армий на карте</label><div class="chips">${ED_SYMBOLS.map(s=>edChip(d.symbol===s,`data-sym="${esc(s)}"`,esc(s),'style="min-width:34px;font-size:16px"')).join('')}</div></div>
    <div class="opt" style="margin-top:10px"><label>Цвет</label><div class="chips">${ED_COLORS.map(c=>`<button class="chip sw ${d.color===c?'on':''}" data-col="${c}" style="background:${c};width:34px" aria-label="Цвет ${c}">${d.color===c?'<b style="color:#120c05">✓</b>':''}</button>`).join('')}</div></div>`;
  o+=`<div class="hd">Уникальная механика</div><div class="list">${Object.keys(MECHS).map(k=>`<button class="item ${d.mech===k?'cur':''}" data-mech="${k}"><span>${d.mech===k?'▶ ':''}${esc(MECHS[k].name)}</span><span class="c">${d.mech===k?'выбрано':''}</span><span class="s">${esc(MECHS[k].desc)}</span></button>`).join('')}</div>`;
  const trChip=t=>{const T=TRAITS[t];const on=d.traits.includes(t);const conf=traitConflict(d.traits,t);const full=!on&&d.traits.length>=ED_MAX_TRAITS;
    const dis=!on&&(conf||full);return `<button class="chip ${on?'on':''}" data-trait="${t}" ${dis?'disabled style="opacity:.4"':''} title="${esc(conf?'Противоречит: '+TRAITS[conf].name:T.desc)}">${esc(T.name)} <span class="${on?'':'muted'}">${T.desc} · ${T.cost>0?T.cost:'+'+(-T.cost)}</span></button>`;};
  o+=`<div class="hd">Черты · очки ${tp} из ${ED_BUDGET}</div><p class="muted" style="font-size:12.5px;margin:0 0 6px">Сильные стороны стоят очков, слабости возвращают их. Не больше ${ED_MAX_TRAITS} черт, противоположные нельзя брать вместе.</p>
    <div class="chips">${Object.keys(TRAITS).filter(t=>TRAITS[t].cost>0).map(trChip).join('')}</div><div class="chips" style="margin-top:6px">${Object.keys(TRAITS).filter(t=>TRAITS[t].cost<0).map(trChip).join('')}</div>
    <p class="${tp>ED_BUDGET?'bad':'muted'}" style="font-size:12.5px">${tp>ED_BUDGET?`Перерасход: ${tp-ED_BUDGET}. Уберите черту или возьмите слабость.`:`Осталось очков: ${ED_BUDGET-tp}.`}</p>`;
  const uu=buildUU(d.uu);
  o+=`<div class="hd">Уникальный отряд · улучшения ${up} из ${UU_BUDGET}</div><div class="opts"><div class="opt"><label for="e-uun">Название отряда</label><input type="text" id="e-uun" maxlength="24" value="${esc(d.uu.name)}"></div></div>
    <div class="opt" style="margin-top:10px"><label>Основа</label><div class="chips">${Object.keys(UU_BASES).map(k=>edChip(d.uu.base===k,`data-base="${k}"`,`${UU_BASES[k].name} <span class="${d.uu.base===k?'':'muted'}">${UU_BASES[k].atk}/${UU_BASES[k].def}</span>`)).join('')}</div></div>
    <div class="list" style="margin-top:8px">${UU_UPS.map(U=>{const n=d.uu.up[U.k]||0;return `<div class="item" style="cursor:default"><span>${esc(U.label)} <span class="muted">· ${U.c} ${plural(U.c,'очко','очка','очков')}</span></span><span class="c"><button class="btn sm" data-up="${U.k}" data-dir="-1" ${n<=0?'disabled':''} aria-label="Меньше">−</button> <span class="k" style="display:inline-block;min-width:24px;text-align:center">${n}/${U.max}</span> <button class="btn sm" data-up="${U.k}" data-dir="1" ${n>=U.max||up+U.c>UU_BUDGET?'disabled':''} aria-label="Больше">+</button></span></div>`;}).join('')}</div>
    <p style="font-size:12.5px">Итог: атк ${uu.atk} · защ ${uu.def} · ОЗ ${uu.hp} · ход ${uu.mv}${uu.regen?' · регенерация':''} · стоимость ${uu.cost} · ${uu.tech?'открывает «'+TECHS[uu.tech].name+'»':'доступен сразу'}</p>`;
  o+=`<div class="hd">Уникальная постройка · ${d.ub.eff.length} из 2 свойств</div><div class="opts"><div class="opt"><label for="e-ubn">Название постройки</label><input type="text" id="e-ubn" maxlength="24" value="${esc(d.ub.name)}"></div></div>
    <div class="chips" style="margin-top:8px">${UB_EFFECTS.map(E=>{const on=d.ub.eff.includes(E.k);return edChip(on,`data-ub="${E.k}"`,esc(E.label),!on&&d.ub.eff.length>=2?'disabled style="opacity:.4"':'');}).join('')}</div>`;
  o+=`<div class="hd">Сюжетная линия</div><div class="chips">${Object.keys(QUEST_CHAINS).map(k=>edChip(d.story===k,`data-story="${k}"`,esc(QUEST_CHAINS[k].title))).join('')}</div>`;
  o+=`<div class="hd">Названия городов</div><div class="opt"><label for="e-cities">По одному в строке. Можно оставить пустым — названия придумаются сами.</label><textarea id="e-cities" rows="4" style="min-height:90px;font-size:13px">${esc(d.cities)}</textarea></div>`;
  $('ed-form').innerHTML=o;
  $('e-name').oninput=e=>{d.name=e.target.value;renderEdPreview();};$('e-lore').oninput=e=>{d.lore=e.target.value;renderEdPreview();};
  $('e-uun').oninput=e=>{d.uu.name=e.target.value;renderEdPreview();};$('e-ubn').oninput=e=>{d.ub.name=e.target.value;renderEdPreview();};
  $('e-cities').oninput=e=>{d.cities=e.target.value;};
  renderEdPreview();}
function renderEdPreview(){const d=ED.d;const f=finalizeFaction(d,'preview');const errs=validateDraft(d);
  $('ed-prev').innerHTML=`<div class="hd">Как это будет выглядеть</div>${facCardHtml(f,true,false)}
    ${errs.length?`<div class="qcard" style="border-color:var(--bad)"><b class="bad">Нужно исправить</b>${errs.map(e=>`<div style="font-size:12.5px">• ${esc(e)}</div>`).join('')}</div>`:'<p class="good" style="font-size:12.5px">Всё готово, фракцию можно сохранять.</p>'}
    <div class="actions"><button class="btn primary" id="e-save2" ${errs.length?'disabled':''}>Сохранить фракцию</button></div>`;
  $('e-save').disabled=!!errs.length;$('e-save2').onclick=saveEditor;}
function saveEditor(){const d=ED.d;if(validateDraft(d).length)return;const f=finalizeFaction(d,ED.editId);
  const k=CUSTOM.findIndex(x=>x.id===f.id);if(k>=0)CUSTOM[k]=f;else CUSTOM.push(f);saveCustom();SETUP.facId=f.id;toast(`Фракция «${f.name}» сохранена.`);closeEditor();}
function initEditor(){
  $('e-back').onclick=closeEditor;$('e-save').onclick=saveEditor;
  $('ed-form').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const d=ED.d;const ds=b.dataset;
    if(ds.sym)d.symbol=ds.sym;else if(ds.col)d.color=ds.col;else if(ds.mech){if(d.story===MECH_STORY[d.mech])d.story=MECH_STORY[ds.mech];d.mech=ds.mech;}
    else if(ds.trait){const t=ds.trait;if(d.traits.includes(t))d.traits=d.traits.filter(x=>x!==t);else d.traits.push(t);}
    else if(ds.base)d.uu.base=ds.base;else if(ds.up){const U=UU_UPS.find(x=>x.k===ds.up);const n=(d.uu.up[ds.up]||0)+(+ds.dir);if(n>=0&&n<=U.max&&(ds.dir<0||uuPoints(d.uu.up)+U.c<=UU_BUDGET))d.uu.up[ds.up]=n;}
    else if(ds.ub){const k=ds.ub;if(d.ub.eff.includes(k))d.ub.eff=d.ub.eff.filter(x=>x!==k);else if(d.ub.eff.length<2)d.ub.eff.push(k);}
    else if(ds.story)d.story=ds.story;else return;
    const y=$('editor').scrollTop;renderEditor();$('editor').scrollTop=y;});}
