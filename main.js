const { app, BrowserWindow, session, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const toml = require('toml');

// 加载配置
let config = loadConfig();

// 设置命令行开关基于配置
if (config.window.highDPIScaling) {
  app.commandLine.appendSwitch('high-dpi-support', '1');
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
}

// 设置用户数据目录
const userDataPath = path.resolve(getConfigPath(), '..', config.userDataPath);
const validatedUserDataPath = createDirectorySafely(userDataPath, '用户数据');
const webDataPath = path.join(validatedUserDataPath, 'WebData');
const validatedWebDataPath = createDirectorySafely(webDataPath, 'Web数据');
app.setPath('userData', validatedWebDataPath);

// 日志系统类
class Logger {
  constructor(logDir, fileName = 'app.log') {
    this.logDir = logDir;

    // 确保日志目录存在
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    this.fileName = fileName;
    this.logPath = path.join(logDir, fileName);
  }

  // 获取格式化的本地时间（用于日志内容）
  getLocalTime() {
    const now = new Date();
    return now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\//g, '-');
  }

  // 获取文件名友好的本地时间格式（用于文件名）
  static getLocalTimeForFilename() {
    const now = new Date();
    return now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    .replace(/\//g, '-')    // 替换斜杠为连字符
    .replace(/\s/g, '-')    // 替换空格为连字符
    .replace(/:/g, '-');    // 替换冒号为连字符
  }

  writeLog(level, message, error = null) {
    const timestamp = this.getLocalTime();
    let logEntry = `[${timestamp}] [${level}] ${message}`;

    if (error) {
      logEntry += `\n错误详情: ${error.stack || error}`;
    }

    logEntry += '\n';

    try {
      fs.appendFileSync(this.logPath, logEntry, 'utf8');
    } catch (writeError) {
      console.error('写入日志失败:', writeError);
    }
  }

  info(message) {
    this.writeLog('INFO', message);
    console.log(`[INFO] ${message}`);
  }

  warn(message) {
    this.writeLog('WARN', message);
    console.warn(`[WARN] ${message}`);
  }

  error(message, error = null) {
    this.writeLog('ERROR', message, error);
    console.error(`[ERROR] ${message}`, error);
  }
}

// 获取配置文件的路径
function getConfigPath() {
  if (app.isPackaged) {
    return path.join(path.dirname(app.getPath('exe')), 'config.toml');
  } else {
    return path.join(__dirname, 'config.toml');
  }
}

// 创建默认 TOML 配置
function createDefaultConfig(configPath) {
  const defaultConfig = `# CusBro配置文件
# 修改后重启应用生效

# 启动时打开的网址【支持 http://、https:// 或 local:// 开头的本地文件】
url = "local://index.html"

# 用户数据存储路径【相对于应用目录】
userDataPath = "./UserData"

# 本地网页文件目录【相对于应用目录】
localPageRoot = "./LocalPage"

# 窗口设置
[window]
# 窗口宽度
width = 1280
# 窗口高度
height = 960
# 是否全屏启动
fullscreen = false
# 窗口标题
title = "CusBro"
# 最小宽度
minWidth = 800
# 最小高度
minHeight = 600
# 是否显示窗口控制按钮【最小化/最大化/关闭】
showControls = true
# 是否可调整窗口大小
resizable = true
# 是否启用高DPI缩放支持
highDPIScaling = true
# 是否显示菜单栏
showMenuBar = true

# 浏览器行为设置
[behavior]
# 是否启用硬件加速
hardwareAcceleration = true
# 是否允许新窗口弹出
allowPopups = false
# 下载路径【路径根目录为"UserData"，下方的默认设置即是："UserData/Downloads"】
downloadPath = "Downloads"
# 是否启用页面右键菜单
enableContextMenu = true
# 是否允许开发者工具
allowDevTools = false
# 是否忽略证书错误【用于本地HTTPS服务，如Syncthing或Docker应用】
ignoreCertificateErrors = false

# 快捷键设置
[shortcuts]
# 打开设置
settings = "F1"
# 刷新页面
reload = "F5"
# 全屏切换
fullscreenToggle = "F11"
# 后退
back = "Alt+Left"
# 前进
forward = "Alt+Right"
# 主页
home = "Alt+Home"
# 放大页面
zoomIn = "Ctrl+Plus"
# 缩小页面
zoomOut = "Ctrl+-"
# 实际大小
resetZoom = "Ctrl+0"
# 开发者工具【allowDevTools设为true时】
devTools = "F12"`;

  fs.writeFileSync(configPath, defaultConfig);
  console.log('已创建默认配置文件:', configPath);
}

// 读取和解析 TOML 配置文件
function loadConfig() {
  try {
    const configPath = getConfigPath();
    console.log('配置文件路径:', configPath);

    if (!fs.existsSync(configPath)) {
      createDefaultConfig(configPath);
    }

    const content = fs.readFileSync(configPath, 'utf8');
    const config = toml.parse(content);

    // 配置验证和默认值
    return {
      url: config.url || 'local://index.html',
      userDataPath: config.userDataPath || './UserData',
      localPageRoot: config.localPageRoot || './LocalPage',
      window: {
        width: config.window?.width || 1280,
        height: config.window?.height || 960,
        fullscreen: config.window?.fullscreen || false,
        title: config.window?.title || 'CusBro',
        minWidth: config.window?.minWidth || 800,
        minHeight: config.window?.minHeight || 600,
        showControls: config.window?.showControls !== false,
        resizable: config.window?.resizable !== false,
        highDPIScaling: config.window?.highDPIScaling !== false,
        showMenuBar: config.window?.showMenuBar !== false
      },
      behavior: {
        hardwareAcceleration: config.behavior?.hardwareAcceleration !== false,
        allowPopups: config.behavior?.allowPopups || false,
        downloadPath: config.behavior?.downloadPath || 'Downloads',
        enableContextMenu: config.behavior?.enableContextMenu !== false,
        allowDevTools: config.behavior?.allowDevTools || false,
        ignoreCertificateErrors: config.behavior?.ignoreCertificateErrors || false
      },
      shortcuts: {
        settings: config.shortcuts?.settings || 'F1',
        reload: config.shortcuts?.reload || 'F5',
        fullscreenToggle: config.shortcuts?.fullscreenToggle || 'F11',
        back: config.shortcuts?.back || 'Alt+Left',
        forward: config.shortcuts?.forward || 'Alt+Right',
        home: config.shortcuts?.home || 'Alt+Home',
        zoomIn: config.shortcuts?.zoomIn || 'Ctrl+Plus',
        zoomOut: config.shortcuts?.zoomOut || 'Ctrl+-',
        resetZoom: config.shortcuts?.resetZoom || 'Ctrl+0',
        devTools: config.shortcuts?.devTools || 'F12'
      }
    };

  } catch (error) {
    console.error('配置文件加载失败:', error);

    if (app.isReady()) {
      dialog.showErrorBox('配置错误',
        `配置文件加载失败: ${error.message}\n\n将使用默认配置。`);
    }

    return getDefaultConfig();
  }
}

// 保存配置到文件
function saveConfig(newConfig) {
  try {
    const configPath = getConfigPath();

    const tomlContent = `# CusBro配置文件
# 修改后重启应用生效

# 启动时打开的网址【支持 http://、https:// 或 local:// 开头的本地文件】
url = "${newConfig.url}"

# 用户数据存储路径【相对于应用目录】
userDataPath = "${newConfig.userDataPath}"

# 本地网页文件目录【相对于应用目录】
localPageRoot = "${newConfig.localPageRoot}"

# 窗口设置
[window]
# 窗口宽度
width = ${newConfig.window.width}
# 窗口高度
height = ${newConfig.window.height}
# 是否全屏启动
fullscreen = ${newConfig.window.fullscreen}
# 窗口标题
title = "${newConfig.window.title}"
# 最小宽度
minWidth = ${newConfig.window.minWidth}
# 最小高度
minHeight = ${newConfig.window.minHeight}
# 是否显示窗口控制按钮【最小化/最大化/关闭】
showControls = ${newConfig.window.showControls}
# 是否可调整窗口大小
resizable = ${newConfig.window.resizable}
# 是否启用高DPI缩放支持
highDPIScaling = ${newConfig.window.highDPIScaling}
# 是否显示菜单栏
showMenuBar = ${newConfig.window.showMenuBar}

# 浏览器行为设置
[behavior]
# 是否启用硬件加速
hardwareAcceleration = ${newConfig.behavior.hardwareAcceleration}
# 是否允许新窗口弹出
allowPopups = ${newConfig.behavior.allowPopups}
# 下载路径【路径根目录为"UserData"】
downloadPath = "${newConfig.behavior.downloadPath}"
# 是否启用页面右键菜单
enableContextMenu = ${newConfig.behavior.enableContextMenu}
# 是否允许开发者工具
allowDevTools = ${newConfig.behavior.allowDevTools}
# 是否忽略证书错误【用于本地HTTPS服务，如Syncthing或Docker应用】
ignoreCertificateErrors = ${newConfig.behavior.ignoreCertificateErrors}

# 快捷键设置
[shortcuts]
# 打开设置
settings = "${newConfig.shortcuts.settings}"
# 刷新页面
reload = "${newConfig.shortcuts.reload}"
# 全屏切换
fullscreenToggle = "${newConfig.shortcuts.fullscreenToggle}"
# 后退
back = "${newConfig.shortcuts.back}"
# 前进
forward = "${newConfig.shortcuts.forward}"
# 主页
home = "${newConfig.shortcuts.home}"
# 放大页面
zoomIn = "${newConfig.shortcuts.zoomIn}"
# 缩小页面
zoomOut = "${newConfig.shortcuts.zoomOut}"
# 实际大小
resetZoom = "${newConfig.shortcuts.resetZoom}"
# 开发者工具【allowDevTools设为true时】
devTools = "${newConfig.shortcuts.devTools}"`;

    fs.writeFileSync(configPath, tomlContent);
    if (logger) logger.info(`配置已保存: ${configPath}`);
    return true;
  } catch (error) {
    if (logger) logger.error('保存配置失败', error);
    return false;
  }
}

// 默认配置（备用）
function getDefaultConfig() {
  return {
    url: 'local://index.html',
    userDataPath: './UserData',
    localPageRoot: './LocalPage',
    window: {
      width: 1280,
      height: 960,
      fullscreen: false,
      title: 'CusBro',
      minWidth: 800,
      minHeight: 600,
      showControls: true,
      resizable: true,
      highDPIScaling: true,
      showMenuBar: true
    },
    behavior: {
      hardwareAcceleration: true,
      allowPopups: false,
      downloadPath: 'Downloads',
      enableContextMenu: true,
      allowDevTools: false,
      ignoreCertificateErrors: false
    },
    shortcuts: {
      settings: 'F1',
      reload: 'F5',
      fullscreenToggle: 'F11',
      back: 'Alt+Left',
      forward: 'Alt+Right',
      home: 'Alt+Home',
      zoomIn: 'Ctrl+Plus',
      zoomOut: 'Ctrl+-',
      resetZoom: 'Ctrl+0',
      devTools: 'F12'
    }
  };
}

// 安全的目录创建函数
function createDirectorySafely(dirPath, description) {
  try {
    if (!dirPath || typeof dirPath !== 'string') {
      throw new Error(`${description}路径无效: ${dirPath}`);
    }

    dirPath = dirPath.trim();
    const resolvedPath = path.resolve(dirPath);

    if (dirPath.length === 0) {
      throw new Error(`${description}路径为空`);
    }

    // 检查非法字符
    const illegalChars = /[<>:"|?*]/;
    const pathParts = resolvedPath.split(path.sep);
    const lastPart = pathParts[pathParts.length - 1];

    if (illegalChars.test(lastPart)) {
      throw new Error(`${description}名称包含非法字符: ${lastPart}`);
    }

    // 检查路径长度限制
    if (process.platform === 'win32' && resolvedPath.length > 260) {
      throw new Error(`${description}路径过长: ${resolvedPath}`);
    }

    // 创建目录（如果不存在）
    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }

    return resolvedPath;
  } catch (error) {
    throw new Error(`创建${description}目录失败: ${error.message}`);
  }
}

// 设置证书错误处理
function setupCertificateErrorHandler(ignoreCertificateErrors) {
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    if (ignoreCertificateErrors) {
      callback(0);
    } else {
      callback(-2);
    }
  });
}

