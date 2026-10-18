import {env} from 'cloudflare:workers';
import {facultyRoster} from './faculty-roster';
import {digest} from './mains-auth';
export async function getFaculty(r:Request){const token=r.headers.get('authorization')?.replace(/^Bearer /,'')||'';if(!/^[a-f0-9]{64}$/.test(token))return null;const session=await env.DB!.prepare('SELECT faculty FROM faculty_sessions WHERE token_hash=? AND expires>?').bind(await digest(token),Date.now()).first<{faculty:string}>();const f=facultyRoster.find(f=>f.id===session?.faculty);return f?{id:f.id,name:f.name,subject:f.subject}:null}
