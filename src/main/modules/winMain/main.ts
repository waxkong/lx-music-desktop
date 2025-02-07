import { BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { createTaskBarButtons, getWindowSizeInfo } from './utils'
import { isLinux, isWin } from '@common/utils'
import { openDevTools as handleOpenDevTools } from '@main/utils'
import { mainSend } from '@common/mainIpc'
import { sendFocus, sendTaskbarButtonClick } from './rendererEvent'
import { encodePath } from '@common/utils/electron'

let browserWindow: Electron.BrowserWindow | null = null

const winEvent = () => {
  if (!browserWindow) return

  browserWindow.on('close', event => {
    if (global.lx.isSkipTrayQuit || !global.lx.appSetting['tray.enable'] || (!isWin && !global.lx.isTrafficLightClose)) {
      browserWindow!.setProgressBar(-1)
      // global.lx.mainWindowClosed = true
      global.lx.event_app.main_window_close()
      return
    }

    if (global.lx.isTrafficLightClose) global.lx.isTrafficLightClose = false
    event.preventDefault()
    browserWindow!.hide()
  })

  browserWindow.on('closed', () => {
    // global.lx.mainWindowClosed = true
    browserWindow = null
  })

  // browserWindow.on('restore', () => {
  //   browserWindow.webContents.send('restore')
  // })
  browserWindow.on('focus', () => {
    sendFocus()
    global.lx.event_app.main_window_focus()
  })

  browserWindow.on('blur', () => {
    global.lx.event_app.main_window_blur()
  })

  browserWindow.once('ready-to-show', () => {
    showWindow()
    setThumbarButtons()
    global.lx.event_app.main_window_ready_to_show()
  })

  browserWindow.on('show', () => {
    global.lx.event_app.main_window_show()
  })
  browserWindow.on('hide', () => {
    global.lx.event_app.main_window_hide()
  })
}


export const createWindow = () => {
  closeWindow()
  const windowSizeInfo = getWindowSizeInfo(global.lx.appSetting['common.windowSizeId'])

  const { shouldUseDarkColors, theme } = global.lx.theme

  /**
   * Initial window options
   */
  const options: Electron.BrowserWindowConstructorOptions = {
    height: windowSizeInfo.height,
    useContentSize: true,
    width: windowSizeInfo.width,
    frame: false,
    transparent: !global.envParams.cmdParams.dt,
    // enableRemoteModule: false,
    // icon: join(global.__static, isWin ? 'icons/256x256.ico' : 'icons/512x512.png'),
    resizable: false,
    maximizable: false,
    fullscreenable: true,
    show: false,
    webPreferences: {
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      webSecurity: false,
      nodeIntegration: true,
      sandbox: false,
      enableWebSQL: false,
      webgl: false,
      spellcheck: false, // 禁用拼写检查器
    },
  }
  if (global.envParams.cmdParams.dt) options.backgroundColor = theme.colors['--color-primary-light-1000']
  if (global.lx.appSetting['common.startInFullscreen']) {
    options.fullscreen = true
    if (isLinux) options.resizable = true
  }
  browserWindow = new BrowserWindow(options)

  const winURL = global.isDev ? 'http://localhost:9080' : `file://${join(encodePath(__dirname), 'index.html')}`
  void browserWindow.loadURL(winURL + `?dt=${!!global.envParams.cmdParams.dt}&dark=${shouldUseDarkColors}&theme=${encodeURIComponent(JSON.stringify(theme))}`)

  winEvent()

  if (global.envParams.cmdParams.odt) handleOpenDevTools(browserWindow.webContents)

  // global.lx.mainWindowClosed = false
  // browserWindow.webContents.openDevTools()
}

export const isExistWindow = (): boolean => !!browserWindow
export const isShowWindow = (): boolean => {
  if (!browserWindow) return false
  return browserWindow.isVisible() && (isWin ? true : browserWindow.isFocused())
}

export const closeWindow = () => {
  if (!browserWindow) return
  browserWindow.close()
}

export const sendEvent = <T = any>(name: string, params?: T) => {
  if (!browserWindow) return
  mainSend(browserWindow, name, params)
}

export const showSelectDialog = async(options: Electron.OpenDialogOptions) => {
  if (!browserWindow) throw new Error('main window is undefined')
  return await dialog.showOpenDialog(browserWindow, options)
}
export const showDialog = ({ type, message, detail }: Electron.MessageBoxSyncOptions) => {
  if (!browserWindow) return
  dialog.showMessageBoxSync(browserWindow, {
    type,
    message,
    detail,
  })
}
export const showSaveDialog = async(options: Electron.SaveDialogOptions) => {
  if (!browserWindow) throw new Error('main window is undefined')
  return await dialog.showSaveDialog(browserWindow, options)
}
export const minimize = () => {
  if (!browserWindow) return
  browserWindow.minimize()
}
export const maximize = () => {
  if (!browserWindow) return
  browserWindow.maximize()
}
export const unmaximize = () => {
  if (!browserWindow) return
  browserWindow.unmaximize()
}
export const toggleHide = () => {
  if (!browserWindow) return
  browserWindow.isVisible()
    ? browserWindow.hide()
    : browserWindow.show()
}
export const toggleMinimize = () => {
  if (!browserWindow) return
  if (browserWindow.isMinimized()) {
    if (!browserWindow.isVisible()) {
      browserWindow.show()
    }
    browserWindow.restore()
    browserWindow.focus()
  } else {
    browserWindow.minimize()
  }
}
export const showWindow = () => {
  if (!browserWindow) return
  if (browserWindow.isMinimized()) {
    browserWindow.restore()
  }
  if (browserWindow.isVisible()) {
    browserWindow.focus()
  } else {
    browserWindow.show()
  }
}
export const hideWindow = () => {
  if (!browserWindow) return
  browserWindow.hide()
}
export const setWindowBounds = (options: Partial<Electron.Rectangle>) => {
  if (!browserWindow) return
  browserWindow.setBounds(options)
}
export const setProgressBar = (progress: number, options?: Electron.ProgressBarOptions) => {
  if (!browserWindow) return
  browserWindow.setProgressBar(progress, options)
}
export const setIgnoreMouseEvents = (ignore: boolean, options?: Electron.IgnoreMouseEventsOptions) => {
  if (!browserWindow) return
  browserWindow.setIgnoreMouseEvents(ignore, options)
}
export const toggleDevTools = () => {
  if (!browserWindow) return
  if (browserWindow.webContents.isDevToolsOpened()) {
    browserWindow.webContents.closeDevTools()
  } else {
    handleOpenDevTools(browserWindow.webContents)
  }
}

export const setFullScreen = (isFullscreen: boolean): boolean => {
  if (!browserWindow) return false
  if (isLinux) { // linux 需要先设置为可调整窗口大小才能全屏
    if (isFullscreen) {
      browserWindow.setResizable(isFullscreen)
      browserWindow.setFullScreen(isFullscreen)
    } else {
      browserWindow.setFullScreen(isFullscreen)
      browserWindow.setResizable(isFullscreen)
    }
  } else {
    browserWindow.setFullScreen(isFullscreen)
  }
  return isFullscreen
}

const taskBarButtonFlags: LX.TaskBarButtonFlags = {
  empty: true,
  collect: false,
  play: false,
  next: true,
  prev: true,
}
export const setThumbarButtons = ({ empty, collect, play, next, prev }: LX.TaskBarButtonFlags = taskBarButtonFlags) => {
  if (!isWin || !browserWindow) return
  taskBarButtonFlags.empty = empty
  taskBarButtonFlags.collect = collect
  taskBarButtonFlags.play = play
  taskBarButtonFlags.next = next
  taskBarButtonFlags.prev = prev
  browserWindow.setThumbarButtons(createTaskBarButtons(taskBarButtonFlags, action => {
    sendTaskbarButtonClick(action)
  }))
}

export const setThumbnailClip = (region: Electron.Rectangle) => {
  if (!browserWindow) return
  return browserWindow.setThumbnailClip(region)
}


export const clearCache = async() => {
  if (!browserWindow) throw new Error('main window is undefined')
  return await browserWindow.webContents.session.clearCache()
}

export const getCacheSize = async() => {
  if (!browserWindow) throw new Error('main window is undefined')
  return await browserWindow.webContents.session.getCacheSize()
}

export const getWebContents = (): Electron.WebContents => {
  if (!browserWindow) throw new Error('main window is undefined')
  return browserWindow.webContents
}
