import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const sqlite=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+file,'utf8'));
const d1={
  prepare(sql){return {sql,values:[],bind(...values){this.values=values;return this},
    async first(){return sqlite.prepare(sql).get(...this.values)||null},
    async all(){return {results:sqlite.prepare(sql).all(...this.values)}},
    async run(){const result=sqlite.prepare(sql).run(...this.values);return {meta:{changes:Number(result.changes)}}}}},
  async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>{const result=sqlite.prepare(s.sql).run(...s.values);return {meta:{changes:Number(result.changes)}}});sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}
};
globalThis.backendEnv={DB:d1};
const dataUrl=(file,replacements={})=>{
  let source=fs.readFileSync(file,'utf8').replace("import {env} from 'cloudflare:workers';",'const env=globalThis.backendEnv;');
  for(const [from,to] of Object.entries(replacements))source=source.replaceAll("'"+from+"'","'"+to+"'");
  return 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
};
const digest=async text=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');
const students=[{id:'MAINS-SUBJECTS',name:'Subject Tester',activationHash:await digest('subjects-private-code')},{id:'MAINS-33060',name:'Test Faculty',activationHash:await digest('faculty-private-code')},{id:'MAINS-TEST',name:'Test Student',activationHash:await digest('student-private-code')}];
const rosterUrl='data:text/javascript;base64,'+Buffer.from('export const roster='+JSON.stringify(students)).toString('base64');
const curriculumUrl=dataUrl('lib/curriculum.ts'),starterUrl=dataUrl('lib/starter-bank.ts');
const httpUrl=dataUrl('lib/http.ts'),gameUrl=dataUrl('lib/game.ts'),authUrl=dataUrl('lib/mains-auth.ts',{'./mains-roster':rosterUrl});
const auth=await import(authUrl),game=await import(gameUrl);
const login=await import(dataUrl('app/api/auth/route.ts',{'../../../lib/mains-roster':rosterUrl,'../../../lib/mains-auth':authUrl,'../../../lib/http':httpUrl}));
const api=await import(dataUrl('app/api/quested/route.ts',{'../../../lib/mains-auth':authUrl,'../../../lib/game':gameUrl,'../../../lib/http':httpUrl,'../../../lib/curriculum':curriculumUrl,'../../../lib/starter-bank':starterUrl}));
const health=await import(dataUrl('app/api/health/route.ts'));
const origin='https://quested.example';
const req=(path,body,cookie,headers={})=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{...(body!==undefined?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
async function call(body,cookie){if(['quiz','submit','quiz-review'].includes(body?.action)&&body.subject===undefined)body={...body,subject:'DSA'};const r=await api.POST(req('/api/quested',body,cookie));return {status:r.status,data:await r.json()}}
async function state(cookie){const r=await api.GET(req('/api/quested',undefined,cookie));assert.equal(r.status,200);return r.json()}
const count=sql=>sqlite.prepare(sql).get();
async function activate(id,code){const r=await login.POST(req('/api/auth',{action:'activate',id,code,password:'long test password'}));assert.equal(r.status,200);const header=r.headers.get('set-cookie');assert.match(header,/HttpOnly; Secure; SameSite=Lax/);return header.split(';')[0]}
assert.equal((await health.GET()).status,200);
assert.equal((await api.GET(req('/api/quested'))).status,401);
assert.equal((await api.GET(req('/api/quested?action=seed'))).status,405);
assert.equal(count('SELECT COUNT(*) AS n FROM people').n,0);
const facultyCookie=await activate('MAINS-33060','faculty-private-code');
const cookie=await activate('MAINS-TEST','student-private-code');
assert.equal((await login.POST(req('/api/auth',{action:'activate',id:'MAINS-TEST',code:'student-private-code',password:'long test password'}))).status,401);
const signedIn=await login.POST(req('/api/auth',{action:'login',id:'mains-test',password:'long test password'}));assert.equal(signedIn.status,200);
assert.equal((await login.POST(req('/api/auth',{action:'login',id:'MAINS-TEST',password:'wrong password'}))).status,401);
assert.equal((await login.POST(req('/api/auth',{action:'login',id:'MAINS-TEST',password:'long test password'},{},{Origin:'https://evil.example'}))).status,403);
const session=sqlite.prepare('SELECT token_hash FROM student_sessions WHERE student=?').get('MAINS-TEST');assert.notEqual(session.token_hash,cookie.split('=')[1]);
assert.equal((await call({action:'seed'},cookie)).status,403);
assert.equal((await call({action:'quiz'},cookie)).status,200);
assert.equal((await call({action:'seed'},facultyCookie)).status,403);
assert.equal((await call({action:'seed'},facultyCookie)).status,403);
assert.equal(count('SELECT COUNT(*) AS n FROM questions').n,36);
const [first,second]=await Promise.all([call({action:'quiz'},cookie),call({action:'quiz'},cookie)]);
assert.equal(first.status,200);assert.deepEqual(first.data,second.data);assert.equal(first.data.questions.length,5);
assert.equal(new Set(first.data.questions.map(q=>q.subject)).size,1);
for(const question of first.data.questions){assert.equal('answer' in question,false);assert.equal('explanation' in question,false)}
assert.equal(count("SELECT COUNT(*) AS n FROM attempts WHERE user='MAINS-TEST'").n,1);
assert.equal((await call({action:'quiz-review',day:game.dayKey()},cookie)).status,404);
const attempt=sqlite.prepare("SELECT * FROM attempts WHERE user='MAINS-TEST'").get(),snapshot=JSON.parse(attempt.questions_snapshot),answers=snapshot.map(q=>q.answer);
assert.equal(new Set(answers).size,4);
for(const q of snapshot){const original=sqlite.prepare('SELECT options,answer FROM questions WHERE id=?').get(q.id);assert.equal(q.options[q.answer],JSON.parse(original.options)[original.answer])}
assert.equal((await call({action:'submit',answers:{}},cookie)).status,400);
assert.equal((await call({action:'submit',answers:[0]},cookie)).status,400);
assert.equal((await call({action:'submit',answers:answers.map(()=>8)},cookie)).status,400);
sqlite.prepare("UPDATE config SET value=? WHERE key='rules'").run(JSON.stringify({...game.defaults,quiz:100,correct:100}));
for(const q of snapshot)sqlite.prepare('UPDATE questions SET approved=0 WHERE id=?').run(q.id);
const submitted=await Promise.all([call({action:'submit',answers,xp:999999},cookie),call({action:'submit',answers,xp:999999},cookie)]);
assert.deepEqual(submitted.map(r=>r.status).sort(),[200,409]);
const success=submitted.find(r=>r.status===200);assert.equal(success.data.xp,40);assert.equal(success.data.correct,5);
assert.equal(count("SELECT COUNT(*) AS n,SUM(xp) AS xp FROM events WHERE user='MAINS-TEST' AND kind='quiz'").xp,40);
assert.equal((await call({action:'quiz'},cookie)).data.submitted,true);
const historyReview=await call({action:'quiz-review',day:game.dayKey()},cookie);assert.equal(historyReview.status,200);assert.deepEqual(historyReview.data.answers,answers);assert.ok(historyReview.data.questions.every(q=>'explanation' in q));
for(const q of snapshot)sqlite.prepare('UPDATE questions SET approved=1 WHERE id=?').run(q.id);
let dashboard=await state(cookie);assert.equal(dashboard.total,40);assert.equal(dashboard.faculty,null);assert.equal(dashboard.badges.find(b=>b.name==='Perfect practice').earned,true);
assert.equal(JSON.stringify(dashboard).includes('password_hash'),false);
assert.equal(JSON.stringify(dashboard).includes('questions_snapshot'),false);
assert.equal((await call({action:'profile',name:'Student Alias',campus:'Jaipur',anonymous:true,hidden:false},cookie)).status,200);
let facultyState=await state(facultyCookie);assert.equal(facultyState.leaderboard.find(p=>p.me===false).name,'Student Alias');assert.equal(facultyState.health,undefined);assert.equal(facultyState.faculty,null);assert.equal(facultyState.owner,false);
assert.equal((await call({action:'profile',name:'Student Alias',campus:'Jaipur',anonymous:true,hidden:true},cookie)).status,200);
assert.equal((await state(facultyCookie)).leaderboard.some(p=>p.name==='Student Alias'),true);
// Legacy privacy preferences remain preserved, while the removed toggles cannot alter them.
sqlite.prepare("UPDATE people SET anonymous=1,hidden=1 WHERE id='MAINS-TEST'").run();
assert.equal((await state(facultyCookie)).leaderboard.some(p=>p.name==='Student Alias'||p.name==='Learner -TEST'),false);
assert.equal((await state(facultyCookie)).battles.find(b=>b.campus==='Jaipur').xp,40);
const award={action:'award',kind:'peer',user:'MAINS-TEST',source:'peer-0'};
assert.equal((await call(award,cookie)).status,403);
assert.equal((await call(award,facultyCookie)).status,403);
// A correction from stored data removes badges and mastery.
const event=sqlite.prepare("SELECT id FROM events WHERE kind='quiz'").get();sqlite.prepare('UPDATE events SET void_reason=? WHERE id=?').run('Verified correction',event.id);
dashboard=await state(cookie);assert.equal(dashboard.badges.find(b=>b.name==='Perfect practice').earned,false);assert.equal(dashboard.topics.every(t=>t.mastered===0),true);
// Freezes require a genuine learning day and are idempotent even under racing requests.
const day=game.dayKey();sqlite.prepare("INSERT INTO events VALUES('prior','MAINS-TEST','attendance','prior',10,?,'verified',NULL)").run(game.shiftDay(day,-2));
const frozen=await Promise.all([call({action:'freeze'},cookie),call({action:'freeze'},cookie)]);assert.deepEqual(frozen.map(r=>r.status).sort(),[200,409]);
assert.equal((await state(cookie)).freezes,1);
// A consumed freeze stays consumed after faculty voids it; caps use the application month.
const month=day.slice(0,7);for(let i=1;i<=2;i++)sqlite.prepare("INSERT INTO events VALUES(?,?,'freeze',?,0,?,'protected',NULL)").run('old-freeze-'+i,'MAINS-33060',month+'-0'+i,game.shiftDay(day,-10-i));
sqlite.prepare("INSERT INTO events VALUES('faculty-prior','MAINS-33060','attendance','prior',10,?,'verified',NULL)").run(game.shiftDay(day,-2));
assert.equal((await call({action:'freeze'},facultyCookie)).status,409);
sqlite.prepare("UPDATE events SET void_reason='correction' WHERE id='old-freeze-1'").run();
assert.equal((await state(facultyCookie)).freezes,0);
// Starting an old unsnapshotted attempt safely captures the current bank and rules.
await call({action:'quiz'},facultyCookie);sqlite.prepare("UPDATE attempts SET questions_snapshot=NULL,rules_snapshot=NULL WHERE user='MAINS-33060'").run();
assert.equal((await call({action:'quiz'},facultyCookie)).status,200);
assert.ok(count("SELECT questions_snapshot AS saved FROM attempts WHERE user='MAINS-33060'").saved);
// League pagination includes a participating learner even outside the top twenty.
for(let i=0;i<25;i++){const id='extra-'+i;sqlite.prepare('INSERT INTO people(id,name,joined) VALUES(?,?,?)').run(id,'Extra '+i,day);sqlite.prepare("INSERT INTO events VALUES(?,?,'assignment',?,220,?,'verified',NULL)").run('extra-event-'+i,id,'assignment-'+i,day)}
sqlite.prepare("UPDATE people SET hidden=0 WHERE id='MAINS-TEST'").run();
await call({action:'profile',name:'Student Alias',campus:'Jaipur'},cookie);
assert.equal((await state(cookie)).league.some(p=>p.me),true);
// Profile customization persists and removed/nonexistent campuses are rejected.
assert.equal((await call({action:'profile',name:'Student Alias',campus:'Pune'},cookie)).status,400);
assert.deepEqual((await state(cookie)).battles.map(b=>b.campus),['Jaipur','Bengaluru','Delhi']);
assert.equal((await call({action:'profile',name:'Student Alias',campus:'Delhi',avatar:'🦉',avatarColor:'blue',bio:'Building web apps'},cookie)).status,200);
assert.equal((await state(cookie)).me.avatar,'🦉');assert.equal((await state(cookie)).me.avatar_color,'blue');
assert.equal((await call({action:'profile',name:'Student Alias',campus:'Delhi',avatar:'invalid'},cookie)).status,400);
assert.equal((await login.POST(req('/api/auth',{action:'login',portal:'faculty',id:'MAINS-TEST',password:'long test password'}))).status,403);
assert.equal((await login.POST(req('/api/auth',{action:'login',portal:'admin',id:'MAINS-33060',password:'long test password'}))).status,403);
assert.equal((await call({action:'assignment-create',subject:'DSA',title:'Unauthorized',instructions:'Test',due:day},facultyCookie)).status,403);
assert.equal((await state(cookie)).activity.length,7);
// Badge progress comes from accepted daily quizzes and earned streak badges survive a later gap.
for(let i=1;i<=7;i++){
  const date=game.shiftDay(day,-i-2),id='historic-'+i;
  sqlite.prepare('INSERT INTO attempts(id,user,day,question_ids,answers,correct,submitted,questions_snapshot,rules_snapshot) VALUES(?,?,?,?,?,?,?,?,?)').run(id,'MAINS-TEST',date,JSON.stringify(snapshot.map(q=>q.id)),JSON.stringify(answers),5,date+'T00:00:00Z',JSON.stringify(snapshot),JSON.stringify(game.defaults));
  sqlite.prepare("INSERT INTO events VALUES(?,?,'quiz',?,40,?,'quiz',NULL)").run('historic-event-'+i,'MAINS-TEST',date,date);
}
let badges=(await state(cookie)).badges;assert.equal(badges.find(b=>b.name==='Week warrior').earned,true);assert.equal(badges.find(b=>b.name==='Week warrior').progress,7);
assert.equal((await call({action:'quiz-review',subject:'Mixed',day:game.shiftDay(day,-3)},cookie)).status,200);
assert.equal((await state(cookie)).quizHistory.length,7);
// Typed request errors, real byte limits (including bodies without Content-Length), and CSRF rejection.
assert.equal((await api.POST(new Request(origin+'/api/quested',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:origin},body:'{bad'}))).status,400);
assert.equal((await call([],cookie)).status,400);
assert.equal((await call({action:{nested:'seed'}},cookie)).status,400);
assert.equal((await api.POST(req('/api/quested',{action:'seed'},facultyCookie,{'Sec-Fetch-Site':'cross-site'}))).status,403);
assert.equal((await api.POST(req('/api/quested',{action:'profile',name:'x'.repeat(17000)},cookie))).status,413);
assert.equal((await api.POST(req('/api/quested',{action:'profile'},cookie,{'Content-Type':'text/plain'}))).status,415);
assert.equal((await call({action:'approve',id:'missing',approved:true},facultyCookie)).status,403);
assert.equal((await call({action:'question',subject:'Programming',topic:'Test',prompt:'Prompt',options:['Same','Same','Other','Last'],answer:0,explanation:'Explanation'},facultyCookie)).status,403);

