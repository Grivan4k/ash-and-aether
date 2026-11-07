const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
async function run(name,vp,mobile){
  const ctx=await b.newContext({viewport:vp,hasTouch:!!mobile,isMobile:!!mobile});const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(name+' PAGEERROR '+e.message+' '+(e.stack||'').split('\n')[1]));p.on('console',m=>{if(m.type()==='error')errs.push(name+': '+m.text());});
  await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(300);
  await p.click('#m-new');await p.waitForTimeout(150);
  await p.screenshot({path:`shots/${name}-e-setup.png`});
  await p.click('#s-newfac');await p.waitForTimeout(150);
  await p.fill('#e-name','Орден Сумерек');
  await p.click('[data-sym="Θ"]');await p.click('[data-col="#7dffd8"]');await p.click('[data-mech="forest"]');
  for(const t of ['martial','stalwart','wise'])await p.click(`[data-trait="${t}"]`);
  const errOver=await p.evaluate(()=>validateDraft(ED.d));
  const confl=await p.evaluate(()=>[document.querySelector('[data-trait="frail"]').disabled,document.querySelector('[data-trait="meek"]').disabled]);
  await p.click('[data-trait="barren"]');
  const errOk=await p.evaluate(()=>validateDraft(ED.d));
  await p.click('[data-base="cavalry"]');await p.click('[data-up="hp"][data-dir="-1"]');await p.click('[data-up="def"][data-dir="-1"]');await p.click('[data-up="mv"][data-dir="1"]');
  const upBlocked=await p.evaluate(()=>document.querySelector('[data-up="regen"][data-dir="1"]').disabled);
  await p.fill('#e-uun','Сумеречные всадники');await p.fill('#e-ubn','Лунный алтарь');
  await p.click('[data-ub="s"]');await p.click('[data-ub="sp"]');await p.click('[data-ub="f"]');
  await p.screenshot({path:`shots/${name}-e-editor.png`,fullPage:false});
  const st=await p.evaluate(()=>({d:ED.d,errs:validateDraft(ED.d),uu:buildUU(ED.d.uu)}));
  await p.click('#e-save');await p.waitForTimeout(200);
  const saved=await p.evaluate(()=>({sel:SETUP.facId,n:CUSTOM.length,card:!!document.querySelector('.fac.on [data-fedit]')}));
  // code export/import
  const code=await p.evaluate(()=>factionCode(CUSTOM[0]));
  const imp=await p.evaluate(c=>{const f=factionFromCode(c);return f.name+'|'+f.uu.atk+'|'+f.traits.join(',');},code);
  let badImp;try{badImp=await p.evaluate(()=>{try{factionFromCode('PEF1:abc');return 'no error';}catch(e){return e.message;}});}catch(e){badImp=e.message;}
  // start game with custom + custom AI
  await p.click('[data-cai]');await p.click('#s-go');await p.waitForTimeout(300);
  const g=await p.evaluate(()=>{const h=human();return {name:h.f.name,custom:h.f.custom,story:chainDef(h).title,uu:h.f.uu,colors:G.players.map(x=>x.f.color),syms:G.players.map(x=>x.f.symbol)};});
  await p.evaluate(()=>closeModal(true));
  // perks
  await p.evaluate(()=>{const h=human();h.perkPts=3;renderTop();});
  await p.click('#b-perk');await p.waitForTimeout(150);
  await p.screenshot({path:`shots/${name}-e-perks.png`});
  await p.click('[data-perk="warDoctrine"]');await p.waitForTimeout(100);await p.click('#cf-ok');await p.waitForTimeout(150);
  const pk=await p.evaluate(()=>{const h=human();return {perks:h.perks,pts:h.perkPts,atk:fmods(h).atk,lockedTier2:!document.querySelector('[data-perk="marches"]')};});
  console.log(name,JSON.stringify({confl,errOver,errOk,upBlocked,st:{traits:st.d.traits,ub:st.d.ub.eff,uu:st.uu,errs:st.errs},saved,imp,badImp,g,pk}));
  await ctx.close();}
await run('desk',{width:1440,height:900},false);await run('mob',{width:390,height:844},true);
console.log(errs.length?errs.join('\n'):'NO ERRORS');await b.close();})();
