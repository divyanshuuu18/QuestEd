import {env} from 'cloudflare:workers';
import {roster} from './mains-roster';
export const cookieName='__Host-quested-session';
export const ownerId='MAINS-33060';
export const normalizeId=(id:string)=>{const value=id.trim().toUpperCase();return value==='MAINS-11111'?'11111':value};
export async function digest(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join('')}
export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('')}
export async function passwordHash(password:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256))).map(b=>b.toString(16).padStart(2,'0')).join('')}
export function equal(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
export function sessionToken(request:Request){return request.headers.get('cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith(cookieName+'='))?.slice(cookieName.length+1)||''}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return request.headers.get('sec-fetch-site')!=='cross-site'&&(!origin||origin===new URL(request.url).origin)}
export async function getStudent(request:Request){const token=sessionToken(request);if(!/^[a-f0-9]{64}$/.test(token))return null;const session=await env.DB!.prepare('SELECT student FROM student_sessions WHERE token_hash=? AND expires>?').bind(await digest(token),Date.now()).first<{student:string}>();if(!session)return null;const student=roster.find(s=>s.id===session.student);return student?{userId:student.id,fullName:student.name,email:''}:null}