// Separate faculty authentication, authoritative shared database and subject isolation.
const facultyRoster=[{id:'22222',name:'test demo',subject:'All subjects',activationHash:await digest('demo-code')},{id:'48219',name:'Nishant Singh',subject:'DSA',activationHash:await digest('dsa-code')},{id:'36475',name:'Anil Sharma',subject:'Chemistry',activationHash:await digest('chem-code')}];
const facultyRosterUrl='data:text/javascript;base64,'+Buffer.from('export const facultyRoster='+JSON.stringify(facultyRoster)).toString('base64');
const facultyAuthUrl=dataUrl('lib/faculty-auth.ts',{'./faculty-roster':facultyRosterUrl,'./mains-auth':authUrl});
const facultyLogin=await import(dataUrl('app/api/faculty/auth/route.ts',{'../../../../lib/faculty-roster':facultyRosterUrl,'../../../../lib/mains-auth':authUrl,'../../../../lib/faculty-auth':facultyAuthUrl,'../../../../lib/http':httpUrl}));
const demoUrl=dataUrl('lib/faculty-demo.ts',{'./http':httpUrl,'./game':gameUrl});
const facultyApi=await import(dataUrl('app/api/faculty/route.ts',{'../../../lib/curriculum':curriculumUrl,'../../../lib/mains-roster':rosterUrl,'../../../lib/faculty-auth':facultyAuthUrl,'../../../lib/http':httpUrl,'../../../lib/game':gameUrl}));
const freq=(body,token,path='/api/faculty')=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
const fc=async(body,token)=>{const r=await facultyApi.POST(freq(body,token));return {status:r.status,data:await r.json()}};
const fsState=async token=>{const r=await facultyApi.GET(freq(undefined,token));assert.equal(r.status,200);return r.json()};
assert.equal((await facultyApi.GET(req('/api/faculty',undefined,cookie))).status,401);
assert.equal((await facultyLogin.POST(freq({action:'activate',id:'MAINS-TEST',name:'Test Student',code:'student-private-code',password:'long test password'}))).status,401);
assert.equal((await facultyLogin.POST(freq({action:'activate',id:'48219',name:'Wrong Teacher',code:'dsa-code',password:'long test password'}))).status,401);
async function activateFaculty(id,name,code){const r=await facultyLogin.POST(freq({action:'activate',id,name,code,password:'long test password'}));assert.equal(r.status,200);return (await r.json()).token}
const dsaToken=await activateFaculty('48219','Nishant Singh','dsa-code'),chemToken=await activateFaculty('36475','Anil Sharma','chem-code');
assert.equal((await facultyLogin.POST(freq({action:'activate',id:'48219',name:'Nishant Singh',code:'dsa-code',password:'long test password'}))).status,401);
assert.equal((await facultyLogin.POST(req('/api/faculty/auth',{action:'login',id:'48219',password:'long test password'}))).status,403);
assert.equal((await facultyLogin.POST(freq({action:'login',id:'48219',password:'wrong password'}))).status,401);
const facultyRelogin=await facultyLogin.POST(freq({action:'login',id:'48219',password:'long test password'}));assert.equal(facultyRelogin.status,200);
assert.notEqual(sqlite.prepare('SELECT token_hash FROM faculty_sessions WHERE faculty=?').get('48219').token_hash,dsaToken);
assert.equal((await api.GET(req('/api/quested',undefined,'__Host-quested-session='+dsaToken))).status,401);
const assignment={action:'assignment-create',title:'Explain stacks',instructions:'Describe LIFO with an example.',due:game.shiftDay(day,3)};
assert.equal((await fc({...assignment,subject:'Chemistry'},dsaToken)).status,403);
assert.equal((await fc({...assignment,due:'2026-02-31'},dsaToken)).status,400);
assert.equal((await fc(assignment,dsaToken)).status,200);
assert.equal((await fc({...assignment,title:'Explain atoms'},chemToken)).status,200);
const coursework=(await state(cookie)).assignments.find(a=>a.subject==='DSA');
assert.ok(coursework);assert.equal((await call({action:'assignment-submit',id:coursework.id,response:'A stack is last in, first out.'},cookie)).status,200);
const pending=(await fsState(dsaToken)).submissions[0];assert.equal(pending.user,'MAINS-TEST');assert.equal(pending.response,'A stack is last in, first out.');
assert.equal((await fsState(chemToken)).submissions.length,0);
assert.equal((await fc({action:'assignment-review',id:pending.id},chemToken)).status,404);
const reviews=await Promise.all([fc({action:'assignment-review',id:pending.id},dsaToken),fc({action:'assignment-review',id:pending.id},dsaToken)]);assert.deepEqual(reviews.map(r=>r.status).sort(),[200,409]);
assert.equal(count("SELECT COUNT(*) AS n FROM events WHERE source='assignment:"+coursework.id+"'").n,1);
assert.ok((await state(cookie)).assignments.find(a=>a.id===coursework.id).reviewed);
assert.equal((await call({action:'assignment-submit',id:coursework.id,response:'Changing after review'},cookie)).status,409);
const teacherQuestion={action:'question',topic:'Stacks',prompt:'What is LIFO?',options:['Last in first out','First in first out','Random access','Sorted order'],answer:0,explanation:'Stacks remove the last element added.'};
assert.equal((await fc(teacherQuestion,dsaToken)).status,200);
const questionRecord=(await fsState(dsaToken)).questions.find(q=>q.prompt===teacherQuestion.prompt);assert.ok(questionRecord);
assert.equal((await fc({action:'approve',id:questionRecord.id,approved:true},chemToken)).status,404);
assert.equal((await fc({action:'approve',id:questionRecord.id,approved:true},dsaToken)).status,200);
const facultyDashboard=await fsState(dsaToken);assert.equal(facultyDashboard.students.find(s=>s.id==='MAINS-TEST').reviewed,1);
assert.equal(facultyDashboard.questions.every(q=>q.subject==='DSA'),true);
assert.equal(JSON.stringify(facultyDashboard).includes('password_hash'),false);assert.equal(JSON.stringify(facultyDashboard).includes('activationHash'),false);
// Equal topic names in different subjects have independent progress.
for(const [subject,token] of [['DSA',dsaToken],['Chemistry',chemToken]]){await fc({...teacherQuestion,topic:'Shared topic',prompt:'Shared topic '+subject},token);const q=(await fsState(token)).questions.find(q=>q.prompt==='Shared topic '+subject);await fc({action:'approve',id:q.id,approved:true},token)}
const sharedTopics=(await state(cookie)).topics.filter(t=>t.topic==='Shared topic');assert.equal(sharedTopics.length,2);assert.deepEqual(sharedTopics.map(t=>t.subject).sort(),['Chemistry','DSA']);assert.ok(sharedTopics.every(t=>t.total===1));
// The test account observes real students and all subjects, without changing coursework.
const demoToken=await activateFaculty('22222','test demo','demo-code');
const demoState=await fsState(demoToken);assert.equal(demoState.liveViewer,true);assert.equal(demoState.faculty.name,'test demo');assert.equal(demoState.students.some(s=>s.id==='MAINS-TEST'&&s.name==='Test Student'),true);assert.equal(demoState.students.some(s=>s.id.startsWith('DEMO-')),false);
assert.equal(new Set(demoState.assignments.map(a=>a.subject)).size,2);
assert.equal(demoState.submissions.find(s=>s.id===pending.id).name,'Test Student');
assert.equal((await fc({action:'assignment-review',id:pending.id},demoToken)).status,409);
assert.equal((await fc({...assignment,subject:'Chemistry',title:'Test live assignment'},demoToken)).status,200);
assert.equal((await state(cookie)).assignments.some(a=>a.title==='Test live assignment'&&a.subject==='Chemistry'),true);
const liveAssignment=(await state(cookie)).assignments.find(a=>a.title==='Test live assignment');
await call({action:'assignment-submit',id:liveAssignment.id,response:'Real linked student submission'},cookie);
const liveSubmission=(await fsState(demoToken)).submissions.find(s=>s.assignment===liveAssignment.id);
assert.equal((await fc({action:'assignment-review',id:liveSubmission.id},demoToken)).status,200);
assert.ok((await state(cookie)).assignments.find(a=>a.id===liveAssignment.id).reviewed);
assert.equal((await fc({...assignment,subject:'Invalid'},demoToken)).status,400);
assert.equal((await fc(teacherQuestion,demoToken)).status,403);
// Faculty-published challenges replace automatic practice only on their scheduled day.
sqlite.prepare("UPDATE config SET value=? WHERE key='rules'").run(JSON.stringify(game.defaults));
const challenge={action:'daily-challenge-create',subject:'Chemistry',day,title:'Faculty chemistry daily challenge',instructions:'Focus on the explanations.',questions:Array.from({length:20},(_,i)=>({...teacherQuestion,topic:'Chemistry challenge',prompt:'Faculty question '+i}))};
assert.equal((await call(challenge,cookie)).status,403);
assert.equal((await fc(challenge,dsaToken)).status,403);
assert.equal((await fc({...challenge,day:game.shiftDay(day,-1)},chemToken)).status,400);
assert.equal((await fc({...challenge,day:'2026-02-31'},chemToken)).status,400);
assert.equal((await fc({...challenge,questions:[]},chemToken)).status,400);
assert.equal((await fc({...challenge,questions:[{...teacherQuestion,options:['Same','Same','Three','Four']}]},chemToken)).status,400);
const published=await Promise.all([fc(challenge,chemToken),fc(challenge,chemToken)]);assert.deepEqual(published.map(r=>r.status).sort(),[200,409]);
assert.equal((await fsState(chemToken)).challenges.length,1);assert.equal((await fsState(dsaToken)).challenges.length,0);
const futureChallenge={...challenge,subject:'DSA',day:game.shiftDay(day,1),title:'Tomorrow only',questions:[teacherQuestion]};assert.equal((await fc(futureChallenge,dsaToken)).status,200);
assert.equal((await state(cookie)).subjectQuizzes.find(s=>s.subject==='DSA').challengeTitle,null);
assert.equal((await state(cookie)).subjectQuizzes.find(s=>s.subject==='Chemistry').challengeTitle,challenge.title);
const customQuiz=await call({action:'quiz',subject:'Chemistry'},cookie);assert.equal(customQuiz.status,200);assert.equal(customQuiz.data.challenge.title,challenge.title);assert.equal(customQuiz.data.questions.every(q=>q.id.startsWith('faculty-')&&q.subject==='Chemistry'),true);assert.equal(customQuiz.data.questions.some(q=>'answer' in q||'explanation' in q),false);
const customAttempt=sqlite.prepare('SELECT questions_snapshot FROM attempts WHERE user=? AND subject=? AND day=?').get('MAINS-TEST','Chemistry',day),customAnswers=JSON.parse(customAttempt.questions_snapshot).map(q=>q.answer);
assert.equal((await call({action:'submit',subject:'Chemistry',answers:customAnswers},cookie)).data.xp,115);
assert.equal((await call({action:'submit',subject:'Chemistry',answers:customAnswers},cookie)).status,409);
assert.equal((await fsState(chemToken)).activity.find(a=>a.user==='MAINS-TEST'&&a.subject==='Chemistry').xp,115);
assert.equal((await fc({...futureChallenge,day},dsaToken)).status,409);
const shortChallenge={...challenge,subject:'Constitutional Design',title:'One-question faculty challenge',questions:[teacherQuestion]};assert.equal((await fc(shortChallenge,demoToken)).status,200);
assert.equal((await state(cookie)).subjectQuizzes.find(s=>s.subject==='Constitutional Design').questionCount,1);
assert.equal((await state(cookie)).subjectQuizzes.find(s=>s.subject==='Constitutional Design').maxXP,20);
// Exercise actual faculty-site proxy against the actual backend handlers.
const facultyProxy=await import(dataUrl('tests/fixtures/faculty-proxy.ts'));
const actualFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{assert.equal(options.redirect,'manual');const r=new Request(url,options);return url.endsWith('/api/faculty/auth')?facultyLogin[r.method](r):facultyApi[r.method](r)};
const proxyOrigin='https://faculty.example';const preq=(body,cookie)=>new Request(proxyOrigin+'/api/auth',{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:proxyOrigin,...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
const proxyLogin=await facultyProxy.proxy(preq({action:'login',id:'48219',password:'long test password'}),'/api/faculty/auth',true);assert.equal(proxyLogin.status,200);assert.equal('token' in await proxyLogin.json(),false);
const teacherCookie=proxyLogin.headers.get('set-cookie').split(';')[0];
const wrongLogin=await facultyProxy.proxy(preq({action:'login',id:'48219',password:'wrong password'},teacherCookie),'/api/faculty/auth',true);assert.equal(wrongLogin.status,401);assert.equal(wrongLogin.headers.has('set-cookie'),false);
assert.match(proxyLogin.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
const proxied=await facultyProxy.proxy(preq(undefined,teacherCookie),'/api/faculty');assert.equal(proxied.status,200);assert.equal((await proxied.json()).faculty.id,'48219');
assert.equal((await facultyProxy.proxy(preq(undefined,cookie),'/api/faculty')).status,401);
const csrf=new Request(proxyOrigin+'/api/auth',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal((await facultyProxy.proxy(csrf,'/api/faculty/auth',true)).status,403);
const proxyLogout=await facultyProxy.proxy(preq({action:'logout'},teacherCookie),'/api/faculty/auth',true);assert.equal(proxyLogout.status,200);assert.match(proxyLogout.headers.get('set-cookie'),/Max-Age=0/);
assert.equal((await facultyProxy.proxy(preq(undefined,teacherCookie),'/api/faculty')).status,401);
globalThis.fetch=async()=>new Response('',{status:302,headers:{Location:'https://untrusted.example'}});
assert.equal((await facultyProxy.proxy(preq({action:'login',id:'48219',password:'long test password'}),'/api/faculty/auth',true)).status,503);
globalThis.fetch=actualFetch;
await facultyLogin.POST(freq({action:'logout'},dsaToken));assert.equal((await facultyApi.GET(freq(undefined,dsaToken))).status,401);
sqlite.prepare('UPDATE faculty_sessions SET expires=0').run();assert.equal((await facultyApi.GET(freq(undefined,chemToken))).status,401);
// All six subjects score independently, with server-controlled rewards and duplicate protection.
sqlite.prepare("UPDATE config SET value=? WHERE key='rules'").run(JSON.stringify(game.defaults));
const subjectCookie=await activate('MAINS-SUBJECTS','subjects-private-code');
assert.equal((await api.POST(req('/api/quested',{action:'quiz'},subjectCookie))).status,400);
assert.equal((await call({action:'quiz',subject:'Invalid subject'},subjectCookie)).status,400);
const names=(await import(curriculumUrl)).subjects.map(s=>s.name);
for(const subject of names){const started=await call({action:'quiz',subject},subjectCookie);assert.equal(started.status,200);assert.equal(started.data.subject,subject);assert.equal(started.data.questions.every(q=>q.subject===subject),true);assert.equal(started.data.questions.length,subject==='Constitutional Design'?1:subject==='Chemistry'?20:5);if(['Chemistry','Constitutional Design'].includes(subject))assert.ok(started.data.challenge);const row=sqlite.prepare('SELECT questions_snapshot FROM attempts WHERE user=? AND day=? AND subject=?').get('MAINS-SUBJECTS',day,subject),keys=JSON.parse(row.questions_snapshot).map(q=>q.answer);const results=await Promise.all([call({action:'submit',subject,answers:keys,xp:100000},subjectCookie),call({action:'submit',subject,answers:keys,xp:100000},subjectCookie)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(results.find(r=>r.status===200).data.xp,subject==='Constitutional Design'?20:subject==='Chemistry'?115:40);const review=await call({action:'quiz-review',day,subject},subjectCookie);assert.equal(review.status,200);assert.equal(review.data.subject,subject);assert.deepEqual(review.data.answers,keys)}
const allSubjects=await state(subjectCookie);assert.equal(allSubjects.total,295);assert.equal(allSubjects.quizHistory.length,6);assert.equal(allSubjects.subjectQuizzes.length,6);assert.ok(allSubjects.subjectQuizzes.every(s=>s.completed&&s.xp===(s.subject==='Constitutional Design'?20:s.subject==='Chemistry'?115:40)&&s.todayXP===s.xp));assert.equal(allSubjects.dailyChallenge.completed,true);assert.equal(allSubjects.streak,1);assert.equal(allSubjects.activity.at(-1).accuracy,100);assert.equal(allSubjects.badges.find(b=>b.name==='Week warrior').progress,1);assert.equal(allSubjects.badges.find(b=>b.name==='Rising star').earned,false);
// Isolated rate-limit tests avoid waiting or sending requests to production.
sqlite.exec('DELETE FROM api_limits');const rate=[];for(let i=0;i<121;i++)rate.push((await call({action:'unknown'},cookie)).status);assert.equal(rate.at(-1),429);
for(let i=0;i<11;i++)await login.POST(req('/api/auth',{action:'login',id:'MAINS-NOT-ALLOWED',password:'wrong password'}));
assert.equal((await login.POST(req('/api/auth',{action:'login',id:'MAINS-NOT-ALLOWED',password:'wrong password'}))).status,429);
const loggedOut=await login.POST(req('/api/auth',{action:'logout'},cookie));assert.equal(loggedOut.status,200);assert.equal((await api.GET(req('/api/quested',undefined,cookie))).status,401);
sqlite.prepare('UPDATE student_sessions SET expires=0').run();assert.equal((await api.GET(req('/api/quested',undefined,facultyCookie))).status,401);
console.log('PASS: real database/API integration — student/faculty isolation, one-time activation, hashed sessions, subject permissions, shared assignment review, proxy cookies/CSRF, quiz scoring/snapshots, badge history, profiles, concurrency and throttling');
