UniLexical 已按 ARCHITECTURE.md 搭好：基于 Lexical 的 Notion 风格块编辑器，核心全为 TypeScript，Vue3 / React 只做薄封装。

项目结构

UniLexical/
├── ARCHITECTURE.md
├── README.md
├── package.json
├── src/
│   ├── core/          # UniEditor、EventEmitter、types、theme
│   ├── nodes/         # BlockWrapperNode、ImageNode
│   ├── plugins/       # 拖拽、Markdown、Slash、Toolbar、序列化、图片
│   ├── ui/            # 纯 DOM UI（toolbar / slash / overlay）+ styles.css
│   ├── wrappers/      # vanilla / vue / react
│   └── index.ts
├── examples/          # vanilla / vue / react 示例
└── dist/              # 构建产物

已实现的功能

┌─────────────────────────────┬─────────────────────────────────────────────────────┐
│ 需求                        │ 实现                                                │
├─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 1. Drag handle 拖拽行       │ BlockOverlayController + HTML5 DnD 重排 block       │
├─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 2. 实时 Markdown            │ #  ##  >  列表；**bold** *italic* `code` ~~strike~~ │
├─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 3. Slash 菜单               │ / 触发，过滤、方向键、Enter 确认                    │
├─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 4. 自定义 toolbar           │ toolbarItems: ['bold','italic','underline']         │
├─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 5. Markdown / HTML 导入导出 │ getContent / setContent 支持 html | markdown | json │
├─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 6. 图片上传                 │ imageOptions.upload 自定义；未传则 base64           │
├─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 7. Plus icon                │ 拖拽手柄旁 +，插入新块并打开 slash                  │
└─────────────────────────────┴─────────────────────────────────────────────────────┘

使用方式

cd /Users/entity/Desktop/Language/JS/UniLexical
npm install
npm run build

# 示例
npm run example:vanilla   # http://localhost:5173  (当前已在跑)
npm run example:vue       # :5174
npm run example:react     # :5175

原生 JS：

import { mountEditor } from 'unilexical';
import 'unilexical/style.css';

const { editor, getMarkdown } = mountEditor({
  container: '#editor',
  toolbarItems: ['bold', 'italic', 'underline', 'image'],
  imageOptions: { upload: async (file) => url }, // 可选
  initialContent: '# Hello',
  initialFormat: 'markdown',
});

Vue 3： import { UniLexical } from 'unilexical/vue'
React： import { UniLexical } from 'unilexical/react'

架构分层（与文档一致）

1. TS Core — 节点、插件、纯 DOM UI，无框架依赖
2. Event Bridge — change / toolbarChange / slashTriggered / blockHoverChanged
3. Wrappers — 仅负责挂载与生命周期（Vue shallowRef、React useSyncExternalStore）