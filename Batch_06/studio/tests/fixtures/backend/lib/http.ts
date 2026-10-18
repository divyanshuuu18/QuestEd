export class HttpError extends Error {
  status:number;
  constructor(message:string,status=400){super(message);this.status=status}
}

export async function readJson(request:Request,limit=16384,largeAction?:string):Promise<Record<string,any>>{
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new HttpError('Send application/json.',415);
  if(Number(request.headers.get('content-length'))>limit)throw new HttpError('Request too large.',413);
  const reader=request.body?.getReader();if(!reader)throw new HttpError('A JSON request body is required.');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new HttpError('Request too large.',413)}chunks.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  let value;try{value=JSON.parse(new TextDecoder().decode(bytes))}catch{throw new HttpError('Invalid JSON request.')}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError('Expected a JSON object.');if(largeAction&&value.action!==largeAction&&size>16384)throw new HttpError('Request too large.',413);return value;
}

export function textField(value:unknown,name:string,max:number){
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new HttpError(`${name} must be 1–${max} characters.`);
  return value.trim();
}

export function failure(error:unknown,reply:(data:unknown,status:number)=>Response){
  if(error instanceof HttpError)return reply({error:error.message},error.status);
  const reference=crypto.randomUUID();console.error('QuestEd request failed',reference,error);
  return reply({error:'Something went wrong. Please try again.',reference},500);
}