// 处理 URL，支持本地文件
function processUrl(url, localPageRoot) {
  if (url.startsWith('local://')) {
    const fileName = url.substring(8);
    const localPagePath = path.resolve(getConfigPath(), '..', localPageRoot);
    const filePath = path.join(localPagePath, fileName);

    if (fs.existsSync(filePath)) {
      return `file://${filePath}`;
    } else {
      console.warn(`本地文件不存在: ${filePath}`);
      return 'local://index.html';
    }
  }

  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
    return `https://${url}`;
  }

  return url;
}

// 创建设置窗口
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  // 预加载脚本路径
  let preloadPath;
  if (app.isPackaged) {
    preloadPath = path.join(process.resourcesPath, 'preload.js');
  } else {
    preloadPath = path.join(__dirname, 'preload.js');
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 700,
    parent: mainWindow,
    modal: true,
    title: '设置',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: preloadPath
    },
    resizable: true,
    maximizable: false,
    autoHideMenuBar: true
  });

  // 设置页面路径
  let settingsPath;
  if (app.isPackaged) {
    settingsPath = path.join(process.resourcesPath, 'settings.html');
  } else {
    settingsPath = path.join(__dirname, 'settings.html');
  }

  settingsWindow.loadFile(settingsPath);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

let mainWindow;
let settingsWindow = null;
let logger = null;

