import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['student/lib/mains-roster.ts','student/lib/faculty-roster.ts'];
const codeFile=path.join(root,'private/activation-codes.json');
if(fs.existsSync(codeFile)&&!process.argv.includes('--replace'))throw Error('Local demo codes already exist. Use --replace only for a fresh database. Existing activated accounts keep their password.');
const students=[{id:'11111',name:'student demo'},{id:'MAINS-33060',name:'Sample Student'}];
const faculty=[{id:'22222',name:'test demo',subject:'All subjects'},{id:'48219',name:'Demo DSA Faculty',subject:'DSA'},{id:'36475',name:'Demo Chemistry Faculty',subject:'Chemistry'}];
const codes=[];
for(const [file,name,rows]of [[files[0],'roster',students],[files[1],'facultyRoster',faculty]]){
 for(const row of rows){const code=randomBytes(24).toString('base64url');codes.push({...row,activationCode:code});row.activationHash=createHash('sha256').update(code).digest('hex');}
 fs.writeFileSync(path.join(root,file),"import 'server-only';\nexport const "+name+'='+JSON.stringify(rows,null,2)+';\n');
}
fs.mkdirSync(path.dirname(codeFile),{recursive:true,mode:0o700});fs.writeFileSync(codeFile,JSON.stringify(codes,null,2)+'\n',{mode:0o600});
console.log('Demo accounts configured. Your unique activation codes are in private/activation-codes.json. Keep that file private and out of GitHub.');
