const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch();
  const errs=[];
  async function run(name,vp,mobile){
    const ctx=await b.newContext({viewport:vp,deviceScaleFactor:mobile?2:1,hasTouch:!!mobile,isMobile:!!mobile});
    const p=await ctx.newPage();
    p.on('console',m=>{if(m.type()==='error')errs.push(name+': '+m.text());});
    p.on('pageerror',e=>errs.push(name+' PAGEERROR: '+e.message));
    await p.goto('file://'+process.cwd()+'/index.html');
    await p.waitForTimeout(600);
    await p.screenshot({path:`shots/${name}-menu.png`});
    await p.click('#m-new');await p.waitForTimeout(200);
    await p.screenshot({path:`shots/${name}-setup.png`,fullPage:false});
    await p.click('#s-go');await p.waitForTimeout(500);
    await p.screenshot({path:`shots/${name}-intro.png`});
    await p.click('#modal [data-act=modal-close]');await p.waitForTimeout(300);
    await p.screenshot({path:`shots/${name}-tech.png`});
    await p.click('#modal [data-act=tech]');await p.waitForTimeout(300);
    await p.screenshot({path:`shots/${name}-game1.png`});
    // autoplay some turns
    await p.evaluate(()=>window.__dbg.autoplay(45));
    await p.waitForTimeout(300);
    // close any modal
    await p.evaluate(()=>{document.getElementById('modal-back').classList.add('hidden');});
    // select capital city
    await p.evaluate(()=>{const G=window.__dbg.G;const h=window.__dbg.human();const c=Object.values(G.cities).find(c=>c.owner===h.id);if(c){window.__dbg.select({type:'city',id:c.id});window.__dbg.centerOn(c.idx);}});
    await p.waitForTimeout(300);
    await p.screenshot({path:`shots/${name}-game45.png`});
    // end turn via button
    await p.click('#b-end');await p.waitForTimeout(1200);
    await p.screenshot({path:`shots/${name}-after-end.png`});
    await ctx.close();
  }
  await run('desk',{width:1440,height:900},false);
  await run('mob',{width:390,height:844},true);
  console.log(errs.length?errs.join('\n'):'NO ERRORS');
  await b.close();
})();
