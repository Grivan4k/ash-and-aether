const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
async function run(name,vp,mobile){
  const ctx=await b.newContext({viewport:vp,hasTouch:!!mobile,isMobile:!!mobile});const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(name+' PAGEERROR '+e.message+' '+(e.stack||'').split('\n')[1]));p.on('console',m=>{if(m.type()==='error')errs.push(name+': '+m.text());});
  await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(300);
  await p.click('#m-new');await p.click('#s-go');await p.waitForTimeout(300);
  await p.click('#modal [data-act=modal-close]');await p.waitForTimeout(100);await p.click('#modal [data-t=agri]');
  const modalTitle=async()=>p.evaluate(()=>document.getElementById('modal-back').classList.contains('hidden')?null:document.querySelector('#modal h2').textContent);
  await p.click('#b-end');await p.waitForTimeout(700);
  const t2=await modalTitle();await p.screenshot({path:`shots/${name}-q-intro.png`});
  await p.evaluate(()=>closeModal());await p.waitForTimeout(100);
  // complete chapter 1 -> reward modal
  await p.evaluate(()=>{const h=human();chainComplete(h);queueQuestUI();});await p.waitForTimeout(150);
  const t3=await modalTitle();await p.screenshot({path:`shots/${name}-q-reward.png`});
  await p.click('#modal [data-pick="0"]');await p.waitForTimeout(200);
  const t4=await modalTitle();const site=await p.evaluate(()=>{const c=human().quests.chain;return {i:c.i,site:c.site,goal:c.goal.type,qs:Object.keys(G.qsites).length,guard:!!armyAt(c.site)};});
  await p.evaluate(()=>closeModal(true));
  await p.evaluate(()=>{const c=human().quests.chain;if(c.site>=0){centerOn(c.site);}});await p.waitForTimeout(150);
  await p.screenshot({path:`shots/${name}-q-site.png`});
  // event
  await p.evaluate(()=>{const h=human();h.quests.nextEvent=0;fireEvent(h);queueQuestUI();});await p.waitForTimeout(150);
  const t5=await modalTitle();await p.screenshot({path:`shots/${name}-q-event.png`});
  await p.click('#modal [data-pick]:not([disabled])');await p.waitForTimeout(150);
  // side offer: bandits
  await p.evaluate(()=>{const h=human();const t=SIDE_QUESTS.find(x=>x.id==='bandits');h.quests.pend.push({kind:'offer',inst:{id:t.id,title:t.title,text:t.text,goal:{...t.goal},turns:t.turns,reward:t.reward,fail:t.fail,site:-1,target:null,visited:false,base:0,until:0}});queueQuestUI();});
  await p.waitForTimeout(150);const t6=await modalTitle();await p.click('#qo-yes');await p.waitForTimeout(200);
  const side=await p.evaluate(()=>{const s=human().quests.side;return s&&{id:s.id,target:!!G.armies[s.target]};});
  await p.evaluate(()=>{select(null);});
  await p.click('#b-quest');await p.waitForTimeout(150);await p.screenshot({path:`shots/${name}-q-journal.png`});
  await p.evaluate(()=>closeModal(true));
  // science: give techs and build gate
  const gate=await p.evaluate(()=>{const h=human();for(const k in TECHS)h.techs[k]=true;const c=citiesOf(h.id)[0];select({type:'city',id:c.id});
    const has=!!document.querySelector('#sidebody [data-k=proj]');return has;});
  if(gate){await p.click('#sidebody [data-k=proj]');}
  await p.screenshot({path:`shots/${name}-q-city.png`});
  const fin=await p.evaluate(()=>{const h=human();const c=citiesOf(h.id)[0];for(let k=0;k<3;k++){c.prog=9999;G._popups=[];processPlayer(h);c.prog=c.prog;}afterTurnUI();return {over:G.over,stage:h.gate.stage};});
  await p.waitForTimeout(200);const t7=await modalTitle();await p.screenshot({path:`shots/${name}-q-win.png`});
  console.log(name,JSON.stringify({t2,t3,t4,site,t5,t6,side,gate,fin,t7}));await ctx.close();}
await run('desk',{width:1440,height:900},false);await run('mob',{width:390,height:844},true);
console.log(errs.length?errs.join('\n'):'NO ERRORS');await b.close();})();
