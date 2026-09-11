import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import VisitCounter from './VisitCounter.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-features-after': () => h(VisitCounter),
    })
  },
}
