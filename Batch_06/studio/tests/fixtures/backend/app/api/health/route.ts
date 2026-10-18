import {env} from 'cloudflare:workers';
export async function GET(){
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  try{
    // Read the required new schema too, so a missing migration reports unavailable.
    await env.DB!.prepare('SELECT subject,questions_snapshot,rules_snapshot FROM attempts LIMIT 1').all();
    await env.DB!.prepare('SELECT expires FROM api_limits LIMIT 1').all();
    await env.DB!.prepare('SELECT avatar,avatar_color,bio FROM people LIMIT 1').all();
    await env.DB!.prepare('SELECT id FROM assignments LIMIT 1').all();
    await env.DB!.prepare('SELECT id FROM submissions LIMIT 1').all();
    await env.DB!.prepare('SELECT id FROM faculty_credentials LIMIT 1').all();
    await env.DB!.prepare('SELECT faculty,expires FROM faculty_sessions LIMIT 1').all();
    await env.DB!.prepare('SELECT subject,day FROM daily_challenges LIMIT 1').all();
    return Response.json({status:'ready',service:'QuestEd',database:'connected',time:new Date().toISOString()},{headers});
  }catch(error){console.error('QuestEd health check failed',error);return Response.json({status:'unavailable',service:'QuestEd'},{status:503,headers})}
}