function createWindow() {
  // 创建本地网页目录
  const localPagePath = path.resolve(getConfigPath(), '..', config.localPageRoot);
  const validatedLocalPagePath = createDirectorySafely(localPagePath, '本地网页');

  // 创建示例HTML文件（如果不存在）
  if (!fs.existsSync(path.join(validatedLocalPagePath, 'index.html'))) {
    const sampleHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>应用说明页面</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); color: #333; line-height: 1.6; padding: 20px; min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; }
        .container { max-width: 800px; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); margin-top: 20px; }
        h1 { color: #2c3e50; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #3498db; font-size: 28px; }
        p { margin-bottom: 16px; font-size: 16px; color: #555; }
        code { background-color: #ecf0f1; padding: 4px 8px; border-radius: 4px; font-family: 'Courier New', monospace; color: #e74c3c; font-size: 14px; }
        .note-section { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 4px; }
        .note-section h1 { color: #856404; border-bottom: none; font-size: 22px; margin-bottom: 10px; }
        .note-section p { color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <h1>欢迎使用本应用！</h1>
        <p>本应用在初始化的时候，会在程序根目录生成一个 <code>config.toml</code> 文件。</p>
        <p>这个文件是本应用的配置文件，内含功能注释，请按需调整。</p>
        <p>以及，这个页面是一个示例，展示应用读取本地离线HTML页面。</p>
        <p>这个示例的HTML文件储存在程序目录下的 <code>LocalPage</code> 文件夹内，可自行替换你的本地web应用，或者将它删掉。</p>
        <p>（虽然在你没有放置名为index.html的本地页面的情况下它还是会生成的。）</p>
        <p>您的使用数据一般情况下会储存在 <code>UserData/WebData</code> 目录内，由Electron负责储存。</p>
        <p>而您从web应用里导出的下载程序一般情况下会储存在 <code>UserData/Downloads</code> 目录内，遵循同名文件直接覆盖的原则。这个部分问就是能力有限暂时没改。</p>
        <p>最后，您可以在配置文件中使用 <code>local://index.html</code> 来加载本地页面。</p>
        <p>或是使用 <code>http://192.168.1.1</code> 或<code>https://192.168.1.1</code>来加载远程页面（比如一些应用的webUI或是网站）。</p>

        <div class="note-section">
            <h1>注意</h1>
            <p>这个项目的本意是为本地web应用和局域网内的web应用提供一个通用前端。</p>
            <p>安全性上没有做任何设计，如果出现因为使用本程序连接互联网导致的不可承受的后果，开发者不对用户行为负责。</p>
            <p>如不愿意接受这点，早早删了这程序了事。</p>
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync(path.join(validatedLocalPagePath, 'index.html'), sampleHtml);
    logger.info('已创建示例HTML文件');
  }

  // 窗口选项
  const windowOptions = {
    width: config.window.width,
    height: config.window.height,
    minWidth: config.window.minWidth,
    minHeight: config.window.minHeight,
    fullscreen: config.window.fullscreen,
    title: config.window.title,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    minimizable: true,
    maximizable: config.window.resizable,
    closable: true,
    resizable: config.window.resizable,
    titleBarStyle: config.window.showControls ? 'default' : 'hidden',
    autoHideMenuBar: !config.window.showMenuBar
  };

  // 创建主窗口
  mainWindow = new BrowserWindow(windowOptions);
  logger.info('主窗口创建完成');

  // 创建中文菜单
  createChineseMenu();

  // 处理URL
  const processedUrl = processUrl(config.url, config.localPageRoot);
  logger.info(`加载网址: ${processedUrl}`);

  // 加载URL
  mainWindow.loadURL(processedUrl).catch(error => {
    logger.error('加载URL失败', error);
    const fallbackUrl = processUrl('local://index.html', config.localPageRoot);
    mainWindow.loadURL(fallbackUrl);
  });

  // 设置弹出窗口处理
  if (!config.behavior.allowPopups) {
    mainWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
  }

  // 设置下载处理器
  setupDownloadHandler(validatedUserDataPath, config.behavior.downloadPath);

  // 设置右键菜单
  setupContextMenu();

  // 设置窗口事件
  setupWindowEvents();
}

// 创建包含设置菜单的中文菜单
function createChineseMenu() {
  const { Menu, shell, dialog } = require('electron');

  if (!config.window.showMenuBar) {
    Menu.setApplicationMenu(null);
    return;
  }

  const template = [
    {
      label: '文件(F)',
      submenu: [
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑(E)',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '恢复', accelerator: process.platform === 'darwin' ? 'Cmd+Shift+Z' : 'Ctrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '删除', role: 'delete' },
        { type: 'separator' },
        { label: '选择全部', accelerator: 'CmdOrCtrl+A', role: 'selectall' }
      ]
    },
    {
      label: '视图(V)',
      submenu: [
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: '实际大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: '切换全屏', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: '窗口(W)',
      role: 'window',
      submenu: [
        { label: '最小化', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: '缩放', role: 'zoom' },
        { label: '关闭', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    },
    {
      label: '设置(S)',
      submenu: [
        {
          label: '打开设置',
          accelerator: 'F1',
          click: () => {
            createSettingsWindow();
          }
        },
        { type: 'separator' },
        {
          label: '重启应用',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '重启应用',
              message: '应用将重启以使配置生效',
              buttons: ['确定', '取消']
            }).then(result => {
              if (result.response === 0) {
                app.relaunch();
                app.exit();
              }
            });
          }
        }
      ]
    },
    {
      label: '帮助(H)',
      role: 'help',
      submenu: [
        {
          label: '更多 (Electron)',
          click: () => {
            shell.openExternal('https://electronjs.org');
          }
        },
        {
          label: '文档 (Electron)',
          click: () => {
            shell.openExternal('https://electronjs.org/docs');
          }
        },
        {
          label: '社区论坛 (Electron)',
          click: () => {
            shell.openExternal('https://discuss.electronjs.org');
          }
        },
        {
          label: '搜索问题 (Electron)',
          click: () => {
            shell.openExternal('https://github.com/electron/electron/issues');
          }
        },
        { type: 'separator' },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: '自定义浏览器',
              detail: '版本 2.0.0\n\nElectron版本 38.2.0\n\nElectron-Builder版本 26.0.12\n\n\n基于 Electron 框架构建，集成设置系统和日志功能。\n作用是拿来打开一些只有webui的应用。\n\n我知道肯定有人会说“用浏览器就好了呀？”\n有没有可能有的人就是觉得用主浏览器太重了？\n有时候只想打开一个应用，而不想开浏览器？\n又或者打开浏览器但不想看到标题栏和标签栏？\n等等等等……\n这个拿electron+deepseek简单写的应用就是为了这样的场景而生的。\n而且本就是自用，分享出来不过是为了给有同样需求但不太会编程的朋友一个凑合用的方案。\n毕竟陶德说过，"it just works!"\n\n至于为什么用electron？\n水平不行是一方面，之前1.0.0版用python+webview做的那个只有最基本的功能，实在是有点不满意……\n至于现在嘛……凑合用吧，至少凑合用的话个人还算满意了。\n\n\n“是的,它能跑!”\n\n                                                by Luminous'
            });
          }
        }
      ]
    }
  ];

  if (!config.behavior.allowDevTools) {
    template[2].submenu = template[2].submenu.filter(item =>
      item.role !== 'toggleDevTools'
    );
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 设置下载处理器
function setupDownloadHandler(userDataPath, downloadSubPath) {
  const downloadPath = path.join(userDataPath, downloadSubPath);
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  session.defaultSession.on('will-download', (event, item) => {
    const fileName = item.getFilename();
    const filePath = path.join(downloadPath, fileName);
    item.setSavePath(filePath);

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        if (logger) logger.warn('下载已中断');
      } else if (state === 'progressing') {
        if (item.isPaused()) {
          if (logger) logger.info('下载已暂停');
        } else {
          const progress = ((item.getReceivedBytes() / item.getTotalBytes()) * 100).toFixed(2);
          if (logger) logger.info(`下载进度: ${progress}% - ${fileName}`);
        }
      }
    });

    item.once('done', (event, state) => {
      if (state === 'completed') {
        if (logger) logger.info(`下载完成: ${filePath}`);
        if (mainWindow) {
          mainWindow.webContents.executeJavaScript(`
            if (typeof showDownloadComplete === 'function') {
              showDownloadComplete('${fileName}');
            }
          `);
        }
      } else {
        if (logger) logger.error(`下载失败: ${state} - ${fileName}`);
      }
    });
  });
}

