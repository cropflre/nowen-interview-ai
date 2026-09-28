/**
 * 场景题库（掌握四档 · 第 4 档「用得上」）
 *
 * 与选择题/复现题的区别：这里不给知识点，只给**真实业务场景**，
 * 要你自己判断「该用哪个技术 + 为什么」。这才是面试里真正的考法。
 *
 * 字段：
 *   code     稳定 ID（用于记录成绩，改了会断历史）
 *   category 归类（用于薄弱分类统计）
 *   scene    场景题干
 *   must     必答关键词（命中即得分；用同一个词的不同写法请都列上）
 *   mustNot  明确的误区（命中且覆盖不足 → 封顶处理）
 *   answer   参考解法（提交后才揭晓）
 */

export const SCENES = [
  {
    code: 'debounce-search',
    category: '场景 · 性能',
    scene: '搜索框：用户每敲一个字就发一次请求，后端被打爆，返回还乱序——旧结果把新结果盖了。你会怎么改？',
    must: ['防抖', 'debounce', '延迟', '最后一次'],
    mustNot: ['节流'],
    answer: `① 输入用防抖（debounce）：把请求**延迟**到最后一次输入之后 —— 等用户停止输入 N 毫秒（一般 200–400ms）才发请求，只保留最后一次。
② 还要处理**请求竞态**：给每次请求打自增序号，或直接用 AbortController 取消上一个未完成的请求，只接受最新一次的结果——否则慢的旧请求后到，照样覆盖新结果。
③ 再加一层：结果缓存（同一个关键词不重复请求）、空输入不发请求、加载态与「无结果」态。

为什么不用节流：节流是「固定间隔必发一次」，用户慢慢敲 10 个字还是会发好几次，而且最后停下的那一次不一定触发，体验更差。防抖保证「只在停下来时发一次」，更贴合搜索。`
  },
  {
    code: 'throttle-scroll',
    category: '场景 · 性能',
    scene: '无限滚动列表：滚动事件回调里直接算位置并渲染新数据，页面一滚就卡。你怎么改？',
    must: ['节流', 'throttle', '间隔', '时间'],
    mustNot: ['防抖'],
    answer: `① 滚动回调用节流（throttle）：固定**时间**间隔（如 100–200ms）最多执行一次，保证滚动过程中持续有反馈。
② 滚动事件用 passive: true，避免滚动被 JS 阻塞。
③ 渲染侧再优化：新数据分页/批量插入、列表用虚拟滚动、触底判定改用 IntersectionObserver（哨兵元素）而不是每次 scroll 都 getBoundingClientRect。

为什么不用防抖：防抖要等滚动**完全停止**才触发，用户一路滚到底会一直没有加载，体验断裂。节流是「持续但降频」，正合适。`
  },
  {
    code: 'closure-loop',
    category: '场景 · JS 基础',
    scene: '给 5 个按钮绑定点击事件，想让它点第 i 个就弹出 i，结果每个按钮都弹出 5。为什么？怎么改？',
    must: ['闭包', 'let', '作用域', 'var'],
    mustNot: [],
    answer: `原因：用 var 声明循环变量时，i 是**函数作用域**里的同一个变量，5 个回调共享它。事件触发时循环早已结束，i 已经变成 5，所以每个回调读到的都是 5。

三种改法：
① 用 let —— 块级作用域，每轮循环都产生一个新的绑定，回调各自闭包住自己的 i（最推荐）。
② 用 IIFE 把当前 i 作为参数「快照」进去：for (var i…)(function(j){ btn.onclick = () => alert(j) })(i)
③ 不依赖闭包：把值写到 DOM 上，点击时从 dataset / index 参数里取。

这题考的是「闭包捕获的是变量本身，不是值」。`
  },
  {
    code: 'layout-read-after-write',
    category: '场景 · 事件循环',
    scene: '点按钮后在弹窗上做 transition 动画，但每次都是「瞬间出现」，动画不生效。为什么？怎么改？',
    must: ['重排', '回流', '渲染', 'requestAnimationFrame', 'nextTick', 'transition'],
    mustNot: [],
    answer: `原因：浏览器是**批量渲染**的。你在同一个任务里先把它设成 display:block / opacity:0，紧接着又改成 opacity:1，中间浏览器一次都没机会渲染，它只看到「最终状态」，于是没有「从 0 到 1」的过程，transition 自然不触发。

改法：在两次状态修改之间**强制让浏览器渲染一帧**——
① requestAnimationFrame（包一层，或在 rAF 里再改目标值）；
② 读一次布局属性**强制触发一次重排（回流）**（offsetHeight、getBoundingClientRect）——有效但会掉性能，只适合偶尔用；
③ Vue 里用 nextTick / await 一个微任务，等 DOM 更新完再改目标值。

顺带一记：微任务（Promise.then）在渲染**之前**执行，宏任务（setTimeout）在渲染**之后**——所以 setTimeout(0) 也能生效，但不如 rAF 稳。`
  },
  {
    code: 'http-cache-invalidate',
    category: '场景 · 网络',
    scene: '上线新版本后，一部分用户仍看到旧页面，强刷（Ctrl+F5）才好。你怎么根治？',
    must: ['hash', '哈希', '指纹', '缓存', 'no-cache'],
    mustNot: [],
    answer: `根因：HTML 和静态资源设了强缓存，文件名没变 → 浏览器直接用本地旧文件。

标准做法（缓存分级）：
① **静态资源（JS/CSS/图片）**：文件名带**内容哈希（hash / 指纹）**（index.a1b2c3.js），配 Cache-Control: max-age=31536000, immutable —— 可永久强缓存，因为内容一变文件名就变。
② **HTML 入口**：设 no-cache（或 max-age=0），每次校验，保证用户拿到最新的资源引用。
③ 发布时先传资源、再传 HTML（避免 HTML 引用了还没上传的资源）。
④ 兜底：Service Worker 有缓存的话要同步更新版本号（skipWaiting + clients.claim）。

一句话：**「文件名即版本」**，让缓存失效这件事由构建产物名字完成，别靠用户强刷。`
  },
  {
    code: 'vfor-key-index',
    category: '场景 · 框架原理',
    scene: 'v-for 列表用 index 当 key，删掉中间一项后，后面几行的输入框内容「串位」了。为什么？',
    must: ['key', 'index', '复用', 'diff'],
    mustNot: [],
    answer: `原因：diff 靠 key 判断「同一个节点」。用 index 作 key 时，删掉第 2 项后，原来的第 3 项变成 index=2，框架认为「index=2 的节点还是原来那个」，于是**复用**了同一个 DOM——连同输入框里的临时内容一起留下来了，看起来就是内容错位。

改法：用**稳定且唯一**的标识作 key（数据库 id、uuid）。只有「纯静态、不增删排序」的列表才勉强可以用 index。

延伸：key 的作用是给 diff 提供节点身份，让复用/移动/销毁判断正确——它不只是「消警告」。`
  },
  {
    code: 'memory-leak-spa',
    category: '场景 · 内存',
    scene: '单页应用来回切路由几次后越来越卡，内存只涨不降。你从哪儿查、怎么修？',
    must: ['定时器', '监听', '销毁', '清理', '解绑'],
    mustNot: [],
    answer: `排查：DevTools → Memory → 连拍两次堆快照（Heap snapshot）对比，看哪类对象没被回收；Performance 面板看是否有持续增长的节点数。

常见泄漏点（按出现频率）：
① **定时器**没清（setInterval / setTimeout 里持有组件引用）→ 在 unmounted / onUnmounted 里 clear。
② **事件监听**没移除（window/document 上的 scroll、resize、message）→ 成对解绑，或用 AbortController 一次性取消。
③ **订阅/长连接**没断（WebSocket、EventBus、store 订阅）。
④ **闭包**无意持有大对象（一个回调里引用了几十 MB 的数据）。
⑤ **全局缓存/数组**只加不删（比如 Map 缓存 key 无限增长）。
⑥ **DOM 引用**：手动 removeChild 了但还留着节点引用。

原则：**谁创建谁销毁**，把「注册」和「清理」写在同一个组件/同一个函数里，别分散。`
  },
  {
    code: 'big-list-render',
    category: '场景 · 性能',
    scene: '一次性渲染 1 万行表格，页面直接卡死几秒。你怎么改？',
    must: ['虚拟', '分页', '懒加载', '可视'],
    mustNot: [],
    answer: `三条路，按场景选：
① **虚拟滚动**（最通用）：只渲染**可视区**（视口内）+ 上下缓冲区的几十行，用一个撑高的占位元素模拟总高度，滚动时换数据。1 万行也只渲染几十个 DOM。
② **分页**：如果用户不需要一眼看全（后台管理常见），直接分页最省。
③ **懒加载 / 无限滚动 + 时间分片**：先渲染首屏，剩余用 requestIdleCallback 或分批 setTimeout 插入，避免长时间阻塞主线程。

附加优化：行高固定可显著提速；避开每行复杂计算（用 computed 缓存）；用 v-memo / shouldComponentUpdate 减少 diff；表格不做整体响应式（大数组用 shallowRef / markRaw）。`
  },
  {
    code: 'reflow-animation',
    category: '场景 · 渲染',
    scene: '用 JS 每帧改元素的 left/top 做动画，桌面还行，手机上明显掉帧。怎么改？',
    must: ['transform', 'GPU', '合成', 'left', '回流'],
    mustNot: [],
    answer: `根因：left/top 属于**布局属性**，每改一次都会触发 重排（回流 reflow） → 重绘(repaint) → 合成，动画每帧都跑完整条渲染流水线，移动端 GPU/CPU 扛不住。

改法：用 transform: translate3d(x, y, 0)（或 translateX/Y）——它只触发**合成(composite)**，能走 GPU 合成层，跳过布局与重绘。

配套三件事：
① 只动 transform / opacity 这两个「合成友好」属性；
② 加 will-change: transform（或 translate3d）提前提升为合成层，但别滥用（层太多反而爆内存）；
③ 动画逻辑尽量交给 CSS transition/animation 或 Web Animations API，别在 scroll/rAF 里做重计算；必要时只读一次布局，避免「读写交替」引发强制同步布局。`
  },
  {
    code: 'request-race',
    category: '场景 · 网络',
    scene: '页签快速切换，A 页签的数据晚到，把已经显示好的 B 页签数据覆盖了。怎么改？',
    must: ['竞态', '取消', 'AbortController', '序号', '最新'],
    mustNot: [],
    answer: `这是经典的**请求竞态（race condition）**：响应顺序和请求顺序不一致。

两种主流修法：
① **给请求打标记（序号）**：维护一个自增的 requestId，发请求时记下当前值，响应回来先比对「我是不是最新那次」，不是就直接丢弃。
② **取消上一个请求**：fetch 用 AbortController，切换时 abort 掉未完成的请求；axios 用 CancelToken。

配套：
③ 切换时先清空/置加载态，别让旧数据继续展示；
④ 能用 SWR / Vue Query 这类库的话，它们内建了竞态处理与缓存，少造轮子。

注意：不要只在「数据到得慢」时才想起它——线上弱网环境才是竞态的高发区。`
  },
  {
    code: 'deep-clone-json',
    category: '场景 · JS 基础',
    scene: '用 JSON.parse(JSON.stringify(obj)) 做深拷贝，结果 Date 变成了字符串、undefined 直接丢了。你换什么方案？',
    must: ['structuredClone', '递归', 'WeakMap', '循环引用'],
    mustNot: [],
    answer: `先记住 JSON 方案的丢失清单：Date→字符串、undefined/函数/Symbol 直接丢、NaN/Infinity→null、Map/Set/RegExp→空对象、循环引用直接抛错、原型链丢失。

替代方案按优先级：
① **structuredClone(obj)**：浏览器/Node 原生，支持 Date/Map/Set/RegExp/ArrayBuffer/循环引用（不支持函数与原型方法）。**首选**。
② 手写递归 + **WeakMap** 记录已拷贝对象——WeakMap 用来处理循环引用（否则会无限递归爆栈）。
③ lodash.cloneDeep / 库方案，功能全但体积大。
④ 只改一层的话用展开运算符 / Object.assign（注意这是**浅拷贝**，嵌套对象仍是同一个引用）。

选型原则：先问「要不要保留原型和函数」——要就用库，不要就 structuredClone。`
  },
  {
    code: 'type-check-array',
    category: '场景 · JS 基础',
    scene: '要判断一个值是不是数组。typeof / instanceof Array / Array.isArray / Object.prototype.toString，你选哪个？为什么？',
    must: ['Array.isArray', 'instanceof', '原型', 'iframe'],
    mustNot: [],
    answer: `结论：**Array.isArray()**。

逐个说清为什么：
① typeof [] === 'object' —— 数组、null、普通对象全是 'object'，没法区分。
② [] instanceof Array —— 在**同一个窗口**里没问题，但跨 iframe / 多窗口时，各自的 Array 构造函数不同，原型链对不上，会误判为 false。
③ Object.prototype.toString.call([]) === '[object Array]' —— 可靠（内部基于 [[Class]] 判定），但要写一长串，可读性差。
④ Array.isArray() —— ES5 官方 API，内部等价于 ③，语义清晰、跨 realm 安全，**首选**。

    延伸：instanceof 依赖原型链，判断自定义类型时同理要注意「跨 realm / 修改过 prototype」的场景。`
  },
  {
    code: 'css-center',
    category: '场景 · CSS',
    scene: '弹窗要在屏幕正中，但它高度不固定（内容多少不定），还不能改 DOM 结构。你选哪种居中方案？',
    must: ['flex', 'grid', 'transform', 'absolute'],
    mustNot: [],
    answer: `按场景选：
① **flex**：父容器 display:flex + justify-content:center + align-items:center —— 最通用，不关心子元素尺寸。
② **grid**：父容器 display:grid + place-items:center —— 一行搞定，语义最干净。
③ **absolute + transform**：子元素 position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) —— 适合放在遮罩层里、需要脱离文档流时；translate 的百分比是相对自身尺寸，所以**不依赖内容高度**。
④ 别用固定 margin 或固定 line-height —— 高度未知时会失效。

一句话：**要「不知道尺寸也能居中」就靠 flex/grid，或 transform 的百分比**。`
  },
  {
    code: 'css-specificity',
    category: '场景 · CSS',
    scene: '明明给元素写了样式，页面却不生效，DevTools 里那条规则带着删除线。你怎么排查？',
    must: ['优先级', '权重', 'important', '作用域'],
    mustNot: [],
    answer: `按可能性从高到低查：
① **优先级不够**：被更具体的选择器盖过（#id > .class > 标签，内联样式更高）。记住权重：内联 1000、id 100、class/属性/伪类 10、标签/伪元素 1。
② **同权重但后写的赢**：CSS 是层叠，后面的覆盖前面的（加载顺序 / 引入顺序也影响）。
③ **!important**：第三方库或全局样式里的 !important 会压过你。
④ **样式作用域**（scoped / CSS Modules）：编译后加了属性选择器，你的全局选择器权重反而不够。
⑤ 选择器根本没匹配上（写错类名、拼写、被 v-if 移除、动态类名没生效）。
排查工具：DevTools 的 Computed 面板看**最终生效值 + 来自哪条规则**，以及 Styles 面板从上往下看谁把谁划掉了。`
  },
  {
    code: 'margin-collapse',
    category: '场景 · CSS',
    scene: '上下两个相邻的 div 各设了 margin: 20px，实际只隔了 20px，不是 40px。为什么？怎么改？',
    must: ['合并', '塌陷', 'margin', 'BFC'],
    mustNot: [],
    answer: `这是**外边距合并（margin collapsing）**：相邻的块级元素，垂直方向的 margin 会合并成**较大值**（不是相加），所以 20 和 20 合并成 20。
同样会发生的还有：父子元素之间（父元素没有 padding/border/内容隔开时）、空元素自身的上下 margin 合并。

解除办法（挑一个）：
① 给其中一个元素外层包一层，创建 **BFC**（overflow: hidden / display: flow-root / flex / grid 都能形成 BFC）；
② 给父元素加 padding-top 或 border-top 隔开；
③ **改用 flex/grid 布局**：它们的子项之间不做 margin 合并，间距用 gap 更可控。
④ 用 padding 代替 margin（在能接受的场景下）。

建议：现代布局优先 flex + gap，就别再跟塌陷搏斗了。`
  },
  {
    code: 'vue3-proxy',
    category: '场景 · 框架原理',
    scene: 'Vue2 里给对象新增属性必须用 $set，Vue3 为什么就不需要了？',
    must: ['Proxy', 'defineProperty', '拦截', '新增'],
    mustNot: [],
    answer: `核心差别在**用的拦截机制不同**：

① **Vue2 用 Object.defineProperty** —— 它是在初始化时**逐个属性**改写成 getter/setter。这意味着：
   - 只能劫持**已经存在的属性**：新增/删除属性它根本不知道 → 必须 $set/$delete；
   - 数组通过下标改元素、改 length 也拦不到 → 才重写了 7 个数组方法（push/pop/splice…）；
   - 而且在初始化时就得递归遍历整棵树，性能随数据量线性下降。

② **Vue3 用 Proxy** —— 它代理的是**整个对象**，能拦截 get / set / deleteProperty / has / ownKeys 等 13 种操作。所以：
   - 新增属性、删除属性、数组下标赋值，天然就能被感知；
   - 而且**惰性**：只有真正访问到嵌套对象时才递归代理，初始化更快。

一句话：**defineProperty 是"逐属性拦截"，Proxy 是"整对象拦截"** —— 所以 Vue3 不再需要 $set。`
  },
  {
    code: 'diff-min-move',
    category: '场景 · 框架原理',
    scene: '长列表中间插入一条数据，Vue/React 是怎么把 DOM 操作降到最少的？',
    must: ['diff', 'key', '复用', '移动', '同层'],
    mustNot: [],
    answer: `原则（三条）：
① **同层比较**：只对比同一层级，不跨层级，把复杂度从 O(n³) 降到接近 O(n)；
② **类型不同直接替换**：标签/组件类型变了就重建，不再往下比；
③ **靠 key 认人**：key 是节点的身份，决定了「复用 / 移动 / 新建 / 删除」。

具体流程（Vue3 为例）：
- 先做**双端对比**：头头、尾尾、头尾、尾头四路快速剔除两端不变的部分；
- 剩下的乱序区间，按 key 建索引映射，找出「要保留哪些、新增哪些、删除哪些」；
- 对「要保留的」求 **最长递增子序列(LIS)** —— 子序列里的节点**不用移动**，其余节点做最小次数插入移动。

所以中间插一条，通常只产生 **1 次 insertBefore**，而不是把后面全部重建。React 的 diff 思路类似（双端遍历 + 按索引/ key 比对），但不用 LIS。
**前提：key 必须稳定唯一** —— 用 index 当 key 会让这套判断全错。`
  },
  {
    code: 'computed-vs-watch',
    category: '场景 · 框架原理',
    scene: '一个列表要跟着搜索词实时过滤 + 再按价格排序。用 computed 还是 watch？为什么？',
    must: ['computed', '缓存', 'watch', '副作用'],
    mustNot: [],
    answer: `用 **computed**。

判断标准只有一条：**「这个值是不是由别的状态算出来的？」** —— 是，就用 computed。

computed 的优点：
① **声明式**：只声明「结果 = f(搜索词, 列表)」，不用手动维护「什么时候该重算」；
② **有缓存**：依赖没变就直接返回上次结果，不会重复计算（watch 里手动算就做不到）；
③ **纯函数**：不产生副作用，好测试、不会引起连锁更新。

watch 该用在哪：**副作用**。比如搜索词变化后**发请求**（防抖）、把数据写进 localStorage、操作 DOM、上报埋点 —— 这些是「做一件事」，不是「算一个值」。

⚠️ 常见错误：在 computed 里发请求 / 改别的状态（会导致无限循环与难排查的 bug）；或者用 watch 去维护一个本来能算出来的值（多一份状态就多一处不一致）。`
  },
  {
    code: 'why-virtual-dom',
    category: '场景 · 框架原理',
    scene: '直接操作 DOM 明明是最快的，为什么 Vue/React 还要搞一层虚拟 DOM？',
    must: ['声明式', '批量', 'diff', '跨平台', '状态'],
    mustNot: [],
    answer: `先纠正一个常见误解：**虚拟 DOM 不比"人肉最优的 DOM 操作"更快**。它换来的是别的东西：

① **声明式编程**：你只描述「在这个状态下 UI 该长什么样」，不用手动维护「先删谁、再插谁、什么时候更新」。状态一变，UI 自动对齐 —— 这是可维护性的胜利，不是性能的胜利。
② **批量更新**：把同一轮里的多次状态变更**攒起来一次性 patch**，避免「改一个数据动一次 DOM」造成的抖动与重复布局（Vue 的 nextTick / React 的批处理都在做这件事）。
③ **把"算最小更新"这件事交给框架**：人肉维护 DOM 迟早出错；框架用 diff 兜住，并且能在跨平台（小程序、Native、SSR）复用同一套描述。
④ **心智负担**：不用记「哪个 DOM 对应哪份状态」，减少不一致 bug。

结论：虚拟 DOM 是**工程权衡**（可维护性 + 批量 + 跨平台），极端性能场景下仍可以直接操作 DOM 或绕过框架（如 v-memo、will-change、Canvas）。`
  },
  {
    code: 'promise-pool',
    category: '场景 · JS 异步',
    scene: '要给 1000 个接口发请求，但不能一次全发（浏览器并发限制、后端也扛不住）。你怎么写？',
    must: ['并发', '限制', '队列', 'Promise'],
    mustNot: [],
    answer: `写一个**并发池（并发限制）**：维护最多 N 个（一般 5–10）同时进行，每完成一个就从队列里补下一个。

两种常见实现：
① **递归 + 计数器**：起 N 个 worker，每个 worker 循环从任务队列里取下一个执行，直到队列空；
② **滑动窗口 + Promise.race**：先把 N 个塞进 running 数组，用 Promise.race 等最快的一个结束，再往里补一个新的。

配套注意：
- 单个失败**不能让整体挂掉** → 每个任务自己 catch，或用 Promise.allSettled 收结果；
- 需要"按顺序返回结果"的话，把结果按下标写回数组；
- 现成方案：p-limit、async.queue，或 axios 拦截器 + 队列。

顺带区分：Promise.all 是**一次性全发 + 任一失败整体 reject**；allSettled 是**全发但等全部落定**；要限流只能自己控。`
  },
  {
    code: 'async-error-handling',
    category: '场景 · JS 异步',
    scene: 'await 一个接口失败后，后面的代码全都不执行了，页面直接白屏。怎么改？',
    must: ['try', 'catch', '错误', 'reject'],
    mustNot: [],
    answer: `原因：await 一个 **reject 的 Promise 会抛出异常**。如果当前 async 函数里没有 try/catch，异常会一路向上抛，中断整个链路；如果没人接，还会产生 **unhandled rejection**。

改法（按场景选）：
① **try/catch** 包住可能失败的 await —— 最直接，能在 catch 里给兜底 UI；
② **每个请求单独兜底**：把 await 包成「const data = await api().catch(() => null)」，一个失败不影响其他；
③ **并发场景用 Promise.allSettled** 而不是 Promise.all —— 后者任一失败就整体 reject；
④ **兜底防线**：window.onunhandledrejection 全局上报 + 组件层错误边界（React ErrorBoundary / Vue errorCaptured），避免一处失败白屏；
⑤ 区分「可恢复错误」和「致命错误」：前者给重试按钮，后者给降级页面。

一句话：**await 不是不会抛错，是抛错的方式变成了异常**。`
  },
  {
    code: 'this-lost',
    category: '场景 · JS 基础',
    scene: '把对象的方法当回调传给 setTimeout / 事件监听，里面的 this 就丢了。为什么？怎么修？',
    must: ['this', 'bind', '箭头函数', '调用'],
    mustNot: [],
    answer: `原因：**this 由「怎么调用」决定，不由「在哪定义」决定**。
- obj.fn() → this = obj（方法调用）
- const f = obj.fn; f() → 变成普通函数调用，this = undefined（严格模式）或 全局对象
- 传进 setTimeout / onClick 之后，调用点已经不在 obj 上了，所以 this 丢了。

四种修法：
① **定义时用箭头函数**（最推荐）：箭头函数**没有自己的 this**，它捕获定义处外层的 this；
② **bind 永久绑定**：this.fn = this.fn.bind(this)，返回新函数，之后怎么传都不丢；
③ **传的时候包一层**：() => obj.fn()，调用点又回到 obj 上；
④ **class 里用类字段箭头函数**（React 类组件时代的标准做法）。

顺带区分：call/apply 是**立即执行并临时改 this**；bind 是**返回新函数、不执行**。`
  },
  {
    code: 'call-apply-bind',
    category: '场景 · JS 基础',
    scene: '说说 call / apply / bind 的区别，你分别在什么场景用它们？',
    must: ['call', 'apply', 'bind', '数组', '不执行'],
    mustNot: [],
    answer: `三者都是改变函数执行时的 this，区别在**参数形式**和**是否立即执行**：

| 方法 | 参数 | 执行时机 | 返回值 |
|---|---|---|---|
| call(thisArg, a, b) | 逐个传 | **立即执行** | 函数返回值 |
| apply(thisArg, [a, b]) | **数组传** | **立即执行** | 函数返回值 |
| bind(thisArg, a) | 逐个传 | **不执行** | **新函数**（this 已绑定） |

口诀：**call 逐个、apply 数组、bind 返回不执行**。

典型场景：
① apply：经典的 Math.max.apply(null, arr)（现在直接 Math.max(...arr)）；
② call：借用别人的方法，如 Object.prototype.toString.call(x) 判类型；
③ bind：把方法当回调传来传去时固定 this、或在构造函数里一次性绑定；bind 还能**预设部分参数**（柯里化）。
④ 面试延伸：手写 bind 要注意「new 绑定优先级高于 bind」——被 new 调用时 this 应该指向新对象。`
  },
  {
    code: 'gc-leak-theory',
    category: '场景 · JS 基础',
    scene: 'JS 自带垃圾回收，为什么还会有内存泄漏？泄漏到底是怎么发生的？',
    must: ['引用', '可达', '垃圾回收', '标记'],
    mustNot: [],
    answer: `关键前提：现代 JS 垃圾回收基于**可达性（标记-清除 Mark-and-Sweep）** —— 从根对象（window/globalThis、当前调用栈、栈上的局部变量）出发，沿引用链能到达的对象算「存活」，其余回收。

所以「泄漏」的准确说法是：**你已经不再需要的对象，仍然被根引用链引用着**，GC 认为它还有用，于是永远不回收。

典型成因：
① **意外的全局变量**（漏写声明、挂到 window 上的缓存）—— 根直接持有；
② **闭包**长期持有外层大对象（一个回调引用了几十 MB 数据）；
③ **定时器 / 事件监听 / 订阅**没有清理，回调里持有了组件或大对象；
④ **detached DOM**：元素已从文档移除，但 JS 变量还引用着它（连带整个子树）；
⑤ **缓存只加不删**（Map/set/全局数组无限增长）。

解决思路：**断引用** —— 及时清理定时器/监听/订阅、给缓存设上限（LRU）、避免无意义地挂全局。`
  },
  {
    code: 'cors-why',
    category: '场景 · 网络',
    scene: '前端调后端接口报 CORS 跨域错误，但用 Postman 调同一个接口完全正常。为什么？怎么解决？',
    must: ['同源', '浏览器', 'CORS', '预检', 'Allow-Origin'],
    mustNot: [],
    answer: `原因：**CORS（跨域资源共享）是浏览器的限制，Postman 不执行同源策略**。所以问题在服务端没给「允许跨域」的响应头，而不是接口本身坏了。

同源 = 协议 + 域名 + 端口 三者全部一致。任一不同就是跨域。

解决（服务端改，或加代理）：
① 服务端返回 **Access-Control-Allow-Origin**。注意：如果请求带 Cookie（credentials），**不能用 \`*\`**，必须回显具体 Origin 且同时返回 Access-Control-Allow-Credentials: true。
② 非简单请求（自定义头、JSON 的 PUT/DELETE、Content-Type 非三项之一）会先发 **OPTIONS 预检**，服务端必须正确响应预检，并声明允许的方法与头。
③ **开发环境**用构建工具的 proxy（如 Vite server.proxy）—— 请求先发给同源的 dev server，再由它转发，浏览器根本看不到跨域。
④ **生产环境**：同域部署，或 Nginx 反向代理把 /api 转到后端。

常见踩坑：前端加了 credentials 但服务端用 \`*\` → 浏览器直接拒绝，且报错信息很含糊。`
  },
  {
    code: 'web-vitals',
    category: '场景 · 性能',
    scene: '老板问「我们页面到底快不快」，你拿什么数据回答他？',
    must: ['LCP', 'CLS', 'INP', 'FCP', '指标'],
    mustNot: [],
    answer: `拿 **Core Web Vitals** 三件套 + 辅助指标，并且区分**实验室数据**和**真实用户数据**。

核心三项（Google 的 CWV）：
① **LCP（最大内容绘制）** < 2.5s —— 主内容什么时候看见（加载体验）；
② **INP（交互到下次绘制）** < 200ms（取代了 FID）—— 点了之后多久有反应（交互流畅）；
③ **CLS（累积布局偏移）** < 0.1 —— 页面有没有乱跳（视觉稳定）。

辅助：FCP（首次内容绘制）、TTFB（首字节）、TBT（总阻塞时长）、首屏时间、资源体积与请求数。

怎么采：
- **实验室**：Lighthouse / PageSpeed Insights —— 可复现、方便定位，但不等于用户真实体验；
- **真实用户（RUM）**：用 web-vitals 库上报到监控平台，配合 CrUX。

回答老板的方式：**「三项 CWV 里 X 项达标/不达标，最差的是 LCP，主要集中在移动端弱网」** —— 给指标 + 给归因 + 给改进项，而不是「挺快的」。`
  },
  {
    code: 'bundle-bloat',
    category: '场景 · 工程化',
    scene: '打包产物 3MB，首屏要 8 秒才出来。你会从哪儿下手优化？',
    must: ['分包', '懒加载', '按需', 'tree', '压缩'],
    mustNot: [],
    answer: `先**定位再动手**：用打包分析（rollup-plugin-visualizer / webpack-bundle-analyzer）看体积大头是谁。

优化手段（按收益从高到低）：
① **路由级懒加载**：动态 import() 把非首屏页面拆出去；重组件（编辑器、图表、地图）也异步加载。
② **按需引入**：组件库/图标库别整包 import，用 unplugin-vue-components / babel-plugin-import 自动按需；lodash 换 lodash-es 或按方法引；moment 换 dayjs。
③ **分包 + 长效缓存**：把不常变的第三方拆成独立 vendor chunk（hash 命名），业务代码变了也不影响用户缓存。
④ **tree shaking**：确保用 ESM、package.json 标 sideEffects: false、避免 import * as，别让死代码被打进来。
⑤ **传输层**：开启 gzip/brotli、生产不传 sourcemap（或单独上报）、图片转 WebP/AVIF 并按需压缩。
⑥ **查重复依赖**：pnpm 严格模式、依赖去重、必要时 externals 走 CDN。

经验：**「重复 + 未使用」通常占大头**，先把这两块砍掉，往往直接减半。`
  },
  {
    code: 'monorepo-bundle',
    category: '场景 · 工程化',
    scene: 'monorepo 里子包的代码被重复打进主包，产物反而更大。怎么治？',
    must: ['分包', 'external', 'workspace', 'chunk', '依赖'],
    mustNot: [],
    answer: `先定位：产物里搜同一个库/同一个模块名出现了几份 —— 出现多份就是被打重了。

三个高频病因：
① **打包配置漏了 return**（自定义 rollupOptions / 插件里忘了返回），导致子包被当源码重新编译进主包；
② **包归类错**：本该 external 的内部包/第三方库被打进了 bundle，多个入口各自打一份；
③ **manualChunks 配冲突**：同一个库被拆到多个 chunk（或既进 vendor 又进业务包），反而重复下载。

治理做法：
- 内部包统一用 **workspace:\*** 协议引用，构建时对第三方做 **external**（库交给宿主去装）；
- 手动分包只针对**稳定的大第三方**，且保证一个库只落一个 chunk（可用函数式 manualChunks 按 node_modules 路径归类）；
- 用 **pnpm** 的严格依赖避免幽灵依赖与版本漂移；
- 多包构建用 turborepo / nx 的缓存 + 拓扑构建顺序；
- 定期跑包体积分析，把「重复率」当指标盯。

一句话：**库该 external 的别打进去，该打进去的别打多份。**`
  },
  {
    code: 'big-file-upload',
    category: '场景 · 工程化',
    scene: '要上传几百 MB 的大文件，经常中断、还容易超时。你怎么设计上传方案？',
    must: ['分片', '断点续传', '秒传', '并发', 'hash'],
    mustNot: [],
    answer: `核心是**分片 + 断点续传**：

① **分片上传**：按固定大小（2–5MB）把文件切片，并发上传，服务端按序号合并 —— 既绕开单请求体积/超时限制，也能并发提速。
② **断点续传**：上传前先请求服务端「这个文件（按 hash 标识）已有哪些分片」，只补缺失的；中断后能接着传。
③ **秒传**：上传前先算文件 hash（大文件用抽样 hash 快速预判，再全量兜底），服务端若已有同 hash 文件直接返回成功。
④ **并发控制 + 单分片重试**：限制并发（3–5），某一片失败只重传那一片，不要整体重来。
⑤ **进度与取消**：显示真实进度、支持暂停/继续/取消（AbortController）。
⑥ **直传对象存储**：让服务端签发临时 URL，浏览器直接传到 OSS/S3，业务服务器只做元数据与合并记录 —— 避免流量全压在自己身上。

边界处理：文件被修改过（hash 变了）要重新上传；合并失败要能回滚或重试；超时用「单片超时」而不是整体超时。`
  },
  {
    code: 'long-task',
    category: '场景 · 性能',
    scene: '一个 200ms 的同步计算把主线程卡住了，用户打字都卡顿。怎么改？',
    must: ['Worker', '分片', '切片', 'idle'],
    mustNot: [],
    answer: `根因：**JS 是单线程**，一段同步长任务（一般 >50ms 就算「长任务」）会把主线程占满，渲染和输入事件都排队等着。

三条路（按场景选）：
① **Web Worker**：把纯计算搬进 Worker（不能碰 DOM），算完 postMessage 回结果 —— 主线程全程不卡。适合：大数组计算、解析、加解密、图片处理。
② **时间切片（分片）**：把任务拆成小块，每块执行完用 setTimeout(0) / requestIdleCallback（空闲 idle 时段）/ scheduler.yield 让出主线程，让浏览器有机会渲染与响应输入。适合：必须操作 DOM 的分批渲染。
③ **优化算法与数据**：减少计算量本身 —— 用 Map 替代数组查找消除 O(n²)、加缓存/记忆化、把重复计算提到循环外、用索引替代深拷贝。

配套：
- 先渲染骨架（Skeleton），把重计算延后；
- 用 PerformanceObserver 监听 longtask 做监控，别等用户反馈；
    - 注意 Worker 与主线程的数据传输成本（大对象用 Transferable / SharedArrayBuffer 零拷贝）。`
  },
  {
    code: 'event-delegation',
    category: '场景 · 事件',
    scene: '表格有 1000 行，每行一个「删除」按钮。你给每行都绑了 click，页面卡、内存也高。怎么改？',
    must: ['事件委托', '冒泡', '父'],
    mustNot: [],
    answer: `用**事件委托**：只在外层容器（**父**元素）上绑一个监听，利用**事件冒泡**，在回调里用 e.target 判断点的是哪个按钮、属于哪一行（用 closest 沿祖先找，或从 dataset 拿 id）。

好处：
① 监听器从 1000 个降到 1 个 —— 内存与初始化都省；
② 动态新增/删除的行自动生效，不用重新绑（也不用解绑，避免泄漏）。

注意：
① 有些事件**不冒泡**（focus / blur / mouseenter / mouseleave），要换 focusin / focusout，或在捕获阶段处理；
② 判断目标要稳 —— 别只比对 e.target（按钮里可能还有图标子元素），用 closest 找最近的按钮；
③ 别把委托绑到 document 上滥用，作用域越小越好维护。
`
  },
  {
    code: 'prevent-bubble',
    category: '场景 · 事件',
    scene: '一张卡片整块可点进详情，右上角还有个「收藏」按钮。现在点收藏，详情页也被打开了。为什么？怎么改？',
    must: ['stopPropagation', '冒泡', 'preventDefault'],
    mustNot: [],
    answer: `原因：点收藏时事件会**冒泡**到父级卡片，卡片上的点击回调也被触发了 —— 两个处理器都跑了一遍。

改法：在收藏按钮的处理函数里调用 **e.stopPropagation()**，阻止事件继续向上冒泡。

⚠️ 常见混淆 —— 这两个是完全不同的东西：
| 方法 | 作用 | 典型用途 |
|---|---|---|
| **preventDefault()** | 阻止元素**默认行为**，事件照样冒泡 | 阻止 a 跳转、表单提交、右键菜单 |
| **stopPropagation()** | 阻止事件**继续冒泡**，不影响默认行为 | 阻止父级监听被触发 |
| stopImmediatePropagation() | 阻止冒泡 + 同元素后续监听 | 多个监听器时彻底截断 |

所以"点收藏顺带打开详情"要用 stopPropagation；"点链接不想跳转"要用 preventDefault。两个都要就都调一次。
`
  },
  {
    code: 'debounce-handwrite',
    category: '场景 · 事件',
    scene: '让你手写一个防抖函数。除了「延迟执行」，还有哪些细节必须处理？',
    must: ['闭包', '定时器', 'this', '参数', 'clearTimeout'],
    mustNot: [],
    answer: `骨架：**闭包**里保存一个**定时器** id；每次触发先 **clearTimeout** 清掉上一个，再 setTimeout 延迟执行。

面试官真正想听的是这些细节：
① **this 与参数透传**：返回的函数里要把调用时的 this 和 arguments 传给原函数（普通函数用 fn.apply(this, args)，或用箭头函数捕获外层 this）；
② **immediate / leading 选项**：有的场景要"第一次立刻执行，之后进入冷却"（如按钮防连点）；
③ **cancel / flush**：暴露取消方法，组件卸载时能清掉定时器 —— 否则回调持有已卸载组件，就是一次内存泄漏；
④ 定时器 id 每次必须覆盖，别让多个定时器叠着跑；
⑤ 如果要支持"立即执行 + 尾部再执行一次"，别忘了 trailing 分支。

一句话：**防抖的难点不在延迟，在 this、参数、取消这三件事**。
`
  },
  {
    code: 'request-waterfall',
    category: '场景 · 网络',
    scene: '详情页要取「用户信息」「权限列表」「消息数」三个接口，它们互不依赖。现在写成三次 await 串行，首屏慢了三倍。怎么改？',
    must: ['并行', 'Promise.all', '串行'],
    mustNot: [],
    answer: `三个接口互不依赖，就该**并行**而不是**串行**。

改法：用 **Promise.all** 一起发 —— 总耗时取决于最慢的那个，而不是三者相加：
「const [user, perms, msg] = await Promise.all([a(), b(), c()])」

进阶考虑：
① 需要"部分失败也能用"就换 **Promise.allSettled**（Promise.all 是任一失败整体 reject，一条挂全挂）；
② 有时序无关的请求可以更早发（路由跳转前、骨架屏阶段就发出）；
③ 真正需要**串行**的只有**有依赖**的场景（B 必须等 A 的结果）；
④ 首屏优先：把首屏必需的数据和非必需的拆开，非必需的延后或懒加载；
⑤ 接口太多时配合并发池（见另一题）避免打爆后端。

排查工具：Network 面板看瀑布图 —— 一条一条"阶梯状"排队，基本就是串行写错了。
`
  },
  {
    code: 'abort-on-unmount',
    category: '场景 · 网络',
    scene: '详情页发了一个请求，用户立刻返回上一页，然后控制台报「更新了已卸载的组件」。怎么根治？',
    must: ['卸载', '取消', 'AbortController', '标志'],
    mustNot: [],
    answer: `根因：请求发出后组件已经被**卸载**，但回调仍然回来更新它的状态 —— React 会警告，Vue 里则可能造成脏更新或内存泄漏（回调还持有组件引用）。

两条根治思路：
① **取消请求**（首选）：用 **AbortController**，在组件卸载时 abort()（axios 用 signal / CancelToken）。请求根本没回来，自然没有回调。
② **加标志位**：用一个「let cancelled = false」，卸载时置 true，回调里先判断再更新 —— 适合无法取消的第三方调用或 WebSocket。

配套：
- Vue 放在 onUnmounted / onBeforeUnmount，React 放在 useEffect 的 cleanup 里，**成对写**；
- 快速切换页面时，配合"只接受最新一次响应"（请求**序号**）防竞态；
- 全局兜底 window.onunhandledrejection，避免取消导致的 rejection 被误报。
`
  },
  {
    code: 'skeleton-cls',
    category: '场景 · 渲染',
    scene: '首屏加了骨架屏，但真实内容渲染后整页往下一跳，用户点到了错误的位置。怎么解？',
    must: ['CLS', '占位', '高度', '布局偏移'],
    mustNot: [],
    answer: `这是 **CLS（累积布局偏移）**：骨架屏与真实内容的尺寸不一致，内容落位时把下面的元素推下去了。

解法：
① **占位尺寸对齐**：骨架块的**高度**、宽高比要和真实内容一致；
② **图片/广告/iframe 必须预留高度**：用 width/height 属性或 aspect-ratio，别等加载完再撑开；
③ 新增内容尽量**向下追加**，不要往已渲染内容的上方插入（"有新消息"提示条不要顶下去）；
④ 字体加载、动态横幅同理 —— 预留空间或设 min-height；
⑤ 用 PerformanceObserver 监听 layout-shift 验证效果（目标 CLS < 0.1）。

一句话：**布局偏移的根因是"尺寸未知"，那就把尺寸提前声明出来。**
`
  },
  {
    code: 'font-flash',
    category: '场景 · 渲染',
    scene: '自定义字体加载时，文字先是空白、加载完突然换成自定义字体，整段跳动。怎么优化？',
    must: ['font-display', 'preload', '字体', '闪烁'],
    mustNot: [],
    answer: `现象专业叫 **FOIT / FOUT**：**字体**未就绪时要么不可见（FOIT），要么先用回退字体再切换（FOUT），切换时会重排导致跳动/闪烁。

优化：
① **font-display**: swap —— 先用回退字体立即显示，加载完替换（避免长时间空白）；optional 更激进（弱网直接不回退）；
② **preload** 关键字体：rel="preload" as="font" crossorigin，并配合**子集化**只打包用到的字重/字形，减小体积；
③ 让回退字体与自定义字体的**字形度量接近**（size-adjust / ascent-override，或选相近的系统字体），减少切换位移；
④ 字体文件同域或配好 CORS，避免额外握手；
⑤ 首屏关键文案可先用系统字体，非关键区域再上自定义字体。

自检：DevTools 的 Rendering 面板勾选 "Font display"，直接看切换时序。
`
  },
  {
    code: 'image-lazy',
    category: '场景 · 性能',
    scene: '长图文列表页，一进去所有图片同时开始加载，首屏被拖得很慢。怎么改？',
    must: ['懒加载', 'IntersectionObserver', '预加载', 'loading'],
    mustNot: [],
    answer: `两步走：**懒加载**非关键图 + **预加载**关键图。

① **懒加载**：只加载视口附近的图。原生用 loading="lazy"；要精细控制（提前量、动画、失败重试）就用 **IntersectionObserver**，进入视口才把 data-src 换成 src；
② **占位防跳动**：给图片写死宽高或 aspect-ratio，避免加载完撑开导致 CLS；
③ **预加载关键图**：首屏第一张（通常是 LCP 元素）**反而要提前加载**（rel="preload" 或 fetchpriority="high"），别让它被懒加载拖慢 —— 这是最常见的误伤；
④ 图片本身：压缩、转 WebP/AVIF、用 srcset + sizes 按需尺寸、CDN 裁剪；
⑤ 长列表可以对"离开视口很久"的图做反向卸载，控制内存。

误区：把首屏图也设成 lazy，结果 LCP 更慢了。
`
  },
  {
    code: 'xss-innerhtml',
    category: '场景 · 安全',
    scene: '用户评论里写了 img onerror 之类的脚本，结果评论区把它当 HTML 渲染，脚本被执行了。怎么防？',
    must: ['XSS', '转义', 'innerHTML', 'CSP'],
    mustNot: [],
    answer: `这是 **XSS（跨站脚本注入）**：你把用户输入当 HTML 渲染（**innerHTML** / v-html / dangerouslySetInnerHTML），里面的标签与事件就被浏览器执行了。

防护（按优先级）：
① **默认不渲染 HTML**：用文本插值（Vue 的 {{ }} / React 的 {}），框架会自动**转义** —— 90% 的场景这样就够了；
② 确实要渲染富文本：用成熟的 **sanitize** 库（DOMPurify）做白名单过滤，禁掉所有 on* 事件属性、script/iframe 标签、javascript: 协议；
③ **服务端也要过滤一次**，不要只信前端（前端可被绕过，且要防"存起来下次渲染"的存储型 XSS）；
④ 加 **CSP**（Content-Security-Policy）限制脚本来源，作为第二道防线；
⑤ 别用 eval / new Function 处理用户输入；敏感 Cookie 设 HttpOnly，令牌放内存。

顺带区分：**XSS 是在你的页面里执行代码；CSRF 是借你的身份发请求。**
`
  },
  {
    code: 'csrf-token',
    category: '场景 · 安全',
    scene: '一个第三方页面放了个隐藏表单，用户一打开就自动向你的站点发了「转账」请求，还带着 Cookie。怎么防？',
    must: ['CSRF', 'token', 'SameSite', 'Referer'],
    mustNot: [],
    answer: `这是 **CSRF（跨站请求伪造）**：浏览器会自动带上你站点的 Cookie，所以服务端分不清是用户自愿操作还是被诱导的。

防护：
① **CSRF Token**（最有效）：服务端下发一次性 token（写进页面/表单/自定义头），提交时必须带回并校验 —— 第三方站点拿不到这个 token；
② **SameSite Cookie**：设 Lax 或 Strict，跨站请求就不带 Cookie 了（注意 Strict 会影响第三方登录回跳等场景，通常用 Lax）；
③ **校验来源**：检查 Origin / **Referer** 头是否同源（作为辅助手段，注意有些请求没有 Referer，不能只靠它）；
④ **敏感操作二次确认**：转账、改密码要求输入密码或验证码；
⑤ 不要用 GET 做有副作用的操作（图片、表单、预加载都能轻易触发 GET）。

一句话：**CSRF 的关键是"让攻击者拿不到那个凭证（token）"，而不是靠前端藏起来。**
`
  },
  {
    code: 'token-storage',
    category: '场景 · 安全',
    scene: '登录后的 token 存 localStorage 还是 Cookie？说说取舍。',
    must: ['localStorage', 'HttpOnly', 'XSS', 'CSRF', 'Cookie'],
    mustNot: [],
    answer: `没有绝对答案，看你能接受哪种风险 —— 两者各挡一半。

| 方案 | 优点 | 风险 |
|---|---|---|
| **localStorage** | 简单、跨端方便、不怕 **CSRF**（浏览器不会自动带） | JS 能读 → 一旦 **XSS** 直接被偷走，无过期与 HttpOnly 保护 |
| **Cookie（HttpOnly）** | 设 **HttpOnly** 后 JS 读不到，XSS 也偷不走；可配 Secure / SameSite | 浏览器自动携带 → 天然有 **CSRF** 风险，必须配 SameSite + CSRF Token |

落地建议：
① 最稳的是「HttpOnly Cookie 放 refresh token + 内存里放短命 access token」；
② 若必须用 **localStorage**：把 XSS 防护做扎实（CSP、转义、依赖审计）、token 设短有效期 + 刷新机制、必要时加密（但前端加密作用有限）；
③ 无论哪种，都别把 token 写进 URL 或日志（会进 Referer / 监控系统）。
`
  },
  {
    code: 'component-reuse-key',
    category: '场景 · 框架原理',
    scene: '两个页面共用同一个组件，从 A 跳到 B 时，组件里的输入框内容还残留着。为什么？',
    must: ['key', '复用', '销毁', '重挂载'],
    mustNot: [],
    answer: `原因：Vue/React 在同一位置渲染**同类型组件时会复用** —— 框架认为"还是那个组件"，只更新 props，于是组件内部状态被保留了下来。

改法：给它加一个会变化的 **key**（如 route.fullPath、数据 id）。key 一变，框架就会**销毁**旧实例并**重挂载**，状态自然重置。

其他同类场景：
① 列表里 key 用错（用 index）→ 状态串位，也是**复用**判断错导致；
② 想主动重置复杂表单，改 key 比手动清空每个字段更干净；
③ 反过来要警惕：加 key 意味着重新创建（开销变大），别滥用；只想同步部分状态的话用 watch 更合适。

一句话：**key 是"身份"，身份变了就重建，身份没变就复用。**
`
  },
  {
    code: 'watch-deep',
    category: '场景 · 框架原理',
    scene: 'watch 了一个对象，改了它的某个属性，回调却没触发。为什么？',
    must: ['deep', '引用', 'watch', 'computed'],
    mustNot: [],
    answer: `原因：**watch** 默认只做浅比较 —— 比较的是**引用**。你改对象内部属性时引用没变，所以判定"没变化"，不触发回调。

三种解法：
① 加 **deep**: true —— 会递归遍历，对象大时有性能开销；
② 直接 watch 那个具体属性（「() => state.count」）—— **更推荐**：精确、省性能、意图清晰；
③ 如果这个值是"算出来的"，用 **computed** 更合适（有缓存、语义明确），需要副作用时再 watch 这个 computed。

补充：Vue3 用 reactive 定义的对象，直接改内部属性本身是能触发渲染的（Proxy 拦截）；但 watch 是否触发取决于你有没有 watch 到那个字段，或有没有开 deep。ref 包对象要 watch 内部字段同理。
`
  },
  {
    code: 'destructure-reactive',
    category: '场景 · 框架原理',
    scene: '从 reactive / ref 对象里解构出来的变量，改了它页面不更新。怎么办？',
    must: ['解构', 'toRefs', '响应式', 'Proxy', 'ref'],
    mustNot: [],
    answer: `原因：**解构本质是取值**。把响应式对象的某个属性取出来赋给普通变量后，它就只是一个普通值，与源对象之间的**响应式**关联断了（Vue3 用 **Proxy** 追踪的是"对源对象的属性访问"，不是变量本身）。

解法：
① 不解构，始终通过「state.xxx」访问；
② 用 **toRefs**(state) / toRef(state, 'xxx') 解构 —— 拿到的是保持响应式的 **ref**；
③ 用 computed 派生需要的那部分；
④ 写组合式函数时，标准做法就是返回 ref / toRefs，别返回被解构过的裸对象。

类比：解构像"抄了一份地址"，而不是"拉了一条电话线"——源头变了，抄的那份不会响。
`
  },
  {
    code: 'keep-alive-state',
    category: '场景 · 框架原理',
    scene: '列表页有筛选条件和滚动位置，一进详情再返回就全丢了。怎么保持？',
    must: ['keep-alive', '缓存', 'activated', '状态'],
    mustNot: [],
    answer: `目标：返回列表时保留**状态**（筛选条件、滚动位置、已加载的数据）。

Vue：
① 用 **keep-alive** 包裹路由出口，把列表页**缓存**起来（组件不销毁，状态自然保留）；
② 配合 include / exclude 精确控制缓存范围，别全缓存（吃内存）；
③ 用 **activated** / deactivated 钩子做进入恢复（重设滚动位置）与离开保存；
④ 滚动位置可交给路由的 scrollBehavior（配合 history），或手动记录 scrollTop；
⑤ 关键状态同时持久化到 store / sessionStorage，防止刷新丢。

React 对应思路：状态提升到父级或 store、把筛选条件放进 URL query（可分享可回退）、或用 off-screen 保留渲染树。

取舍：缓存越多内存越高，长时间不用的页面要能淘汰。
`
  },
  {
    code: 'ssr-first-screen',
    category: '场景 · 架构',
    scene: '首屏白屏 3 秒（要等 JS 下载完才渲染），老板问要不要上 SSR。你怎么判断？',
    must: ['SSR', '首屏', 'SEO', '水合'],
    mustNot: [],
    answer: `先判断是否真需要，SSR 不是万能药。

**该上的信号**：① 首屏强依赖数据且需要 **SEO**（内容站、电商详情）；② 白屏直接影响转化；③ 弱网/低端机占比高。

**SSR 能解决**：服务端直出 HTML，**首屏**更快可见，爬虫可收录。

**代价（必须说清）**：
① 需要 Node 服务 —— 部署/扩容/监控复杂度上升；
② 代码要兼容服务端（不能用 window/document，生命周期不同）；
③ **水合（hydration）** 阶段前后端不一致会报错报白屏，要专门排查；
④ 缓存与压测要求更高，成本上升。

**更轻的替代**：SSG / 预渲染（静态页）、纯 CSR + 骨架屏 + 资源优化、边缘渲染。

结论：**先用打包分析把 JS 体积砍掉**（往往收益更快更便宜），再评估 SSR 是否真的必要。
`
  },
  {
    code: 'ts-any',
    category: '场景 · 工程化',
    scene: '团队项目里到处都是 any，类型检查形同虚设。你会怎么逐步整改？',
    must: ['unknown', '泛型', '类型守卫', '严格模式'],
    mustNot: [],
    answer: `不要一次性全改（会炸），按"加严 + 收口 + 入口校验"推进：

① 打开 **tsconfig 的 strict（严格模式）**（可先开 strictNullChecks，最容易暴露真问题），并开启 noImplicitAny —— 让**新代码**不能偷懒；
② 把 any 换成 **unknown** —— unknown 必须先做**类型守卫**（typeof / in / 自定义 type guard）才能使用，逼你处理边界；
③ 用**泛型**替代 any 写通用工具（如「request<T>」、Pick<T,K>、Omit<T,K>），保留类型信息；
④ **外部数据在入口处校验一次**：接口响应/本地存储用 runtime schema（zod 之类）校验并推导类型，别让脏数据往里渗；
⑤ 配合 ESLint 的 no-explicit-any 逐步收紧；用 ts-expect-error 时必须写清原因并登记技术债；
⑥ 给后端 DTO、store state 补类型，让类型有单一来源（单一真相）。

推进顺序：入口校验 → 公共工具 → 业务组件，配合 CI 卡新增违规。
`
  },
  {
    code: 'error-monitor',
    category: '场景 · 工程化',
    scene: '线上有用户反馈页面白屏，但你手上什么都没有。怎么建立可观测性？',
    must: ['onerror', '上报', 'sourcemap', '监控', '错误边界'],
    mustNot: [],
    answer: `三层防线 + 上报：

① **全局捕获**：window.onerror / addEventListener('error')、**window.onunhandledrejection**（未处理的 Promise rejection）、框架层 —— Vue 的 errorCaptured、React 的**错误边界**（ErrorBoundary 能把整页白屏降级成局部出错 / 兜底 UI）；
② **上报**：把错误栈、路由、用户标识、UA、构建版本、面包屑一起报到**监控**平台（Sentry / 自建），做聚合、去重、告警与版本对比；
③ **可读的栈**：生产代码是压缩的，**必须把 sourcemap 上传到监控平台**（别把 map 直接放公网，会泄露源码）；
④ 性能侧：PerformanceObserver 监控 longtask / LCP / CLS，配合用户操作路径还原现场；
⑤ 兜底体验：接口失败有重试与降级、关键流程埋点、灰度与快速回滚能力 —— 别等用户来告诉你。

一句话：**没有上报，就没有线上。**
`
  },
  {
    code: 'timezone-date',
    category: '场景 · 时间',
    scene: '后台写的是「每日 0 点重置」，但用户在北京时间早上 8 点就发现重置了。为什么？',
    must: ['时区', 'UTC', 'ISO', '本地'],
    mustNot: [],
    answer: `根因：服务端按 **UTC** 自然日切分，而用户看的是**本地**时间 —— UTC 的 0 点正好是北京时间（UTC+8）早上 8 点。这不是 bug，是"日界没定义清楚"。

正确做法：
① **存储统一用 UTC**（时间戳或带偏移的 **ISO** 8601 字符串），**展示**时再按用户的**本地**时区格式化（Intl.DateTimeFormat / toLocaleString 指定 timeZone）；
② 「今天」「每日重置」这种业务概念要**先确定时区**：按业务所在时区（如 Asia/Shanghai）算日界，别直接拿 UTC 日期切；
③ 不要把"日期字符串"当时间戳传来传去（会丢时区信息）；
④ 有夏令时（DST）的地区别硬编码偏移，交给时区数据库处理；
⑤ 跨时区用户多时，在 UI 上**明确标注**口径（例如"每日 08:00（北京时间）重置"），并把规则写进文档。

一句话：**时间只存 UTC，日界要指定时区，展示按本地。**
`
  },
  {
    code: 'mobile-adapt',
    category: '场景 · CSS',
    scene: '移动端要适配各种屏幕宽度，rem / vw / 媒体查询你选哪个？',
    must: ['viewport', 'rem', 'vw', '媒体查询'],
    mustNot: [],
    answer: `没有单一答案，看"可控性 vs 等比缩放"的取舍：

① **前提**：先写好 viewport meta（width=device-width, initial-scale=1）—— 漏了它后面全白搭；
② **媒体查询**：断点式布局，语义清晰、可控，适合"一套设计稿 + 几个断点"（最常见，也最好维护）；
③ **rem**：以根字号缩放（配 postcss-pxtorem 等），整页等比缩放，适合 H5 活动页/营销页；缺点是字号与真实像素脱钩，影响可访问性；
④ **vw**：按视口百分比，纯 CSS 无需 JS，等比感自然；注意超宽屏/极端宽高比要用 max-width 兜底；
⑤ **现代实践**：媒体查询 + flex/grid + clamp()/min()/max() 做弹性布局，比整页缩放更稳；刘海屏用 env(safe-area-inset-*) 处理**安全区**；
⑥ 别忘了体验细节：点击热区 ≥ 44px、字体不小于 12px、1px 边框用 transform 缩放或 0.5px 方案。

选型建议：**内容型用弹性布局 + 断点，活动页用 rem/vw 等比缩放。**
`
  },

  /* ================= 项目深挖（kind: 'project'） =================
   * 面试官视角的追问，绑定你的三大旗舰项目。
   * 注意：参考解法是「高分回答骨架」+ 通用最佳实践 —— 请按你的真实实现校准，别背。
   */
  {
    code: 'proj-sql-diff-algorithm',
    kind: 'project',
    category: '项目深挖 · SQL AI 审查',
    scene: '【面试官追问】你说在 Monaco 里做 AI 审查的内联 diff。这个 diff 是怎么算出来的？为什么不能直接逐行比对？',
    must: ['diff', '公共子序列', 'LIS', '行', '移动'],
    mustNot: [],
    answer: `先讲为什么不能逐行比：只要中间**插入一行**，后面所有行的下标全部错位，逐行比对会把"插入 1 行"报成"改了后面 200 行"——噪音大到没法看。

正确做法分两层：
① **哪些内容相同** → 求最长**公共子序列(LCS)**（或最小编辑距离）。落在公共子序列里的**行**是"保留"的，夹在公共行之间的就是新增/删除。
② **最少移动多少** → 如果还想像 git 那样把"移动"标到最少：把"新序列里每一行在旧序列中的位置"取出来，对这批位置求**最长递增子序列(LIS)**。LIS 内的元素**不用移动**，其余才需要移动。

⚠️ 高频追问点：**LCS 和 LIS 不是一回事，也不能互换** —— LCS 解决"哪些内容相同"，LIS 解决"最少移动几个"。面试官很可能就是拿这个区分你有没有真懂。

工程落地：别手写（边界极多），用 diff-match-patch / 成熟 diff 库；注意它的复杂度对超长文本不友好，要设超时或降级到行级。
`
  },
  {
    code: 'proj-sql-diff-perf',
    kind: 'project',
    category: '项目深挖 · SQL AI 审查',
    scene: '【面试官追问】用户打开一个 5000 行的 SQL 文件，一算 diff 页面就卡住 2 秒。你怎么优化？',
    must: ['Worker', '增量', '节流', '版本', '虚拟'],
    mustNot: [],
    answer: `根因：diff 是计算密集型任务，跑在**主线程**上会阻塞渲染与输入。

① **搬进 Web Worker**：diff 是纯计算、完全不碰 DOM，是最适合 Worker 的任务；结果 postMessage 回主线程（结果大时考虑 Transferable 减少拷贝）。
② **增量计算**：用户编辑只影响局部 —— 先按"编辑位置"切出受影响的窗口，只重算这一段（配合行级锚点），而不是每次全文 diff。
③ **去抖 / 节流 + 结果版本号**：编辑停止 200–300ms 后再算；给每次计算打自增 id，回来先比对"我还是不是最新那次"，过期结果直接丢弃（防乱序覆盖）。
④ **渲染侧配合**：Monaco 本身是**虚拟滚动**，只给可视区加 decoration；用一次 setModelDecorations 批量提交，别逐条 add（会触发大量重排）。
⑤ **降级策略**：超长文本只做行级 diff，不做字符级；或用超时中断 + 提示"文件过大，仅展示行级差异"。

回答结构建议：**先定位瓶颈（主线程 + 算法复杂度），再分层给方案（计算/渲染/交互），最后给降级兜底。**
`
  },
  {
    code: 'proj-sql-anchor-drift',
    kind: 'project',
    category: '项目深挖 · SQL AI 审查',
    scene: '【面试官追问】AI 返回的是"第 42 行有问题"，但用户在你渲染之前又编辑了几行，高亮就错位了。怎么根治？',
    must: ['行号', '锚点', '版本', '映射', 'decoration'],
    mustNot: [],
    answer: `根因：**行号是易失坐标** —— 内容是活的，行号随时会漂。

① **版本绑定**：发起审查时记录文档 version，结果回来先比对 version；不一致时不要直接渲染。
② **锚内容，而不是锚行号**：用「该行文本片段 + 上下文特征」做**锚点**，在最新文档里重新定位；定位不到就明确提示"内容已变更，请重新审查"。
③ **行号映射**：如果坚持用行号，就要在版本变化时用 diff 把旧行号**映射**到新位置（这也是上面那个 diff 能力的复用）。
④ **落地用 decoration**：Monaco 的高亮/行内提示用 decoration（区间 + 样式 + hover 内容）实现，而不是往文本里插字符串 —— 这样不污染用户文档，撤销重做也干净。
⑤ 交互兜底：给"重新审查"入口，让用户能手动刷新结论。

一句话：**不要把结论绑在易变的坐标上，要么绑版本，要么绑内容。**
`
  },
  {
    code: 'proj-sql-stream-review',
    kind: 'project',
    category: '项目深挖 · SQL AI 审查',
    scene: '【面试官追问】AI 审查结果是流式返回的。边生成边显示，怎么做到不卡、还能中途取消？',
    must: ['流式', '增量', '节流', '取消', 'SSE'],
    mustNot: [],
    answer: `① **传输层**：用 **SSE**（或 fetch + ReadableStream）逐块读，比 WebSocket 轻；配 AbortController 支持**取消**（"停止生成"按钮）。
② **渲染层**：千万不要每来一片就 setState —— 高频重渲染必卡。用**增量缓冲 + 节流**（如 60–100ms 合并一次）批量刷新到 UI。
③ **解析层**：流式传输时 JSON 是不完整片段，要有容错解析 —— 最省事的是让后端按 JSONL（一行一个对象）推，或缓冲到括号闭合再解析。
④ **状态机**：生成中 / 已取消 / 已完成 / 失败 四态要清晰；取消时既要 abort 请求，也要丢弃已到达但未渲染的残留数据。
⑤ **收尾**：流结束后再一次性做 diff / decoration 的最终落地，避免中间态反复重算（与"大文件 diff 性能"那题是同一套思路）。

加分点：说清"为什么不用轮询"——轮询延迟高、连接开销大；SSE 天然单向流式，正好匹配这个场景。
`
  },

  {
    code: 'proj-pnpm-pitfalls',
    kind: 'project',
    category: '项目深挖 · pnpm 分包',
    scene: '【面试官追问】你的 pnpm monorepo 分包踩过哪些坑？说三个具体的。',
    must: ['return', 'external', 'chunk', '分包', '重复'],
    mustNot: [],
    answer: `按"构建配置 → 依赖归类 → 手写分包"三层讲，每个都讲清"现象 + 根因 + 怎么修"：

① **构建配置漏了 return**：自定义 rollupOptions / 插件函数里忘了 return 配置对象 → 产物结构不符预期、子包被当源码重新编译进主包。
② **包归类错**：本该在宿主里 **external** 掉的内部包/第三方库被打进了 bundle，多个入口各打一份 → 产物**重复**、体积虚高。
③ **manualChunks 冲突**：同一个库被分到多个 **chunk**（或既进 vendor 又进业务包），反而重复下载；函数式 manualChunks 要按 node_modules 路径严格归类，并保证一个库只落一个 chunk。

补充（体现体系感）：
- 内部包统一用 **workspace:\*** 协议，避免版本漂移；
- 用 **pnpm** 的严格依赖避免幽灵依赖（没声明的包也能 import 的问题）；
- 把"产物体积 / 重复率"做成 CI 指标，超阈值直接 fail，防止回归。

讲法建议：**每个坑都要有"修复前后对比"，面试官想听的是你怎么发现的，不只是坑本身。**
`
  },
  {
    code: 'proj-pnpm-dedupe',
    kind: 'project',
    category: '项目深挖 · pnpm 分包',
    scene: '【面试官追问】产物里同一个库出现了 3 份，你怎么定位、怎么消除？',
    must: ['定位', 'external', '版本', '去重', 'chunk'],
    mustNot: [],
    answer: `**先定位**（这步讲清楚最加分）：
① 打包分析工具（rollup-plugin-visualizer / webpack-bundle-analyzer）看同一包名的多个来源路径；
② 在产物里 grep 该库的特征字符串，看命中几个文件；
③ 「pnpm why 包名」查谁是依赖方、有几个版本；
④ 看产物文件名：同一库不同 hash 多份，通常就是多版本或多入口各打一份。

**再消除（去重）**：
① 库类包构建时 **external**，交给宿主统一安装（子包不该把第三方打进自己的产物）；
② 统一**版本**（pnpm overrides / workspace 协议），消除多版本共存；
③ 手动 **chunk** 只针对稳定的大第三方，并保证一个库只落一个 chunk；
④ 检查是否同时被"直接依赖 + 间接依赖"打进了不同 chunk；
⑤ 多入口用共享 chunk（splitChunks / output.manualChunks 统一策略），别各打各的。

**防回归**：CI 加产物体积与重复率检查，把"新增重复依赖"挡在合并前。

一句话总结：**重复打包的根因永远是"该外置的没外置"或"该合并的没合并"。**
`
  },
  {
    code: 'proj-monaco-worker',
    kind: 'project',
    category: '项目深挖 · pnpm 分包',
    scene: '【面试官追问】Monaco 的 worker 在你分包后加载 404 或者被打进了多个 chunk，怎么解？',
    must: ['worker', 'chunk', 'manualChunks', '路径', 'CDN'],
    mustNot: [],
    answer: `先讲根因：Monaco 的 worker 是**独立文件**，不随主 bundle 走。打包器不知道它的运行时加载**路径** —— 一旦你改了 chunk 命名或输出目录，它按默认路径找不到就 404；如果多个入口各自打包，就会产出多份 worker **chunk**。

三种解法（按推荐度）：
① **显式接管 worker 加载**：Vite 用「?worker」导入 + 自己实现 MonacoEnvironment.getWorker，把加载路径的控制权拿回来；
② **走 CDN**：用 monaco-editor 的 loader 配置 vs 路径指向 CDN，把 worker 从自己的产物里摘出去（简单，但要考虑内网/离线）；
③ **在 manualChunks 里给 monaco 单独归一个 chunk**，避免它被拆进多个业务 chunk。

必做的收尾检查：构建完看 dist 里 worker 文件到底在不在、运行时拼接的**路径**是否一致 —— 这是最容易出错的一步。
排查手法：打开 Network 面板看那条 404 的 URL，反推"它期望的路径"和"实际产物路径"差在哪。
`
  },
  {
    code: 'proj-monorepo-build',
    kind: 'project',
    category: '项目深挖 · pnpm 分包',
    scene: '【面试官追问】monorepo 里改一个底层包，所有包都要重编，CI 要十几分钟。怎么优化？',
    must: ['拓扑', '缓存', '影响', '依赖', '并行'],
    mustNot: [],
    answer: `按"少做 → 早停 → 并行"三步：

① **只构建受影响的包**：用 turbo/nx 的 filter 按 git 变更范围算出**影响**（被改包的依赖方），无关包不动。
② **缓存命中就跳过**（收益最大）：本地 + 远程缓存，输入指纹 = 源码 + **依赖**版本 + 构建配置；指纹没变直接跳过，CI 从十几分钟降到几分钟。
③ **拓扑顺序 + 并行**：按**依赖**图排序（被依赖的先构建），互不依赖的包**并行**执行 —— turbo/nx 自带，别手写脚本。
④ 拆分与增量：类型检查用 tsc --build 增量、测试按包并行、构建产物只出需要的格式（ESM 优先，别同时打 CJS/UMD）。
⑤ 排查持续变慢的原因：是否有包被"假变更"（时间戳/环境影响指纹）导致缓存永远不命中 —— 这是最常见的隐形坑。

讲法建议：**给"优化前 vs 优化后"的 CI 时长数字**，比讲原理有说服力得多。
`
  },

  {
    code: 'proj-perm-unified-entry',
    kind: 'project',
    category: '项目深挖 · 权限转交',
    scene: '【面试官追问】你做了一个统一入口（ApplyDataPermission）来处理权限。为什么必须统一？散着写到底会出什么问题？',
    must: ['统一', '入口', '散落', '一致', '拦截'],
    mustNot: [],
    answer: `散落着写的三个必然结局（这就是"必须统一"的理由）：
① **不一致**：有的接口校验了、有的漏了 —— 漏一处就是一个越权漏洞，而且**没人能保证不漏**；
② **改不动**：规则一变要改 N 处，改漏了又出问题；
③ **不可审计**：说不清"这条数据到底谁能看"，出事没法归因。

统一入口的价值：**所有数据访问都过一次闸机**，规则集中一处、改一处全局生效。

落地要点（面试官会接着问这些）：
① 入口要**难以绕过** —— 做成框架中间件 / 数据访问层的**拦截**，而不是"靠开发者记得手动调"；
② 入参统一（当前用户、目标资源、动作），出参统一（允许 / 拒绝 / **脱敏**后的数据）；
③ 拒绝语义一致（返回 403 而不是"查不到"，避免通过差异探测数据是否存在）；
④ 入口内部可**组合**：角色权限、数据范围（本人/本部门/全部）、字段级脱敏分层叠加；
⑤ 可测：入口是纯函数式判定，能写单测覆盖规则矩阵。

一句话收尾：**安全的关键不是"记得校验"，而是"绕不过去"。**
`
  },
  {
    code: 'proj-perm-frontend',
    kind: 'project',
    category: '项目深挖 · 权限转交',
    scene: '【面试官追问】权限你在前端也做了（按钮置灰、菜单隐藏）。那前端这层到底有什么用？能算安全吗？',
    must: ['前端', '后端', '不可信', '绕过', '体验'],
    mustNot: [],
    answer: `先定调（这句必须先说）：**前端权限只负责体验，不负责安全**。前端代码可被改、接口可被直接调用 —— 前端的一切判断都**不可信**、都能**绕过**。

前端这层的正当作用：
① 不显示不能点的按钮，减少误操作与困惑；
② 提前给出提示（"你没有权限"），避免用户填一堆表单再被拒；
③ 少发无效请求，减轻后端压力。

真正的安全必须在**后端**：每个接口、每次数据查询都要独立校验，**不能因为"前端已经隐藏了"就放行**。

加分回答（体现工程成熟度）：
- **一份规则，两端共用**：后端下发权限点/策略，前端只做渲染决策、后端做终审，避免两边规则漂移；
- 前端权限判断要有**兜底**：即使按钮显示了，后端仍会拦（双保险）；
- 反面例子要能说出来：只在前端隐藏"删除"按钮、后端接口没校验 → 直接 curl 就能删。

面试官问这题其实在看你**有没有把体验和安全分开**。混在一起答，基本就露馅了。
`
  },
  {
    code: 'proj-perm-cache',
    kind: 'project',
    category: '项目深挖 · 权限转交',
    scene: '【面试官追问】权限点很多，每次操作都查一遍权限接口，页面明显变慢。你怎么优化？',
    must: ['缓存', '失效', '批量', '预取', '版本'],
    mustNot: [],
    answer: `① **一次批量拿，而不是每次查一个**：登录后 / 进入模块时**预取**该用户在当前上下文的权限集合，前端本地判断 —— 把 N 次请求压成 1 次。
② **缓存 + 明确失效时机**：缓存在内存/store；在"权限变更、切换角色或组织、令牌刷新"时主动**失效**（后端推送或轮询**版本**号）。
③ **版本号机制**：后端给权限集一个版本号，请求带上；没变就返回 304 / 空体 —— 省流量也更安全（能及时发现变更）。
④ **服务端侧缓存**：热点权限判定结果缓存在 Redis，短 TTL + 变更时主动失效 —— 这通常是性能大头。
⑤ **别缓过头**：涉及敏感操作的**终审仍然实时校验**；缓存只用于列表、按钮这类高频低风险判断。
⑥ 可观测：记录缓存命中率与权限接口耗时，优化要有数据支撑。

讲法建议：说清"**缓存什么（权限集合）、缓在哪（前端内存 + 服务端 Redis）、什么时候失效（三种时机）**"这三件事，条理就出来了。
`
  },
  {
    code: 'proj-perm-audit',
    kind: 'project',
    category: '项目深挖 · 权限转交',
    scene: '【面试官追问】出了数据越权事故，老板问"到底谁在什么时候动了这条数据"。你怎么设计留痕？',
    must: ['审计', '日志', '追溯', '不可篡改', '统一'],
    mustNot: [],
    answer: `① **操作审计日志**：记录"谁（用户/角色）、什么时候、对哪个资源、做了什么动作、结果（成功/拒绝）、来源 IP/UA"。关键是在**统一入口处打点** —— 只有统一入口才能保证不遗漏（这题和"为什么必须统一"是同一套逻辑）。
② **区分读写**：读操作量大可采样；**写操作与权限拒绝必须全量记**。
③ **不可篡改**：审计日志写独立存储、**只增不改**；用签名或链式 hash 防篡改，应用账号不允许删日志 —— 否则有人删日志就把痕迹抹了。
④ **可追溯**：用 requestId / traceId 把一次业务操作串起来，关联业务日志与数据变更记录（谁改的、改前值 / 改后值），能还原完整链路。
⑤ **告警优先于翻日志**：对"短时间大量拒绝""非工作时间访问敏感数据""同一账号异常跨部门访问"做实时告警，别等事后。

    一句话收尾：**审计的价值在事后的可归因，所以它必须做到"统一打点 + 不可否认"。**
`
  },

  /* ================= 稳定性（场景 · 稳定性） =================
   * 来自真实面经：「企业看重的不是你会不会写组件，而是面对浏览器、网络的不确定性，
   * 能不能用工程化手段，给用户一个确定的交付结果。」
   * 四象限：数据 / 请求 / 状态 / 工程
   */
  {
    code: 'http-client-layer',
    category: '场景 · 稳定性',
    scene: '【面试官追问】你们调接口是裸调 axios，还是有一层统一封装？封装里应该放什么、不该放什么？',
    must: ['拦截器', '统一', '超时', 'token', '错误'],
    mustNot: [],
    answer: `结论先说：**必须统一封装**。裸调会让鉴权、**超时**、**错误**处理散落在每个调用点 —— 改一处规则要改 N 处，漏一处就是事故。

封装里应该放（与业务无关的横切能力）：
① **拦截器**：请求侧注入 baseURL、**token**、traceId、防重复提交；响应侧解包（剥掉 code/data 外壳）、按错误码统一分流；
② **超时与取消**：默认 timeout、可按接口覆盖；页面卸载或竞态时 abort；
③ **统一错误出口**：网络错误 / 业务错误码 / HTTP 状态分别归类，对外抛**一致的错误结构** —— 让上层只写一种 catch；
④ **可观测**：耗时打点、失败上报、慢请求告警。

不该放的：**业务逻辑**（失败后跳某页、把某字段默认成 0 这类）—— 那是调用方的责任，塞进来封装就变成不可维护的大泥球。

加分句：**封装要可替换 —— 底层从 axios 换成 fetch，业务代码不应该有感知。**
`
  },
  {
    code: 'response-schema-validate',
    category: '场景 · 稳定性',
    scene: '【面试官追问】后端返回的数据你敢直接用吗？字段缺失、类型不对、返回 null，前端怎么防？',
    must: ['schema', '校验', '兜底', '默认值'],
    mustNot: [],
    answer: `原则：**把接口返回当不可信输入**（和用户输入同级）。后端会改字段名、会返回 null、会把数字返回成字符串 —— 任何一种都能让前端白屏或静默算错。

三层防护：
① **结构校验**：用 runtime **schema**（zod / yup）在数据入口**校验**一次，失败就走降级，别让脏数据往里渗。注意 TS 只是编译期的，**拦不住运行时**；
② **取值兜底**：可选链 + **默认值**（?? / ??=）替代层层 if；列表渲染前先 Array.isArray，对象先判空，数字先 Number() 归一化；
③ **兼容 + 告警**：对字段改名/新增做兼容读取（加一层映射，新旧字段都有就取新的）；发现不符合 schema 的数据要**上报**，让后端感知"契约被破坏了"。

落地位置：放在统一封装的响应拦截器里做 —— 写一次，所有接口受益。
`
  },
  {
    code: 'retry-backoff',
    category: '场景 · 稳定性',
    scene: '【面试官追问】请求失败了要不要重试？怎么重试才不会把后端打挂？',
    must: ['指数退避', '幂等', '重试', '上限'],
    mustNot: [],
    answer: `先回答"要不要"：**不是所有失败都该重试**。
① 可重试：网络抖动、超时、502/503/504（临时性故障）；
② 不可重试：400 参数错、401 未登录、403 无权限、422 业务校验失败 —— 重试只会**重复失败**，还可能触发风控。

**重试**策略三要素：
① **次数上限**（一般 3 次），绝不能无限重；
② **指数退避 + 抖动（jitter）**：间隔 1s → 2s → 4s，再加随机偏移。否则同一时刻所有客户端一起重试，就是**惊群**，直接把恢复中的后端再次打挂；
③ **幂等性判断**：只有**幂等**接口（GET、带 requestId 的幂等写）才能自动重试；非幂等操作（创建订单、扣款）自动重试可能造成重复下单，必须由后端幂等键保证。

配套：重试期间给用户明确反馈（"重试中…"），超过上限给降级或手动重试按钮，别静默失败。
加分：提**熔断** —— 连续失败就快速失败一段时间，别继续打后端。
`
  },
  {
    code: 'timeout-degrade',
    category: '场景 · 稳定性',
    scene: '【面试官追问】接口 10 秒不返回，用户早就走了。超时与降级你怎么设计？',
    must: ['超时', '降级', '兜底', '取消'],
    mustNot: [],
    answer: `① **所有请求必须有默认超时**（如 10s，关键接口更短），用 AbortController 实现，到时主动**取消** —— 别让请求一直挂着占连接、占内存。
② **分级超时**：首屏关键接口短（2–5s），次要接口长；上传/导出这类长任务走单独通道（提交任务 + 轮询状态），不用请求超时硬等。
③ **降级**：超时后**不能白屏** —— 给骨架屏 / **兜底**数据 / 默认值，并提供"重试"入口；非核心模块（推荐位、评论、广告）超时就直接隐藏，别阻塞主流程。
④ **用户反馈**：加载态要明确且**可取消**，别让用户对着转圈猜。
⑤ 兜底优先级：**本地缓存 → 默认值 → 空态 + 重试**，而不是弹一个报错框了事。

一句话：**超时是必然事件，不是异常 —— 设计之初就要回答"超时之后页面长什么样"。**
`
  },
  {
    code: 'cache-fallback',
    category: '场景 · 稳定性',
    scene: '【面试官追问】弱网下接口挂了，页面直接空白。能不能用上次的数据兜底？怎么设计？',
    must: ['缓存', '兜底', '过期', '本地', '失效'],
    mustNot: [],
    answer: `思路：**"最后一次成功的数据"就是最好的兜底**（stale-while-revalidate 的思想）—— 网络不可靠时，宁可显示可能过期的数据，也别白屏。

设计五步：
① **写入**：每次接口成功，把结果连同时间戳存进**本地缓存**（内存优先；关键数据用 sessionStorage / IndexedDB）；
② **读取**：接口失败时取**缓存**数据渲染，同时打上"数据可能已过期"的标识（顶部轻提示），别让用户误以为是最新的；
③ **过期**策略：给缓存设 TTL；不同数据容忍度不同 —— 配置类可以很旧，行情、库存、余额这类不能旧；是否使用过期数据由业务决定；
④ **失效**：写操作成功后主动**失效**相关缓存，避免"界面显示旧数据，用户以为已生效"；
⑤ **安全**：**本地**缓存可能含敏感数据，要有清理机制，别把 token、隐私长期落在磁盘。

加分：说清这套和"请求层缓存"的区别 —— 这里兜的是**失败场景**，不是省请求。
`
  },
  {
    code: 'route-state-restore',
    category: '场景 · 稳定性',
    scene: '【面试官追问】用户在列表→详情→列表→改筛选→再跳走，来回十几轮，回来说"我的筛选条件没了"。状态恢复你怎么设计？',
    must: ['URL', 'query', '持久化', '恢复', '过期'],
    mustNot: [],
    answer: `先分清三类状态，**别一刀切**：
① **要跨页、可分享的**（筛选条件、页码、tab）→ 放 **URL query**：可分享、可回退、刷新不丢，这是最该**持久化**的一类；
② **要跨页但不可分享的**（未保存草稿、多步表单）→ store + sessionStorage（会话级持久化）；
③ **纯临时的**（输入框草稿、面板展开态）→ 组件内或内存即可，别过度设计。

落地要点：
① 状态变化同步到 URL 用 router.replace（不污染历史栈），只放可序列化的关键**参数** —— 别把大对象塞 URL（有长度限制与泄露风险）；
② 返回列表时不重拉数据：配合 keep-alive 缓存 + **恢复**滚动位置；
③ 恢复要有**过期**概念：数据版本变了、登录态变了、时间隔太久，旧状态要作废 —— 不能无脑还原（还原一个过期的筛选条件比丢失更糟）；
④ 反面例子：全部塞全局 store 但从不清理 → 越用越脏，内存与逻辑双重负担。

一句话：**能进 URL 的进 URL（可分享可回退），临时的留内存，中间态才用 storage。**
`
  },
  {
    code: 'watch-infinite-loop',
    category: '场景 · 稳定性',
    scene: '【面试官追问】页面越用越卡，CPU 100%，最后发现是 watch 无限触发。这种死循环怎么形成的？怎么防？',
    must: ['死循环', 'watch', '副作用', 'computed', '递归'],
    mustNot: [],
    answer: `这种**死循环**有三种典型成因：
① **watch 里改自己 watch 的数据**：watch(a, () => a.value++) —— 每次触发又改 a，形成**递归**；
② **computed 里写副作用**：在 computed 里改别的响应式数据，触发依赖它的组件重渲染，又改回去 → 循环；
③ **两个 watch 互相改**：watch a 改 b、watch b 改 a，互相触发，永远停不下来。

为什么更隐蔽：同步**递归**会抛栈溢出（Maximum call stack size exceeded），但 **watch 默认是异步批处理**的循环**不抛错**，只会 CPU 疯狂占用 —— 你看不到报错，只看到页面越来越卡。

防护：
① **单向数据流**：watch / computed 只读自己依赖的数据，不在里面改状态；副作用放到明确的地方；
② 需要联动时，收敛到一个数据源 + **computed** 派生，别用两个 watch 互相掰手腕；
③ 加**最大循环保护**：计数器超阈值就 console.error + 上报 + 中断，让系统自愈而不是烧 CPU；
④ 定位手法：DevTools Performance 录一段，火焰图里反复出现同一个函数基本就是它。
`
  },
  {
    code: 'white-screen-recovery',
    category: '场景 · 稳定性',
    scene: '【面试官追问】JS 一报错整页白屏，用户只能刷新。怎么让它"不至于整页挂掉"？',
    must: ['错误边界', '白屏', '降级', '捕获', '上报'],
    mustNot: [],
    answer: `白屏根因：渲染过程中抛出的异常没有被**捕获**，整棵组件树没渲染出来。

四层防护：
① **错误边界**（React ErrorBoundary / Vue errorCaptured）：把"局部组件出错"限制在局部，展示兜底 UI（"这块内容加载失败，点此重试"），其他区域照常 —— 这是把**白屏**降级成"局部故障"的**关键**；
② **全局兜底**：window.onerror、window.onunhandledrejection 接住漏网的，统一**上报**；
③ **渲染前防御**：对数据做防御（判空、数组化、默认值）—— 大量**白屏**其实是「data.xxx.map is not a function」这类空值错误；
④ **构建期拦截**：TS + ESLint 挡住明显错误，减少线上抛错。

恢复：兜底 UI 必须有「重试」动作（重新挂载该子树 / 重新请求），而不是让用户整页刷新。

配套：上报要带 sourcemap、版本号、面包屑，否则只知道错了不知道错在哪（呼应"错误监控"那题）。
`
  },
  {
    code: 'micro-frontend-tradeoff',
    category: '场景 · 稳定性',
    scene: '【面试官追问】为什么用微前端，而不是直接做成多个独立页面？子应用挂了怎么保证主应用不挂？',
    must: ['隔离', '降级', '独立', '子应用', '主应用'],
    mustNot: [],
    answer: `先讲真实动机（别背概念）：
① **多团队并行**：不同团队、甚至不同技术栈（Vue/React 混用）的**子应用**要在一个壳里共存，并且**独立**开发、独立发布、独立部署，互不阻塞；
② **渐进式迁移**：老系统不必推倒重写，新页面用新栈逐步替换；
③ 统一的壳：导航、登录、鉴权、主题只做一次。

如果"多个独立页面"就能满足（不需要共享状态、不需要无缝切换），**就别上微前端** —— 它引入的是纯复杂度：样式隔离、JS 沙箱、路由同步、公共依赖、应用通信。

子应用挂了怎么保证**主应用**不挂（稳定性设计）：
① **加载失败降级**：捕获子应用加载异常，给占位 UI + 重试按钮，绝不让壳层白屏；
② **隔离机制**：JS 沙箱（代理 window）、样式用 shadow DOM 或 scoped 前缀 —— 防止单个子应用的报错/全局污染影响别人；
③ **超时 + 健康检查**：加载超时判定、心跳检测，异常**子应用**自动下线或降级；
④ **壳层自持**：**主应用**的导航、登录、权限不依赖子应用返回的数据 —— 子应用全挂，壳还在。

加分句：**微前端解决的是组织问题（多团队独立交付），不是性能问题。**
`
  },
  {
    code: 'side-effect-cleanup-list',
    category: '场景 · 稳定性',
    scene: '【面试官追问】组件销毁时到底要清哪些东西？给我一份清单，并说说漏掉会怎样。',
    must: ['定时器', '监听', '解绑', '订阅', '取消'],
    mustNot: [],
    answer: `一份可直接背的**副作用清理清单**：

① **定时器**：setInterval / setTimeout 要 clear；requestAnimationFrame 要 cancelAnimationFrame；
② **事件监听**：挂在 window / document 上的 scroll、resize、keydown、message 要**解绑**（注意必须用同一个函数引用，或用 AbortSignal 一次性**取消**）；
③ **订阅与长连接**：WebSocket close、EventBus off、store 订阅退订、轮询停止；
④ **进行中的请求**：**取消**（AbortController），防止回来更新已卸载的组件；
⑤ **第三方实例**：编辑器、图表、地图实例要 destroy（它们内部往往还有定时器和 DOM 引用）；
⑥ **各类 Observer**：IntersectionObserver / MutationObserver / ResizeObserver 要 disconnect；
⑦ **全局与缓存**：往 window 上挂的东西、往全局 Map 塞的缓存要清。

漏掉的后果：**内存泄漏**（越用越卡）、**重复回调**（一个动作触发 N 次）、**脏更新**（更新已卸载组件）、隐蔽 bug（旧监听还在响应）。

写法原则：**谁注册谁销毁，注册与清理写在同一处** —— React 在 useEffect 里返回 cleanup，Vue 在 onUnmounted 里；分散在十几个地方必然漏。
`
  }
]

