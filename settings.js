document.addEventListener('DOMContentLoaded', async () => {
    let currentCategory = 'core';
    let originalConfig = {};

    try {
        originalConfig = await window.electronAPI.getConfig();
        populateForm(originalConfig);
        
        showCategory(currentCategory);
        
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentCategory = e.target.dataset.category;
                showCategory(currentCategory);
            });
        });
    } catch (error) {
        console.error('加载配置失败:', error);
        alert('加载配置失败，请重试');
    }

    // 修复：将 originalConfig 挂载到 window 对象上，使其全局可访问
    window.originalConfig = originalConfig;
});

function showCategory(category) {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    document.querySelectorAll('.category').forEach(cat => {
        cat.classList.toggle('active', cat.id === category + '-category');
    });
}

function populateForm(config) {
    document.getElementById('url').value = config.url || '';
    document.getElementById('userDataPath').value = config.userDataPath || '';
    document.getElementById('localPageRoot').value = config.localPageRoot || '';

    document.getElementById('width').value = config.window.width;
    document.getElementById('height').value = config.window.height;
    document.getElementById('minWidth').value = config.window.minWidth;
    document.getElementById('minHeight').value = config.window.minHeight;
    document.getElementById('fullscreen').checked = config.window.fullscreen;
    document.getElementById('title').value = config.window.title;
    document.getElementById('showControls').checked = config.window.showControls;
    document.getElementById('showMenuBar').checked = config.window.showMenuBar;
    document.getElementById('resizable').checked = config.window.resizable;
    document.getElementById('highDPIScaling').checked = config.window.highDPIScaling;

    document.getElementById('hardwareAcceleration').checked = config.behavior.hardwareAcceleration;
    document.getElementById('allowPopups').checked = config.behavior.allowPopups;
    document.getElementById('enableContextMenu').checked = config.behavior.enableContextMenu;
    document.getElementById('allowDevTools').checked = config.behavior.allowDevTools;
    document.getElementById('ignoreCertificateErrors').checked = config.behavior.ignoreCertificateErrors;
    document.getElementById('webSecurity').checked = config.behavior.webSecurity !== false;
    document.getElementById('allowRunningInsecureContent').checked = config.behavior.allowRunningInsecureContent || false;
    document.getElementById('allowDisplayingInsecureContent').checked = config.behavior.allowDisplayingInsecureContent || false;
    document.getElementById('experimentalFeatures').checked = config.behavior.experimentalFeatures || false;
    document.getElementById('plugins').checked = config.behavior.plugins || false;
    document.getElementById('proxyServer').value = config.behavior.proxyServer || '';
    document.getElementById('userAgent').value = config.behavior.userAgent || '';
    document.getElementById('cacheSize').value = config.behavior.cacheSize || 100;
    document.getElementById('enableRemoteModule').checked = config.behavior.enableRemoteModule || false;
    document.getElementById('nodeIntegration').checked = config.behavior.nodeIntegration || false;

    document.getElementById('settings').value = config.shortcuts.settings;
    document.getElementById('reload').value = config.shortcuts.reload;
    document.getElementById('fullscreenToggle').value = config.shortcuts.fullscreenToggle;
    document.getElementById('back').value = config.shortcuts.back;
    document.getElementById('forward').value = config.shortcuts.forward;
    document.getElementById('home').value = config.shortcuts.home;
    document.getElementById('zoomIn').value = config.shortcuts.zoomIn;
    document.getElementById('zoomOut').value = config.shortcuts.zoomOut;
    document.getElementById('resetZoom').value = config.shortcuts.resetZoom;
    document.getElementById('devTools').value = config.shortcuts.devTools;
}

function getFormData() {
    return {
        url: document.getElementById('url').value,
        userDataPath: document.getElementById('userDataPath').value,
        localPageRoot: document.getElementById('localPageRoot').value,
        window: {
            width: parseInt(document.getElementById('width').value) || 1280,
            height: parseInt(document.getElementById('height').value) || 960,
            minWidth: parseInt(document.getElementById('minWidth').value) || 800,
            minHeight: parseInt(document.getElementById('minHeight').value) || 600,
            fullscreen: document.getElementById('fullscreen').checked,
            title: document.getElementById('title').value || 'CusBro',
            showControls: document.getElementById('showControls').checked,
            showMenuBar: document.getElementById('showMenuBar').checked,
            resizable: document.getElementById('resizable').checked,
            highDPIScaling: document.getElementById('highDPIScaling').checked
        },
        behavior: {
            hardwareAcceleration: document.getElementById('hardwareAcceleration').checked,
            allowPopups: document.getElementById('allowPopups').checked,
            downloadPath: window.originalConfig?.behavior?.downloadPath || 'Downloads',
            enableContextMenu: document.getElementById('enableContextMenu').checked,
            allowDevTools: document.getElementById('allowDevTools').checked,
            ignoreCertificateErrors: document.getElementById('ignoreCertificateErrors').checked,
            webSecurity: document.getElementById('webSecurity').checked,
            allowRunningInsecureContent: document.getElementById('allowRunningInsecureContent').checked,
            allowDisplayingInsecureContent: document.getElementById('allowDisplayingInsecureContent').checked,
            experimentalFeatures: document.getElementById('experimentalFeatures').checked,
            plugins: document.getElementById('plugins').checked,
            proxyServer: document.getElementById('proxyServer').value,
            userAgent: document.getElementById('userAgent').value,
            cacheSize: parseInt(document.getElementById('cacheSize').value) || 100,
            enableRemoteModule: document.getElementById('enableRemoteModule').checked,
            nodeIntegration: document.getElementById('nodeIntegration').checked
        },
        shortcuts: {
            settings: document.getElementById('settings').value || 'F1',
            reload: document.getElementById('reload').value || 'F5',
            fullscreenToggle: document.getElementById('fullscreenToggle').value || 'F11',
            back: document.getElementById('back').value || 'Alt+Left',
            forward: document.getElementById('forward').value || 'Alt+Right',
            home: document.getElementById('home').value || 'Alt+Home',
            zoomIn: document.getElementById('zoomIn').value || 'Ctrl+Plus',
            zoomOut: document.getElementById('zoomOut').value || 'Ctrl+-',
            resetZoom: document.getElementById('resetZoom').value || 'Ctrl+0',
            devTools: document.getElementById('devTools').value || 'F12'
        }
    };
}

async function resetToDefault() {
    try {
        const defaultConfig = await window.electronAPI.getDefaultConfig();
        populateForm(defaultConfig);
        // 修复：重置时也更新全局的 originalConfig
        window.originalConfig = defaultConfig;
    } catch (error) {
        console.error('获取默认配置失败:', error);
        alert('获取默认配置失败');
    }
}

async function save() {
    try {
        const newConfig = getFormData();
        const success = await window.electronAPI.saveConfig(newConfig);
        if (success) {
            window.electronAPI.onSettingsSaved(() => {
                window.close();
            });
        } else {
            alert('保存失败，请检查配置是否正确');
        }
    } catch (error) {
        console.error('保存配置失败:', error);
        alert('保存失败: ' + error.message);
    }
}

function cancel() {
    window.close();
}

window.resetToDefault = resetToDefault;
window.save = save;
window.cancel = cancel;
