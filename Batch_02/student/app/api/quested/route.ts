import {env} from 'cloudflare:workers';
import {getStudent,sameOrigin,ownerId} from '../../../lib/mains-auth';
import {defaults,dayKey,weekKey,scoreQuiz,streak,shiftDay} from '../../../lib/game';
import {starterBank} from '../../../lib/starter-bank';
import {campuses,subjects,avatars,avatarColors} from '../../../lib/curriculum';
import {HttpError,readJson,textField,failure} from '../../../lib/http';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
type Question={id:string;subject:string;topic:string;prompt:string;options:string[];answer:number;explanation:string};
const questionFromRow=(q:any):Question=>({...q,options:JSON.parse(q.options)});
export async function GET(r:Request){return handle(r)}
export async function POST(r:Request){return handle(r)}
async function handle(r:Request){try{
  if(r.method==='POST'&&!sameOrigin(r))throw new HttpError('Request origin rejected',403);
  if(r.method==='GET'&&new URL(r.url).searchParams.has('action')&&new URL(r.url).searchParams.get('action')!=='state')throw new HttpError('Actions require POST.',405);
  const identity=await getStudent(r);if(!identity)throw new HttpError('Sign in with your Mains ID to save your learning progress.',401);
  const db=env.DB!;const uid=identity.userId,day=dayKey(),week=weekKey(day),owner=false;
  const run=(sql:string,...values:any[])=>db.prepare(sql).bind(...values);
  const rows=async(sql:string,...values:any[])=>(await run(sql,...values).all()).results as any[];
  const body=r.method==='POST'?await readJson(r,1048576,'submit'):{};
  const action=body.action??'state';if(typeof action!=='string')throw new HttpError('Invalid action.');
  const subject=body.subject;
  if(['quiz','submit'].includes(action)&&!subjects.some(s=>s.name===subject))throw new HttpError('Choose one of the six quiz subjects.');
  if(action==='quiz-review'&&subject!=='Mixed'&&!subjects.some(s=>s.name===subject))throw new HttpError('Choose a valid quiz subject.');
  if(r.method==='POST'){
    const now=Date.now(),key=uid+':'+Math.floor(now/60000);
    const count=await run('INSERT INTO api_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',key,now+120000).first<{count:number}>();
    if(count!.count>120)throw new HttpError('Too many requests. Try again in a minute.',429);
    await run('DELETE FROM api_limits WHERE expires<?',now).run();
  }
  await db.batch([run('INSERT OR IGNORE INTO people(id,name,joined) VALUES(?,?,?)',uid,identity.fullName,day),run('INSERT OR IGNORE INTO config(key,value) VALUES(?,?)','owner',ownerId),run('INSERT OR IGNORE INTO config(key,value) VALUES(?,?)','rules',JSON.stringify(defaults))]);
  const starterVersion=await run("SELECT value FROM config WHERE key='starter-bank'").first<{value:string}>();
  if(!starterVersion){
    await db.batch([...starterBank.map((q,i)=>run('INSERT OR IGNORE INTO questions VALUES(?,?,?,?,?,?,?,?)','starter-'+i,q[0],q[1],q[2],JSON.stringify(q[3]),q[4],q[5],1)),run("INSERT OR IGNORE INTO config(key,value) VALUES('starter-bank','1')")]);
  }
  const stored=await run("SELECT value FROM config WHERE key='rules'").first<{value:string}>();
  const rules={...defaults,...JSON.parse(stored!.value)};
  const awardStreak=async(user:string)=>{
    const activity=await rows('SELECT day,kind FROM events WHERE user=? AND void_reason IS NULL',user);
    if(!activity.some(e=>e.day===day&&e.kind!=='freeze'&&e.kind!=='streak'))return;
    const count=streak(activity.map(e=>e.day),day);
    if(count>0&&count%7===0)await run('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?,?,NULL)',crypto.randomUUID(),user,'streak',day,rules.streak,day,'7-day milestone').run();
  };
  // Snapshot answers and reward rules on first start: faculty edits cannot change an active quiz.
  const snapshot=async(a:any):Promise<{questions:Question[];rules:typeof defaults}>=>{
    if(a.questions_snapshot&&a.rules_snapshot)return {questions:JSON.parse(a.questions_snapshot),rules:JSON.parse(a.rules_snapshot)};
    const ids:string[]=JSON.parse(a.question_ids);
    if(!ids.length)throw new HttpError('This attempt has no questions. Contact faculty.',409);
    const found=await rows('SELECT * FROM questions WHERE id IN ('+ids.map(()=>'?').join(',')+')',...ids);
    const questions=ids.map(id=>{const q=found.find(q=>q.id===id);if(!q)throw new HttpError('A question is unavailable. Contact faculty.',409);return questionFromRow(q)});
    await run('UPDATE attempts SET questions_snapshot=?,rules_snapshot=? WHERE id=? AND questions_snapshot IS NULL',JSON.stringify(questions),JSON.stringify(rules),a.id).run();
    const saved=await run('SELECT questions_snapshot,rules_snapshot FROM attempts WHERE id=?',a.id).first<any>();
    return {questions:JSON.parse(saved.questions_snapshot),rules:JSON.parse(saved.rules_snapshot)};
  };
  const presentQuiz=async(a:any)=>{const frozen=await snapshot(a);const challenge=await run('SELECT title,instructions,faculty FROM daily_challenges WHERE subject=? AND day=?',a.subject,a.day).first<any>();return json({challenge:challenge?{title:challenge.title,instructions:challenge.instructions}:null,subject:a.subject,day:a.day,submitted:!!a.submitted,answers:a.submitted?JSON.parse(a.answers):undefined,correct:a.correct,reward:{max:frozen.rules.quiz+frozen.rules.correct*frozen.questions.length},questions:frozen.questions.map(q=>({id:q.id,subject:q.subject,topic:q.topic,prompt:q.prompt,options:q.options,...(a.submitted?{answer:q.answer,explanation:q.explanation}:{})}))})};
  if(action==='quiz-review'){
    if(typeof body.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.day))throw new HttpError('Choose a valid challenge date.');
    const a=await run('SELECT * FROM attempts WHERE user=? AND day=? AND subject=? AND submitted IS NOT NULL',uid,body.day,subject).first<any>();
    if(!a)throw new HttpError('Completed challenge not found.',404);return presentQuiz(a);
  }
  if(action==='quiz'){
    let a=await run('SELECT * FROM attempts WHERE user=? AND day=? AND subject=?',uid,day,subject).first<any>();
    if(!a){
      const challenge=await run('SELECT * FROM daily_challenges WHERE subject=? AND day=?',subject,day).first<any>();
      const approved=challenge?JSON.parse(challenge.questions).map((q:any)=>({...q,options:JSON.stringify(q.options)})):await rows('SELECT * FROM questions WHERE approved=1 AND subject=? ORDER BY id',subject);
      if(!challenge&&approved.length<3)throw new HttpError('Faculty must approve at least 3 questions for this subject first.',409);
      const ordinal=Math.floor(new Date(day).getTime()/86400000),hash=Array.from(uid).reduce((n,c)=>n+c.charCodeAt(0),0);
      const questionCount=challenge?approved.length:Math.min(5,approved.length);
      const positions=Array.from({length:questionCount},(_,i)=>i%4);
      for(let i=positions.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[positions[i],positions[j]]=[positions[j],positions[i]]}
      const selected=Array.from({length:questionCount},(_,i)=>questionFromRow(approved[(ordinal+hash+i)%approved.length])).map((q,i)=>{const answer=positions[i],shift=(answer-q.answer+4)%4;return {...q,answer,options:q.options.map((_,j)=>q.options[(j-shift+4)%4])}});
      await run(`INSERT OR IGNORE INTO attempts(id,user,day,subject,question_ids,questions_snapshot,rules_snapshot) SELECT ?,?,?,?,?,?,? WHERE (? IS NULL AND NOT EXISTS(SELECT 1 FROM daily_challenges WHERE subject=? AND day=?)) OR EXISTS(SELECT 1 FROM daily_challenges WHERE id=?)`,crypto.randomUUID(),uid,day,subject,JSON.stringify(selected.map(q=>q.id)),JSON.stringify(selected),JSON.stringify(rules),challenge?.id??null,subject,day,challenge?.id??null).run();
      a=await run('SELECT * FROM attempts WHERE user=? AND day=? AND subject=?',uid,day,subject).first<any>();
    }
    if(!a)throw new HttpError('A faculty challenge has just been published. Load the subject quiz again.',409);
    return presentQuiz(a);
  }
  if(action==='submit'){
    const a=await run('SELECT * FROM attempts WHERE user=? AND day=? AND subject=?',uid,day,subject).first<any>();
    if(!a||a.submitted)throw new HttpError('This daily quiz is already submitted or has not been started.',409);
    const frozen=await snapshot(a),questions=frozen.questions,keys=questions.map(q=>q.answer);
    let result;try{result=scoreQuiz(body.answers,keys,frozen.rules)}catch{throw new HttpError('Answer every question with a valid option.')}
    const committed=await db.batch([
      run(`INSERT OR IGNORE INTO events SELECT ?,user,?,day||':'||subject,?,day,?,NULL FROM attempts WHERE id=? AND submitted IS NULL`,crypto.randomUUID(),'quiz',result.xp,JSON.stringify({subject,correct:result.correct,total:keys.length,topics:questions.map(q=>q.topic)}),a.id),
      run('UPDATE attempts SET answers=?,correct=?,submitted=? WHERE id=? AND submitted IS NULL',JSON.stringify(body.answers),result.correct,new Date().toISOString(),a.id)
    ]);
    if(!committed[0].meta.changes)throw new HttpError('Duplicate submission blocked',409);
    await awardStreak(uid);
    return json({...result,subject,feedback:questions.map((q,i)=>({prompt:q.prompt,correct:body.answers[i]===q.answer,answer:q.answer,explanation:q.explanation}))});
  }
  if(action==='profile'){
    const name=textField(body.name,'Display name',60);
    if(!campuses.includes(body.campus))throw new HttpError('Choose a valid campus.');
    const avatar=body.avatar??'⚡',avatarColor=body.avatarColor??'lavender',bio=body.bio??'';
    if(!avatars.includes(avatar)||!avatarColors.includes(avatarColor)||typeof bio!=='string'||bio.length>160)throw new HttpError('Choose a valid avatar and color. Bio limit: 160 characters.');
    await run('UPDATE people SET name=?,campus=?,avatar=?,avatar_color=?,bio=? WHERE id=?',name,body.campus,avatar,avatarColor,bio.trim(),uid).run();return json({ok:true});
  }
  if(action==='assignment-submit'){
    const id=textField(body.id,'Assignment ID',100),response=textField(body.response,'Your response',6000);
    if(!await run('SELECT id FROM assignments WHERE id=?',id).first())throw new HttpError('Assignment not found',404);
    const saved=await run(`INSERT INTO submissions(id,assignment,user,response,submitted) VALUES(?,?,?,?,?)
      ON CONFLICT(assignment,user) DO UPDATE SET response=excluded.response,submitted=excluded.submitted WHERE submissions.reviewed IS NULL`,crypto.randomUUID(),id,uid,response,new Date().toISOString()).run();
    if(!saved.meta.changes)throw new HttpError('This assignment is already reviewed.',409);return json({ok:true});
  }
  if(action==='freeze'){
    const yesterday=shiftDay(day,-1),prior=shiftDay(day,-2),month=day.slice(0,7)+'-01';
    const result=await run(`INSERT OR IGNORE INTO events(id,user,kind,source,xp,day,detail,void_reason)
      SELECT ?,?,'freeze',?,0,?,'Protected missed day',NULL
      WHERE NOT EXISTS(SELECT 1 FROM events WHERE user=? AND day=? AND void_reason IS NULL)
      AND EXISTS(SELECT 1 FROM events WHERE user=? AND day=? AND kind NOT IN ('freeze','streak') AND void_reason IS NULL)
      AND (SELECT COUNT(*) FROM events WHERE user=? AND kind='freeze' AND source>=?)<2`,crypto.randomUUID(),uid,day,yesterday,uid,yesterday,uid,prior,uid,month).run();
    if(!result.meta.changes)throw new HttpError('Freezes cover one missed day after learning. Limit: 2 per month.',409);
    await awardStreak(uid);return json({ok:true});
  }
  if(['seed','rules','award','void','question','approve','assignment-create','assignment-review','daily-challenge-create'].includes(action))throw new HttpError('Use the separate faculty website.',403);
  if(action!=='state')throw new HttpError('Unknown action');
  // Aggregate XP in SQL once rather than loading every event and repeatedly scanning it.
  const [people,mine,qbank,quizzes,usedFreezes]=await Promise.all([
    rows(`SELECT p.*,COALESCE(e.total,0) AS total,COALESCE(e.weekly,0) AS weekly,COALESCE(e.last,p.joined) AS last
      FROM people p LEFT JOIN (SELECT user,SUM(xp) AS total,SUM(CASE WHEN day>=? THEN xp ELSE 0 END) AS weekly,MAX(day) AS last FROM events WHERE void_reason IS NULL GROUP BY user) e ON e.user=p.id`,week),
    rows('SELECT * FROM events WHERE user=? AND void_reason IS NULL ORDER BY day DESC,id',uid),
    rows('SELECT * FROM questions WHERE approved=1 ORDER BY subject,topic,id'),
    rows(`SELECT a.* FROM attempts a WHERE a.submitted IS NOT NULL AND (?=1 OR a.user=?)
      AND EXISTS(SELECT 1 FROM events e WHERE e.user=a.user AND e.kind='quiz' AND e.source=CASE WHEN a.subject='Mixed' THEN a.day ELSE a.day||':'||a.subject END AND e.void_reason IS NULL)`,owner?1:0,uid),
    rows("SELECT COUNT(*) AS used FROM events WHERE user=? AND kind='freeze' AND source>=?",uid,day.slice(0,7)+'-01')
  ]);
  const me=people.find(p=>p.id===uid),total=me.total,level=1+Math.floor(total/250);
  const leaderboard=people.filter(p=>!p.hidden).sort((a,b)=>b.weekly-a.weekly||a.id.localeCompare(b.id)).map(p=>({name:p.anonymous?'Learner '+p.id.slice(-5):p.name,avatar:p.avatar,avatarColor:p.avatar_color,campus:p.campus,me:p.id===uid,level:1+Math.floor(p.total/250),xp:p.weekly}));
  const band=Math.floor((level-1)/5),division=leaderboard.filter(p=>Math.floor((p.level-1)/5)===band);
  // Include the current learner in a 20-person division, even when they rank beyond the first 20.
  const rank=division.findIndex(p=>p.me),start=rank>=0?Math.floor(rank/20)*20:0,league=division.slice(start,start+20);
  const topicMap=new Map<string,{topic:string;subject:string;attempted:number;right:number;mastered:Set<string>;ids:Set<string>}>();
  for(const q of qbank){if(!topicMap.has(q.subject+':'+q.topic))topicMap.set(q.subject+':'+q.topic,{topic:q.topic,subject:q.subject,attempted:0,right:0,mastered:new Set(),ids:new Set()});topicMap.get(q.subject+':'+q.topic)!.ids.add(q.id)}
  for(const a of quizzes){const answers=JSON.parse(a.answers),ids:string[]=JSON.parse(a.question_ids);const saved:Question[]=a.questions_snapshot?JSON.parse(a.questions_snapshot):ids.map(id=>qbank.find(q=>q.id===id)).filter(Boolean).map(questionFromRow);
    saved.forEach(q=>{const t=topicMap.get(q.subject+':'+q.topic),i=ids.indexOf(q.id);if(!t||i<0)return;t.attempted++;if(answers[i]===q.answer){t.right++;if(a.user===uid&&t.ids.has(q.id))t.mastered.add(q.id)}});
  }
  const topics=[...topicMap.values()].map(t=>({topic:t.topic,subject:t.subject,attempted:t.attempted,accuracy:t.attempted?Math.round(t.right/t.attempted*100):null,mastered:t.mastered.size,total:t.ids.size}));
  const myQuizzes=quizzes.filter(q=>q.user===uid).sort((a,b)=>a.day.localeCompare(b.day));
  const dailyStreak=streak(myQuizzes.map(q=>q.day),day);
  let bestDailyStreak=0,currentRun=0,previous='';for(const date of [...new Set(myQuizzes.map(q=>q.day))]){currentRun=previous&&shiftDay(previous,1)===date?currentRun+1:1;bestDailyStreak=Math.max(bestDailyStreak,currentRun);previous=date}
  let improvement=0;const previousAccuracy=new Map<string,number>();for(const q of myQuizzes){const accuracy=q.correct/JSON.parse(q.question_ids).length;if(previousAccuracy.has(q.subject))improvement=Math.max(improvement,Math.round(100*(accuracy-previousAccuracy.get(q.subject)!)));previousAccuracy.set(q.subject,accuracy)}
  const todayAttempts=await rows('SELECT subject,submitted,correct,question_ids,rules_snapshot FROM attempts WHERE user=? AND day=?',uid,day);
  const assignments=await rows(`SELECT a.*,s.id AS submission_id,s.response,s.submitted,s.reviewed FROM assignments a LEFT JOIN submissions s ON s.assignment=a.id AND s.user=? ORDER BY a.due,a.created DESC`,uid);
  const quizHistory=myQuizzes.map(q=>({subject:q.subject,day:q.day,correct:q.correct,total:JSON.parse(q.question_ids).length,xp:mine.find(e=>e.kind==='quiz'&&e.source===(q.subject==='Mixed'?q.day:q.day+':'+q.subject))?.xp??0})).reverse();
  const activity=Array.from({length:7},(_,i)=>{const date=shiftDay(day,i-6),daily=quizHistory.filter(q=>q.day===date),answered=daily.reduce((n,q)=>n+q.total,0);return {day:date,xp:mine.filter(e=>e.day===date).reduce((n,e)=>n+e.xp,0),accuracy:answered?Math.round(100*daily.reduce((n,q)=>n+q.correct,0)/answered):null}});
  const scheduledChallenges=await rows('SELECT subject,title,instructions,questions FROM daily_challenges WHERE day=?',day);
  const subjectQuizzes=subjects.map(s=>{const history=quizHistory.filter(q=>q.subject===s.name),today=todayAttempts.find(a=>a.subject===s.name),challenge=scheduledChallenges.find(c=>c.subject===s.name),count=challenge?JSON.parse(challenge.questions).length:qbank.filter(q=>q.subject===s.name).length,questionCount=today?JSON.parse(today.question_ids).length:challenge?count:Math.min(5,count),frozenRules=today?.rules_snapshot?JSON.parse(today.rules_snapshot):rules;return {subject:s.name,faculty:s.faculty,completed:!!today?.submitted,challengeTitle:challenge?.title??null,available:!!today||!!challenge||count>=3,questionCount,todayXP:history.find(q=>q.day===day)?.xp??0,xp:history.reduce((n,q)=>n+q.xp,0),attempts:history.length,correct:today?.correct??null,maxXP:frozenRules.quiz+frozenRules.correct*questionCount}});
  const faculty=null;
  return json({me,total,assignments,quizHistory,activity,subjectQuizzes,dailyChallenge:{completed:subjectQuizzes.every(s=>s.completed),completedSubjects:subjectQuizzes.filter(s=>s.completed).length,totalSubjects:subjects.length,available:subjectQuizzes.some(s=>s.available)},topics:topics.map(({topic,subject,mastered,total})=>({topic,subject,mastered,total})),level,streak:streak(mine.map(e=>e.day),day),freezes:Math.max(0,2-usedFreezes[0].used),week,day,owner,rules,history:mine,leaderboard,league,battles:campuses.map(c=>({campus:c,xp:people.filter(p=>p.campus===c).reduce((n,p)=>n+p.weekly,0)})),badges:[
    {name:'First steps',earned:myQuizzes.length>0,description:'Complete your first daily challenge',progress:Math.min(1,myQuizzes.length),target:1},{name:'Week warrior',earned:bestDailyStreak>=7,description:'Complete daily challenges on 7 consecutive days',progress:bestDailyStreak>=7?7:Math.min(7,dailyStreak),target:7},
    {name:'Perfect practice',description:'Get every answer correct in a daily challenge',progress:myQuizzes.some(q=>q.correct===JSON.parse(q.question_ids).length)?1:0,target:1,earned:myQuizzes.some(q=>q.correct===JSON.parse(q.question_ids).length)},
    {name:'Rising star',progress:Math.min(15,improvement),target:15,description:'Improve accuracy in the same subject by 15 percentage points',earned:improvement>=15}
  ],faculty});
}catch(error){return failure(error,json)}}
