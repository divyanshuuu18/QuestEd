import {proxy} from '../../../lib/proxy';
export async function GET(r:Request){return proxy(r,'/api/faculty')}
export async function POST(r:Request){return proxy(r,'/api/faculty')}
