import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'quested-urls.json');const before=JSON.parse(fs.readFileSync(file,'utf8'));const after={...before};
const args=process.argv.slice(2);if(args.length%2)throw Error('Use --student URL --faculty URL --studio URL');
for(let i=0;i<args.length;i+=2){const key=args[i].replace(/^--/,'');if(!Object.hasOwn(after,key))throw Error('Unknown app: '+key);const u=new URL(args[i+1]);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Use a plain HTTP(S) origin');after[key]=u.origin;}
for(const app of ['student','faculty','studio'])for(const rel of ['app/page.tsx','lib/proxy.ts']){const p=path.join(root,app,rel);if(!fs.existsSync(p))continue;let s=fs.readFileSync(p,'utf8');const keys=Object.keys(before);keys.forEach((key,i)=>s=s.replaceAll(before[key],'__QUESTED_URL_'+i+'__'));keys.forEach((key,i)=>s=s.replaceAll('__QUESTED_URL_'+i+'__',after[key]));fs.writeFileSync(p,s);}
fs.writeFileSync(file,JSON.stringify(after,null,2)+'\n');console.log('Configured app origins. Rebuild and redeploy each app after changing URLs.');
