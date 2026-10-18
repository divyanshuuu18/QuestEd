import sqlite3,pathlib
c=sqlite3.connect(':memory:');c.executescript(pathlib.Path('drizzle/0000_wild_master_mold.sql').read_text())
c.execute("insert into people(id,name,joined) values('u','Learner','2026-10-10')")
c.execute("insert into attempts(id,user,day,question_ids) values('a','u','2026-10-10','[]')")
for i in range(300):
 c.execute("insert or ignore into events select ?,user,?,day,?,day,?,NULL from attempts where id=? and submitted is null",(str(i),'quiz',40,'quiz result','a'))
 c.execute("update attempts set submitted='done' where id='a' and submitted is null")
assert c.execute('select count(*),sum(xp) from events').fetchone()==(1,40)
try:c.execute("insert into attempts(id,user,day,question_ids) values('b','u','2026-10-10','[]')");raise AssertionError('duplicate accepted')
except sqlite3.IntegrityError:pass
c.execute("update events set void_reason='Faculty correction'")
assert c.execute('select coalesce(sum(xp),0) from events where void_reason is null').fetchone()[0]==0
print('PASS: 300 repeated requests yield one award, one quiz/day enforced, faculty void removes XP')
