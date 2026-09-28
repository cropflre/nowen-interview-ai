/**
 * 人工校对过的高质量选项（覆盖自动生成）。
 * key = 章节标题；value = { 题目在本分类中的序号(从 0 开始): { options: [...], answer: 正确项下标 } }
 *
 * 原则：干扰项必须「同领域、看着像对的、长度接近」，不能出现跨领域的弱智选项。
 * 本文件先做第 1 章 JavaScript（26 题）；第 2、3 章待批量校对。
 */
export const QUIZ_OVERRIDES = {
  '一、JavaScript': {
    0: {
      options: [
        '8 种：7 个原始类型 + Object；原始类型按值存在栈上，引用类型存地址指向堆',
        '6 种：Number、String、Boolean、Object、Array、Function，都按值存储',
        '7 种：不含 Symbol 和 BigInt，引用类型也是按值存储',
        '9 种：含 undefined、null、NaN 三个特殊类型，全部存在堆上'
      ],
      answer: 0, shuffle: true
    },
    1: {
      options: [
        'typeof 能准确判断所有类型；instanceof 用于判断原始类型',
        '两者完全等价，只是写法不同',
        "typeof 判断原始类型（返回字符串），null 会得到 'object'；instanceof 沿原型链判断引用类型",
        'typeof 沿原型链判断；instanceof 返回类型字符串'
      ],
      answer: 2, shuffle: true
    },
    2: {
      options: [
        '== 和 === 都会隐式转换类型，只是 == 执行更快',
        '=== 严格相等不做转换；== 会先隐式转换再比较，容易出坑（如 [] == false 为 true）',
        '=== 只能比较引用类型，== 只能比较原始类型',
        '两者比较对象时行为完全一致，都不做类型转换'
      ],
      answer: 1, shuffle: true
    },
    3: {
      options: [
        '浅拷贝会递归复制每一层；深拷贝只复制第一层',
        '两者对数组和对象的效果完全相同，只是 API 名称不同',
        'JSON.parse(JSON.stringify()) 是浅拷贝的推荐写法',
        '浅拷贝只复制第一层（里层对象仍共享引用）；深拷贝递归复制每一层，可用 structuredClone'
      ],
      answer: 3, shuffle: true
    },
    4: {
      options: [
        '闭包是函数与其词法作用域的组合，即使函数在其定义作用域之外执行，也能访问该作用域中的变量',
        '闭包是函数执行时动态创建的作用域，与定义位置无关',
        '只要是嵌套函数就一定形成闭包',
        '闭包会让被引用的变量立即被 GC 回收，所以不推荐使用'
      ],
      answer: 0, shuffle: true
    },
    5: {
      options: [
        '每个对象都有 prototype 属性，指向它的构造函数',
        '原型链查找会先沿链向上找，最后才查自身属性',
        '每个函数有 prototype，每个对象有 __proto__ 指向构造函数的 prototype；查找属性沿原型链向上直到 null',
        '原型链的尽头是 undefined，找不到就会报错'
      ],
      answer: 2, shuffle: true
    },
    6: {
      options: [
        '直接把构造函数里的 this 指向 window 执行',
        '创建空对象 → 把它的 __proto__ 指向构造函数 prototype → 让 this 指向它并执行 → 返回对象则用它，否则用新对象',
        '创建对象后执行构造函数，并把 prototype 上的属性和方法复制到对象自身',
        '只做对象创建与属性拷贝，和 this 无关'
      ],
      answer: 1, shuffle: true
    },
    7: {
      options: [
        '优先级：默认绑定 > 隐式绑定 > 显式绑定 > new 绑定',
        'this 在函数定义时就已经确定，与调用方式无关',
        '箭头函数的 this 指向调用它的那个对象',
        '优先级：new > 显式(call/apply/bind) > 隐式(obj.fn()) > 默认；箭头函数没有自己的 this'
      ],
      answer: 3, shuffle: true
    },
    8: {
      options: [
        'call 传数组；apply 传参数列表；bind 会立即执行',
        '三者都会立即执行，区别只是参数形式',
        'call 逐个传参并立即执行；apply 传数组并立即执行；bind 不执行、返回绑好 this 的新函数',
        'bind 会永久修改原函数的 this 和原型'
      ],
      answer: 2, shuffle: true
    },
    9: {
      options: [
        '同步代码 → 宏任务 → 微任务，三者交替执行',
        '同步代码 → 清空所有微任务 → 取一个宏任务 → 再清微任务，循环往复',
        'Promise.then 属于宏任务，所以一定晚于 setTimeout',
        '微任务和宏任务按加入顺序混在同一个队列里执行'
      ],
      answer: 1, shuffle: true
    },
    10: {
      options: [
        '三种：pending → fulfilled / rejected，只能变一次且不可逆；另有 all/allSettled/race/any',
        '两种：pending / fulfilled，可以来回切换',
        '四种状态，包含 canceled（已取消）',
        '状态可以任意切换，reject 之后仍能再 resolve'
      ],
      answer: 0, shuffle: true
    },
    11: {
      options: [
        '是一种新的多线程方案，await 会阻塞主线程',
        '是宏任务的语法糖，底层用 setTimeout 实现',
        'async 函数返回的是普通值，不是 Promise',
        '是 Generator + Promise 的语法糖，await 相当于把后续代码放进 then'
      ],
      answer: 3, shuffle: true
    },
    12: {
      options: [
        'var 和 let 都有暂时性死区，声明前访问都会报错',
        'let 声明前访问会得到 undefined',
        'var 提升并初始化为 undefined；let/const 有暂时性死区，声明前访问抛 ReferenceError',
        '只有 const 存在变量提升'
      ],
      answer: 2, shuffle: true
    },
    13: {
      options: [
        'var 是块级作用域且不可重复声明',
        'var 函数作用域 + 提升 + 可重复声明；let/const 块级作用域 + 暂时性死区 + 不可重复声明，const 不可重新赋值',
        'const 声明的对象，其内部属性也不能修改',
        'let 和 const 没有任何区别'
      ],
      answer: 1, shuffle: true
    },
    14: {
      options: [
        '函数在定义时就确定了词法作用域，查找变量时逐层向外，形成作用域链',
        '函数在调用时才确定外层作用域，形成动态作用域链',
        '作用域链只在全局作用域中有效',
        '作用域链决定的是 this 的指向'
      ],
      answer: 0, shuffle: true
    },
    15: {
      options: [
        'map、filter、concat 会改变原数组',
        '所有数组方法都会改变原数组',
        'slice 和 splice 都不会改变原数组',
        'push、pop、shift、unshift、splice、sort、reverse 会改变原数组'
      ],
      answer: 3, shuffle: true
    },
    16: {
      options: [
        '类数组不存在，是个伪概念',
        'Array.from(likeArr)，或可迭代时用 [...likeArr]',
        '只能用 Array.prototype.map.call 转换',
        'JSON.parse 可以把类数组转成数组'
      ],
      answer: 1, shuffle: true
    },
    17: {
      options: [
        '防抖是每 n 秒执行一次；节流是停止触发后执行一次',
        '两者完全等价，只是命名不同',
        '防抖：n 秒内只执行最后一次；节流：每 n 秒最多执行一次',
        '节流用 clearTimeout 实现，防抖用时间戳实现'
      ],
      answer: 2, shuffle: true
    },
    18: {
      options: [
        '未清理的定时器 / 事件监听、意外的全局变量、闭包长期引用大对象、游离 DOM 引用',
        'JS 有自动 GC，不会发生内存泄漏',
        '只有使用 Web Worker 时才会泄漏',
        '内存泄漏只发生在 Node 环境，浏览器不会'
      ],
      answer: 0, shuffle: true
    },
    19: {
      options: [
        '以引用计数为主，循环引用能被正确回收',
        '只要对象不再被变量引用，就会立刻被回收',
        'GC 会回收所有不再使用的变量，包括被闭包引用的',
        'V8 以标记清除为主 + 分代回收；从根不可达的对象会被回收'
      ],
      answer: 3, shuffle: true
    },
    20: {
      options: [
        '因为 JS 的 + 运算符本身有 bug',
        'IEEE 754 双精度浮点无法精确表示 0.1 和 0.2，相加得到 0.30000000000000004',
        '因为 0.1 被当成了字符串参与运算',
        '所有小数运算都不精确，只能改用字符串计算'
      ],
      answer: 1, shuffle: true
    },
    21: {
      options: [
        '把单参数函数变成多参数函数',
        '是数组的一个方法',
        '把接收多个参数的函数变成一系列只接收单个参数的函数，靠闭包收集参数',
        '是函数式编程里的立即执行函数'
      ],
      answer: 2, shuffle: true
    },
    22: {
      options: [
        '给每个子元素都单独绑定监听器，性能更好',
        '利用事件捕获，只能捕获不能冒泡',
        '事件委托会让动态新增的子元素失效',
        '把监听器绑在父元素上，利用事件冒泡 + event.target 判断触发源'
      ],
      answer: 3, shuffle: true
    },
    23: {
      options: [
        'let/const、箭头函数、模板字符串、解构、Promise、async/await、class、模块化、Set/Map、可选链',
        '只有 let/const 和箭头函数',
        '主要指 jQuery、Ajax 这些库',
        '主要指 CSS3 的新选择器'
      ],
      answer: 0, shuffle: true
    },
    24: {
      options: [
        'ESM 是运行时加载、值拷贝；CJS 是编译时静态分析',
        '两者完全一样，只是关键字不同',
        'ESM 编译时静态分析、支持 tree-shaking、值引用；CJS 运行时加载、值拷贝',
        'CJS 不能被 tree-shaking 是因为它执行太慢'
      ],
      answer: 2, shuffle: true
    },
    25: {
      options: [
        'defineProperty 能监听新增/删除属性；Proxy 不能',
        'defineProperty 只能劫持已有属性，监听不到新增/删除和数组索引 / length；Proxy 代理整个对象，且是惰性深层代理',
        '两者性能完全相同，可以随意替换',
        'Proxy 只能用来代理数组'
      ],
      answer: 1, shuffle: true
    }
  },

  /* ============ 第 2 章 CSS（12 题）============ */
  '二、CSS': {
    0: {
      options: [
        '四层：content + padding + border + margin；content-box 的 width 只算内容，border-box 的 width 包含 padding 和 border',
        'border-box 的 width 只算内容，加 padding 会撑大盒子',
        '标准盒模型指的是 IE 盒模型，现代浏览器默认就是 border-box',
        'margin 也计入 width，所以 margin 越大盒子越宽'
      ],
      answer: 0, shuffle: true
    },
    1: {
      options: [
        'BFC 是一块独立的渲染区域，能清除浮动、解决 margin 塌陷、防止被浮动覆盖；overflow、display:flex、position 等可触发',
        '触发 BFC 后元素会脱离文档流',
        '只能通过 float 或 position: absolute 触发 BFC',
        'BFC 内部的块级元素会水平排列'
      ],
      answer: 0, shuffle: true
    },
    2: {
      options: [
        'Flex 用 justify-content + align-items；绝对定位用 top/left 50% + transform: translate(-50%, -50%)；Grid 用 place-items: center',
        'margin: auto 可以垂直居中绝对定位元素，前提是未设置宽高',
        'line-height 只能用于多行文本垂直居中',
        'transform: translate(-50%, -50%) 会引起严重的性能问题'
      ],
      answer: 0, shuffle: true
    },
    3: {
      options: [
        '容器：flex-direction / justify-content（主轴）/ align-items（交叉轴）/ gap；子项：flex（grow shrink basis）',
        'align-items 控制主轴对齐，justify-content 控制交叉轴对齐',
        'flex: 1 表示固定宽度 1px',
        'gap 只能用于 Grid，Flex 容器不支持 gap'
      ],
      answer: 0, shuffle: true
    },
    4: {
      options: [
        'Flex 是一维（一行或一列），Grid 是二维（行列同时控制）；自适应卡片常用 repeat(auto-fit, minmax(250px, 1fr))',
        'flex-basis 的优先级一定低于 width',
        'Grid 只能实现二维布局，完全做不了一维布局',
        'Grid 的 justify-content 控制交叉轴，align-items 控制主轴'
      ],
      answer: 0, shuffle: true
    },
    5: {
      options: [
        '父元素 overflow: hidden 触发 BFC、::after + clear: both（clearfix）、或现代直接改用 Flex/Grid',
        '给浮动元素自己加 clear: both 就能让父元素撑开',
        '清除浮动会让元素脱离文档流，所以要配合 position: relative',
        'clear: both 只能写在浮动元素自身上，写在兄弟元素上无效'
      ],
      answer: 0, shuffle: true
    },
    6: {
      options: [
        'z-index 只对定位元素（或 flex/grid 子项）生效；父元素一旦创建层叠上下文（opacity<1、transform 等），子元素再大的 z-index 也超不出父级',
        'z-index 对所有元素都生效，值越大就一定显示在最上层',
        '层叠上下文只能由 position: absolute 触发',
        'z-index 相同时，后写的元素一定被压在下面'
      ],
      answer: 0, shuffle: true
    },
    7: {
      options: [
        '相邻块级元素竖直方向的外边距会合并取较大值；父子之间子元素的 margin-top 会穿透出去，可用 BFC / padding / border 阻断',
        'margin 塌陷只发生在水平方向，竖直方向不会合并',
        '给父元素加 margin-top 就能阻止子元素 margin 穿透',
        'margin 塌陷只会取较小值，所以间距总是变小'
      ],
      answer: 0, shuffle: true
    },
    8: {
      options: [
        '设置 viewport meta；用 rem / vw（配合 postcss-px-to-viewport）或小程序 rpx；1px 边框用 transform: scaleY(0.5) 或伪元素 + 媒体查询',
        '不用设置 viewport，浏览器会自动按设备宽度缩放',
        '1px 边框问题是因为设计稿画错了，改设计稿即可',
        'rem 的根字号固定为 16px，在任何设备上都一样'
      ],
      answer: 0, shuffle: true
    },
    9: {
      options: [
        '!important > 行内 > ID > 类/属性/伪类 > 标签/伪元素 > 通配符；权重按 (ID 数, 类数, 标签数) 逐位比较',
        '类选择器的优先级高于 ID 选择器',
        '只要加了 !important 就是绝对最高优先级，不存在被覆盖的情况',
        '优先级相同时，先写的样式会覆盖后写的'
      ],
      answer: 0, shuffle: true
    },
    10: {
      options: [
        '重排是几何属性变化、代价大；重绘是外观变化、代价小；优化靠批量改样式、避免强制同步布局、动画只用 transform / opacity',
        '修改 color 属性必定触发重排',
        '重排和重绘在合成线程中同步执行',
        '使用 transform 会触发整个页面的重绘'
      ],
      answer: 0, shuffle: true
    },
    11: {
      options: [
        '优先动画 transform 和 opacity —— 只触发合成，不引起重排重绘；必要时用 will-change 提升图层，别滥用',
        '动画 width / height 比动画 transform 性能更好，因为浏览器更熟悉布局属性',
        '为了流畅，应该给页面上所有元素都加上 will-change',
        'CSS 动画都会触发重排，所以尽量改用 JS 定时器直接改样式'
      ],
      answer: 0, shuffle: true
    }
  },

  /* ============ 第 3 章 浏览器与网络（14 题）============ */
  '三、浏览器与网络': {
    0: {
      options: [
        'DNS 解析 → TCP 三次握手（HTTPS 加 TLS）→ HTTP 请求 → 解析 HTML 建 DOM / CSS 建 CSSOM → 布局 → 绘制 → 合成；script 会阻塞 DOM 解析，除非 async/defer',
        '解析 HTML 的同时就会执行所有外链 JS，不会阻塞 DOM 构建',
        '渲染流程是「绘制 → 布局 → 合成」，先画出来再计算位置',
        'DNS 解析发生在 TCP 连接建立之后'
      ],
      answer: 0, shuffle: true
    },
    1: {
      options: [
        '强缓存由 Cache-Control: max-age（单位秒）控制，命中不发请求；协商缓存由 ETag / Last-Modified 控制，命中返回 304 不带 body',
        'no-cache 表示完全不缓存，每次都向服务器请求完整数据',
        'max-age 的单位是毫秒',
        '协商缓存命中时，服务端会返回 200 OK 并带上完整新数据'
      ],
      answer: 0, shuffle: true
    },
    2: {
      options: [
        'HTTP/2 二进制分帧 + 多路复用 + 头部压缩，但仍有 TCP 层队头阻塞；HTTP/3 基于 QUIC（UDP）解决队头阻塞，建连更快',
        'HTTP/2 已经彻底解决了 TCP 层的队头阻塞问题',
        'HTTP/3 底层完全放弃了拥塞控制以换取速度',
        'HTTP/2 的多路复用意味着每次请求都要重新建立一次 TCP 连接'
      ],
      answer: 0, shuffle: true
    },
    3: {
      options: [
        '客户端发起 → 服务端返回证书 → 客户端用 CA 公钥验签 → 双方用非对称加密协商出对称密钥 → 之后用对称加密传输数据',
        'HTTPS 全程使用非对称加密传输数据，开销大但更安全',
        'HTTPS 不需要证书，只靠双方事先约定的固定密钥即可加密',
        'TLS 握手与 TCP 三次握手是同一件事，只是叫法不同'
      ],
      answer: 0, shuffle: true
    },
    4: {
      options: [
        '三次握手：SYN → SYN+ACK → ACK；四次挥手：FIN → ACK → FIN → ACK，主动关闭方等待 2MSL 才释放',
        '三次握手是为了确认双方带宽，四次挥手是为了释放内存',
        'TCP 建立连接只需要两次握手，第三次是可选的',
        '主动关闭方发完 FIN 就立即释放连接，不需要等待'
      ],
      answer: 0, shuffle: true
    },
    5: {
      options: [
        '同源 = 协议 + 域名 + 端口全相同；CORS 由服务端设置 Access-Control-Allow-Origin 等响应头放行；非简单请求会先发 OPTIONS 预检',
        '简单请求也会先发送 OPTIONS 预检请求',
        '只要前端设置了 withCredentials，跨域 Cookie 就能无条件携带',
        '带 Cookie 的跨域请求，Access-Control-Allow-Origin 可以写成 *'
      ],
      answer: 0, shuffle: true
    },
    6: {
      options: [
        '代理（Vite proxy / Nginx 反向代理）、JSONP（仅 GET，钻 script 标签的空子）、postMessage、WebSocket（不受同源限制，服务端校验 Origin）',
        'JSONP 可以支持各种 HTTP 方法，不仅限于 GET',
        'Nginx 反向代理需要后端额外配置 CORS 头才能生效',
        'WebSocket 受同源策略限制，必须配置 CORS 才能连接'
      ],
      answer: 0, shuffle: true
    },
    7: {
      options: [
        'XSS 是注入恶意脚本执行（防御：输出转义、CSP、HttpOnly）；CSRF 是冒用已登录身份发请求（防御：CSRF Token、SameSite、校验 Origin）',
        'HttpOnly 可以彻底防御 CSRF 攻击',
        'XSS 攻击主要是通过伪造用户的请求发送给服务器',
        '只要使用了 HTTPS 就能免疫 XSS 和 CSRF'
      ],
      answer: 0, shuffle: true
    },
    8: {
      options: [
        'Session：服务端保存会话状态，sessionId 放 Cookie，请求自动携带；JWT：服务端不存状态，信息签名后交前端，请求带上由服务端验签',
        'JWT 的内容默认是加密的，拿到 token 也读不出用户信息',
        'Session 是无状态的，服务端不需要保存任何数据',
        'JWT 可以像 Session 一样由服务端主动失效，撤销非常方便'
      ],
      answer: 0, shuffle: true
    },
    9: {
      options: [
        'Cookie 约 4KB 且随请求自动携带；localStorage 约 5MB、永久、同源共享；sessionStorage 绑定标签页、关闭即清；IndexedDB 容量大、异步、支持索引与事务',
        'localStorage 的容量和 Cookie 一样，只有 4KB 左右',
        'sessionStorage 在同源的多个标签页之间是共享的',
        'IndexedDB 是同步 API，读写时会阻塞主线程'
      ],
      answer: 0, shuffle: true
    },
    10: {
      options: [
        'storage 事件（同源其他标签页触发，改的那个自己收不到）、BroadcastChannel（推荐）、SharedWorker、postMessage',
        '用 localStorage 存数据后，当前这个标签页也会立刻收到 storage 事件',
        'BroadcastChannel 只能在同一标签页内通信，跨标签页收不到',
        'Session 过期后浏览器会自动通知所有标签页刷新'
      ],
      answer: 0, shuffle: true
    },
    11: {
      options: [
        'LCP 最大内容绘制（加载，< 2.5s）；INP 交互到下次绘制（响应，2024 取代 FID）；CLS 累积布局偏移（视觉稳定性）',
        'FID 至今仍是最核心的交互指标，INP 只是实验性指标',
        'LCP 越小说明首屏越快，理想值是小于 200ms',
        'CLS 衡量的是接口响应时间，越小越好'
      ],
      answer: 0, shuffle: true
    },
    12: {
      options: [
        '多进程：浏览器主进程、GPU 进程、网络进程、多个渲染进程；渲染进程内多线程：GUI 渲染线程、JS 引擎线程、事件触发线程、定时器线程、异步请求线程',
        '浏览器是单进程多线程模型，所有标签页共用一个渲染进程',
        'JS 引擎线程和 GUI 渲染线程可以同时执行，互不干扰',
        '每个标签页一定对应一个独立进程，永远不会合并'
      ],
      answer: 0, shuffle: true
    },
    13: {
      options: [
        '把耗时计算放到独立线程，避免阻塞主线程；与主线程通过 postMessage 通信，数据默认是拷贝（可用 Transferable 转移所有权）',
        'Web Worker 里可以直接操作 DOM，性能与主线程一样',
        'Web Worker 与主线程共享同一份内存，改一个另一个立刻变',
        'Web Worker 只能执行字符串形式的代码，不能加载外部脚本'
      ],
      answer: 0, shuffle: true
    }
  },

  /* ============ 第 4 章 Vue 3（14 题）============
     以下统一写法：options 第 0 项 = 正确项，answer:0 + shuffle:true，由 seed 打乱并回算下标 */
  '四、Vue 3': {
    0: {
      options: [
        'reactive 用 Proxy 包裹对象拦截 get/set；读取时 track 收集依赖，修改时 trigger 触发更新，配合 Reflect 操作原对象',
        '用 Object.defineProperty 递归给每个属性加 getter/setter',
        '用发布订阅模式，数据变化后由业务代码手动通知视图',
        '靠定时器轮询数据变化，发现变化就更新 DOM'
      ],
      answer: 0, shuffle: true
    },
    1: {
      options: [
        '能监听新增/删除属性与数组索引/length；惰性深层代理，初始化不用递归遍历；支持 Map/Set；不再需要 $set',
        'Vue2 用的是 Proxy，Vue3 改成了 defineProperty，所以性能更高',
        'Vue2 必须声明所有属性，Vue3 不用声明也能响应',
        'Vue3 的响应式是同步的，Vue2 是异步的'
      ],
      answer: 0, shuffle: true
    },
    2: {
      options: [
        '先做头头/尾尾/头尾交叉比较处理两端，乱序部分求最长递增子序列（LIS），LIS 中的节点不动，只移动不在 LIS 里的节点',
        'Vue3 用 LCS（最长公共子序列）求最小移动次数，LIS 只用于文本 diff',
        'Diff 时按索引顺序全量重建 DOM，保证不出错',
        '必须先把子序列求出来，再处理两端，顺序反了结果也不同'
      ],
      answer: 0, shuffle: true
    },
    3: {
      options: [
        '静态提升让静态节点只创建一次；Patch Flag 标记动态节点只比对这些；Block Tree 分块，diff 只走动态节点',
        '把模板编译成字符串，运行时用 innerHTML 整体替换',
        '编译期就把所有 DOM 创建好，运行时不执行任何 JS',
        'Patch Flag 是运行时才生成的标记，与编译期无关'
      ],
      answer: 0, shuffle: true
    },
    4: {
      options: [
        'reactive 只接对象/数组，解构会丢响应式；ref 可接任意类型，JS 里要 .value，模板里自动解包',
        'reactive 可以接数字和字符串，ref 只能接对象',
        'ref 在模板里也必须写 .value 才能取值',
        'reactive 定义的值通过 .value 访问'
      ],
      answer: 0, shuffle: true
    },
    5: {
      options: [
        'Vue 把 DOM 更新放进微任务队列批量执行；nextTick 的回调也进同一队列，等 DOM 更新完执行，因此能拿到最新 DOM',
        'nextTick 用的是 setTimeout，属于宏任务',
        'nextTick 会立刻同步刷新 DOM，等价于强制重渲染',
        'nextTick 只能在 onMounted 里使用'
      ],
      answer: 0, shuffle: true
    },
    6: {
      options: [
        'setup → onBeforeMount → onMounted → onBeforeUpdate → onUpdated → onBeforeUnmount → onUnmounted，另有 onActivated/onDeactivated',
        'Vue3 去掉了 onMounted，统一由 setup 代替',
        '生命周期钩子必须写在 methods 里',
        'onUnmounted 在组件 DOM 被移除之前触发'
      ],
      answer: 0, shuffle: true
    },
    7: {
      options: [
        '按功能聚合逻辑，便于抽 composable 复用；TS 类型推导更友好；避免 mixins 命名冲突',
        'Composition API 的运行性能比 Options API 高一个数量级',
        'Composition API 让 this 的指向更明确',
        'Composition API 不支持响应式数据'
      ],
      answer: 0, shuffle: true
    },
    8: {
      options: [
        '是「值绑定 + 事件监听」的语法糖；Vue3 默认是 modelValue 属性 + update:modelValue 事件，可传参实现多个 v-model',
        'v-model 是内置指令，本质是直接修改子组件的 props',
        'v-model 只能用在表单元素上，不能用在自定义组件上',
        'v-model 监听 input 事件并自动应用 .sync 修饰符'
      ],
      answer: 0, shuffle: true
    },
    9: {
      options: [
        '去掉 mutations，直接改 state 或用 action；完整 TS 推导；无模块嵌套；体积更小',
        'Pinia 必须通过 mutations 才能改 state，比 Vuex 更严格',
        'Pinia 不支持 devtools，所以更轻量',
        'Vuex 是 Vue3 官方推荐，Pinia 已停止维护'
      ],
      answer: 0, shuffle: true
    },
    10: {
      options: [
        '父→子 props；子→父 emit；跨层级 provide/inject；父取子用 ref + defineExpose；任意组件用 Pinia',
        'Vue3 只能通过 EventBus 通信，provide/inject 已废弃',
        '子组件可以直接修改父组件传来的 props',
        '跨层级通信必须一层层透传 props，没有别的办法'
      ],
      answer: 0, shuffle: true
    },
    11: {
      options: [
        '内部维护缓存 Map，切换时缓存组件实例而非销毁；可用 include/exclude 控制、max 触发淘汰，对应 activated/deactivated',
        'keep-alive 把组件渲染成静态 HTML 字符串缓存起来',
        'keep-alive 缓存的是 DOM 快照，组件实例仍会重建',
        'keep-alive 只能包裹路由组件，不能包裹普通组件'
      ],
      answer: 0, shuffle: true
    },
    12: {
      options: [
        '优点：跨平台、批量更新只改必要节点、声明式开发；缺点：有 diff 与内存开销，极致性能场景不如手写 DOM',
        '虚拟 DOM 一定比直接操作真实 DOM 快，且没有任何代价',
        '虚拟 DOM 的作用是减少内存占用，与更新性能无关',
        '虚拟 DOM 只能用在浏览器环境，无法跨端'
      ],
      answer: 0, shuffle: true
    },
    13: {
      options: [
        '单向数据流：props 属于父组件的数据，子组件直接改会破坏数据流向的可追踪性；应 emit 让父改，或复制到本地状态',
        'props 是只读的，因为浏览器不允许修改对象属性',
        '直接改 props 会导致内存泄漏',
        '只有 Vue2 不能改 props，Vue3 可以随意改'
      ],
      answer: 0, shuffle: true
    }
  },

  /* ============ 第 5 章 React（8 题）============ */
  '五、React': {
    0: {
      options: [
        '只能在函数组件/自定义 Hook 的顶层调用，不能放在条件、循环或嵌套函数里；React 靠调用顺序匹配状态',
        '可以放在 if 里，只要保证每次渲染都执行到即可',
        '必须写在 class 组件的 constructor 中',
        '只要不调用 setState，放在哪里都可以'
      ],
      answer: 0, shuffle: true
    },
    1: {
      options: [
        '渲染提交后异步执行；不传依赖每次渲染都跑，传空数组只跑一次，传依赖则依赖变化才跑；清理函数在下次执行前或卸载时调用',
        '在渲染之前同步执行，会阻塞浏览器绘制',
        '传空数组表示每次渲染都执行一次',
        '清理函数只在组件卸载时调用，与依赖变化无关'
      ],
      answer: 0, shuffle: true
    },
    2: {
      options: [
        'useMemo 缓存计算结果；useCallback 缓存函数引用；React.memo 浅比较 props 决定是否重渲染',
        'useMemo 缓存函数引用，useCallback 缓存计算结果',
        'React.memo 会深比较 props，能完全避免重渲染',
        '三者都是 Hooks，必须配合 class 组件使用'
      ],
      answer: 0, shuffle: true
    },
    3: {
      options: [
        'useEffect/定时器里引用了旧的 state（闭包捕获了当次渲染的快照）导致读到过期值；解决：补全依赖、用 ref 存最新值、函数式更新',
        '闭包陷阱指组件卸载后闭包导致内存无法释放',
        '闭包陷阱只会出现在 class 组件中',
        '只要把依赖数组写成空数组就能避免闭包陷阱'
      ],
      answer: 0, shuffle: true
    },
    4: {
      options: [
        'React 16 引入的协调引擎：把渲染工作拆成可中断的小单元，配合时间切片与优先级调度，避免长任务阻塞交互',
        'Fiber 是一种新的状态管理方案，用来替代 Redux',
        'Fiber 让 React 变成多线程渲染，DOM 更新在子线程完成',
        'Fiber 就是虚拟 DOM 的别名，只是换了名字'
      ],
      answer: 0, shuffle: true
    },
    5: {
      options: [
        'Actions 处理异步提交并自动管理 pending；useTransition/useDeferredValue 降低非紧急更新优先级；Server Components；流式 SSR',
        'React 19 移除了 Hooks，改回 class 组件',
        'React 19 的主要变化是把 JSX 换成了模板语法',
        'React 19 用 Signals 全面替代了 useState'
      ],
      answer: 0, shuffle: true
    },
    6: {
      options: [
        '帮 diff 识别哪些节点是同一个，从而正确复用与移动 DOM；应用稳定唯一 id，用 index 在列表增删排序时会状态错位',
        'key 只是给 React 排序用，删掉也不影响渲染',
        'key 必须用数组下标，这样性能最高',
        'key 只能用在数组元素上，且必须全局唯一'
      ],
      answer: 0, shuffle: true
    },
    7: {
      options: [
        '受控：值由 state 控制（value + onChange），数据流统一、易校验；非受控：值存在 DOM 里，用 ref 读取',
        '受控组件的值存在 DOM 中，非受控组件的值存在 state 中',
        '非受控组件无法获取用户输入的值',
        '受控组件必须配合 class 组件才能使用'
      ],
      answer: 0, shuffle: true
    }
  },

  /* ============ 第 6 章 工程化与构建（8 题）============ */
  '六、工程化与构建': {
    0: {
      options: [
        'Vite 开发时用 esbuild 预构建依赖 + 原生 ESM 按需编译，冷启动极快；生产用 Rollup 打包。Webpack 启动时打包整个依赖图，越大越慢',
        'Vite 生产环境也用 esbuild 打包，所以比 Webpack 快很多',
        'Webpack 只支持 CJS，无法处理 ESM',
        'Vite 不支持 HMR，改代码必须手动刷新'
      ],
      answer: 0, shuffle: true
    },
    1: {
      options: [
        '按包分组拆 vendor chunk（manualChunks）以利用长缓存；业务代码按路由懒加载；大依赖异步加载；用分析工具定位大头',
        '把所有依赖打进一个 bundle 最省事，也最快',
        'manualChunks 里用模糊字符串匹配包名最稳妥',
        '分包只会增加请求数量，对性能没有好处'
      ],
      answer: 0, shuffle: true
    },
    2: {
      options: [
        '全局内容寻址 store，项目里用硬链接指向 store，.pnpm 是真实依赖图，顶层只 symlink 直接依赖；省磁盘、装得快，且严格 node_modules 避免幽灵依赖',
        'pnpm 会把每个依赖完整复制到项目的 node_modules 里',
        'pnpm 快是因为跳过了完整性校验',
        'pnpm 允许访问未声明的依赖，所以更灵活'
      ],
      answer: 0, shuffle: true
    },
    3: {
      options: [
        'monorepo 把多个包放一个仓库统一管理；pnpm workspace 负责依赖链接（workspace:*），Turborepo 负责任务编排与缓存（命中缓存直接跳过）',
        'monorepo 必须用 npm workspaces，pnpm 不支持',
        'Turborepo 的作用是自动把项目部署到服务器',
        'monorepo 会把所有包合并成一个大包发布'
      ],
      answer: 0, shuffle: true
    },
    4: {
      options: [
        '基于 ESM 的静态结构分析未被使用的导出并删除；用了 CJS、副作用未声明、或 babel 把 ESM 转成 CJS 时都会失效',
        'tree-shaking 能在运行时删除未执行到的代码分支',
        'tree-shaking 对 CJS 的支持比 ESM 更好',
        '只要开了 minify 就会自动 tree-shaking，与模块格式无关'
      ],
      answer: 0, shuffle: true
    },
    5: {
      options: [
        '文件改动 → 重新编译该模块 → 通过 WebSocket 通知浏览器 → 浏览器下载新模块并热替换，不刷新页面、保留应用状态',
        'HMR 的原理是定时全量重新打包并刷新页面',
        'HMR 依赖 Service Worker 缓存来实现',
        'HMR 只能更新 CSS，JS 改动必须整页刷新'
      ],
      answer: 0, shuffle: true
    },
    6: {
      options: [
        'qiankun（基于 single-spa，适合渐进式接入）、Module Federation（Webpack 5 共享模块、可独立部署）、iframe（隔离彻底但体验差）',
        '微前端只能用 iframe 实现，其他方案都有安全风险',
        'Module Federation 只能共享 CSS，不能共享 JS 模块',
        'qiankun 的沙箱会重写子应用的 window 且无法还原'
      ],
      answer: 0, shuffle: true
    },
    7: {
      options: [
        '遵循 Conventional Commits（feat/fix/chore）+ husky/lint-staged 提交前校验；feature/fix 分支 + MR 流程；CI 卡 lint 与类型检查',
        '提交信息随便写，只要代码能跑就行',
        '应该每天只提交一次，攒成一个大提交方便回溯',
        '分支不需要任何保护，直接往主干推最快'
      ],
      answer: 0, shuffle: true
    }
  },

  /* ============ 第 7 章 性能优化（5 题）============ */
  '七、性能优化': {
    0: {
      options: [
        '网络层 CDN/HTTP2/压缩/缓存；资源层代码分割 + 路由懒加载、图片懒加载、关键 CSS 内联；渲染层 SSR/SSG 直出；用 LCP 定位瓶颈',
        '首屏慢只要把 JS 全部内联进 HTML 就能解决',
        '把首屏所有资源改成同步加载，保证不漏依赖',
        '首屏优化只能在服务端做，前端无能为力'
      ],
      answer: 0, shuffle: true
    },
    1: {
      options: [
        '虚拟滚动只渲染可视区 + 缓冲区；固定行高并按 scrollTop 计算起始索引；配合分片渲染、requestAnimationFrame、Web Worker',
        '给每个列表项都加 will-change 就不会卡了',
        '把列表数据一次性 setState，交给 React 批量处理最快',
        '十万条数据必须一开始就全部渲染，否则滚动会跳'
      ],
      answer: 0, shuffle: true
    },
    2: {
      options: [
        '用 visualizer/analyzer 定位大头；组件库按需引入；lodash-es 替代全量 lodash；大依赖异步加载；开启 tree-shaking',
        '包体积大只能靠升级服务器带宽解决',
        '把所有依赖改成 CJS 可以减小体积',
        'gzip 后体积没变化说明不需要优化'
      ],
      answer: 0, shuffle: true
    },
    3: {
      options: [
        '图片：压缩、WebP/AVIF、srcset 适配 DPR、懒加载、指定宽高避免 CLS；字体：font-display:swap、子集化、preload、系统字体兜底',
        '图片统一用 PNG 兼容性最好且体积最小',
        '字体必须全部加载完才能显示，否则会闪',
        '给所有图片加固定宽高会破坏响应式布局'
      ],
      answer: 0, shuffle: true
    },
    4: {
      options: [
        '错误监控（onerror/onunhandledrejection）、性能监控（PerformanceObserver 采集 LCP/INP/CLS）、行为监控（PV/UV、曝光）；上报用 sendBeacon + 采样 + 离线缓存',
        '性能监控只能靠用户反馈，没有其他办法',
        '错误上报应该每条都立即同步请求，保证不丢',
        'LCP/INP/CLS 只能在本地 Lighthouse 里测，线上测不到'
      ],
      answer: 0, shuffle: true
    }
  },

  /* ============ 第 8 章 手写题（10 题）============ */
  '八、手写题（思路钩子）': {
    0: {
      options: [
        '闭包保存 timer；每次调用先 clearTimeout 取消上一次，再 setTimeout 重新计时，到点执行原函数',
        '用 setInterval 轮询，距离上次调用超过 n 秒就执行',
        '记录调用次数，达到阈值后执行一次',
        '用 requestAnimationFrame 每帧执行一次'
      ],
      answer: 0, shuffle: true
    },
    1: {
      options: [
        '记录上次执行时间 last；调用时判断 now - last > wait 才执行，并把 last 更新为 now',
        '用 clearTimeout + setTimeout 每次重新计时，等停下再执行',
        '用一个布尔开关锁住函数，执行后永不解锁',
        '把函数延迟 n 秒后执行，只执行一次'
      ],
      answer: 0, shuffle: true
    },
    2: {
      options: [
        '原始值直接返回；WeakMap 记录已复制对象以打断循环引用；Date/RegExp 单独造；数组给 []、对象给 {}，逐 key 递归',
        '直接 return JSON.parse(JSON.stringify(obj)) 就能处理所有情况',
        '用 Object.assign({}, obj) 递归每一层即可',
        '不需要处理循环引用，JS 会自动跳过'
      ],
      answer: 0, shuffle: true
    },
    3: {
      options: [
        '把函数挂到目标对象上（用 Symbol 当键避免覆盖同名属性），用目标对象调用后 delete，最后返回结果',
        '用 bind 绑定 this 之后立即执行',
        '直接修改函数的 prototype 指向目标对象',
        '通过 new 一个函数来改变 this 指向'
      ],
      answer: 0, shuffle: true
    },
    4: {
      options: [
        '用计数器记录完成数；结果按索引存放以保证顺序；任一 reject 就整体 reject；空数组直接 resolve',
        '用数组 push 按完成顺序收集结果即可',
        '只要有一个失败就忽略，继续等其余成功',
        '用 Promise.race 依次等待每个 Promise'
      ],
      answer: 0, shuffle: true
    },
    5: {
      options: [
        '维护任务队列；同时启动 limit 个 worker，每个 worker 不断从队列取任务并 await，完成一个自动补下一个',
        '用 setTimeout 错开每个请求的发起时间',
        '把所有请求一次性发出去，浏览器会自动限流',
        '用 Promise.all 本身就是并发控制，无需额外处理'
      ],
      answer: 0, shuffle: true
    },
    6: {
      options: [
        '用 Map：get 命中时先 delete 再 set（移到最新）；set 超容量时删除第一个 key（最久未使用）',
        '用数组存数据，每次读取都从头遍历一遍',
        '用 Set 存 key，满了就清空整个缓存',
        '按 key 的字典序淘汰最小的那个'
      ],
      answer: 0, shuffle: true
    },
    7: {
      options: [
        '用对象存「事件名 → 回调数组」；on 时 push，emit 时遍历执行，once 包装后执行完自动 off',
        '用 DOM 的 addEventListener 转发所有事件',
        '用 Map 存事件名到单个回调，不支持多个监听',
        'emit 时用 eval 执行回调字符串'
      ],
      answer: 0, shuffle: true
    },
    8: {
      options: [
        '先遍历建 id→节点 的 Map 字典，再遍历一次按 parentId 挂到父节点下，parentId 为空的是根；两次线性遍历 O(n)',
        '对每个节点都遍历整个数组找父节点，虽然 O(n²) 但更直观',
        '用递归逐层过滤，时间复杂度 O(n log n)',
        '必须先把数组排序，否则无法建树'
      ],
      answer: 0, shuffle: true
    },
    9: {
      options: [
        '用闭包收集已传入的参数；参数个数达到原函数形参个数（fn.length）时执行，否则返回新函数继续收集',
        '用 arguments 把所有参数一次性传给原函数',
        '通过修改函数的 length 属性来控制参数个数',
        '柯里化必须用 eval 动态生成函数'
      ],
      answer: 0, shuffle: true
    }
  },

  /* ============ 第 9 章 TypeScript（5 题）============ */
  '九、TypeScript': {
    0: {
      options: [
        'interface 可声明合并、更适合描述对象/类结构、可 extends；type 可定义联合/交叉/元组/条件类型，但不能同名合并',
        'type 可以声明合并，interface 不能',
        'interface 支持联合类型，type 不支持',
        '两者完全等价，可以随意替换，没有任何差别'
      ],
      answer: 0, shuffle: true
    },
    1: {
      options: [
        '类型参数化，让同一段代码支持多种类型同时保持类型安全；约束用 extends，可用 keyof 限制为某对象的键',
        '泛型就是 any 的别名，只是写法不同',
        '泛型只能用在函数上，不能用于类型和类',
        '泛型会在运行时生成不同的函数实现'
      ],
      answer: 0, shuffle: true
    },
    2: {
      options: [
        '条件类型是 T extends U ? X : Y；映射类型遍历已有键生成新类型（Partial/Readonly）；模板字面量类型用字符串拼接生成联合类型',
        '条件类型是运行时 if/else 的类型版本，会影响执行结果',
        '映射类型只能用于数组，不能用于对象',
        '模板字面量类型只能拼接数字，不能拼接字符串'
      ],
      answer: 0, shuffle: true
    },
    3: {
      options: [
        '收窄：用 typeof/instanceof/in/字面量判断把宽类型缩小；可辨识联合：给每个成员加共同判别字段，switch 后即可安全访问各自独有属性',
        '类型收窄只能靠类型断言 as 实现',
        '可辨识联合要求所有成员字段完全一致，不能有差异',
        '收窄是运行时行为，与类型系统无关'
      ],
      answer: 0, shuffle: true
    },
    4: {
      options: [
        'Partial、Required、Readonly、Pick、Omit、Record、ReturnType、Parameters、Exclude/Extract、NonNullable',
        '只有 Partial 和 Readonly 是内置的，其余都要自己写',
        'Omit 是挑出指定键，Pick 是排除指定键',
        'Record 用于把对象转换成数组类型'
      ],
      answer: 0, shuffle: true
    }
  },

  /* ============ 第 10 章 场景题与安全（8 题）============ */
  '十、场景题与安全': {
    0: {
      options: [
        '先澄清需求 → 输入防抖 → 用 AbortController 取消旧请求防竞态 → 结果虚拟列表 → 键盘上下键与高亮 → 无障碍 aria',
        '每次输入都立即发请求，保证结果最新',
        '不需要处理竞态，因为请求一定按发送顺序返回',
        '补全结果直接全部渲染，不用管数据量'
      ],
      answer: 0, shuffle: true
    },
    1: {
      options: [
        'File.slice 切片；并发上传并控制并发数；每片带序号与文件 hash；上传前查询已存在分片以实现续传；全部完成后调合并接口',
        '把整个文件一次性 POST 上去最简单',
        '分片上传必须按顺序串行上传，不能并发',
        '断点续传只能靠浏览器自动重试，前端无法实现'
      ],
      answer: 0, shuffle: true
    },
    2: {
      options: [
        '路由级用动态路由/路由守卫拦截；按钮级用指令或权限组件控制显隐；接口级必须靠后端校验，前端只做体验优化',
        '把权限控制全放前端，后端不需要校验',
        '按钮级权限只能通过 CSS 隐藏按钮实现',
        '前端权限只需要在登录时校验一次'
      ],
      answer: 0, shuffle: true
    },
    3: {
      options: [
        'IntersectionObserver 监听底部哨兵触发加载下一页；配合游标分页、加载中/失败/没有更多状态；数据量大再叠虚拟滚动',
        '用 setInterval 定时检查是否滚到底部',
        '必须监听 scroll 事件并同步计算 scrollTop，越频繁越准',
        '一次性把全部数据加载完就不需要无限滚动了'
      ],
      answer: 0, shuffle: true
    },
    4: {
      options: [
        '每次请求带序号/时间戳，只接受最新一次的响应；或用 AbortController 在发新请求前取消旧请求；也可用防抖减少请求',
        '竞态无法解决，只能让用户慢点操作',
        '给请求加 Promise.all 就能保证顺序',
        '把请求改成同步阻塞调用即可避免'
      ],
      answer: 0, shuffle: true
    },
    5: {
      options: [
        'CSR 由浏览器下载 JS 后渲染，首屏慢、SEO 差；SSR 服务端直出 HTML，首屏快利于 SEO，但服务器压力大、有 hydration 成本',
        'SSR 不需要 hydration，服务端渲染完就没有 JS 交互了',
        'CSR 的 SEO 效果比 SSR 更好',
        'SSR 只适合纯静态页面，无法处理动态数据'
      ],
      answer: 0, shuffle: true
    },
    6: {
      options: [
        '手动埋点精准但成本高、无痕埋点自动但精度低；上报用批量合并 + sendBeacon 兜底 + 离线缓存 + 失败重试；曝光用 IntersectionObserver',
        '埋点必须在每次操作后立即同步请求，否则数据会丢',
        '曝光埋点只要元素渲染出来就算，不用判断是否进入视口',
        '埋点数据不需要抽样，全量上报最准确'
      ],
      answer: 0, shuffle: true
    },
    7: {
      options: [
        '请求超时 + 指数退避重试；失败给友好提示与重试按钮；本地缓存兜底旧数据；监听网络状态；并发限流；骨架屏防白屏',
        '弱网时应该把超时时间设为 0，避免用户等待',
        '接口失败时静默处理即可，不需要提示用户',
        '只要后端保证 100% 可用，前端就不需要兜底'
      ],
      answer: 0, shuffle: true
    }
  }
}
