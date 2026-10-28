import { app } from 'electron'
import { HisApp } from './app.ts'

if (!app.requestSingleInstanceLock()) app.exit(0)

const hisApp = new HisApp(app)

app.on('second-instance', () => {
  hisApp.openWindow()
})

app.on('window-all-closed', () => {
  // The window hides instead of closing; keep running in the menubar.
})

app.on('before-quit', (event) => {
  event.preventDefault()
  hisApp.quit()
})

app.whenReady().then(() => {
  hisApp.start()
})
