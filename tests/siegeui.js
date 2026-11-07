// Интерфейс осады в браузере: карточка в панели города, рамка на карте, панель осаждающей армии, вражеский город
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];const out={};
async function run(name,vp,mobile){const ctx=await b.newContext({viewport:vp,hasTouch:!!mobile,isMobile:!!mobile,deviceScaleFactor:mobile?2:1});const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(name+' PAGEERROR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(name+': '+m.text());});
  await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(300);await p.click('#m-new');await p.click('#s-go');await p.waitForTimeout(300);
  await p.evaluate(()=>{closeModal(true);UI.popq=[];});
  // 1) наш город в осаде
  const r1=await p.evaluate(()=>{const h=human();const e=G.players.find(q=>q.id!==h.id);h.met[e.id]=e.met[h.id]=true;declareWar(e.id,h.id);
    const c=citiesOf(h.id)[0];for(const a of Object.values(G.armies))if(a.owner===h.id&&a.idx===c.idx)removeArmy(a);
    const t=NBR[c.idx].find(q=>!isWater(q)&&!armyAt(q)&&!cityAt(q)&&G.ter[q]!=='mount');newArmy(e.id,t,[mkUnit(e,'sword'),mkUnit(e,'archer')]);
    c.siege=4;c.apSt=4;computeVision(h.id);VIS=h._vis;select({type:'city',id:c.id});centerOn(c.idx);draw();
    const pan=document.getElementById('side').innerText;return {card:/Осада: 4/.test(pan),cut:/Доходы и еда отрезаны/.test(pan),count:(pan.match(/сдастся через \d+ \S+/)||[''])[0],
      prodTxt:(pan.match(/стоит|∞/)||[''])[0]};});
  await p.waitForTimeout(150);await p.screenshot({path:`shots/siege_city_${name}.png`});
  // 2) мы осаждаем чужой город
  const r2=await p.evaluate(()=>{const h=human();const e=G.players.find(q=>q.id!==h.id);const ec=citiesOf(e.id)[0];declareWar(h.id,e.id);
    for(const a of Object.values(G.armies))if(a.owner===h.id&&a.units.some(u=>u.t==='sword'))removeArmy(a);
    const t=NBR[ec.idx].find(q=>!isWater(q)&&!armyAt(q)&&!cityAt(q)&&G.ter[q]!=='mount');const my=newArmy(h.id,t,[mkUnit(h,'sword'),mkUnit(h,'sword')]);
    ec.siege=3;ec.apSt=4;const g=armyAt(ec.idx);if(g)removeArmy(g);computeVision(h.id);VIS=h._vis;
    select({type:'army',id:my.id});const ap=document.getElementById('side').innerText;
    select({type:'city',id:ec.id});const cp=document.getElementById('side').innerText;centerOn(ec.idx);draw();
    return {army:(ap.match(/Осада\s+\S+: \d+ \S+, стены −\d+%/)||[''])[0],city:(cp.match(/В осаде[^.]*\./)||[''])[0],surr:(cp.match(/Сдастся через \d+ \S+/)||[''])[0]};});
  await p.waitForTimeout(150);await p.screenshot({path:`shots/siege_enemy_${name}.png`});
  // 3) справка
  const r3=await p.evaluate(()=>{const s=document.body.innerHTML;return /Сдача без боя/.test(typeof HELP_HTML!=='undefined'?HELP_HTML:s)||null;});
  out[name]={r1,r2,help:r3};await ctx.close();}
await run('desk',{width:1366,height:820});await run('mob',{width:390,height:844},true);
console.log(JSON.stringify(out));console.log(errs.length?errs.join('\n'):'NO ERRORS');await b.close();})();
