import { defineConfig, type DefaultTheme } from 'vitepress'
import fs from 'node:fs'
import path from 'node:path'

const TOPICS: { dir: string; text: string }[] = [
  { dir: 'UnityShader', text: 'Unity Shader' },
  { dir: 'UnityLighting', text: 'Unity 光照与渲染' },
  { dir: 'ResourceManagement', text: '资源管理' },
  { dir: 'Addressables', text: 'Addressables' },
  { dir: 'HotUpdate', text: '热更新' },
  { dir: 'HybridCLR', text: 'HybridCLR' },
  { dir: 'NetworkSync', text: '网络同步' },
]

function pagesIn(dir: string): DefaultTheme.SidebarItem[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
    .map((f) => {
      const stem = f.slice(0, -3)
      const raw = fs.readFileSync(path.join(dir, f), 'utf8')
      const heading = raw.match(/^#\s+(.+)$/m)
      return {
        text: heading ? heading[1] : stem,
        link: `/${dir}/${stem}`,
      }
    })
}

function sidebar(): DefaultTheme.Sidebar {
  const items: DefaultTheme.SidebarItem[] = TOPICS.map(({ dir, text }) => ({
    text,
    collapsed: false,
    items: pagesIn(dir),
  }))
  return items
}

function getBase(): string {
  const repo = process.env.GITHUB_REPOSITORY
  if (!repo) return '/'
  const name = repo.split('/')[1]
  if (!name || name.endsWith('.github.io')) return '/'
  return `/${name}/`
}

export default defineConfig({
  lang: 'zh-CN',
  title: 'UnityLearn',
  description: 'Unity 进阶学习笔记：Shader、光照与渲染、资源管理、Addressables、热更新、HybridCLR、网络同步',
  base: getBase(),
  srcExclude: ['README.md'],
  ignoreDeadLinks: true,
  lastUpdated: true,
  cleanUrls: true,
  markdown: {
    lineNumbers: true,
  },
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      ...TOPICS.map(({ dir, text }) => {
        const first = pagesIn(dir)[0]
        return { text, link: first?.link ?? `/${dir}/` }
      }),
    ],
    sidebar: sidebar(),
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '没有找到相关结果',
            resetButtonTitle: '清除查询',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },
    outline: {
      label: '本页目录',
      level: [2, 3],
    },
    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },
    lastUpdated: {
      text: '最后更新',
    },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '主题',
    socialLinks: [],
  },
})
