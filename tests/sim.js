const fs=require('fs');const vm=require('vm');
const code=['data','engine','combat','turn','quests','perks','approval','siege','ai'].map(f=>fs.readFileSync('src/'+f+'.js','utf8').replace(/'use strict';/,'')).join('\n');
const ctx={console,Math,JSON,Map,Set,Uint8Array,Int16Array,Int32Array,Float32Array,Array,Object,Number,String,Error,Infinity};
vm.createContext(ctx);
vm.runInContext(code+`
;globalThis.__run=function(seed,size,np,diff,turns){
  createGame({seed,size,players:np,diff,faction:PRESETS[seed%6]});
  const t0=Date.now();
  const terr={};for(const t of G.ter)terr[t]=(terr[t]||0)+1;
  let out={terr,regions:G.regions.length,lairs:G.lairs.length,ruins:Object.keys(G.ruins).length};
  const snaps=[];
  for(let k=0;k<turns;k++){runWorldTurn({humanAI:true});if(G.over)break;
    if(G.turn%30===0)snaps.push(G.turn+': '+G.players.map(p=>p.f.symbol+(p.alive?'':'x')+' c'+citiesOf(p.id).length+' pop'+citiesOf(p.id).reduce((s,c)=>s+c.pop,0)+' t'+Object.keys(p.techs).length+' ap'+Math.round(avgApproval(p))+' st'+citiesOf(p.id).map(c=>c.apSt==null?'-':c.apSt).join('')+' u'+armiesOf(p.id).reduce((s,a)=>s+a.units.length,0)+' g'+p.gold).join(' | '));}
  out.ms=Date.now()-t0;out.turn=G.turn;out.over=G.over;out.snaps=snaps;
  out.wars=Object.entries(G.rel).filter(e=>e[1]==='war').map(e=>e[0]);
  out.captured=G.players.map(p=>p.stats.captured);out.chain=G.players.map(p=>p.f.symbol+' perks['+p.perks.join(',')+']');out.rebels=Object.values(G.armies).filter(a=>a.rebel!=null).length;out.alive=G.players.filter(p=>p.alive).length;out.monsters=Object.values(G.armies).filter(a=>a.owner<0).length;
  out.log=G.log.slice(-6).map(l=>l.text);
  return out;};`,ctx);
for(const [seed,size,np] of [[11,'medium',5],[42,'small',3],[99,'medium',4],[5,'medium',5]]){
  const r=ctx.__run(seed,size,np,1,320);
  console.log(JSON.stringify({seed,size,regions:r.regions,lairs:r.lairs,ruins:r.ruins,ms:r.ms,turn:r.turn,over:r.over,over:r.over,rebels:r.rebels,chain:r.chain,captured:r.captured,alive:r.alive,monsters:r.monsters}));
  console.log(' terr',JSON.stringify(r.terr));
  r.snaps.forEach(s=>console.log(' ',s));
}
