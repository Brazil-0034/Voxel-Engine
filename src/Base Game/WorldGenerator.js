// Imports
const { ipcRenderer } = require('electron');
import { addToCutawayStack, BoxData, VoxelChunk, VoxelFace, voxelField, cutawayField } from './VoxelStructures.js';
import { getPixelsFromImage } from './CanvasPixelReader.js';
import { rapidFloat, createVizSphere } from './EngineMath.js'; // math functions
import { instancedModelIndex } from './LevelHandler.js'; // for frustum
import { NPC } from './NPC.js'; // non-player characters (NPCs)
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

export const generateWorld = function (modelURL, LEVELHANDLER, USERSETTINGS, WEAPONHANDLER, worldSphere) {

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
                if (mapObject.isCutaway != true && mapObject.isEnemyNPC != true) {
                    itemsToBuild++;
                }
            });
            if (itemsToBuild == 0) removeLoader();

            // Filter 1: Cutaways
            // These must be processed BEFORE boxes, but by nature can exist in save files in random order
            mapObjects.forEach(mapObject => {
                if (mapObject.isCutaway == true) {
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
                
                buildWorldModelFromBox(LEVELHANDLER, USERSETTINGS, mapObject.type, scale, position, mapObject.material, color, mapObject.lightBrightness, mapObject.interactionEvent, light);
            });
        });
    });
}


