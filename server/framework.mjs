import { randomUUID } from 'node:crypto';
import { initGame } from './game.mjs';
import { calendarDay } from './calendar.mjs';

export class FrameworkError extends Error { constructor(message, status=400) { super(message); this.status=status; } }
const question=(id,prompt,options,correct,explanation,knowledgeId,code='')=>({id,prompt,options,correct,explanation,knowledgeId,code});
export const FRAMEWORK_STAGES=Object.freeze([
 { id:'react-state', title:'状态港湾',subtitle:'识别状态归属和派生数据',type:'quiz',knowledgeId:'interview:react-state',questions:[
  question('state-1','根据 props 可以直接计算出的 fullName，优先如何处理？',['用 Effect 监听 props 再 setFullName','在渲染时计算 fullName','另建全局变量','每次都修改 DOM'],1,'派生数据一般直接在渲染期间计算，避免额外状态同步与额外渲染。','interview:react-state'),
  question('state-2','两个兄弟组件需要共享筛选条件，哪个方案更合适？',['状态提升至最近的共同父组件','分别复制状态且不做同步','在 DOM 属性上互相查询','每次点击都刷新页面'],0,'共享状态应提升到最近的共同拥有者，也可以在复杂场景采用适当的状态容器。','interview:react-state'),
  question('state-3','筛选条件改变后，原分页停留在第 9 页但只剩 2 页，应该怎么办？',['继续保留无效页码','根据产品规则重置或约束分页','把所有数据删掉','禁用筛选'],1,'分页与筛选相关联，条件变化时应定义明确的页码更新策略。','interview:react-state'),
 ]},
 { id:'react-effects',title:'副作用礁石',subtitle:'正确使用 Effect 与清理',type:'debug',knowledgeId:'interview:react-effects',questions:[
  question('effect-1','哪项操作通常不需要 Effect？',['订阅外部连接并在卸载时断开','根据已有 props 计算字符串','监听 window 事件并清理','与第三方组件同步'],1,'纯粹的渲染计算通常不需要 Effect。','interview:react-effects'),
  question('effect-2','下面的定时器会在卸载后残留。优先修复方案？',['在 Effect 返回函数中 clearInterval(id)','把 interval 改成 10ms','删除依赖数组','把 id 放到全局'],0,'Effect 清理函数应释放所创建的定时器。','interview:react-effects','useEffect(() => { const id=setInterval(tick,1000); }, []);'),
  question('effect-3','搜索请求 A 比后发的 B 晚返回，A 覆盖新结果。如何防止？',['仅接受最新请求的结果或取消旧请求','在每次 render 中无条件 fetch','永远隐藏结果','删掉 query 依赖'],0,'使用 AbortController 或请求序号，忽略过期响应。','interview:react-effects'),
 ]},
 {id:'react-keys',title:'协调航道',subtitle:'列表标识与渲染机制',type:'predict',knowledgeId:'interview:react-render',questions:[
  question('keys-1','可重排序且每项含局部输入状态的列表，优先选择什么 key？',['列表当前位置索引','稳定且唯一的业务 id','每次渲染 Math.random()','统一使用 0'],1,'稳定的业务 id 能帮助 React 在重排时保持正确的组件身份。','interview:react-render'),
  question('keys-2','key 在 React 中主要用于什么？',['自动优化所有网络请求','标识同级元素身份以辅助协调','向后端认证用户','强制开启并发渲染'],1,'key 用于同级列表项身份识别，并非认证或通用性能开关。','interview:react-render'),
  question('keys-3','父组件重新渲染，子组件一定会修改真实 DOM 吗？',['一定会','不一定；渲染与提交到 DOM 是不同阶段','React 会重载页面','必须强制清空缓存'],1,'React 可以渲染并比较结果，但 DOM 仅在需要提交改变时更新。','interview:react-render'),
 ]},
 {id:'react-performance',title:'性能灯塔',subtitle:'用测量驱动优化',type:'debug',knowledgeId:'interview:react-render',questions:[
  question('perf-1','输入大列表时卡顿，第一步是什么？',['立刻把全部组件包上 memo','使用 Profiler/Performance 找到瓶颈','直接删除数据','无条件上微前端'],1,'先测量瓶颈，再考虑虚拟列表、拆分任务等针对性措施。','interview:react-render'),
  question('perf-2','useMemo 是否保证组件不会渲染？',['是，永久缓存组件','否，它缓存计算结果，依赖改变或缓存丢弃仍可重新计算','会缓存网络响应','会在服务器执行用户代码'],1,'useMemo 是优化提示，不是渲染正确性的保证。','interview:react-render'),
  question('perf-3','一万个不可见列表项仍全部挂载，适合考虑哪种优化？',['虚拟列表，仅渲染可视范围附近的项','为每项添加十个 Effect','关闭所有浏览器缓存','在循环里同步等待'],0,'虚拟列表降低同时挂载的 DOM 数量，但仍需检查可访问性和动态高度。','interview:react-render'),
 ]},
 {id:'react-boss',title:'BOSS · 组件架构守卫者',subtitle:'状态、竞态、身份的综合试炼',type:'boss',knowledgeId:'interview:react-state',questions:[
  question('boss-1','筛选与分页状态多次不同步，如何设计？',['区分源状态和派生数据，明确状态归属','为每个结果复制一套独立状态','每次切换都强制 reload','在 render 中修改 props'],0,'先明确源状态、派生状态和需要共享的范围，再确定分页重置规则。','interview:react-state'),
  question('boss-2','组件卸载后请求仍回写旧结果，适合采取什么组合？',['用 Effect 清理取消请求，并忽略旧响应','只延长请求超时','在 DOM 上直接写入结果','使用列表索引做缓存 key'],0,'取消请求和结果时序校验能减少卸载更新及竞态问题。','interview:react-effects'),
  question('boss-3','列表重排后输入框内容错位，且性能问题未确认，应先做什么？',['使用稳定业务 key 并通过 Profiler 验证瓶颈','不断随机生成 key','无条件 useMemo 所有变量','删掉输入框'],0,'稳定 key 修复身份错位；性能问题需要独立测量，不宜盲目缓存。','interview:react-render'),
 ]},
]);
const byId=new Map(FRAMEWORK_STAGES.map(stage=>[stage.id,stage]));
const stamp=()=>new Date().toISOString();
export function initFramework(db){
 initGame(db);
 db.exec(`CREATE TABLE IF NOT EXISTS framework_progress(stage_id TEXT PRIMARY KEY,best_stars INTEGER NOT NULL DEFAULT 0 CHECK(best_stars BETWEEN 0 AND 2),clears INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS framework_attempts(id TEXT PRIMARY KEY,stage_id TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('active','cleared','failed')),started_at TEXT NOT NULL,finished_at TEXT,correct_count INTEGER NOT NULL DEFAULT 0,stars INTEGER NOT NULL DEFAULT 0,earned_xp INTEGER NOT NULL DEFAULT 0);
 CREATE UNIQUE INDEX IF NOT EXISTS idx_framework_active ON framework_attempts(stage_id) WHERE status='active';
 CREATE TABLE IF NOT EXISTS framework_answers(attempt_id TEXT NOT NULL REFERENCES framework_attempts(id) ON DELETE CASCADE,question_id TEXT NOT NULL,choice INTEGER NOT NULL,correct INTEGER NOT NULL,reasoning TEXT NOT NULL,answered_at TEXT NOT NULL,PRIMARY KEY(attempt_id,question_id));`);
}
const bossCleared=db=>Boolean(db.prepare("SELECT 1 FROM game_progress WHERE stage_id='js-boss' AND best_stars>0").get());
function unlocked(db,index){return bossCleared(db)&&(index===0||Boolean(db.prepare('SELECT 1 FROM framework_progress WHERE stage_id=? AND best_stars>0').get(FRAMEWORK_STAGES[index-1].id)));}
function knowledgeStar(db,stage,best){return best===2&&db.prepare('SELECT 1 FROM review_logs WHERE knowledge_id=? AND delayed=1 AND correct=1 LIMIT 1').get(stage.knowledgeId)?3:best;}
export function frameworkWorld(db){
 initFramework(db);
 const available=bossCleared(db);
 const stages=FRAMEWORK_STAGES.map((stage,index)=>{
  const row=db.prepare('SELECT * FROM framework_progress WHERE stage_id=?').get(stage.id);
  return {id:stage.id,title:stage.title,subtitle:stage.subtitle,type:stage.type,questionCount:3,status:row?.best_stars?'cleared':unlocked(db,index)?'available':'locked',stars:knowledgeStar(db,stage,row?.best_stars??0),clears:row?.clears??0};
 });
 return {world:{id:'framework-islands',title:'框架群岛',subtitle:'React 五关与组件架构守卫者'},unlocked:available,requires:'js-boss',stages,cleared:stages.filter(s=>s.status==='cleared').length,player:db.prepare("SELECT xp FROM game_players WHERE id='local'").get()};
}
function attemptRow(db,id){const row=db.prepare('SELECT * FROM framework_attempts WHERE id=?').get(id);if(!row)throw new FrameworkError('挑战记录不存在',404);return row;}
export function frameworkAttempt(db,id){
 initFramework(db);
 const row=attemptRow(db,id),stage=byId.get(row.stage_id);
 const answered=db.prepare('SELECT * FROM framework_answers WHERE attempt_id=? ORDER BY rowid').all(id);
 const current=stage.questions[answered.length];
 return {id,stageId:stage.id,stageTitle:stage.title,status:row.status,answered:answered.length,total:stage.questions.length,correctCount:row.correct_count,stars:row.stars,earnedXp:row.earned_xp,
  current:row.status==='active'&&current?{id:current.id,prompt:current.prompt,code:current.code,options:current.options}:null,
  feedback:answered.map(item=>{const q=stage.questions.find(x=>x.id===item.question_id);return {questionId:q.id,choice:item.choice,correct:Boolean(item.correct),correctChoice:q.correct,explanation:q.explanation,reasoning:item.reasoning};})};
}
export function startFrameworkStage(db,id){
 initFramework(db);
 const stage=byId.get(id);if(!stage)throw new FrameworkError('关卡不存在',404);
 db.exec('BEGIN IMMEDIATE');let attemptId;
 try{
  if(!unlocked(db,FRAMEWORK_STAGES.indexOf(stage)))throw new FrameworkError('先通关 JavaScript 森林 BOSS 与前置关卡',409);
  const old=db.prepare("SELECT id FROM framework_attempts WHERE stage_id=? AND status='active'").get(id);
  attemptId=old?.id??randomUUID();
  if(!old)db.prepare("INSERT INTO framework_attempts(id,stage_id,status,started_at) VALUES (?,?,'active',?)").run(attemptId,id,stamp());
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 return frameworkAttempt(db,attemptId);
}
export function answerFrameworkStage(db,id,input={}){
 if(typeof input.questionId!=='string'||!Number.isInteger(input.choice)||input.choice<0||input.choice>3||typeof(input.reasoning??'')!=='string'||(input.reasoning??'').length>2000)throw new FrameworkError('无效的选项或解释');
 initFramework(db);db.exec('BEGIN IMMEDIATE');
 try{
  const row=attemptRow(db,id);if(row.status!=='active')throw new FrameworkError('挑战已结算，不可重复提交',409);
  const stage=byId.get(row.stage_id),answered=db.prepare('SELECT correct FROM framework_answers WHERE attempt_id=? ORDER BY rowid').all(id);
  const q=stage.questions[answered.length];if(!q||q.id!==input.questionId)throw new FrameworkError('题目已更新，请刷新重试',409);
  const correct=Number(input.choice===q.correct),ts=stamp();
  db.prepare('INSERT INTO framework_answers(attempt_id,question_id,choice,correct,reasoning,answered_at) VALUES (?,?,?,?,?,?)').run(id,q.id,input.choice,correct,input.reasoning??'',ts);
  if(!correct) db.prepare('INSERT OR IGNORE INTO review_items(knowledge_id,due_on) VALUES (?,?)').run(q.knowledgeId,calendarDay());
  if(answered.length+1===stage.questions.length){
   const total=answered.reduce((sum,item)=>sum+item.correct,correct),cleared=total>=2,stars=cleared?(total===3?2:1):0;
   let earned=0;
   if(cleared){
    const existing=db.prepare('SELECT best_stars,clears FROM framework_progress WHERE stage_id=?').get(stage.id);
    db.prepare('INSERT INTO framework_progress(stage_id,best_stars,clears,updated_at) VALUES (?,?,1,?) ON CONFLICT(stage_id) DO UPDATE SET best_stars=MAX(best_stars,excluded.best_stars),clears=clears+1,updated_at=excluded.updated_at').run(stage.id,stars,ts);
    for(const [event,amount] of [[`framework:first:${stage.id}`,stage.type==='boss'?350:120],[`framework:perfect:${stage.id}`,stage.type==='boss'?70:30]]){
     if(event.startsWith('framework:perfect:')&&stars!==2)continue;
     const inserted=db.prepare('INSERT OR IGNORE INTO game_rewards(event_key,amount,created_at) VALUES (?,?,?)').run(event,amount,ts).changes;
     if(inserted){db.prepare("UPDATE game_players SET xp=xp+? WHERE id='local'").run(amount);earned+=amount;}
    }
   }
   db.prepare('UPDATE framework_attempts SET status=?,finished_at=?,correct_count=?,stars=?,earned_xp=? WHERE id=?').run(cleared?'cleared':'failed',ts,total,stars,earned,id);
  }
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 return frameworkAttempt(db,id);
}
