const fs=require('fs');const vm=require('vm');
const code=['data','engine','combat','turn','quests','perks','approval','siege','ai'].map(f=>fs.readFileSync('src/'+f+'.js','utf8').replace(/'use strict';/,'')).join('\n');
const ctx={console,Math,JSON,Map,Set,Uint8Array,Int16Array,Int32Array,Float32Array,Array,Object,Number,String,Error,Infinity};vm.createContext(ctx);
vm.runInContext(code+`;globalThis.__t=function(){createGame({seed:3,size:'small',players:3,diff:1,faction:PRESETS[1]});
 for(let k=0;k<10;k++)runWorldTurn({humanAI:true});
 const o=JSON.parse(serialize());delete o.vic;delete o.qsites;for(const p of o.players){delete p.quests;delete p.qmods;delete p.gate;delete p.stats.mkills;delete p.stats.ruins;}
 deserialize(JSON.stringify(o));for(let k=0;k<30;k++)runWorldTurn({humanAI:true});
 return 'ok turn '+G.turn+' chain '+G.players.map(p=>p.quests.chain&&p.quests.chain.i).join(',');};`,ctx);
console.log(ctx.__t());
