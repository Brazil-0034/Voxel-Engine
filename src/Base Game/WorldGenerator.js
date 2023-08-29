// Imports
const { ipcRenderer } = require('electron');
import { addToCutawayStack, BoxData, VoxelChunk, VoxelFace, voxelField, cutawayField } from './VoxelStructures.js';
import { getPixelsFromImage } from './CanvasPixelReader.js';
import { rapidFloat } from './EngineMath.js'; // math functions
import * as THREE from 'three';

import { LightProbeGenerator } from 'three/addons/lights/LightProbeGenerator.js';
import { LightProbeHelper } from 'three/addons/helpers/LightProbeHelper.js';

// ##########
// ENVIRONMENT LIGHTING SETUP
// ##########
const lightProbe = new THREE.LightProbe();
const cubeRenderTarget = new THREE.WebGLCubeRenderTarget( 256 );
const cubeCamera = new THREE.CubeCamera( 1, 1000, cubeRenderTarget );

// ##########
// World Generation
// ##########

// Maximum size for chunking
// Lower size = fewer chunks
// It is best to alter this dynamically between maps for performance
// TODO implement some algorithm to determine this value on the fly
const squareChunkSize = 64;
export const instancedWorldSafetyOffset = new THREE.Vector3(-10000, -10000, -10000); // to account for memory issues when rendering the dead point ... i know it's messy, but it is the most widely compatible solution. sue me.

let itemsBuiltSoFar = 0, itemsToBuild = 0;

export const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);
export const voxelMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff
});
voxelMaterial.dithering = true;

export const generateWorld = function (modelURL, LEVELHANDLER, USERSETTINGS, worldSphere) {

    LEVELHANDLER.scene.add(lightProbe);

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
            LEVELHANDLER.camera.position.set(mapCameraData.position.x, LEVELHANDLER.playerHeight, mapCameraData.position.z);
            LEVELHANDLER.camera.rotation.set(mapCameraData.rotation.x, mapCameraData.rotation.y, mapCameraData.rotation.z);

            const groundData = JSON.parse(arg.metaData).groundData;
            const groundColor = new THREE.Color(groundData.groundColor.r, groundData.groundColor.g, groundData.groundColor.b);
            worldSphere.material.color = groundColor;
            if (groundData) {
                const groundFloor = new THREE.Mesh(
                    new THREE.BoxGeometry(groundData.groundSize.x, 1, groundData.groundSize.y),
                    new THREE.MeshBasicMaterial({
                        color: groundColor,
                    })
                );
                groundFloor.position.y = -1; // we set it just below the origin, to act as a floor
                // scene.add(groundFloor);
            }

            const mapObjects = JSON.parse(arg.metaData).mapMakerSave;
            const mapLights = JSON.parse(arg.metaData).lightData;
            const mod = 1; // scale modifier

            // Filter 0: Count Boxes
            mapObjects.forEach(mapObject => {
                if (mapObject.type == "box" && mapObject.isCutaway != true && mapObject.isEnemyNPC != true) {
                    itemsToBuild++;
                }
            });
            if (itemsToBuild == 0) removeLoader();

            // Filter 1: Cutaways
            // These must be processed BEFORE boxes, but by nature can exist in save files in random order
            mapObjects.forEach(mapObject => {
                if (mapObject.type == "box" && mapObject.isCutaway == true) {
                    const cutawaySize = mapObject.size;
                    cutawaySize.x /= mod;
                    cutawaySize.y /= mod;
                    cutawaySize.z /= mod;
                    const cutawayPosition = mapObject.position;
                    cutawayPosition.x /= mod;
                    cutawayPosition.y /= mod;
                    cutawayPosition.z /= mod;
                    addToCutawayStack(cutawaySize, cutawayPosition);
                }
            });

            // Filter 2: Boxes
            // These are the most standard world object, and are the quickest to process
            mapObjects.forEach(mapObject => {
                if (mapObject.type == "box") {

                    if (mapObject.isCutaway && mapObject.isCutaway == true) return;

                    const scale = mapObject.size;
                    scale.x /= mod;
                    scale.y /= mod;
                    scale.z /= mod;
                    const position = mapObject.position;
                    position.x /= mod;
                    position.y /= mod;
                    position.z /= mod;
                    const color = mapObject.color;

                    // shift position (to center it)
                    position.x -= scale.x / 2;
                    position.y -= scale.y / 2;
                    position.z -= scale.z / 2;

                    // Lights
                    let light = null;
                    if (mapObject.isLight && mapObject.isLight == true) {
                        // create a point light at this position with mapObject.lightBrightness
                        light = new THREE.PointLight(new THREE.Color(color.r, color.g, color.b), mapObject.lightBrightness, 0, 2);
                        light.position.set(position.x + (scale.x / 2), position.y + (scale.y / 2) - 1, position.z + (scale.z / 2));
                        light.decay = 1.15;
                        LEVELHANDLER.scene.add(light);
                    }

                    // Enemy NPCs
                    if (mapObject.isEnemyNPC && mapObject.isEnemyNPC == true) {
                        // sometimes -0 (or a number close to it) is actually 180 deg, so we need to account for that
                        if (mapObject.rotation.y < 0.1 && mapObject.rotation.y > -0.1) mapObject.rotation.y = Math.PI;
                        const thisNPC = new NPC(
                            'swat',
                            '../character_models/swat_idle.png',
                            new THREE.Vector3(position.x, position.y, position.z),
                            new THREE.Vector3(
                                0,
                                mapObject.rotation.y - Math.PI / 2,
                                0
                            ),
                            100 + rapidFloat() * 100,
                            25,
                            LEVELHANDLER,
                            voxelField,
                            WEAPONHANDLER,
                            new Howl({
                                src: ['../sfx/kill_ding.wav'],
                                volume: USERSETTINGS.SFXVolume * 7.5
                            })
                        );
                        return;
                    }
                    
                    buildWorldModelFromBox(LEVELHANDLER, USERSETTINGS, scale, position, mapObject.material, color, mapObject.lightBrightness, mapObject.interactionEvent, light);
                }
            });
        });
    });
}


