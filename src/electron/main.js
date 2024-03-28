// Modules to control application life and create native browser window
const { app, shell, BrowserWindow } = require('electron')
const path = require('path')
const { electronApp, optimizer } = require('@electron-toolkit/utils')
const fs = require('fs')

function createWindow() {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1152,
        height: 677,
        // titleBarStyle: 'hidden',
        // titleBarOverlay: {
        //     color: '#cd373e',
        //     symbolColor: '#ffffff',
        //     height: 40
        // },
        icon: path.join(__dirname, '../../build/icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true
        }
    })


    mainWindow.setMenu(null)

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // and load the index.html of the app.
    // const indexFile = "../Base Game/index.html";
    const indexFile = "../launcher/menu.html";
    mainWindow.loadFile(path.join(__dirname, indexFile))

    // devtools
    mainWindow.webContents.openDevTools()

    // IPC Event Handler
    var ipc = require('electron').ipcMain
    // USERSETTINGS
    ipc.on('fetch-user-settings', function (event) {
        console.log('Fetch User Settings...')
        // send the user settings to the renderer
        // "fetch-user-settings-reply"
        // read file USERSETTINGS.json in ../ 
        fs.readFile(__dirname + '/../USERSETTINGS.json', 'utf8', function (err, data) {
            if (err) {
                console.log(err)
                return
            }
            event.sender.send('fetch-user-settings-reply', JSON.parse(data))
        });
    });
    ipc.on('update-user-settings', function (event, arg) {
        console.log('Update User Settings...')
        // write to file USERSETTINGS.json in ../ 
        fs.writeFile(__dirname + '/../USERSETTINGS.json', JSON.stringify(arg), function (err) {
            if (err) {
                console.log(err)
                return
            }
            else console.log('USER SETTINGS WRITE SUCCESS')
        });
    });

    // WORLD GEN
    ipc.on('list-maps', function (event) {
        console.log('List Maps...')
        // return an array of stringsd with everything in /maps/
        // LIST ONLY DIRECTORIES
        var maps = fs.readdirSync(__dirname + '/../maps/').filter(function (file) {
            if (fs.statSync(path.join(__dirname + '/../maps/', file)).isDirectory()) {
                return true
            }
        })
        console.log(maps)
        // send the array back to the renderer
        // "list-maps-reply"
        event.sender.send('list-maps-reply', maps)
    })
    ipc.on('get-map-metadata', function (event, arg) {
        // return the metadata.json
        // arg is the map name
        console.log('Get Map Metadata: ' + arg.mapName)
        fs.readFile(
            __dirname + '/../maps/' + arg.mapName + '/metadata.json',
            'utf8',
            function (err, data) {
                if (err) {
                    console.log(err)
                    return
                }
                // count the number of chunks
                var totalChunks = 0
                // search the directory /maps/arg.mapName/ for any file that ends in ".json" and starts with "chunk"
                fs.readdirSync(__dirname + '/../maps/' + arg.mapName).filter(function (file) {
                    if (file.endsWith('.json') && file.startsWith('chunk')) {
                        totalChunks++
                    }
                })
                event.sender.send('get-map-metadata-reply', {
                    metaData: data,
                    totalChunks: totalChunks
                })
                console.log('SENT METADATA! [ONLY SEE ONCE]')
            }
        )
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
