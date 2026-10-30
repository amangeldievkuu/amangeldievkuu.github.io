import './styles/tokens.css'
import './styles/base.css'
import './styles/post.css'
import './styles/photos.css'
import './styles/viewer.css'
import { initSmoothScroll } from './smooth.ts'
import { initTheme } from './theme.ts'
import { initViewer } from './viewer.ts'

initTheme()
initSmoothScroll()
initViewer()
