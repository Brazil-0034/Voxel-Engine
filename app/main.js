"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Modules to control application life and create native browser window
const electron_1 = require("electron");
const fs = require("fs");
const path = require("path");
function createWindow() {
    // Create the browser window.
    const mainWindow = new electron_1.BrowserWindow({
        width: 1366,
        height: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, '/preload.js')
        },
        autoHideMenuBar: true,
        icon: __dirname + '/icon.ico'
    });
    mainWindow.setMenu(null);
    mainWindow.loadFile(__dirname + '/index.html');
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
    var ipc = require('electron').ipcMain;
    ipc.on('list-maps', function (event, arg) {
        console.log("List Maps...");
        // return an array of stringsd with everything in /maps/
        // LIST ONLY DIRECTORIES
        var maps = fs.readdirSync(__dirname + '/maps/').filter(function (file) {
            if (fs.statSync(path.join(__dirname + '/maps/', file)).isDirectory()) {
                return true;
            }
        });
        console.log(maps);
        // send the array back to the renderer
        // "list-maps-reply"
        event.sender.send('list-maps-reply', maps);
    });
    ipc.on('get-map-metadata', function (event, arg) {
        // return the metadata.json 
        // arg is the map name
        console.log("Get Map Metadata: " + arg.mapName);
        fs.readFile(__dirname + '/maps/' + arg.mapName + '/metadata.json', 'utf8', function (err, data) {
            if (err) {
                console.log(err);
                return;
            }
            // count the number of chunks
            var totalChunks = 0;
            // search the directory /maps/arg.mapName/ for any file that ends in ".json" and starts with "chunk"
            fs.readdirSync(__dirname + '/maps/' + arg.mapName).filter(function (file) {
                if (file.endsWith(".json") && file.startsWith("chunk")) {
                    totalChunks++;
                }
            });
            event.sender.send('get-map-metadata-reply', {
                metaData: data,
                totalChunks: totalChunks
            });
            console.log("SENT METADATA! [ONLY SEE ONCE]");
        });
    });
    ipc.on('get-map-chunk', function (event, arg) {
        const mapDirName = arg.mapName;
        const index = arg.chunkIndex;
        // send back the URL (absolute path) of the chunk
        // arg is the map name
        console.log("Get Map Chunk: " + mapDirName + " [chunk" + index + "]");
        event.sender.send('get-map-chunk-reply', {
            modelURL: __dirname + '/maps/' + mapDirName + '/chunk' + index + '.json',
            index: index
        });
    });
}
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
electron_1.app.on('window-all-closed', function () {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
//# sourceMappingURL=main.js.map