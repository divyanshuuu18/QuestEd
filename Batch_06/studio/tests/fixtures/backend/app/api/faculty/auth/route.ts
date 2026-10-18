import {env} from 'cloudflare:workers';
import {facultyRoster} from '../../../../lib/faculty-roster';
import {digest,equal,passwordHash,randomToken} from '../../../../lib/mains-auth';
import {getFaculty} from '../../../../lib/faculty-auth';
import {readJson,failure} from '../../../../lib/http';
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(r:Request){const faculty=await getFaculty(r);return reply({faculty},faculty?200:401)}
export async function POST(r:Request){try{
if(r.headers.get('origin')||r.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Use the faculty website.'},403);
const b=await readJson(r,8192),db=env.DB!;
if(b.action==='logout'){const token=r.headers.get('authorization')?.replace(/^Bearer /,'')||'';await db.prepare('DELETE FROM faculty_sessions WHERE token_hash=?').bind(await digest(token)).run();return reply({ok:true})}
const id=typeof b.id==='string'?b.id.trim():'',password=typeof b.password==='string'?b.password:'';
const now=Date.now(),bucket=Math.floor(now/900000),ip=r.headers.get('cf-connecting-ip')||'unknown';
await db.prepare('DELETE FROM auth_limits WHERE expires<?').bind(now).run();
for(const [key,max] of [[await digest('faculty-id:'+id+':'+bucket),10],[await digest('faculty-ip:'+ip+':'+bucket),120]] as const){const n=await db.prepare('INSERT INTO auth_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,(bucket+1)*900000).first<{count:number}>();if(n!.count>max)return reply({error:'Too many attempts. Try again in 15 minutes.'},429)}
const teacher=facultyRoster.find(f=>f.id===id);if(!teacher||password.length<10||password.length>128)return reply({error:'Check ID and credentials. Password must be 10–128 characters.'},401);
const account=await db.prepare('SELECT * FROM faculty_credentials WHERE id=?').bind(id).first<{salt:string;password_hash:string}>();
if(b.action==='activate'){
if(account||typeof b.name!=='string'||b.name.trim().toLowerCase()!==teacher.name.toLowerCase()||typeof b.code!=='string'||!equal(await digest(b.code.trim()),teacher.activationHash))return reply({error:'Account already activated or activation details incorrect.'},401);
const salt=randomToken();const result=await db.prepare('INSERT OR IGNORE INTO faculty_credentials VALUES(?,?,?,?)').bind(id,await passwordHash(password,salt),salt,new Date().toISOString()).run();if(!result.meta.changes)return reply({error:'Already activated. Sign in instead.'},409);
}else if(b.action==='login'){if(!account||!equal(await passwordHash(password,account.salt),account.password_hash))return reply({error:'ID or password incorrect. Activate your account on your first visit.'},401)}else return reply({error:'Unknown action'},400);
const token=randomToken();await db.batch([db.prepare('DELETE FROM faculty_sessions WHERE expires<?').bind(now),db.prepare('INSERT INTO faculty_sessions VALUES(?,?,?)').bind(await digest(token),id,now+7*86400000)]);
return reply({ok:true,token,faculty:{id:teacher.id,name:teacher.name,subject:teacher.subject}});
}catch(e){return failure(e,reply)}}
