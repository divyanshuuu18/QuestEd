import {spawnSync,spawn} from 'node:child_process';
import fs from 'node:fs';
function run(args){const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.status)process.exit(r.status)}
run(['scripts/run-framework.mjs','build']);
fs.mkdirSync('.wrangler',{recursive:true});const tracker='.wrangler/applied-local.json';const applied=fs.existsSync(tracker)?JSON.parse(fs.readFileSync(tracker,'utf8')):[];
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){if(applied.includes(file))continue;run(['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--file','drizzle/'+file]);applied.push(file);fs.writeFileSync(tracker,JSON.stringify(applied));}
spawn(process.execPath,['scripts/run-framework.mjs','dev'],{stdio:'inherit'});