const buildWorldModelFromBox = function (LEVELHANDLER, USERSETTINGS, scale, position, material, colorData, lightBrightness = 0, interactionEvent, light) {
    let buildFront = true, buildBack = true, buildLeft = true, buildRight = true, buildTop = true, buildBottom = true;

    if (scale.x > 2) scale.x -= 1;
    if (scale.y > 2) scale.y -= 1;
    if (scale.z > 2) scale.z -= 1;

    const chunkConnector = new BoxData();

    // Interactions
    if (interactionEvent != "none" || USERSETTINGS.blockoutMode == true) {
        // box (for raycasting)
        const interactionBox = new THREE.Mesh(
            voxelGeometry,
            voxelMaterial
        );
        interactionBox.position.set(position.x + (scale.x / 2), position.y + (scale.y / 2), position.z + (scale.z / 2));
        interactionBox.scale.set(scale.x, scale.y, scale.z);
        interactionBox.visible = USERSETTINGS.blockoutMode;
        LEVELHANDLER.scene.add(interactionBox);

        interactionBox.interactionEvent = interactionEvent;

        interactableObjects.push(interactionBox);
    }
    if (USERSETTINGS.blockoutMode) return;

    const texturePath = '../textures/' + material + '.png';
    const manager = new THREE.LoadingManager();
    let pixelData;
    manager.onLoad = function () {
        pixelData = getPixelsFromImage(pixelData.image);
        const getPixelColorAt = function (x, y) {
            // pixelData is 32 arrays of 32. Each array is a row of pixels
            // x and y can be beyond 32, but it will wrap around
            x = x % 32;
            y = y % 32;
            let data = pixelData[x][y];
            const voxelColor = new THREE.Color(data[0] / 255, data[1] / 255, data[2] / 255);
            voxelColor.convertSRGBToLinear();
            return voxelColor;
        }

        // compute the chunk
        var debugModeChunkColor = new THREE.Color(0xffffff * rapidFloat());
        let chunkCounter = 0;
        var chunkMinPosition, chunkMaxPosition;
        const resetChunkBounds = function () {
            // For every chunk ...
            chunkMinPosition = new THREE.Vector3(
                Number.MAX_SAFE_INTEGER,
                Number.MAX_SAFE_INTEGER,
                Number.MAX_SAFE_INTEGER
            );
            chunkMaxPosition = new THREE.Vector3(
                Number.MIN_SAFE_INTEGER,
                Number.MIN_SAFE_INTEGER,
                Number.MIN_SAFE_INTEGER
            );
        }
        resetChunkBounds();

        // color of tha box (both instance and cover)
        const boxColor = new THREE.Color(colorData.r, colorData.g, colorData.b);

        let instancedWorldModel, localVoxelIterator;
        const resetInstancedWorldModel = function () {
            // Compute counts ...
            let isSmall = false;
            if (scale.x < squareChunkSize && scale.y < squareChunkSize && scale.z < squareChunkSize) isSmall = true;
            // Setup the model ...
            instancedWorldModel = new VoxelChunk(
                voxelGeometry,
                voxelMaterial.clone(),
                isSmall ? 2 * (squareChunkSize * squareChunkSize) : squareChunkSize * squareChunkSize,
                LEVELHANDLER
            );
            instancedWorldModel.material.emissive = boxColor;
            instancedWorldModel.material.emissiveIntensity = lightBrightness;
            instancedWorldModel.visible = false;
            instancedWorldModel.position.copy(instancedWorldSafetyOffset);
            instancedWorldModel.name = chunkCounter.toString();
            instancedWorldModel.isSideChunk = false;
            if (light != null) instancedWorldModel.attachedLight = light;
            // Update Counters
            localVoxelIterator = 0;
            chunkCounter++;
            // Manual Culling Adjustment
            instancedWorldModel.frustumCulled = false;
        }
        resetInstancedWorldModel();

        const numFullChunks = Math.floor(scale.x / squareChunkSize) * Math.floor(scale.y / squareChunkSize) * Math.floor(scale.z / squareChunkSize);

        const finalizeChunk = function (voxelFace, isAbnormal = false) {

            // // For Frustum Culling...
            instancedWorldModel.frustumBox = new THREE.Box3();
            instancedWorldModel.frustumBox.setFromCenterAndSize(
                // Determine Center
                new THREE.Vector3(
                    (chunkMinPosition.x + chunkMaxPosition.x) / 2,
                    (chunkMinPosition.y + chunkMaxPosition.y) / 2,
                    (chunkMinPosition.z + chunkMaxPosition.z) / 2
                ),
                // Determine Size
                new THREE.Vector3(
                    (chunkMaxPosition.x - chunkMinPosition.x),
                    (chunkMaxPosition.y - chunkMinPosition.y),
                    (chunkMaxPosition.z - chunkMinPosition.z)
                )
            );

            instancedWorldModel.instanceMatrix.needsUpdate = true;
            LEVELHANDLER.scene.add(instancedWorldModel);

            chunkConnector.addChunk(instancedWorldModel);
            instancedWorldModel.isSideChunk = false;
            if (scale.x < squareChunkSize && scale.y < squareChunkSize && scale.z < squareChunkSize) {
                // If the chunk is smaller than the maximum chunk size, we can just add it to the scene
                // push to registry & add to scene
                instancedWorldModel.visible = true;
                return;
            }

            instancedWorldModel.visible = false;

            debugModeChunkColor = new THREE.Color(0xffffff * Math.random());
            // createa  wireframe box to visualize the frustum box
            // const frustumBoxHelper = new THREE.Box3Helper(instancedWorldModel.frustumBox, 0xffff00);
            // scene.add(frustumBoxHelper);

            // create a cover box with the same dimensions and position as the frustum box
            const coverBox = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1),
                new THREE.MeshLambertMaterial({
                    map: texture,
                    side: THREE.DoubleSide,
                    color: boxColor,
                    emissive: boxColor,
                    emissiveIntensity: lightBrightness
                })
            );
            coverBox.material.dithering = true;

            // box.material.map.repeat.set(squareChunkSize,squareChunkSize);
            if (USERSETTINGS.debugMode) {
                coverBox.material.color = debugModeChunkColor;
                coverBox.material.emissive = debugModeChunkColor;
            }
            coverBox.material.map.wrapS = THREE.RepeatWrapping;
            coverBox.material.map.wrapT = THREE.RepeatWrapping;
            coverBox.material.map.magFilter = THREE.NearestFilter;
            coverBox.material.map.minFilter = THREE.NearestFilter;
            instancedWorldModel.frustumBox.getCenter(coverBox.position);
            coverBox.material.map = texture.clone();
            coverBox.material.map.repeat.set(
                squareChunkSize / 32,
                squareChunkSize / 32 // 32 is the texture resolution, so it is the [size (in world units) of the chunk / size of the texture]
            );

            // color the coverbox material.color depending on the voxelface
            // if (voxelFace == VoxelFace.TOP) {
            // 	coverBox.material.color = new THREE.Color(0x00ff00);
            // } else if (voxelFace == VoxelFace.BOTTOM) {
            // 	coverBox.material.color = new THREE.Color(0xff0000);
            // } else if (voxelFace == VoxelFace.LEFT) {
            // 	coverBox.material.color = new THREE.Color(0x0000ff);
            // } else if (voxelFace == VoxelFace.RIGHT) {
            // 	coverBox.material.color = new THREE.Color(0xffff00);
            // } else if (voxelFace == VoxelFace.FRONT) {
            // 	coverBox.material.color = new THREE.Color(0x00ffff);
            // } else if (voxelFace == VoxelFace.BACK) {
            // 	coverBox.material.color = new THREE.Color(0xff00ff);
            // }

            if (instancedWorldModel.useCoverBox != false)
            {
                let subBox; // switch cases require parent block scoped variables? guess i don kno much about js ... or coding ... or life
                // whose idea to make this in js was it anyway??
                switch (voxelFace) {
                    default:
                        console.error("Invalid VoxelFace: " + voxelFace);
                        return;
                    case VoxelFace.TOP:
                        coverBox.position.y += 0.5
                    case VoxelFace.BOTTOM:
                        if (voxelFace == VoxelFace.BOTTOM) coverBox.position.y -= 0.5;
                        coverBox.scale.set(
                            instancedWorldModel.frustumBox.max.x - instancedWorldModel.frustumBox.min.x + 1,
                            instancedWorldModel.frustumBox.max.z - instancedWorldModel.frustumBox.min.z + 1
                        );
                        coverBox.material.map.repeat.multiply(
                            new THREE.Vector2(
                                (coverBox.scale.x / (squareChunkSize)),
                                (coverBox.scale.y / (squareChunkSize))
                            )
                        );
                        if (coverBox.scale.y < squareChunkSize) {
                            // CENTERS:
                            // default (0,0) bottom left
                            coverBox.material.map.center.set(1, 1);
                            instancedWorldModel.isSideChunk = true;
                        }
                        if (coverBox.scale.x < squareChunkSize) {
                            // CENTERS:
                            // default (0,0) bottom left
                            coverBox.material.map.center.set(0, 1);
                            instancedWorldModel.isSideChunk = true;
                        }
                        
                        if (!instancedWorldModel.isSideChunk) LEVELHANDLER.potentialCleanCalls += 1;

                        coverBox.rotation.x = -Math.PI / 2;

                        instancedWorldModel.addCoverBox(coverBox);
                        LEVELHANDLER.scene.add(coverBox);
                        break;
                    case VoxelFace.LEFT:
                        coverBox.position.x -= 0.5 - 0.01;
                    case VoxelFace.RIGHT:
                        if (voxelFace == VoxelFace.RIGHT) coverBox.position.x += 0.5 + 0.01;
                        // coverBox.position.y += 1;
                        coverBox.scale.set(
                            instancedWorldModel.frustumBox.max.z - instancedWorldModel.frustumBox.min.z + 1,
                            instancedWorldModel.frustumBox.max.y - instancedWorldModel.frustumBox.min.y + 1
                        );
                        coverBox.material.map.repeat.multiply(
                            new THREE.Vector2(
                                (coverBox.scale.y / (squareChunkSize)),
                                -(coverBox.scale.x / (squareChunkSize))
                            )
                        );
                        if (coverBox.scale.x < squareChunkSize) {
                            // CENTERS:
                            // default (0,0) bottom left
                            coverBox.material.map.center.set(1, 1);
                            instancedWorldModel.isSideChunk = true;
                        }
                        if (coverBox.scale.y < squareChunkSize) {
                            // CENTERS:
                            // default (0,0) bottom left
                            coverBox.material.map.center.set(1, 0);
                            instancedWorldModel.isSideChunk = true;
                        }

                        if (!instancedWorldModel.isSideChunk) LEVELHANDLER.potentialCleanCalls += 1;

                        coverBox.material.map.rotation = Math.PI / 2;
                        coverBox.rotation.y = Math.PI / 2;

                        instancedWorldModel.addCoverBox(coverBox);
                        LEVELHANDLER.scene.add(coverBox);
                        break;
                    case VoxelFace.FRONT:
                        coverBox.position.z -= 0.5 - 0.01;
                    case VoxelFace.BACK:
                        if (voxelFace == VoxelFace.BACK) coverBox.position.z += 0.5 + 0.01;
                        coverBox.scale.set(
                            instancedWorldModel.frustumBox.max.x - instancedWorldModel.frustumBox.min.x + 1,
                            instancedWorldModel.frustumBox.max.y - instancedWorldModel.frustumBox.min.y + 1
                        );
                        coverBox.material.map.repeat.multiply(
                            new THREE.Vector2(
                                -(coverBox.scale.x / (squareChunkSize)),
                                -(coverBox.scale.y / (squareChunkSize))
                            )
                        );

                        if (coverBox.scale.x < squareChunkSize) {
                            // CENTERS:
                            // default (0,0) bottom left
                            coverBox.material.map.center.set(1, 1);
                            instancedWorldModel.isSideChunk = true;
                        }
                        if (coverBox.scale.y < squareChunkSize) {
                            // CENTERS:
                            // default (0,0) bottom left
                            coverBox.material.map.center.set(1, 0);
                            instancedWorldModel.isSideChunk = true;
                        }
                        
                        if (!instancedWorldModel.isSideChunk) LEVELHANDLER.potentialCleanCalls += 1;

                        coverBox.rotation.y = Math.PI;

                        instancedWorldModel.addCoverBox(coverBox);
                        LEVELHANDLER.scene.add(coverBox);
                        break;
                }
                // coverBox.visible = false;
                // if (instancedWorldModel.isSideChunk == true) coverBox.material.color = new THREE.Color(0xff0000);
                LEVELHANDLER.numCoverBoxes++;
            }
            else
            {
                instancedWorldModel.isCovered = false;
                instancedWorldModel.visible = true;
            }

            // Reset Everything!!
            resetChunkBounds();
            resetInstancedWorldModel();

            }
        
        const setVoxel = function (voxelPosition, voxelFace, voxelColor) {
            // set voxelColor based on the voxelFace
            // first, check if a voxel already exists here OR if a cutaway voids voxels from existing here
            voxelPosition = voxelPosition.round();
            if (cutawayField.get(voxelPosition.x, voxelPosition.y, voxelPosition.z) != null) {
                instancedWorldModel.useCoverBox = false;
                return
            }
            const voxel = voxelField.get(voxelPosition.x, voxelPosition.y, voxelPosition.z);
            chunkMinPosition.min(voxelPosition);
            chunkMaxPosition.max(voxelPosition);
            if (voxel != null) {
                // removing  clones ...
                voxelPosition.copy(instancedWorldSafetyOffset);
            }
            // Commit to the global voxel field
            // update min/max positions for this chunk (for culling)
            voxelField.set(voxelPosition.x, voxelPosition.y, voxelPosition.z, 1, localVoxelIterator, instancedWorldModel, voxelFace);
            instancedWorldModel.setMatrixAt(localVoxelIterator, new THREE.Matrix4().setPosition(new THREE.Vector3(voxelPosition.x - instancedWorldSafetyOffset.x, voxelPosition.y - instancedWorldSafetyOffset.y, voxelPosition.z - instancedWorldSafetyOffset.z)));
            voxelColor.multiply(colorData);
            if (USERSETTINGS.debugMode == true) voxelColor = debugModeChunkColor;
            // if (voxelFace == VoxelFace.FRONT) voxelColor = new THREE.Color(0xff0000)
            // if (voxelFace == VoxelFace.LEFT) voxelColor = new THREE.Color(0x00ff00)
            instancedWorldModel.setColorAt(localVoxelIterator, voxelColor);
            localVoxelIterator++;
            // check if we need to create a new chunk
            LEVELHANDLER.numVoxels++;
        }

        // Create the ROOF (top) of the box:
        if (buildTop == true)
        {
            for (let x = 0; x < Math.ceil(scale.x / squareChunkSize); x++) {
                for (let z = 0; z < Math.ceil(scale.z / squareChunkSize); z++) {
                    let isFullChunk = true;
                    let thisChunkSizeX = squareChunkSize;
                    let thisChunkSizeZ = squareChunkSize;
                    for (let i = 0; i < thisChunkSizeX; i++) {
                        for (let j = 0; j < thisChunkSizeZ; j++) {
                            const voxelPosition = new THREE.Vector3(position.x + x * squareChunkSize + i, position.y + scale.y, position.z + z * squareChunkSize + j);
                            // if the point is within the box:
                            if (voxelPosition.x >= position.x && voxelPosition.x <= position.x + scale.x && voxelPosition.z >= position.z && voxelPosition.z <= position.z + scale.z) {
                                // we set the voxel at this position
                                setVoxel(voxelPosition, VoxelFace.TOP, getPixelColorAt(x * thisChunkSizeX + i, z * thisChunkSizeZ + j));
                            }
                            else {
                                isFullChunk = false;
                            }
                        }
                    }

                    // we finalize this chunk
                    finalizeChunk(VoxelFace.TOP, !isFullChunk);
                }
            }
        }

        if (buildRight == true)
        {
            // Create the RIGHT WALL of the box:
            for (let y = 0; y < Math.ceil(scale.y / squareChunkSize); y++) {
                for (let z = 0; z < Math.ceil(scale.z / squareChunkSize); z++) {
                    let isFullChunk = true;
                    let thisChunkSizeY = squareChunkSize;
                    let thisChunkSizeZ = squareChunkSize;
                    for (let i = 0; i < thisChunkSizeY; i++) {
                        for (let j = 0; j < thisChunkSizeZ; j++) {
                            const voxelPosition = new THREE.Vector3(position.x + scale.x, position.y + y * squareChunkSize + i, position.z + z * squareChunkSize + j);
                            // if the point is within the box:
                            if (voxelPosition.y >= position.y && voxelPosition.y <= position.y + scale.y && voxelPosition.z >= position.z && voxelPosition.z <= position.z + scale.z) {
                                // we set the voxel at this position
                                setVoxel(voxelPosition, VoxelFace.RIGHT, getPixelColorAt(y * thisChunkSizeY + i, z * thisChunkSizeZ + j));
                            }
                            else {
                                isFullChunk = false;
                            }
                        }
                    }

                    // we finalize this chunk
                    finalizeChunk(VoxelFace.RIGHT, !isFullChunk);
                }
            }
        }

        if (buildBack == true)
        {
            // Create the BACK WALL of the box:
            for (let x = 0; x < Math.ceil(scale.x / squareChunkSize); x++) {
                for (let y = 0; y < Math.ceil(scale.y / squareChunkSize); y++) {
                    let isFullChunk = true;
                    let thisChunkSizeX = squareChunkSize;
                    let thisChunkSizeY = squareChunkSize;
                    for (let i = 0; i < thisChunkSizeX; i++) {
                        for (let j = 0; j < thisChunkSizeY; j++) {
                            const voxelPosition = new THREE.Vector3(position.x + x * squareChunkSize + i, position.y + y * squareChunkSize + j, position.z + scale.z);
                            // if the point is within the box:
                            if (voxelPosition.x >= position.x && voxelPosition.x <= position.x + scale.x && voxelPosition.y >= position.y && voxelPosition.y <= position.y + scale.y) {
                                // we set the voxel at this position
                                setVoxel(voxelPosition, VoxelFace.BACK, getPixelColorAt(x * thisChunkSizeX + i, y * thisChunkSizeY + j));
                            }
                            else {
                                isFullChunk = false;
                            }
                        }
                    }

                    // we finalize this chunk
                    finalizeChunk(VoxelFace.BACK, !isFullChunk);
                }
            }
        }

        if (buildFront == true)
        {
            // Create the FRONT WALL of the box:
            for (let x = 0; x < Math.ceil(scale.x / squareChunkSize); x++) {
                for (let y = 0; y < Math.ceil(scale.y / squareChunkSize); y++) {
                    let isFullChunk = true;
                    let thisChunkSizeX = squareChunkSize;
                    let thisChunkSizeY = squareChunkSize;
                    for (let i = 0; i < thisChunkSizeX; i++) {
                        for (let j = 0; j < thisChunkSizeY; j++) {
                            const voxelPosition = new THREE.Vector3(position.x + x * squareChunkSize + i, position.y + y * squareChunkSize + j, position.z);
                            // if the point is within the box:
                            if (voxelPosition.x >= position.x && voxelPosition.x <= position.x + scale.x && voxelPosition.y >= position.y && voxelPosition.y <= position.y + scale.y) {
                                // we set the voxel at this position
                                setVoxel(voxelPosition, VoxelFace.FRONT, getPixelColorAt(x * thisChunkSizeX + i, y * thisChunkSizeY + j));
                            }
                            else {
                                isFullChunk = false;
                            }
                        }
                    }

                    // we finalize this chunk
                    finalizeChunk(VoxelFace.FRONT, !isFullChunk);
                }
            }
        }

        if (buildLeft == true)
        {
            // Create the LEFT WALL of the box:
            for (let y = 0; y < Math.ceil(scale.y / squareChunkSize); y++) {
                for (let z = 0; z < Math.ceil(scale.z / squareChunkSize); z++) {
                    let isFullChunk = true;
                    let thisChunkSizeY = squareChunkSize;
                    let thisChunkSizeZ = squareChunkSize;
                    for (let i = 0; i < thisChunkSizeY; i++) {
                        for (let j = 0; j < thisChunkSizeZ; j++) {
                            const voxelPosition = new THREE.Vector3(position.x, position.y + y * squareChunkSize + i, position.z + z * squareChunkSize + j);
                            // if the point is within the box:
                            if (voxelPosition.y >= position.y && voxelPosition.y <= position.y + scale.y && voxelPosition.z >= position.z && voxelPosition.z <= position.z + scale.z) {
                                // we set the voxel at this position
                                setVoxel(voxelPosition, VoxelFace.LEFT, getPixelColorAt(y * thisChunkSizeY + i, z * thisChunkSizeZ + j));
                            }
                            else {
                                isFullChunk = false;
                            }
                        }
                    }

                    // we finalize this chunk
                    finalizeChunk(VoxelFace.LEFT, !isFullChunk);
                }
            }
        }

        if (buildBottom == true)
        {
            // Create the FLOOR (bottom) of the box:
            for (let x = 0; x < Math.ceil(scale.x / squareChunkSize); x++) {
                for (let z = 0; z < Math.ceil(scale.z / squareChunkSize); z++) {
                    let isFullChunk = true;
                    let thisChunkSizeX = squareChunkSize;
                    let thisChunkSizeZ = squareChunkSize;
                    for (let i = 0; i < thisChunkSizeX; i++) {
                        for (let j = 0; j < thisChunkSizeZ; j++) {
                            const voxelPosition = new THREE.Vector3(position.x + x * squareChunkSize + i, position.y, position.z + z * squareChunkSize + j);
                            // if the point is within the box:
                            if (voxelPosition.x >= position.x && voxelPosition.x <= position.x + scale.x && voxelPosition.z >= position.z && voxelPosition.z <= position.z + scale.z) {
                                // we set the voxel at this position
                                setVoxel(voxelPosition, VoxelFace.BOTTOM, getPixelColorAt(x * thisChunkSizeX + i, z * thisChunkSizeZ + j));
                            }
                            else {
                                isFullChunk = false;
                            }
                        }
                    }

                    // we finalize this chunk
                    finalizeChunk(VoxelFace.BOTTOM, !isFullChunk);
                }
            }
        }

        itemsBuiltSoFar++;
        document.querySelector("#loader").textContent = Math.round((itemsBuiltSoFar/itemsToBuild)*100) + "%";
        console.log(itemsBuiltSoFar, itemsToBuild)
        // When all objects are finished loading ...
        if (itemsBuiltSoFar >= itemsToBuild) {
            // Remove the Pump Cover
            const loader = document.querySelector("#loader-bg");
            loader.style.animation = "fade-out 1s ease";
            setTimeout(() => { loader.parentNode.removeChild(loader) }, 1000);

            // Update the light probe !!!
            cubeCamera.update(LEVELHANDLER.renderer,LEVELHANDLER.scene);
            lightProbe.copy(LightProbeGenerator.fromCubeRenderTarget(LEVELHANDLER.renderer, cubeRenderTarget));
        }

    };
    const loader = new THREE.TextureLoader(manager);
    const texture = loader.load(texturePath, (texture) => {
        texture.encoding = THREE.sRGBEncoding;
        pixelData = texture;
    });
}

const buildWorldModelFromSphere = function (position, scale, color) {
    // TODO
}