const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
async function run(name,vp,mobile){
  const ctx=await b.newContext({viewport:vp,hasTouch:!!mobile,isMobile:!!mobile});const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(name+' PAGEERROR '+e.message+' '+(e.stack||'').split('\n')[1]));p.on('console',m=>{if(m.type()==='error')errs.push(name+': '+m.text());});
  await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(300);
  await p.click('#m-new');await p.click('#s-go');await p.waitForTimeout(300);
  await p.evaluate(()=>{closeModal(true);UI.popq=[];});
  const r=await p.evaluate(()=>{const h=human();const before=cityCalc(citiesOf(h.id)[0]).ap.v;
    // много городов и жителей
    let n=0;for(const rg of G.regions){if(n>=10)break;if(rg.city==null&&rg.site>=0&&!armyAt(rg.site)){const c=foundCityAt(h,rg.site,false);c.pop=7;n++;}}
    const cap=citiesOf(h.id).find(c=>c.capital);cap.pop=14;h.explored.fill(1);
    G._popups=[];processPlayer(h);const capAp=cityCalc(cap).ap;
    const states=citiesOf(h.id).map(c=>c.apSt).join('');
    // мятежники
    const riot=citiesOf(h.id).find(c=>!c.capital);riot.apSt=4;const g=armyAt(riot.idx);if(g)removeArmy(g);spawnRebels(h,riot);const reb=rebelsOf(riot);
    const pop0=riot.pop;riot.prog=40;for(let k=0;k<4;k++)rebelsAct(reb);
    select({type:'city',id:cap.id});centerOn(cap.idx);afterAction();
    return {before,cap:{v:capAp.v,st:capAp.st,parts:capAp.parts},states,rebels:!!reb,pop0,pop1:riot.pop,prog:riot.prog};});
  await p.waitForTimeout(200);
  await p.evaluate(()=>{closeModal(true);UI.popq=[];select({type:'city',id:citiesOf(human().id).find(c=>c.capital).id});});await p.waitForTimeout(100);
  await p.click('#sidebody details.apd summary');await p.waitForTimeout(100);
  await p.screenshot({path:`shots/${name}-ap-city.png`});
  // празднества
  await p.click('#sidebody [data-act=fest-on]');await p.waitForTimeout(100);
  const fest=await p.evaluate(()=>{const c=citiesOf(human().id).find(c=>c.capital);return {q:c.queue.map(x=>x.k).join(','),ap:cityCalc(c).ap.v};});
  // событие о ропоте
  await p.evaluate(()=>{const h=human();h.quests.pend.push({kind:'event',id:'unrest',ctx:eventCtx(h)});queueQuestUI();});await p.waitForTimeout(150);
  const ev=await p.evaluate(()=>document.querySelector('#modal h2').textContent);
  await p.screenshot({path:`shots/${name}-ap-event.png`});
  await p.click('#modal [data-pick="1"]');await p.waitForTimeout(150);
  const buff=await p.evaluate(()=>JSON.stringify(human().apBuff));
  await p.evaluate(()=>{closeModal(true);select(null);});await p.waitForTimeout(100);
  await p.screenshot({path:`shots/${name}-ap-map.png`});
  console.log(name,JSON.stringify({r,fest,ev,buff}));await ctx.close();}
await run('desk',{width:1440,height:900},false);await run('mob',{width:390,height:844},true);
console.log(errs.length?errs.join('\n'):'NO ERRORS');await b.close();})();