const buildWorldModelFromBox = function (LEVELHANDLER, USERSETTINGS, boxType, scale, position, material, colorData, lightBrightness = 0, interactionEvent, light) {

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
            // Determine Instance Count
            let count = (2 * scale.x) + (2 * scale.y) + (2 * scale.z);
            if (boxType == "Wall" || boxType == "Floor") count = 64 * 64 * 2; // 2 is the wall depth
            // Setup the model ...
            instancedWorldModel = new VoxelChunk(
                voxelGeometry,
                voxelMaterial.clone(),
                count,
                LEVELHANDLER
            );
            instancedWorldModel.material.emissive = boxColor;
            instancedWorldModel.material.emissiveIntensity = lightBrightness;
            instancedWorldModel.visible = false;
            instancedWorldModel.position.copy(instancedWorldSafetyOffset);
            instancedWorldModel.name = chunkCounter.toString();
            if (light != null) instancedWorldModel.attachedLight = light;
            // Update Counters
            localVoxelIterator = 0;
            chunkCounter++;
            // Manual Culling Adjustment
            instancedWorldModel.frustumCulled = false;
        }
        resetInstancedWorldModel();

        // ############
        // IMESHING
        // ############

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
        coverBox.material.map.repeat.set(
            squareChunkSize / 32,
            squareChunkSize / 32 // 32 is the texture resolution, so it is the [size (in world units) of the chunk / size of the texture]
        );

        const setMaterialProperties = function(obj) {
            obj.material.map.wrapS = THREE.RepeatWrapping;
            obj.material.map.wrapT = THREE.RepeatWrapping;
            obj.material.map.magFilter = THREE.NearestFilter;
            obj.material.map.minFilter = THREE.NearestFilter;
            // obj.material.color = new THREE.Color(0xffffff * Math.random());
        }

        // --- FRONT COVER:
        let frontBoxCount = scale.x;
        if (scale.z > scale.x) frontBoxCount = scale.z;
        const frontCoverBoxIMesh = new THREE.InstancedMesh(
            coverBox.geometry,
            coverBox.material.clone(),
            Math.ceil(frontBoxCount / 64)
        );
        setMaterialProperties(frontCoverBoxIMesh);
        let frontCoverBoxIMeshIterator = 0;
        LEVELHANDLER.scene.add(frontCoverBoxIMesh);

        // --- BACK COVER:
        let backBoxCount = scale.x;
        if (scale.z > scale.x) backBoxCount = scale.z;
        const backCoverBoxIMesh = new THREE.InstancedMesh(
            coverBox.geometry,
            coverBox.material.clone(),
            Math.ceil(backBoxCount / 64)
        );
        setMaterialProperties(backCoverBoxIMesh);
        let backCoverBoxIMeshIterator = 0;
        LEVELHANDLER.scene.add(backCoverBoxIMesh);

        // -- LEFT COVER
        let leftBoxCount = scale.x;
        if (scale.z > scale.x) leftBoxCount = scale.z;
        const leftCoverBoxIMesh = new THREE.InstancedMesh(
            coverBox.geometry,
            coverBox.material.clone(),
            Math.ceil(leftBoxCount / 64)
        );
        setMaterialProperties(leftCoverBoxIMesh);
        let leftCoverBoxIMeshIterator = 0;
        LEVELHANDLER.scene.add(leftCoverBoxIMesh);

        // -- RIGHT COVER
        let rightBoxCount = scale.x;
        if (scale.z > scale.x) rightBoxCount = scale.z;
        const rightCoverBoxIMesh = new THREE.InstancedMesh(
            coverBox.geometry,
            coverBox.material.clone(),
            Math.ceil(rightBoxCount / 64)
        );
        setMaterialProperties(rightCoverBoxIMesh);
        let rightCoverBoxIMeshIterator = 0;
        LEVELHANDLER.scene.add(rightCoverBoxIMesh);

        // -- TOP COVER
        let topBoxCount = scale.x;
        if (scale.z > scale.x) topBoxCount = scale.z;
        if (boxType == "Floor") topBoxCount = scale.x * scale.z;
        const topCoverBoxIMesh = new THREE.InstancedMesh(
            coverBox.geometry,
            coverBox.material.clone(),
            Math.ceil(topBoxCount / 64)
        );
        setMaterialProperties(topCoverBoxIMesh);
        let topCoverBoxIMeshIterator = 0;
        LEVELHANDLER.scene.add(topCoverBoxIMesh);

        // -- BOTTOM COVER
        let bottomBoxCount = scale.x;
        if (scale.z > scale.x) bottomBoxCount = scale.z;
        if (boxType == "Floor") bottomBoxCount = scale.x * scale.z;
        const bottomCoverBoxIMesh = new THREE.InstancedMesh(
            coverBox.geometry,
            coverBox.material.clone(),
            Math.ceil(bottomBoxCount / 64)
        );
        setMaterialProperties(bottomCoverBoxIMesh);
        let bottomCoverBoxIMeshIterator = 0;
        LEVELHANDLER.scene.add(bottomCoverBoxIMesh);

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
            // const frustumBoxHelper = new THREE.Box3Helper(instancedWorldModel.frustumBox, 0xffff00);
            // LEVELHANDLER.scene.add(frustumBoxHelper);

            instancedModelIndex.push(instancedWorldModel);

            instancedWorldModel.instanceMatrix.needsUpdate = true;
            instancedWorldModel.visible = false;
            
            LEVELHANDLER.scene.add(instancedWorldModel);
            chunkConnector.addChunk(instancedWorldModel);

            debugModeChunkColor = new THREE.Color(0xffffff * Math.random());
            if (USERSETTINGS.debugMode) {
                coverBox.material.color = debugModeChunkColor;
                coverBox.material.emissive = debugModeChunkColor;
            }

            // for FLOORS, we do not need a left/right/front/back voxelface, just a top
            if (boxType == "Floor") {
                if (voxelFace != VoxelFace.TOP && voxelFace != VoxelFace.BOTTOM) {
                    // LEVELHANDLER.scene.remove(instancedWorldModel);
                    // instancedWorldModel.material.dispose();
                    resetChunkBounds();
                    resetInstancedWorldModel();
                    return;
                }
            }

            if (instancedWorldModel.useCoverBox != false)
            {
                switch (voxelFace) {
                    default:
                        console.error("Invalid VoxelFace: " + voxelFace);
                        return;
                    case VoxelFace.TOP:
                        if (boxType == "Wall") instancedWorldModel.isSideChunk = true;
                        topCoverBoxIMesh.setMatrixAt(topCoverBoxIMeshIterator, new THREE.Matrix4().compose(
                            new THREE.Vector3(
                                (chunkMinPosition.x + chunkMaxPosition.x) / 2,
                                chunkMaxPosition.y + 0.5,
                                (chunkMinPosition.z + chunkMaxPosition.z) / 2
                            ),
                            new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2, Math.PI, Math.PI)),
                            new THREE.Vector3(
                                (chunkMaxPosition.x - chunkMinPosition.x) + 1,
                                (chunkMaxPosition.z - chunkMinPosition.z) + 1,
                                1
                            )
                        ));

                        instancedWorldModel.addInstancedCoverBox(topCoverBoxIMesh, topCoverBoxIMeshIterator);
                        topCoverBoxIMeshIterator++;
                        break;
                    case VoxelFace.BOTTOM:
                        if (boxType == "Wall") instancedWorldModel.isSideChunk = true;
                        bottomCoverBoxIMesh.setMatrixAt(bottomCoverBoxIMeshIterator, new THREE.Matrix4().compose(
                            new THREE.Vector3(
                                (chunkMinPosition.x + chunkMaxPosition.x) / 2,
                                chunkMinPosition.y - 0.5,
                                (chunkMinPosition.z + chunkMaxPosition.z) / 2
                            ),
                            new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2, Math.PI, Math.PI)),
                            new THREE.Vector3(
                                (chunkMaxPosition.x - chunkMinPosition.x) + 1,
                                (chunkMaxPosition.z - chunkMinPosition.z) + 1,
                                1
                            )
                        ));

                        instancedWorldModel.addInstancedCoverBox(bottomCoverBoxIMesh, bottomCoverBoxIMeshIterator);
                        bottomCoverBoxIMeshIterator++;
                        break;
                    case VoxelFace.LEFT:
                        // If it has the SMALL FACES of the wall on L/R ...
                        if (scale.z < scale.x) {
                            instancedWorldModel.visible = true;
                            if (boxType == "Floor") instancedWorldModel.isSideChunk = true;
                            break;
                        }
                        
                        // else, let's optimize the render by covering it!
                        leftCoverBoxIMesh.setMatrixAt(leftCoverBoxIMeshIterator, new THREE.Matrix4().compose(
                            new THREE.Vector3(
                                chunkMinPosition.x - 0.5,
                                (chunkMinPosition.y + chunkMaxPosition.y) / 2,
                                (chunkMinPosition.z + chunkMaxPosition.z) / 2
                            ),
                            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI/2, Math.PI/2)),
                            new THREE.Vector3(
                                (chunkMaxPosition.z - chunkMinPosition.z) + 1,
                                (chunkMaxPosition.y - chunkMinPosition.y) + 1,
                                1
                            )
                        ));

                        instancedWorldModel.addInstancedCoverBox(leftCoverBoxIMesh, leftCoverBoxIMeshIterator);
                        leftCoverBoxIMeshIterator++;

                        break;
                    case VoxelFace.RIGHT:
                        // If it has the SMALL FACES of the wall on L/R ...
                        if (scale.z < scale.x) {
                            instancedWorldModel.visible = true;
                            if (boxType == "Floor") instancedWorldModel.isSideChunk = true;
                            break;
                        }
                        
                        // else, let's optimize the render by covering it!
                        rightCoverBoxIMesh.setMatrixAt(rightCoverBoxIMeshIterator, new THREE.Matrix4().compose(
                            new THREE.Vector3(
                                chunkMaxPosition.x + 0.5,
                                (chunkMinPosition.y + chunkMaxPosition.y) / 2,
                                (chunkMinPosition.z + chunkMaxPosition.z) / 2
                            ),
                            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI/2, Math.PI/2)),
                            new THREE.Vector3(
                                (chunkMaxPosition.z - chunkMinPosition.z) + 1,
                                (chunkMaxPosition.y - chunkMinPosition.y) + 1,
                                1
                            )
                        ));

                        instancedWorldModel.addInstancedCoverBox(rightCoverBoxIMesh, rightCoverBoxIMeshIterator);
                        rightCoverBoxIMeshIterator++;

                        break;
                    case VoxelFace.FRONT:
                        // If it has the SMALL FACES of the wall on F/B ...
                        if (scale.x < scale.z) {
                            instancedWorldModel.visible = true;
                            if (boxType == "Floor") instancedWorldModel.isSideChunk = true;
                            break;
                        }

                        // else, let's optimize the render by covering it!
                        frontCoverBoxIMesh.setMatrixAt(frontCoverBoxIMeshIterator, new THREE.Matrix4().compose(
                            new THREE.Vector3(
                                (chunkMinPosition.x + chunkMaxPosition.x) / 2,
                                (chunkMinPosition.y + chunkMaxPosition.y) / 2,
                                chunkMaxPosition.z - 0.5
                            ),
                            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, Math.PI)),
                            new THREE.Vector3(
                                (chunkMaxPosition.x - chunkMinPosition.x) + 1,
                                (chunkMaxPosition.y - chunkMinPosition.y) + 1,
                                1
                            )
                        ));

                        instancedWorldModel.addInstancedCoverBox(frontCoverBoxIMesh, frontCoverBoxIMeshIterator);
                        frontCoverBoxIMeshIterator++;
                        break;
                    case VoxelFace.BACK:
                        // If it has the SMALL FACES of the wall on F/B ...
                        if (scale.x < scale.z) {
                            instancedWorldModel.visible = true;
                            if (boxType == "Floor") instancedWorldModel.isSideChunk = true;
                            break;
                        }

                        // else, let's optimize the render by covering it!
                        backCoverBoxIMesh.setMatrixAt(backCoverBoxIMeshIterator, new THREE.Matrix4().compose(
                            new THREE.Vector3(
                                (chunkMinPosition.x + chunkMaxPosition.x) / 2,
                                (chunkMinPosition.y + chunkMaxPosition.y) / 2,
                                chunkMinPosition.z + 0.5
                            ),
                            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, Math.PI)),
                            new THREE.Vector3(
                                (chunkMaxPosition.x - chunkMinPosition.x) + 1,
                                (chunkMaxPosition.y - chunkMinPosition.y) + 1,
                                1
                            )
                        ));

                        instancedWorldModel.addInstancedCoverBox(backCoverBoxIMesh, backCoverBoxIMeshIterator);
                        backCoverBoxIMeshIterator++;
                        break;
                }
                coverBox.visible = false;
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

        const buildBack = function() {
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

        const buildFront = function() {
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

        const buildLeft = function() {
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

        // Create the ROOF (top) of the box:
        const buildTop = function() {
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

        const buildRight = function() {
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

        const buildBottom = function() {
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

        if (boxType == "Wall") {
            if (scale.z > scale.x) {
                buildBack();
                buildFront();
                buildLeft();
                buildTop();
                buildRight();
                buildBottom();
            }
            else
            {
                buildLeft();
                buildRight();
                buildFront();
                buildTop();
                buildBack();
                buildBottom();
            }
        }
        else if (boxType == "Floor") {
            buildTop();
            buildBottom();
        }

        itemsBuiltSoFar++;
        document.querySelector("#loader").textContent = Math.round((itemsBuiltSoFar/itemsToBuild)*100) + "%";
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