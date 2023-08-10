/* eslint-disable no-unused-vars */
// Modules to control application life and create native browser window
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
var ipc = require('electron').ipcMain

const ignore_modules = /node_modules|[/\\]\./
const ignore_saves = /saves|[/\\]\./
require('electron-reload')(__dirname, { ignored: [ignore_modules, ignore_saves] })

const path = require('path')

function createWindow() {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        icon: __dirname + '/icon.ico'
    })

    // and load the index.html of the app.
    mainWindow.loadFile('index.html')

    // Open the DevTools.
    mainWindow.webContents.openDevTools()

    var thisSaveName = 'savedata'
    var saveFileData = '{'
    var chunkCounter = 0
    var metadata = `{"error": "no metadata"}`

    ipc.on('refresh-save', function (event, arg) {
        thisSaveName = arg.saveName
        chunkCounter = 0
        // if a directory in ../maps/ doesnt exist, create it
        if (!fs.existsSync('../maps/' + thisSaveName)) {
            fs.mkdirSync('../maps/' + thisSaveName)
        }

        // WIPE THE SAVEFILE TO OVERWRITE
        fs.readdir('../maps/' + thisSaveName, (err, files) => {
            if (err) throw err
            for (const file of files) {
                fs.writeFileSync(path.join('../maps/' + thisSaveName, file), '', function(){console.log('Wiped File, ready to save ...')})
            }

            // send "ready-to-save"
            mainWindow.webContents.send('ready-to-save')
        })
    })

    ipc.on('minimize', function(event, arg) {
        mainWindow.minimize()
    })

    ipc.on('maximizeToggle', function(event, arg) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize()
        } else {
            mainWindow.maximize()
        }
    })

    ipc.on('init-new-savefile', function (event, arg) {
        saveFileData = '{'
    })

    ipc.on('savefile-add-custom-data', function (event, arg) {
        const dataName = arg.dataName
        const stringData = arg.data
        saveFileData += `"${dataName}":${stringData},`
    })

    ipc.on('savefile-end-custom-data', function (event, arg) {
        saveFileData = saveFileData.slice(0, -1)
        saveFileData += `}`
        metadata = saveFileData
        writeFile('metadata', metadata)
    })

    const writeFile = function (fileName, data) {
        fs.writeFile('../maps/' + thisSaveName + '/' + fileName + '.json', data, function (err) {
            if (err) {
                return console.log(err)
            }
            console.log('The file was saved! - [' + fileName + '.json]')
            if (fileName.includes('chunk')) mainWindow.webContents.send('ready-to-save-voxelchunk')
        })
    }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
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
    if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
