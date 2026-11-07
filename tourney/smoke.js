const {loadEngine}=require('./engine-host');const {buildGames}=require('./run');
const gs=buildGames();console.log('games',gs.length, JSON.stringify(gs.reduce((m,g)=>{m[g.strategy]=(m[g.strategy]||0)+1;return m;},{})));
for(const id of [37,95,61]){const g={...gs[id],maxTurns:120};const ctx=loadEngine();const t=Date.now();const r=ctx.__runGame(g);
  console.log(id,g.strategy,g.faction,g.size,JSON.stringify(r.res),'turns',r.turns,'ms',Date.now()-t,'err',ctx.__ERR.length,ctx.__ERR[0]||'');
  console.log('  human',JSON.stringify(r.human));console.log('  wars',r.log.wars.length,'caps',r.log.captures.length,'elims',r.log.elims.length,'rebH',r.log.rebH,'rebAI',r.log.rebAI,'gate',JSON.stringify(r.log.gate.slice(-2)));}
