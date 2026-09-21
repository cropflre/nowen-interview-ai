import { randomUUID } from 'node:crypto';
import { calendarDay } from './calendar.mjs';

// Local single-player game. Do not expose the API publicly without authentication.
const PLAYER = 'local';
export class GameError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const q = (id, prompt, options, correct, explanation, knowledgeId, code = '') => ({ id, prompt, options, correct, explanation, knowledgeId, code });
export const STAGES = Object.freeze([
  { id: 'js-scope', title: '初入森林 · 作用域', subtitle: '分清词法作用域与块级作用域', type: 'quiz', knowledgeId: 'interview:js-closure', questions: [
    q('scope-1', '执行 run() 的结果是什么？', ['1','2','undefined','ReferenceError'], 1, 'run 内部的 let x 遮蔽外部 x，因此返回 2。','interview:js-closure','let x = 1;\nfunction run() { let x = 2; return x; }\nrun();'),
    q('scope-2', '这段循环会依次打印什么？', ['3、3、3','0、1、2','1、2、3','抛出错误'], 1, 'let 在每轮循环中创建独立绑定，异步回调各自捕获对应的 i。','interview:js-closure','for (let i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 0);\n}'),
    q('scope-3', '以下代码最终打印什么？', ['1','2','undefined','SyntaxError'], 0, '块内 const x 只在块级作用域生效，块外仍然读取外层 x。','interview:js-closure','const x = 1;\n{ const x = 2; }\nconsole.log(x);'),
  ] },
  { id: 'js-closure', title: '闭包陷阱', subtitle: '识别捕获变量与旧状态', type: 'recall', knowledgeId: 'interview:js-closure', questions: [
    q('closure-1','两次调用 counter() 的返回值依次是什么？',['1、1','1、2','2、2','undefined、undefined'],1,'返回的函数保留了对词法环境中 n 的访问，同一个计数器可以持续更新 n。','interview:js-closure','function makeCounter() {\n  let n = 0;\n  return () => ++n;\n}\nconst counter = makeCounter();\ncounter(); counter();'),
    q('closure-2','如果将 for 循环中的 let 换成 var，回调打印什么？',['0、1、2','3、3、3','1、2、3','都不执行'],1,'var 的 i 在循环作用域中共享，定时器回调执行时循环已经结束，i 为 3。','interview:js-closure','for (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 0);\n}'),
    q('closure-3','React 定时器中的 setCount(count + 1) 一直读取初始 count，应优先采用哪种修复？',['把 count 声明成全局变量','在定时器里直接修改 DOM','使用 setCount(c => c + 1)，并在 Effect 中清理定时器','移除 StrictMode 即可'],2,'函数式更新使用最新的排队状态；Effect 返回清理函数避免遗留定时器。','interview:react-effects'),
  ] },
  { id: 'js-async', title: '异步迷宫', subtitle: '预测微任务与定时器的执行顺序', type: 'predict', knowledgeId: 'interview:js-event-loop', questions: [
    q('async-1','下面的输出顺序是什么？',['A、C、B','A、B、C','B、A、C','A、C'],1,'先执行同步输出 A；当前任务结束后检查 Promise 微任务 B；随后运行定时器回调 C。','interview:js-event-loop',"console.log('A');\nsetTimeout(() => console.log('C'), 0);\nPromise.resolve().then(() => console.log('B'));"),
    q('async-2','下面的输出顺序是什么？',['2、1、3','1、3、2','1、2、3','3、2、1'],2,'先打印同步的 1；Promise.then 与 queueMicrotask 按进入微任务队列的顺序执行。','interview:js-event-loop','Promise.resolve().then(() => console.log(2));\nconsole.log(1);\nqueueMicrotask(() => console.log(3));'),
    q('async-3','一个微任务不断追加微任务，最可能出现什么情况？',['保证每一轮都立即绘制页面','可能长期占用微任务检查点，延迟渲染与响应','所有微任务自动改为 setTimeout','浏览器强制停止所有 JavaScript'],1,'不断续接的微任务可使当前微任务检查持续，其他任务以及渲染机会被延迟。','interview:js-event-loop'),
  ] },
  { id:'js-debug',title:'代码侦探',subtitle:'定位泄漏、旧闭包与请求竞态',type:'debug',knowledgeId:'interview:eng-debug',questions:[
    q('debug-1','组件卸载后仍在运行定时器，应该如何修复？',['每次渲染新建更多定时器','在 Effect 返回函数中 clearInterval(timer)','只把间隔从 1 秒改为 2 秒','只清空页面 HTML'],1,'Effect 返回清理函数清除定时器；同时确认依赖项与更新方式正确。','interview:react-effects','useEffect(() => {\n  const timer = setInterval(tick, 1000);\n}, []);'),
    q('debug-2','搜索 A 请求比 B 请求更慢，A 最后返回覆盖了新结果。如何修复？',['忽略请求所属查询','把两个请求都设为高优先级','取消旧请求或检查请求序号，仅接受最新响应','移除加载状态'],2,'AbortController 或请求 ID 检查可防止过期响应覆盖当前状态。','interview:react-effects'),
    q('debug-3','线上偶发白屏无法稳定复现，哪种处理顺序更合理？',['直接重写整个页面','关闭所有错误日志','先收集错误和环境信息，缩小范围，修复后做回归验证','假设一定是用户网络问题'],2,'先建立日志和环境证据，再定位最小复现，最后用测试及监控验证修复。','interview:eng-debug'),
  ] },
  { id:'js-boss',title:'BOSS · 事件循环守卫者',subtitle:'三阶段终局：执行顺序、await、微任务饥饿',type:'boss',knowledgeId:'interview:js-event-loop',questions:[
    q('boss-1','第一阶段：下列代码依次输出什么？',['1、2、3、4','1、4、2、3','1、4、3、2','3、1、4、2'],2,'1 和 4 是同步执行；Promise 回调在微任务检查时输出 3；定时器任务最后输出 2。','interview:js-event-loop','console.log(1);\nsetTimeout(() => console.log(2), 0);\nPromise.resolve().then(() => console.log(3));\nconsole.log(4);'),
    q('boss-2','第二阶段：下列代码输出顺序是什么？',['A、C、B','B、A、C','A、B、C','A、B，C 永不执行'],2,'调用 run 时先同步打印 A，await 使后续代码进入微任务；调用方同步打印 B，随后输出 C。','interview:js-event-loop',"async function run() {\n  console.log('A');\n  await 0;\n  console.log('C');\n}\nrun();\nconsole.log('B');"),
    q('boss-3','第三阶段：你发现微任务递归使页面持续卡顿，优先采用哪个思路？',['继续增加无限微任务','用同步 while(true) 代替','把长工作拆分，适时把控制权交回事件循环，并验证交互指标','只隐藏加载动画'],2,'拆分长任务并合理调度，给输入响应与渲染留出机会；用 Performance 工具验证效果。','interview:js-event-loop'),
  ] },
]);
const byId = new Map(STAGES.map(stage=>[stage.id,stage]));
const today = () => calendarDay();
const publicQuestion = question => ({id:question.id,prompt:question.prompt,code:question.code,options:question.options});
export function initGame(db) {
 db.exec(`CREATE TABLE IF NOT EXISTS game_players (id TEXT PRIMARY KEY,xp INTEGER NOT NULL DEFAULT 0 CHECK(xp>=0),created_at TEXT NOT NULL DEFAULT(datetime('now')));
 CREATE TABLE IF NOT EXISTS game_progress (stage_id TEXT PRIMARY KEY,best_stars INTEGER NOT NULL DEFAULT 0 CHECK(best_stars BETWEEN 0 AND 2),clears INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS game_attempts (id TEXT PRIMARY KEY,stage_id TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('active','cleared','failed')),started_at TEXT NOT NULL,finished_at TEXT,correct_count INTEGER NOT NULL DEFAULT 0,stars INTEGER NOT NULL DEFAULT 0,earned_xp INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS idx_game_attempts_stage ON game_attempts(stage_id,started_at DESC);
 CREATE UNIQUE INDEX IF NOT EXISTS idx_game_active_stage ON game_attempts(stage_id) WHERE status='active';
 CREATE TABLE IF NOT EXISTS game_answers (attempt_id TEXT NOT NULL REFERENCES game_attempts(id) ON DELETE CASCADE,question_id TEXT NOT NULL,choice INTEGER NOT NULL,explanation TEXT NOT NULL DEFAULT '',correct INTEGER NOT NULL,answered_at TEXT NOT NULL,PRIMARY KEY(attempt_id,question_id));
 CREATE TABLE IF NOT EXISTS game_rewards (event_key TEXT PRIMARY KEY,amount INTEGER NOT NULL CHECK(amount>0),created_at TEXT NOT NULL);`);
 db.prepare('INSERT OR IGNORE INTO game_players(id) VALUES (?)').run(PLAYER);
}
function earnedStars(db,stage,best) {
 if(best<2)return best;
 return db.prepare('SELECT 1 FROM review_logs WHERE knowledge_id=? AND delayed=1 AND correct=1 LIMIT 1').get(stage.knowledgeId)?3:2;
}
export function gameWorld(db) {
 initGame(db);
 const player=db.prepare('SELECT xp FROM game_players WHERE id=?').get(PLAYER);
 const progress=new Map(db.prepare('SELECT * FROM game_progress').all().map(p=>[p.stage_id,p]));
 const stages=STAGES.map((stage,idx)=>{
   const saved=progress.get(stage.id);
   const unlocked=idx===0||(progress.get(STAGES[idx-1].id)?.best_stars??0)>=1;
   return {id:stage.id,title:stage.title,subtitle:stage.subtitle,type:stage.type,questionCount:stage.questions.length,status:saved?.best_stars?'cleared':unlocked?'available':'locked',stars:earnedStars(db,stage,saved?.best_stars??0),clears:saved?.clears??0};
 });
 return {world:{id:'javascript-forest',title:'JavaScript 森林',subtitle:'五关修炼 · 最终迎战事件循环守卫者'},player:{xp:player.xp,level:Math.floor(player.xp/500)+1},stages,cleared:stages.filter(stage=>stage.status==='cleared').length,dueReviews:db.prepare('SELECT COUNT(*) AS count FROM review_items WHERE due_on<=?').get(today()).count};
}
function getRow(db,id) {
 const row=db.prepare('SELECT * FROM game_attempts WHERE id=?').get(id);
 if(!row)throw new GameError('挑战记录不存在',404);
 return row;
}
export function gameAttempt(db,id) {
 const row=getRow(db,id),stage=byId.get(row.stage_id);
 const answers=db.prepare('SELECT * FROM game_answers WHERE attempt_id=? ORDER BY answered_at,rowid').all(id);
 const current=stage.questions[answers.length];
 const result={id:row.id,stageId:row.stage_id,stageTitle:stage.title,status:row.status,current:row.status==='active'&&current?publicQuestion(current):null,answered:answers.length,total:stage.questions.length,correctCount:row.correct_count,feedback:answers.map(a=>{
  const question=stage.questions.find(q=>q.id===a.question_id);
  return {questionId:a.question_id,choice:a.choice,correct:Boolean(a.correct),correctChoice:question.correct,explanation:question.explanation,reasoning:a.explanation};
 }),stars:row.stars,earnedXp:row.earned_xp};
 if(row.status!=='active')result.reviewHint=row.status==='cleared'?'已记录最佳通关星级。满分并完成相应知识点的跨天复习后可获得第三颗记忆星。':'本次未达到通过条件，错误知识已加入记忆复习队列，可随时重新挑战。';
 return result;
}
export function startGameStage(db,stageId) {
 initGame(db);
 const stage=byId.get(stageId);
 if(!stage)throw new GameError('关卡不存在',404);
 db.exec('BEGIN IMMEDIATE');
 try {
  const index=STAGES.findIndex(s=>s.id===stageId);
  if(index>0&&!db.prepare('SELECT best_stars FROM game_progress WHERE stage_id=?').get(STAGES[index-1].id)?.best_stars)throw new GameError('请先完成上一关，再来挑战',409);
  const existing=db.prepare("SELECT id FROM game_attempts WHERE stage_id=? AND status='active'").get(stageId);
  const id=existing?.id??randomUUID();
  if(!existing)db.prepare("INSERT INTO game_attempts (id,stage_id,status,started_at) VALUES (?,?,'active',?)").run(id,stageId,new Date().toISOString());
  db.exec('COMMIT');return gameAttempt(db,id);
 }catch(error){db.exec('ROLLBACK');throw error;}
}
function grant(db,key,amount) {
 const changed=db.prepare('INSERT OR IGNORE INTO game_rewards(event_key,amount,created_at) VALUES (?,?,?)').run(key,amount,new Date().toISOString()).changes;
 if(changed)db.prepare('UPDATE game_players SET xp=xp+? WHERE id=?').run(amount,PLAYER);
 return changed?amount:0;
}
export function answerGameStage(db,id,input={}) {
 if(typeof input.questionId!=='string'||!Number.isInteger(input.choice)||input.choice<0||input.choice>3||typeof(input.reasoning??'')!=='string'||(input.reasoning??'').length>2000)throw new GameError('请选择选项并填写有效的解释（最多 2000 字）');
 db.exec('BEGIN IMMEDIATE');
 try {
  const row=getRow(db,id);
  if(row.status!=='active')throw new GameError('本轮挑战已结算，不能重复提交',409);
  const stage=byId.get(row.stage_id);
  const answers=db.prepare('SELECT question_id,correct FROM game_answers WHERE attempt_id=?').all(id);
  const question=stage.questions[answers.length];
  if(!question||question.id!==input.questionId)throw new GameError('题目已变化，请刷新后重试',409);
  const correct=Number(input.choice===question.correct);
  db.prepare('INSERT INTO game_answers(attempt_id,question_id,choice,explanation,correct,answered_at) VALUES (?,?,?,?,?,?)').run(id,question.id,input.choice,(input.reasoning??'').trim(),correct,new Date().toISOString());
  if(answers.length+1===stage.questions.length){
   const total=answers.reduce((n,a)=>n+a.correct,correct);
   const stars=total===3?2:total>=2?1:0;
   const cleared=stars>=1;
   let xp=0;
   if(cleared){
    const old=db.prepare('SELECT best_stars FROM game_progress WHERE stage_id=?').get(stage.id);
    db.prepare('INSERT INTO game_progress(stage_id,best_stars,clears,updated_at) VALUES (?,?,1,?) ON CONFLICT(stage_id) DO UPDATE SET best_stars=MAX(best_stars,excluded.best_stars),clears=clears+1,updated_at=excluded.updated_at').run(stage.id,stars,new Date().toISOString());
    xp+=grant(db,`first:${stage.id}`,stage.type==='boss'?300:100);
    if(stars===2&&(old?.best_stars??0)<2)xp+=grant(db,`perfect:${stage.id}`,stage.type==='boss'?60:20);
   }
   db.prepare('UPDATE game_attempts SET status=?,correct_count=?,stars=?,earned_xp=?,finished_at=? WHERE id=?').run(cleared?'cleared':'failed',total,stars,xp,new Date().toISOString(),id);
  }
  if(!correct)db.prepare('INSERT OR IGNORE INTO review_items(knowledge_id,due_on) SELECT id,? FROM knowledge_points WHERE id=?').run(today(),question.knowledgeId);
  db.exec('COMMIT');return gameAttempt(db,id);
 }catch(error){db.exec('ROLLBACK');throw error;}
}
