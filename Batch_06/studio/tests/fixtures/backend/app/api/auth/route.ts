import {env} from 'cloudflare:workers';
import {roster} from '../../../lib/mains-roster';
import {readJson,failure} from '../../../lib/http';
import {normalizeId,passwordHash,digest,equal,randomToken,cookieName,sessionToken,getStudent,sameOrigin} from '../../../lib/mains-auth';
const reply=(data:unknown,status=200,cookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function POST(request:Request){try{
if(!sameOrigin(request))return reply({error:'Request origin rejected'},403);
const body=await readJson(request,8192);const db=env.DB!;
if(body.action==='logout'){const token=sessionToken(request);if(token)await db.prepare('DELETE FROM student_sessions WHERE token_hash=?').bind(await digest(token)).run();return reply({ok:true},200,`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`)}
const id=typeof body.id==='string'?normalizeId(body.id):'';const password=typeof body.password==='string'?body.password:'';
const now=Date.now(),bucket=Math.floor(now/900000);
await db.prepare('DELETE FROM auth_limits WHERE expires<?').bind(now).run();const ip=request.headers.get('cf-connecting-ip')||'unknown';
for(const [key,max] of [[await digest('ip:'+ip+':'+bucket),120],[await digest('id:'+id+':'+bucket),10]] as const){const count=await db.prepare('INSERT INTO auth_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,(bucket+1)*900000).first<{count:number}>();if(count!.count>max)return reply({error:'Too many attempts. Try again in 15 minutes.'},429)}
if(body.portal&&body.portal!=='student')return reply({error:'Use the separate faculty website.'},403);
const student=roster.find(s=>s.id===id);if(!student||password.length<10||password.length>128)return reply({error:'Check your ID and credentials. Passwords must be 10–128 characters.'},401);
const account=await db.prepare('SELECT * FROM student_credentials WHERE id=?').bind(id).first<{password_hash:string;salt:string}>();
if(body.action==='activate'){
if(account||typeof body.code!=='string'||!equal(await digest(body.code.trim()),student.activationHash))return reply({error:'Account already activated or activation details are incorrect.'},401);
const salt=randomToken(),hash=await passwordHash(password,salt);
const result=await db.prepare('INSERT OR IGNORE INTO student_credentials VALUES(?,?,?,?)').bind(id,hash,salt,new Date().toISOString()).run();if(!result.meta.changes)return reply({error:'Account already activated. Sign in instead.'},409);
}else if(body.action==='login'){
if(!account||!equal(await passwordHash(password,account.salt),account.password_hash))return reply({error:'ID or password is incorrect. First-time users must activate their account.'},401);
}else return reply({error:'Unknown action'},400);
const token=randomToken(),expires=Date.now()+7*86400000;
await db.batch([db.prepare('DELETE FROM student_sessions WHERE expires<?').bind(Date.now()),db.prepare('INSERT INTO student_sessions VALUES(?,?,?)').bind(await digest(token),id,expires)]);
return reply({ok:true},200,`${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
}catch(error){return failure(error,reply)}}
export async function GET(request:Request){return reply({student:await getStudent(request)})}
