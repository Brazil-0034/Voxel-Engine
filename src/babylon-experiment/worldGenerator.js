/**
 * The WorldGenerator class handles the building of the game environment from the provided savedata file.
 * It will construct the raw voxel geometry, along with the 64-lod mesh, and any physics constraints.
 */
const cutawayField = new DiscreteVectorField();
const addToCutawayStack = function (scale, position) {
    console.log("Added a cutaway at " + position.x + ", " + position.y + ", " + position.z + " with scale " + scale);
    for (let x = position.x - (scale.x / 2); x < position.x + (scale.x / 2); x++) {
        for (let y = position.y - (scale.y / 2); y < position.y + (scale.y / 2); y++) {
            for (let z = position.z - (scale.z / 2); z < position.z + (scale.z / 2); z++) {
                cutawayField.set(x, y, z, 1);
            }
        }
    }
}

const generateWorld = function (modelURL) {

    // send IPC message 'list-maps' and wait for response (sends eventResponse)
    // TODO - make this a promise
    ipcRenderer.send('list-maps');
    ipcRenderer.on('list-maps-reply', (event, arg) => {
        // THIS LISTS ALL AVAILABLE MAPS (later: map selector)
        // console.log(arg);

        // THIS CHOOSES THE MAP TO LOAD
        ipcRenderer.send('get-map-metadata', {
            mapName: modelURL
        });

        // THIS GETS METADATA (PRELOAD)
        ipcRenderer.on('get-map-metadata-reply', (event, arg) => {
            console.log("RECEIVED METADATA [ONLY SEE ONCE]");

            const mapCameraData = {
                position: JSON.parse(arg.metaData).cameraData.cameraPosition,
                rotation: JSON.parse(arg.metaData).cameraData.cameraRotation
            };
            camera.position.set(mapCameraData.position.x, camera.position.y, mapCameraData.position.z);
            camera.rotation.set(mapCameraData.rotation.x, mapCameraData.rotation.y, mapCameraData.rotation.z);

            const groundData = JSON.parse(arg.metaData).groundData;
            groundSize = groundData.groundSize;
            if (groundData) {
                let groundFloor = BABYLON.MeshBuilder.CreateGround("groundFloor", { width: groundSize.x, height: groundSize.y, subdivsions: 1 }, scene);
                groundFloor.checkCollisions = true;
                const groundFloorMaterial = new BABYLON.StandardMaterial("groundMaterial", scene);
                groundFloorMaterial.diffuseColor = new BABYLON.Color3(groundData.groundColor.r, groundData.groundColor.g, groundData.groundColor.b);
                groundFloor.position.y = -1;
            }

            const mapObjects = JSON.parse(arg.metaData).mapMakerSave;

            // Filter 1: Cutaways
            // These must be processed BEFORE boxes, but by nature can exist in save files in random order
            mapObjects.forEach(mapObject => {
                if (mapObject.type == "box" && mapObject.isCutaway == true) {
                    addToCutawayStack(mapObject.size, mapObject.position);
                    mapObjects.splice(mapObjects.indexOf(mapObject), 1);
                }
            });

            // Filter 2: Boxes
            // These are the most standard world object, and are the quickest to process
            mapObjects.forEach(mapObject => {
                if (mapObject.type == "box") {

                    const mod = 1;
                    const scale = mapObject.size;
                    scale.x /= mod;
                    scale.y /= mod;
                    scale.z /= mod;
                    scale.x = Math.round(scale.x);
                    scale.y = Math.round(scale.y);
                    scale.z = Math.round(scale.z);
                    const position = mapObject.position;
                    position.x /= mod;
                    position.y /= mod;
                    position.z /= mod;
                    position.x = Math.round(position.x);
                    position.y = Math.round(position.y);
                    position.z = Math.round(position.z);
                    const color = mapObject.color;

                    // shift position (to center it)
                    position.x -= scale.x / 2;
                    position.y -= scale.y / 2;
                    position.z -= scale.z / 2;

                    // Lights
                    if (mapObject.isLight == true) {
                        // create a point light at this position with mapObject.lightBrightness
                        const light = new BABYLON.PointLight("pointLight", new BABYLON.Vector3(position.x + (scale.x / 2), position.y + (scale.y / 2) - 1, position.z + (scale.z / 2)), scene);
                        light.intensity = mapObject.lightBrightness / 5000;
                        return;
                    }

                    //                     // Enemy NPCs
                    //                     if (mapObject.isEnemyNPC && mapObject.isEnemyNPC == true) {
                    //                         const thisNPC = new NPC(
                    //                             'swat',
                    //                             'character_models/swat_idle.png',
                    //                             new THREE.Vector3(position.x, position.y, position.z),
                    //                             new THREE.Vector3(
                    //                                 0,
                    //                                 mapObject.rotation.y - Math.PI / 2,
                    //                                 0
                    //                             ),
                    //                             100 + Math.random() * 100,
                    //                             100);
                    //                         return;
                    //                     }

                    //                     // Normal Objects (Boxes)
                    buildWorldModelFromBox(scale, position, mapObject.material, color, mapObject.lightBrightness, mapObject.interactionEvent);
                }
            });
            //             // get rid of the pump cover
            //             engineDoneLoadingWorld = true;
            //             document.querySelector("#loader-bg").style.animation = "fade-out 0.25s ease";
            //             setTimeout(() => { 
            //  document.querySelector("#loader-bg").remove() }, 250);
            //                  loaderRemoved = true;
        });
    });
}