/* ================= 追问链（仅项目深挖题配置） =================
 * 面试官从不一题即止 —— 每道项目题再往下追 2 层。
 * 判分同场景题（关键词命中），**主题达标且追问全过才算通过**。
 */
export const FOLLOWUPS = {
  'proj-sql-diff-algorithm': [
    {
      q: 'LCS 和 LIS 到底差在哪？各解决什么问题？',
      must: ['公共子序列', '递增', '移动', '相同'],
      answer: 'LCS（最长公共子序列）回答「哪些内容是相同的」——公共部分之外的才是增删，它是 diff 的基础。LIS（最长递增子序列）回答「最少要移动几个」——把新序列每行在旧序列中的位置拿出来求 LIS，LIS 里的元素保持相对顺序、不用动，其余才需要移动。一句话：LCS 找相同，LIS 求最少移动。'
    },
    {
      q: '如果两段 SQL 几乎没有公共行，diff 会发生什么？怎么处理？',
      must: ['复杂度', '性能', '降级', '超时'],
      answer: '几乎无公共行时 LCS 退化到最坏情况，复杂度接近 O(n×m)，5000 行就是两千多万次比较，**性能**上完全不可接受，主线程直接卡死。处理：① 设超时，超过就降级为「两侧并排展示、不做精确对齐」；② 只做行级不做字符级；③ 先用相似度预估（公共行占比太低就直接跳过精细 diff）；④ 放进 Worker，别阻塞主线程。'
    }
  ],
  'proj-sql-diff-perf': [
    {
      q: '为什么不把 diff 放到后端算？',
      must: ['传输', '实时', '延迟', '往返'],
      answer: '放后端要把全文传输上去，而且编辑过程中每次变更都得往返一次，延迟和带宽都不划算，也谈不上实时；用户在本地编辑、结果也在本地展示，前端本地算增量 diff 延迟最低。分工原则：后端做「一次性的重计算」（如全库审查），前端做「编辑过程中的轻量 diff」。'
    },
    {
      q: '用户一边编辑一边看 AI 结果，怎么保证 diff 结果不打架？',
      must: ['版本', '串行', '丢弃', '批量'],
      answer: '① 每次计算带版本号，渲染前比对，过期结果直接丢弃；② 计算任务排队串行执行，同一时刻只有一个 diff 在跑，避免新旧结果乱序；③ 计算与渲染解耦，decoration 在主线程一次性批量提交，别逐条更新。'
    }
  ],
  'proj-sql-anchor-drift': [
    {
      q: '除了行号漂移，AI 审查还有哪些「结果不可靠」的情况？',
      must: ['幻觉', '误报', '部分', '反馈'],
      answer: '① 幻觉——指出的问题在代码里根本不存在；② 误报——规则对但场景不对；③ 部分结果——超时只审了一半；④ 重复建议。所以结果要带置信度、允许用户标记误报并把反馈回流到规则库，UI 永远给「重新审查」入口。'
    },
    {
      q: '用 decoration 标注，比直接改文本好在哪？',
      must: ['污染', '撤销', '性能', '批量'],
      answer: '直接改文本会污染用户文档（他得手动撤销你的标记），还会进撤销栈、破坏 undo 历史；decoration 是视图层标注，不动文本内容，撤销重做干净，还能批量增删、按需显示，性能更好。只有用户主动点「应用建议」时才真正改文本，且走用户可控的编辑事务。'
    }
  ],
  'proj-sql-stream-review': [
    {
      q: '流式返回中途断了，怎么给用户一个好的体验？',
      must: ['部分', '重试', '提示', '上报'],
      answer: '① 保留已生成的部分结果，明确标注「生成中断，以下为部分内容」；② 给「继续生成 / 重新审查」入口（重新审查要防重复消耗额度）；③ 网络类错误自动重试一次，业务类错误直接提示原因；④ 把断流事件上报，用于区分是服务端、网关还是客户端的问题。'
    },
    {
      q: '为什么选 SSE 而不是 WebSocket？',
      must: ['单向', '重连', 'HTTP', '双向'],
      answer: 'AI 审查是典型的单向流——客户端发一次请求，服务端持续推结果，不需要双向通道。SSE 基于普通 HTTP，自动重连、实现简单、对代理和网关友好；WebSocket 是全双工，适合聊天这类双向场景，但要自己处理心跳、重连和协议升级。按需选型，别为了「看起来高级」上 WebSocket。'
    }
  ],
  'proj-pnpm-pitfalls': [
    {
      q: 'pnpm 相比 npm/yarn，为什么能减少这类重复问题？',
      must: ['硬链接', '幽灵依赖', '严格', '安装'],
      answer: '① pnpm 用全局 store + 硬链接，同一版本的包磁盘上只有一份；② node_modules 是严格结构（符号链接到 .pnpm），没有幽灵依赖——没声明的包 import 不到，逼你把依赖声明清楚。但要注意：pnpm 解决的是安装层的重复，打包产物里的重复仍要靠 external 和分包策略解决，两者别混为一谈。'
    },
    {
      q: 'manualChunks 用对象配置还是函数？各有什么坑？',
      must: ['函数', '一致', '循环', '归类'],
      answer: '对象配置简单但粒度粗；函数式灵活（能按 node_modules 路径、引用次数决定归类），但容易写出「同一个包在不同调用里返回不同 chunk 名」的 bug——结果就是拆出重复 chunk。坑：① 函数对同一模块必须返回一致结果，否则构建不稳定；② 有循环依赖的包被拆到不同 chunk 会引发初始化顺序问题；③ 别把业务代码和第三方混进同一个 chunk，否则缓存失效频繁。'
    }
  ],
  'proj-pnpm-dedupe': [
    {
      q: '统一版本能减少重复。但如果两个子包就是需要不同版本呢？',
      must: ['多版本', '隔离', '升级', '收敛'],
      answer: '多版本共存时打包器会把每个版本各打一份，产物必然翻倍。确实需要共存时：① 用作用域包名做隔离、显式区分（如 @org/ui-v1 与 ui-v2）；② 用模块联邦或 external 让运行时各自加载；③ 把它当债而不是方案——排升级计划尽快收敛到一个版本。'
    },
    {
      q: '「产物重复率」这个指标怎么落地到 CI？',
      must: ['阈值', '体积', '失败', '报告'],
      answer: '① 构建后跑分析脚本，统计每个包名出现的 chunk 数和总体积；② 与基线对比，超阈值（如体积 +5%、同一库出现 >1 次）直接让 CI 失败；③ 把报告作为构建产物归档，PR 里能看到体积 diff。关键是让「体积回归」像「测试失败」一样，在合并前就被挡住。'
    }
  ],
  'proj-monaco-worker': [
    {
      q: 'Monaco 为什么需要 worker？不用会怎样？',
      must: ['主线程', '解析', '卡顿', '降级'],
      answer: 'Monaco 把词法解析、语法高亮、校验、智能提示这些计算量大的活放在 worker 里，避免阻塞主线程。worker 加载失败它会降级到主线程同步算——大文件直接卡死，高亮和提示延迟明显。所以 worker 404 不是功能缺失，是性能塌方。'
    },
    {
      q: '生产环境 worker 404，但本地是好的。你怎么排查？',
      must: ['路径', 'base', '构建', '差异'],
      answer: '典型原因是环境差异：本地 dev 的路径解析和生产的 base/publicPath 不一致。排查顺序：① 看 Network 里 404 的完整 URL，反推它期望的路径；② 对比构建配置的 base 与实际部署路径；③ 确认 dist 里 worker 文件真的生成了、在哪个目录；④ 检查是否被部署脚本漏掉；⑤ 用 preview（产物模式）本地复现，别只在 dev server 上测。'
    }
  ],
  'proj-monorepo-build': [
    {
      q: '缓存命中率高，但担心发布产物有问题，怎么防？',
      must: ['指纹', '校验', '回滚', '输入'],
      answer: '缓存的风险是「输入指纹没覆盖到真实影响因素」——比如环境变量、隐式依赖、构建脚本变了但指纹没变。防法：① 指纹包含源码 + 依赖锁文件 + 构建配置 + 关键环境变量；② 关键发布做产物校验（构建后跑 smoke test）；③ 保留最近 N 次产物，出问题一键回滚；④ 用 dry-run 模式查看缓存为什么命中/未命中。'
    },
    {
      q: '公共包改了接口，下游包编译报错一大片，怎么办？',
      must: ['版本', '门禁', '渐进', '废弃'],
      answer: '① 公共包遵守语义化版本：破坏性变更升 major，并保留旧导出别名过渡（打废弃警告）；② CI 加门禁：底层包变更自动跑所有下游的构建与测试（按影响范围），把破坏挡在合并前；③ 渐进迁移——先加新接口、标记旧接口废弃、给下游迁移窗口，最后再删。别用「一次性全改」的方式升级底层包。'
    }
  ],
  'proj-perm-unified-entry': [
    {
      q: '统一入口会不会成为性能瓶颈？所有查询都过它。',
      must: ['缓存', '批量', '测量', '开销'],
      answer: '不做优化会，但这是值得花的开销——安全不能省。优化：① 权限判定结果缓存（Redis + 短 TTL + 变更失效）；② 一次请求批量判定，别在循环里逐条查；③ 规则预编译成索引，减少入口内重复计算；④ 最重要的一条：先测量——加耗时打点看它实际占多少，用数据决定优化点，别凭感觉。'
    },
    {
      q: '有些老代码绕过了统一入口，怎么收编？',
      must: ['扫描', '门禁', '迁移', '渐进'],
      answer: '① 先扫描：静态扫描所有数据访问点（DAO / SQL 构建处），列出绕过清单；② 加门禁：新代码禁止直连（lint 规则 + 架构测试 + CI 拦截），先止血；③ 渐进迁移：按风险排序（写操作、敏感数据优先），逐个切到统一入口，每切一个跑回归；④ 给老代码加运行时告警，走到绕过路径就打点，用数据推动迁移。'
    }
  ],
  'proj-perm-frontend': [
    {
      q: '按钮「置灰」和「隐藏」，哪个更好？',
      must: ['置灰', '隐藏', '提示', '噪音'],
      answer: '看场景：① 置灰 + 提示原因（「需要 XX 权限」）更好——用户知道功能存在、知道为什么不能用，体验更透明，减少「是不是坏了」的困惑；② 隐藏适合「与该用户完全无关」的功能（普通用户看不到管理后台入口），减少界面噪音。共同前提：无论前端怎么处理，后端都必须校验——这两者都只是体验层。'
    },
    {
      q: '权限点很多时，前端怎么组织判断才不会写成一堆 if？',
      must: ['集中', '声明式', '指令', '映射'],
      answer: '① 集中定义：权限点常量化（PERM.XXX），别散落魔法字符串；② 声明式消费：Vue 用自定义指令 v-perm 或包裹组件，React 用 hook useHasPerm——把判断收口到一处；③ 映射表：页面/按钮 → 所需权限点集中配置，改规则只改配置；④ 组合权限（且/或）封装成函数并配单测。原则：判断逻辑一处定义，处处声明式使用。'
    }
  ],
  'proj-perm-cache': [
    {
      q: '权限缓存的失效时机漏了会怎样？怎么兜底？',
      must: ['越权', '失效', 'TTL', '实时'],
      answer: '后果很严重：权限被收回了，缓存里还是旧的，用户能继续访问没权限的数据——这是越权事故。兜底：① 任何缓存都要有 TTL 硬上限（如 5 分钟）到期强制回源，不能只依赖主动失效；② 敏感操作的终审永远实时查，不吃缓存；③ 权限变更走广播失效（消息或版本号），并记录失效日志；④ 定期抽样对账缓存与数据库的一致性。'
    },
    {
      q: '前端存的权限集合被用户手动改了（改 localStorage），会怎样？',
      must: ['不可信', '渲染', '后端', '加密'],
      answer: '只会影响渲染——他能看到本不该看到的按钮，但这不是安全问题，因为真正的校验在后端，接口照样拦。所以：① 前端权限集合按不可信数据对待，只用于显示优化；② 后端接口永远独立校验；③ 不必为防篡改在前端加密权限数据（没意义，浪费精力）；④ 该做的是后端拦截 + 越权尝试的监控告警。'
    }
  ],
  'proj-perm-audit': [
    {
      q: '审计日志量很大，存储和查询怎么设计？',
      must: ['冷热', '归档', '索引', '异步'],
      answer: '① 冷热分离：近 30 天热数据放主库/ES 支持查询，更早的归档到对象存储或冷库；② 写优化：异步批量写入（消息队列削峰），别让审计写阻塞业务主流程；③ 索引：按「用户+时间」「资源+时间」建复合索引，覆盖高频查询；④ 报表类需求用预聚合表，别在线扫明细；⑤ 保留策略按合规要求定（180 天 / 3 年），到期自动归档清理。'
    },
    {
      q: '怎么防止有权限的管理员删日志掩盖痕迹？',
      must: ['只增', '分离', '签名', '权限'],
      answer: '① 日志存储用只增不改的模型（append-only），不给 update/delete 能力；② 应用账号与审计存储权限分离——业务库账号根本连不上审计库；③ 防篡改：每条日志带上前一条的 hash 形成链式，或定期签名固化到对象存储；④ 「删除/导出日志」这个动作本身也要被审计（谁删的、为什么）；⑤ 高敏感场景用 WORM 存储（一次写入多次读取）。'
    }
  ]
}

export const SCENE_BY_CODE = Object.fromEntries(SCENES.map(s => [s.code, s]))
