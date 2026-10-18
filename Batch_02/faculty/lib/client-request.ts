export async function requestJson(path:string,body?:unknown){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{const r=await fetch(path,{cache:'no-store',signal:controller.signal,method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});let d:any;try{d=await r.json()}catch{throw Object.assign(Error('The service returned an unexpected response. Please try again.'),{status:r.status})}if(!r.ok)throw Object.assign(Error(d.error||'Request failed. Please try again.'),{status:r.status});return d}
 catch(e){if(controller.signal.aborted)throw Error('The request timed out. Check your connection and try again.');if(e instanceof TypeError)throw Error('Could not connect to QuestEd. Check your connection and try again.');throw e}finally{clearTimeout(timer)}
}
export function createDashboardLoader<T>(read:()=>Promise<T>,accept:(data:T)=>void,reject:(error:any)=>void){
 let epoch=0,flight:{epoch:number;promise:Promise<boolean>}|null=null;
 return {invalidate(){epoch++;flight=null},load(){if(flight?.epoch===epoch)return flight.promise;const generation=epoch;const entry={epoch:generation,promise:null as unknown as Promise<boolean>};entry.promise=(async()=>{try{const data=await Promise.resolve().then(read);if(generation!==epoch)return false;accept(data);return true}catch(e){if(generation===epoch)reject(e);return false}finally{if(flight===entry)flight=null}})();flight=entry;return entry.promise}}
}
