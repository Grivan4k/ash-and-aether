import re
parts=['data','engine','combat','turn','quests','perks','approval','siege','ai','editor','ui']
js="'use strict';\n"+"\n".join(open(f'src/{p}.js').read().replace("'use strict';","",1) for p in parts)
shell=open('src/shell.html').read()
open('index.html','w').write(shell.replace('/*__JS__*/',js))
print(len(js),'bytes js')
