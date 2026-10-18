import {proxy} from '../../../lib/proxy';
export async function GET(r:Request){return proxy(r,'/api/faculty/auth',true)}
export async function POST(r:Request){return proxy(r,'/api/faculty/auth',true)}
