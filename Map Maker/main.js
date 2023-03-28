// Modules to control application life and create native browser window
const { app, BrowserWindow } = require('electron')

const ignore_modules = /node_modules|[/\\]\./;
const ignore_saves = /saves|[/\\]\./;
require('electron-reload')(__dirname, {ignored: [ignore_modules, ignore_saves]});   

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
        autoHideMenuBar: true
    })

    // and load the index.html of the app.
    mainWindow.loadFile('index.html')

    // Open the DevTools.
    mainWindow.webContents.openDevTools()

    var ipc = require('electron').ipcMain;
    ipc.on('save-file', function (event, arg) {
        var fs = require('fs');
        // if there is no "saves" directory, create it
        if (!fs.existsSync('./saves')) {
            fs.mkdirSync('./saves');
        }
        // save the arg (JSON string) to .json file
        fs.writeFile('./saves/savedata.json', arg, function (err) {
            if (err) {
                return console.log(err);
            }
            console.log("The file was saved!");
        });
    });
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
