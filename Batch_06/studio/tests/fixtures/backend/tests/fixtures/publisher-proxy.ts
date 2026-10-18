const origin='https://quested.glassysole8.chatgpt.site';
export const cookieName='__Host-quested-publisher';
export const token=(r:Request)=>r.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
export const json=(v:unknown,status=200,cookie?:string)=>Response.json(v,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export function allowed(r:Request){return r.headers.get('sec-fetch-site')!=='cross-site'&&(!r.headers.get('origin')||r.headers.get('origin')===new URL(r.url).origin)}
export async function proxy(r:Request,path:'/api/faculty'|'/api/faculty/auth',auth=false){let stage='request';try{
if(r.method==='POST'&&!allowed(r))return json({error:'Request origin rejected.'},403);
const session=token(r);if(!auth&&!/^[a-f0-9]{64}$/.test(session))return json({error:'Faculty sign in required.'},401);
let body:string|undefined;if(r.method==='POST'){if(!r.headers.get('content-type')?.includes('application/json'))return json({error:'Use JSON.'},415);const reader=r.body?.getReader();const chunks:Uint8Array[]=[];let size=0;if(reader){for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1048576){await reader.cancel();return json({error:'Request too large.'},413)}chunks.push(value)}}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}body=new TextDecoder().decode(bytes);try{const b=JSON.parse(body);if(!b||typeof b!=='object'||Array.isArray(b))return json({error:'Provide an object.'},400)}catch(e){console.error('Faculty proxy failed',{stage,name:e instanceof Error?e.name:'unknown',message:e instanceof Error?e.message:'unknown'});return json({error:'Invalid JSON.'},400)}}
stage='fetch';const response=await fetch(origin+path,{method:r.method,headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session}:{})},body,signal:AbortSignal.timeout(15000),redirect:'manual'});if(response.status>=300&&response.status<400)throw Error('Learning service redirect rejected.');stage='response';const data:any=await response.json();
let cookie:string|undefined;if(auth&&response.ok&&data.token){if(!/^[a-f0-9]{64}$/.test(data.token))throw Error('Invalid session');cookie=`${cookieName}=${data.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;delete data.token}
if(auth&&r.method==='POST'&&response.ok&&JSON.parse(body||'{}').action==='logout')cookie=`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
if(response.status===401&&session&&!(auth&&r.method==='POST'))cookie=`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
return json(data,response.status,cookie);
}catch(e){console.error('Faculty proxy failed',{stage,name:e instanceof Error?e.name:'unknown',message:e instanceof Error?e.message:'unknown'});return json({error:'The learning service is temporarily unavailable. Please try again.'},503)}}
