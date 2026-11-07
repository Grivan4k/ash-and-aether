const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch();const errs=[];
  async function run(name,vp,mobile){
    const ctx=await b.newContext({viewport:vp,deviceScaleFactor:1,hasTouch:!!mobile,isMobile:!!mobile});
    const p=await ctx.newPage();p.on('pageerror',e=>errs.push(name+' PAGEERROR: '+e.message+' '+(e.stack||'').split('\n')[1]));
    p.on('console',m=>{if(m.type()==='error')errs.push(name+': '+m.text());});
    await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(300);
    await p.click('#m-new');await p.click('[data-np="4"]');await p.click('#s-go');await p.waitForTimeout(300);
    await p.click('#modal [data-act=modal-close]');await p.waitForTimeout(150);
    await p.click('#modal [data-t=bronze]');await p.waitForTimeout(150);
    const tap=async(i)=>{const pos=await p.evaluate(i=>{const t=tilePos(i);const r=document.getElementById('cv').getBoundingClientRect();return {x:r.left+t.x+VIEW.cw,y:r.top+t.y+VIEW.ch/2};},i);
      if(mobile)await p.touchscreen.tap(pos.x,pos.y);else await p.mouse.click(pos.x,pos.y);await p.waitForTimeout(120);};
    // scout
    const info=await p.evaluate(()=>{const h=human();const sc=armiesOf(h.id).find(a=>a.units[0].t==='scout');centerOn(sc.idx);
      // destination: reachable tile ~3 away
      const R=reachable(sc);let dest=-1;for(let i=0;i<N;i++)if(R[i]&&hexDist(i,sc.idx)>=2&&!armyAt(i)&&!cityAt(i)){dest=i;break;}return {id:sc.id,idx:sc.idx,dest};});
    await p.waitForTimeout(100);
    await tap(info.idx);
    const selOk=await p.evaluate(id=>UI.sel&&UI.sel.type==='army'&&UI.sel.id===id,info.id);
    await tap(info.dest);if(mobile)await tap(info.dest);
    const moved=await p.evaluate(id=>G.armies[id].idx,info.id);
    await p.screenshot({path:`shots/${name}-moved.png`});
    // city production
    const cid=await p.evaluate(()=>{const c=citiesOf(G.human)[0];centerOn(c.idx);return c.idx;});await p.waitForTimeout(100);
    await tap(cid);
    const cityOk=await p.evaluate(()=>UI.sel&&UI.sel.type==='city');
    if(!cityOk){console.log('DBG',JSON.stringify(await p.evaluate((ci)=>({sel:UI.sel,armyAtCity:armyAt(ci)&&armyAt(ci).id,city:cityAt(ci)&&cityAt(ci).id,modal:!document.getElementById('modal-back').classList.contains('hidden'),h2:document.querySelector('#modal h2')&&document.querySelector('#modal h2').textContent,scout:G.armies[3]&&G.armies[3].idx}),cid)));}
    await p.click('#sidebody [data-act=q-add][data-id=militia]',{timeout:3000});
    const q=await p.evaluate(()=>citiesOf(G.human)[0].queue.map(x=>x.id).join(','));
    // end turn
    await p.click('#b-end');await p.waitForTimeout(800);
    const turn=await p.evaluate(()=>G.turn);
    await p.evaluate(()=>{if(!document.getElementById('modal-back').classList.contains('hidden'))closeModal(true);});
    // battle: spawn enemy adjacent to our militia army in capital region
    const bt=await p.evaluate(()=>{const h=human();const a=armiesOf(h.id).find(x=>x.units.some(u=>u.t==='militia'));
      const enemy=G.players.find(q=>q.id!==h.id);declareWar(h.id,enemy.id);h.met[enemy.id]=true;enemy.met[h.id]=true;
      const j=NBR[a.idx].find(t=>!isWater(t)&&!armyAt(t)&&!cityAt(t)&&G.ter[t]!=='mount');const e=newArmy(enemy.id,j,[mkUnit(enemy,'militia')]);e.units[0].hp=5;
      a.mp=a.mpMax;computeVision(h.id);VIS=h._vis;select({type:'army',id:a.id});centerOn(a.idx);return {a:a.id,j};});
    await p.waitForTimeout(150);await tap(bt.j);
    const preview=await p.evaluate(()=>!!document.querySelector('#modal [data-act=attack-go]'));
    await p.screenshot({path:`shots/${name}-preview.png`});
    if(preview){await p.click('#modal [data-act=attack-go]');await p.waitForTimeout(250);}
    await p.screenshot({path:`shots/${name}-report.png`});
    const rep=await p.evaluate(()=>document.querySelector('#modal h2')&&document.querySelector('#modal h2').textContent);
    console.log(name,JSON.stringify({selOk,from:info.idx,dest:info.dest,moved,cityOk,q,turn,preview,rep}));
    await ctx.close();}
  await run('desk',{width:1440,height:900},false);
  await run('mob',{width:390,height:844},true);
  console.log(errs.length?errs.join('\n'):'NO ERRORS');await b.close();})();