// 设置右键菜单
function setupContextMenu() {
  if (!config.behavior.enableContextMenu) {
    mainWindow.webContents.on('context-menu', (event, params) => {
      event.preventDefault();
    });
    return;
  }

  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = Menu.buildFromTemplate([
      {
        label: '后退',
        enabled: mainWindow.webContents.canGoBack(),
        click: () => {
          mainWindow.webContents.goBack();
        }
      },
      {
        label: '前进',
        enabled: mainWindow.webContents.canGoForward(),
        click: () => {
          mainWindow.webContents.goForward();
        }
      },
      { type: 'separator' },
      {
        label: '重新加载',
        click: () => {
          mainWindow.reload();
        }
      },
      { type: 'separator' },
      {
        label: '剪切',
        role: 'cut',
        enabled: params.editFlags.canCut
      },
      {
        label: '复制',
        role: 'copy',
        enabled: params.editFlags.canCopy
      },
      {
        label: '粘贴',
        role: 'paste',
        enabled: params.editFlags.canPaste
      },
      { type: 'separator' },
      {
        label: '检查元素',
        enabled: config.behavior.allowDevTools,
        click: () => {
          mainWindow.webContents.inspectElement(params.x, params.y);
        }
      },
      {
        label: '查看页面源代码',
        click: () => {
          mainWindow.webContents.executeJavaScript('window.location.href').then(url => {
            shell.openExternal(`view-source:${url}`);
          });
        }
      }
    ]);

    menu.popup({ window: mainWindow, x: params.x, y: params.y });
  });
}

