import { app } from 'electron'
import { HisApp } from './app.ts'
import { sandboxDev } from './dev.ts'

// separate the unpackaged app from the installed one
sandboxDev()

if (!app.requestSingleInstanceLock()) app.exit(0)

const hisApp = new HisApp(app)

app.on('second-instance', () => {
  hisApp.openWindow()
})

app.on('window-all-closed', () => {
  // the window hides instead of closing
})

app.on('before-quit', (event) => {
  event.preventDefault()
  hisApp.quit()
})

app.whenReady().then(() => {
  hisApp.start()
})
