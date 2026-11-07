const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
async function run(name,vp,mobile){const ctx=await b.newContext({viewport:vp,hasTouch:!!mobile,isMobile:!!mobile});const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(name+' PAGEERROR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(name+': '+m.text());});
  await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(300);await p.click('#m-new');await p.waitForTimeout(150);
  const card=await p.evaluate(()=>document.querySelector('.fac.on').innerText.match(/Особые исследования:[^\n]*/)[0]);
  await p.click('[data-fac="grove"]');await p.click('#s-go');await p.waitForTimeout(300);await p.evaluate(()=>{closeModal(true);UI.popq=[];});
  const r=await p.evaluate(()=>{const h=human();const c=citiesOf(h.id)[0];c.buildings.push('library','granary','ub','temple');for(const t of ['agri','writing','alchemy','trade','masonry','engineering','crafts','bronze','archery'])h.techs[t]=true;
    const lib=bdef(h,'library'),ub=bdef(h,'ub'),uu=udef(h,'uu');select({type:'city',id:c.id});centerOn(c.idx);
    return {lib:{s:lib.s,ups:lib.ups.map(u=>u.name)},ub:{f:ub.f,p:ub.p,s:ub.s,ups:ub.ups.map(u=>u.name)},uu:{def:uu.def,hp:uu.hp,regen:uu.regen,cost:uu.cost,mv:uu.mv},caps:capitalsHeld(h.id)};});
  await p.evaluate(()=>{document.getElementById('sidebody').scrollTop=99999;});await p.waitForTimeout(100);
  await p.screenshot({path:`shots/${name}-v6-city.png`});
  await p.click('#b-tech');await p.waitForTimeout(150);
  const tech=await p.evaluate(()=>[...document.querySelectorAll('#modal .tech .u')].map(x=>x.innerText).filter(t=>t.includes('★')).slice(0,3));
  await p.screenshot({path:`shots/${name}-v6-tech.png`});await p.evaluate(()=>closeModal(true));
  // предупреждение о Вратах соперника
  await p.evaluate(()=>{const h=human();const e=G.players[1];h.met[e.id]=true;const c=citiesOf(e.id)[0];G._popups=[{type:'gateStart',by:e.id,city:c.name,idx:c.idx}];queueQuestUI();});await p.waitForTimeout(150);
  const gate=await p.evaluate(()=>document.querySelector('#modal h2').textContent+' | '+document.querySelector('#modal .qtext').textContent.slice(0,80));
  await p.evaluate(()=>{closeModal(true);select(null);});await p.waitForTimeout(100);
  const goal=await p.evaluate(()=>[...document.querySelectorAll('#sidebody p')].map(x=>x.innerText).find(t=>t.startsWith('Завоевание')));
  console.log(name,JSON.stringify({card,r,tech,gate,goal}));await ctx.close();}
await run('desk',{width:1440,height:900},false);await run('mob',{width:390,height:844},true);
console.log(errs.length?errs.join('\n'):'NO ERRORS');await b.close();})();