// 设置窗口事件
function setupWindowEvents() {
  mainWindow.webContents.on('page-title-updated', (event, title) => {
    if (title && !title.startsWith('file://')) {
      mainWindow.setTitle(`${title} - ${config.window.title}`);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }

    if (url.startsWith('file://')) {
      mainWindow.loadURL(url);
      return { action: 'deny' };
    }

    if (config.behavior.allowPopups) {
      return { action: 'allow' };
    } else {
      mainWindow.loadURL(url);
      return { action: 'deny' };
    }
  });
}

// 注册全局快捷键
function registerShortcuts() {
  const { globalShortcut } = require('electron');

  // 打开设置
  globalShortcut.register(config.shortcuts.settings, () => {
    createSettingsWindow();
    if (logger) logger.info('打开设置菜单');
  });

  // 刷新页面
  globalShortcut.register(config.shortcuts.reload, () => {
    if (mainWindow) {
      mainWindow.reload();
      if (logger) logger.info('页面已刷新');
    }
  });

  // 全屏切换
  globalShortcut.register(config.shortcuts.fullscreenToggle, () => {
    if (mainWindow) {
      const isFullscreen = !mainWindow.isFullScreen();
      mainWindow.setFullScreen(isFullscreen);
      if (logger) logger.info(`全屏状态: ${isFullscreen ? '开启' : '关闭'}`);
    }
  });

  // 后退
  globalShortcut.register(config.shortcuts.back, () => {
    if (mainWindow && mainWindow.webContents.canGoBack()) {
      mainWindow.webContents.goBack();
      if (logger) logger.info('页面后退');
    }
  });

  // 前进
  globalShortcut.register(config.shortcuts.forward, () => {
    if (mainWindow && mainWindow.webContents.canGoForward()) {
      mainWindow.webContents.goForward();
      if (logger) logger.info('页面前进');
    }
  });

  // 主页
  globalShortcut.register(config.shortcuts.home, () => {
    if (mainWindow) {
      const processedUrl = processUrl(config.url, config.localPageRoot);
      mainWindow.loadURL(processedUrl);
      if (logger) logger.info('返回主页');
    }
  });

  // 放大页面
  globalShortcut.register(config.shortcuts.zoomIn, () => {
    if (mainWindow) {
      const currentZoom = mainWindow.webContents.getZoomLevel();
      mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
      if (logger) logger.info(`页面放大，当前缩放级别: ${currentZoom + 0.5}`);
    }
  });

  // 缩小页面
  globalShortcut.register(config.shortcuts.zoomOut, () => {
    if (mainWindow) {
      const currentZoom = mainWindow.webContents.getZoomLevel();
      mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
      if (logger) logger.info(`页面缩小，当前缩放级别: ${currentZoom - 0.5}`);
    }
  });

  // 重置缩放
  globalShortcut.register(config.shortcuts.resetZoom, () => {
    if (mainWindow) {
      mainWindow.webContents.setZoomLevel(0);
      if (logger) logger.info('重置页面缩放');
    }
  });

  // 开发者工具
  if (config.behavior.allowDevTools) {
    globalShortcut.register(config.shortcuts.devTools, () => {
      if (mainWindow) {
        mainWindow.webContents.toggleDevTools();
      }
    });
  }

  // 窗口控制快捷键
  globalShortcut.register('Ctrl+M', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  globalShortcut.register('Ctrl+W', () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });
}

