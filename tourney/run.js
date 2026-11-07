// 100 партий: 6 стратегий × 6 фракций, разные карты и сложности. Запуск: node run.js [воркеров]
const {fork}=require('child_process');const fs=require('fs');const path=require('path');
const FACS=['legion','grove','forge','necro','tide','guild'];
const PLAN=[['ai',15],['sci',20],['war',20],['wide',15],['turtle',15],['idle',15]];
function buildGames(){const games=[];let id=0;
  for(const [strategy,count] of PLAN)for(let k=0;k<count;k++){
    const faction=FACS[k%6];let size='medium',players=5;
    if(k%10===7){size='small';players=3;}else if(k%10===9){size='large';players=6;}else if(k%10===3)players=4;
    let diff=1;if(strategy==='sci'||strategy==='war'||strategy==='ai'){if(k%5===0)diff=0;else if(k%5===4)diff=2;}
    let vic={conquest:true,science:true};
    if((strategy==='idle'&&k>=10)||(strategy==='turtle'&&k>=12))vic={conquest:true,science:false};
    games.push({id:id++,strategy,faction,size,players,diff,vic,seed:1000+id*7919%100000,maxTurns:300});}
  return games;}
if(require.main===module&&!process.env.WORKER){
  const games=buildGames();const nW=+process.argv[2]||2;const out=path.join(__dirname,'results.jsonl');fs.writeFileSync(out,'');
  let done=0;const t0=Date.now();
  for(let w=0;w<nW;w++){const slice=games.filter((g,i)=>i%nW===w);
    const ch=fork(__filename,[],{env:{...process.env,WORKER:'1'}});ch.send(slice);
    ch.on('message',r=>{fs.appendFileSync(out,JSON.stringify(r)+'\n');done++;
      process.stdout.write(`[${done}/${games.length}] #${r.cfg.id} ${r.cfg.strategy}/${r.cfg.faction}/${r.cfg.size}/d${r.cfg.diff} -> ${r.res.timeout?'timeout':(r.res.win?'WIN ':'LOSS ')+r.res.type+(r.res.by?' by '+r.res.by:'')} t${r.turns} ${Math.round(r.ms/1000)}s err${r.errors.length}\n`);
      if(done===games.length)console.log('ALL DONE in',Math.round((Date.now()-t0)/1000),'s');});}
}
if(process.env.WORKER){const {loadEngine}=require('./engine-host');
  process.on('message',slice=>{for(const g of slice){let r;
      try{const ctx=loadEngine();r=ctx.__runGame(g);r.errors=ctx.__ERR;}catch(e){r={cfg:g,res:{crash:true,timeout:true},turns:0,ms:0,errors:[String(e&&e.stack||e).slice(0,400)],human:{},ais:[],log:{}};}
      process.send(r);}
    process.exit(0);});}
module.exports={buildGames};
