export const defaults={attendance:10,assignment:20,quiz:15,correct:5,test:50,coding:20,club:25,peer:15,streak:50};
export function dayKey(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
export function weekKey(day:string){const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10)}
export function scoreQuiz(answers:number[],keys:number[],rules:typeof defaults){if(!Array.isArray(answers)||answers.length!==keys.length||answers.some(a=>!Number.isInteger(a)||a<0||a>3))throw Error('Answer every question');const correct=answers.filter((a,i)=>a===keys[i]).length;return {correct,xp:rules.quiz+rules.correct*correct}}
export function streak(days:string[],today:string){const set=new Set(days);let d=new Date(today+'T00:00:00Z');if(!set.has(today))d.setUTCDate(d.getUTCDate()-1);let count=0;while(set.has(d.toISOString().slice(0,10))){count++;d.setUTCDate(d.getUTCDate()-1)}return count}
export const bank=[
['Programming','Recursion','What must a recursive function have to stop calling itself?',['A base case','A global variable','Two loops','A print statement'],0,'A base case stops recursion when the simplest case is reached.'],
['Programming','Recursion','What is factorial(0)?',['0','1','Undefined','10'],1,'0! = 1, which is a useful base case for factorial.'],
['Programming','Complexity','Binary search on a sorted array takes which time complexity?',['O(n²)','O(n)','O(log n)','O(1)'],2,'Each comparison halves the search space.'],
['Programming','Data structures','Which structure follows LIFO?',['Queue','Stack','Graph','Set'],1,'A stack removes the last item that was added.'],
['Programming','Recursion','A missing base case can cause what?',['Faster code','Stack overflow','Automatic sorting','Constant memory'],1,'Calls continue until the call stack runs out of space.'],
['Mathematics','Probability','A fair coin is tossed once. P(heads) is:',['0','1/4','1/2','1'],2,'There are two equally likely outcomes, one of which is heads.'],
['Mathematics','Functions','If f(x)=2x+3, what is f(4)?',['7','8','11','14'],2,'Substitute x=4: 2×4+3=11.'],
['Mathematics','Probability','Two fair coins are tossed. P(two heads) is:',['1/2','1/4','3/4','1'],1,'HH is one of four equally likely outcomes.'],
['Mathematics','Functions','The derivative of x² is:',['x','2x','2','x³'],1,'Apply the power rule: d(xⁿ)/dx = nxⁿ⁻¹.'],
['Mathematics','Probability','The probability of an impossible event is:',['0','1','-1','1/2'],0,'An event that cannot occur has probability zero.']
] as const;

export function shiftDay(day:string,offset:number){const date=new Date(day+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10)}