// 应用事件处理
app.whenReady().then(() => {
  // 初始化日志系统
  const logDir = path.join(validatedUserDataPath, 'logs');
  const validatedLogDir = createDirectorySafely(logDir, '日志');
  const dateStr = Logger.getLocalTimeForFilename();
  logger = new Logger(validatedLogDir, `app-${dateStr}.log`);

  logger.info('应用初始化完成');

  // 设置证书错误处理
  setupCertificateErrorHandler(config.behavior.ignoreCertificateErrors);

  // 创建窗口
  createWindow();

  registerShortcuts();

  if (!app.isPackaged) {
    const configPath = getConfigPath();
    fs.watchFile(configPath, (curr, prev) => {
      if (logger) logger.info('配置文件已更改，请重启应用使更改生效');
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('will-quit', () => {
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});

// IPC 通信处理
ipcMain.handle('get-config', () => {
  return config;
});

ipcMain.handle('save-config', (event, newConfig) => {
  const success = saveConfig(newConfig);
  if (success) {
    config = newConfig;
    if (logger) logger.info('配置已保存并更新');
  }
  return success;
});

ipcMain.handle('reload-config', () => {
  const oldUrl = config.url;
  config = loadConfig();
  if (logger) logger.info('配置已重新加载');

  if (mainWindow && oldUrl !== config.url) {
    const processedUrl = processUrl(config.url, config.localPageRoot);
    mainWindow.loadURL(processedUrl);
    if (logger) logger.info(`网址已更新: ${processedUrl}`);
  }

  return config;
});

ipcMain.handle('window-control', (event, action) => {
  if (!mainWindow) return;

  switch (action) {
    case 'minimize':
      mainWindow.minimize();
      break;
    case 'maximize':
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      break;
    case 'close':
      mainWindow.close();
      break;
    case 'fullscreen':
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      break;
  }
});

ipcMain.handle('get-default-config', () => {
  return getDefaultConfig();
});

ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.exit();
  return true;
});

ipcMain.on('settings-saved', () => {
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript(`
      if (typeof showNotification === 'function') {
        showNotification('设置已保存，部分设置需要重启应用才能生效');
      } else {
        alert('设置已保存，部分设置需要重启应用才能生效');
      }
    `);
  }
});

module.exports = { loadConfig, getConfigPath };
