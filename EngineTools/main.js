// Modules to control application life and create native browser window
const { app, BrowserWindow } = require('electron')
const fs = require('fs');
const path = require('path');

const ignore_modules = /node_modules|[/\\]\./;
const ignore_saves = /exported_maps|[/\\]\./;
require('electron-reload')(__dirname, {ignored: [ignore_modules, ignore_saves]});   

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
    ipc.on('read-models', function (event, arg) {
        console.log("read-models");
        // save the file names of every .json file in the /level_models/ folder, then set it
        const directoryPath = path.join(__dirname, 'level_models');

        const files = fs.readdirSync(directoryPath);
        var models = [];
        files.forEach(file => {
            if (file.endsWith(".json")) {
                // remove the .json extension
                file = file.substring(0, file.length - 5);
                models.push(file);
            }
        });

        // in the ul #available-models, empty it and add a new li for each model
        event.returnValue = models;
    });

    // save-map which takes a json object and saves it as .json in /exported_maps/ (create the folder if it doesn't exist)
    ipc.on('save-map', function (event, arg) {
        console.log("save-map");
        // save the file names of every .json file in the /level_models/ folder, then set it
        const directoryPath = path.join(__dirname, 'exported_maps');

        // create the folder if it doesn't exist
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath);
        }

        // save the json object as a .json file
        var json = JSON.stringify(arg);
        fs.writeFile(path.join(directoryPath, arg.name + ".json"), json, 'utf8', function (err) {
            if (err) {
                console.log("An error occured while writing JSON Object to File.");
                return console.log(err);
            }
            console.log("JSON file has been saved as " + arg.name + ".json");
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
