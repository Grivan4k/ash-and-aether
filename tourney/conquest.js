const {fork}=require('child_process');const fs=require('fs');
const FACS=['legion','grove','forge','necro','tide','guild'];
if(!process.env.WORKER){const games=[];for(let k=0;k<10;k++)games.push({id:200+k,strategy:'war',faction:FACS[k%6],size:k%3===2?'small':'medium',players:k%3===2?3:4,diff:k%2,vic:{conquest:true,science:false},seed:777+k*131,maxTurns:300});
  fs.writeFileSync('conquest.jsonl','');let done=0;for(let w=0;w<2;w++){const ch=fork(__filename,[],{env:{...process.env,WORKER:'1'}});ch.send(games.filter((g,i)=>i%2===w));
    ch.on('message',r=>{fs.appendFileSync('conquest.jsonl',JSON.stringify(r)+'\n');done++;const caps=r.log.captures.filter(c=>c.byHuman).length,lost=r.log.captures.filter(c=>c.fromHuman).length;
      const el=r.log.elims.map(e=>`${e.who}@${e.t}${e.by?'←'+e.by:''}`).join(' ');
      console.log(`#${r.cfg.id} ${r.cfg.faction}/${r.cfg.size}/d${r.cfg.diff}: ${r.res.timeout?'timeout':(r.res.win?'WIN ':'LOSS ')+r.res.type} t${r.turns} | игрок захватил ${caps}, потерял ${lost}, городов в конце ${r.human.cities} | уничтожены: ${el||'никто'} | ИИ городов ${r.ais.map(a=>a.cities).join('/')}`);
      if(done===10)console.log('DONE');});}}
else{const {loadEngine}=require('./engine-host');process.on('message',sl=>{for(const g of sl){const ctx=loadEngine();const r=ctx.__runGame(g);r.errors=ctx.__ERR;process.send(r);}process.exit(0);});}
