// Imports
const { ipcRenderer } = require('electron');
import { addToCutawayStack, BoxData, VoxelChunk, VoxelFace, voxelField, cutawayField } from './VoxelStructures.js';
import { getPixelsFromImage } from './CanvasPixelReader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
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

let itemsBuiltSoFar = 0, itemsToBuild = 0;
let levelID;

export const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);
export const voxelMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff
});
voxelMaterial.dithering = true;
let levelName;

export const generateWorld = function (modelURL, LEVELHANDLER, USERSETTINGS, WEAPONHANDLER, worldSphere) {
    // level-specific tweaks
    levelName = modelURL;
    levelID = levelName.substring(0,2);
    LEVELHANDLER.levelID = levelID;
    LEVELHANDLER.nextLevelText = "go to the Next Floor";
    switch (levelID)
    {
        case "05":
            document.querySelector("#middle-crosshair").style.visibility = "hidden";
            document.querySelector("#interaction-text").style.visibility = "hidden";
            document.querySelector("#health-uis").style.display = "none";
            break;
        case "06":
        case "07":
            LEVELHANDLER.nextLevelText = "try to Wake Up";
            document.querySelector("#loader-bg").style.filter = "contrast(150%)";
            LEVELHANDLER.nextLevelText = "try to Wake Up";
            document.querySelector("#health-uis").style.display = "none";
            break;
    }

    // Zeroeth Step: Level Text
    const loader = new FontLoader();
    loader.load('../opensource/fonts/Lilita/Lilita One_Regular.json', (font) => {
        const levelTitleGeometry = new TextGeometry(levelName, {
            font: font,
            size: 120,
            height: 2.5
        });
        const levelText = new THREE.Mesh(levelTitleGeometry, new THREE.MeshBasicMaterial({
            color: new THREE.Color(0xababab)
        }));
        levelText.position.set(0, 256, 0);
        levelText.position.add(globalOffset);
        levelText.rotation.y = -Math.PI/4;
        LEVELHANDLER.scene.add(levelText);

        // DEMO TUTORIAL ###############
        if (levelName.substring(0,2) == "00") {
            const assistObj = new THREE.Mesh(new THREE.PlaneGeometry(85, 40), new THREE.MeshBasicMaterial({
                color: 0xffffff,
                map: LEVELHANDLER.globalTextureLoader.load('../img/shoot_thru_wall.png'),
                transparent: true
            }));
            assistObj.position.set(10286, 30, 9710);
            assistObj.rotation.y = -Math.PI/2;
            LEVELHANDLER.scene.add(assistObj);

            const assistObj2 = new THREE.Mesh(new THREE.PlaneGeometry(85, 40), new THREE.MeshBasicMaterial({
                color: 0xffffff,
                map: LEVELHANDLER.globalTextureLoader.load('../img/throwweapon.png'),
                transparent: true
            }));
            assistObj2.position.set(10414, 30, 9790);
            assistObj2.rotation.y = -Math.PI/2;
            LEVELHANDLER.scene.add(assistObj2);
        }
        if (levelName.substring(0,2) == "02") {
            const assistObj = new THREE.Mesh(new THREE.PlaneGeometry(65, 55), new THREE.MeshBasicMaterial({
                color: 0xffffff,
                map: LEVELHANDLER.globalTextureLoader.load('../img/break_wall.png'),
                transparent: true
            }));
            assistObj.position.set(9970, 30, 9900);
            assistObj.rotation.y = Math.PI/2;
            assistObj.visible = false;
            LEVELHANDLER.assistObj = assistObj;
            LEVELHANDLER.scene.add(assistObj);
        }
        if (levelName.substring(0,2) == "06") {
            const assistObj = new THREE.Mesh(new THREE.PlaneGeometry(45, 15), new THREE.MeshBasicMaterial({
                color: 0xcccccc,
                map: LEVELHANDLER.globalTextureLoader.load('../img/shift_to_sprint.png'),
                transparent: true
            }));
            assistObj.position.set(9806, 35, 9874);
            LEVELHANDLER.scene.add(assistObj);
        }
    })

    ipcRenderer.send('list-maps');
    ipcRenderer.on('list-maps-reply', (event, arg) => {
        // THIS LISTS ALL AVAILABLE MAPS (later: map selector)
        // console.log(arg);

        // THIS CHOOSES THE MAP TO LOAD
        ipcRenderer.send('get-map-metadata', {
            mapName: levelName
        });

        // THIS GETS METADATA (PRELOAD)
        ipcRenderer.on('get-map-metadata-reply', (event, arg) => {
            console.log("GENERATING FROM", modelURL);

            const mapCameraData = {
                position: JSON.parse(arg.metaData).cameraData.cameraPosition,
                rotation: JSON.parse(arg.metaData).cameraData.cameraRotation
            };
            LEVELHANDLER.camera.position.set(globalOffset.x,LEVELHANDLER.playerHeight,globalOffset.z);
            LEVELHANDLER.camera.rotation.set(mapCameraData.rotation.x, mapCameraData.rotation.y, mapCameraData.rotation.z);

            LEVELHANDLER.nextLevelURL = JSON.parse(arg.metaData).nextLevelURL;

            const ambientColorData = JSON.parse(arg.metaData).ambientColor;
            const ambientColor = new THREE.Color(ambientColorData.r, ambientColorData.g, ambientColorData.b);
            worldSphere.material.color = ambientColor.clone().multiplyScalar(0.25);
            LEVELHANDLER.backlight.color = LEVELHANDLER.defaultBacklightColor = ambientColor;
            // space levels
            if (levelID == "XX") {
                LEVELHANDLER.backlight.color = new THREE.Color(0x406ce6);
                LEVELHANDLER.worldSphere.material.map = LEVELHANDLER.globalTextureLoader.load("../img/skybox_1.png");
                LEVELHANDLER.worldSphere.material.map.repeat.set(1,1);
                LEVELHANDLER.worldSphere.material.color = new THREE.Color(0xffffff);
            }

            const mapObjects = JSON.parse(arg.metaData).mapMakerSave;
            const mod = 1; // scale modifier

            // Filter 0: Count Boxes
            mapObjects.forEach(mapObject => {
                if (mapObject.isCutaway != true && (mapObject.type == "Detail" || mapObject.type == "Wall" || mapObject.type == "Floor")) {
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

            // Filter 2: Boxes & Entities
            // These are the most standard world object, and are the quickest to process
            const explosiveList = [];
            mapObjects.forEach(mapMakerObject => {

                if (mapMakerObject.isCutaway && mapMakerObject.isCutaway == true) return;

                const scale = mapMakerObject.size;
                scale.x /= mod;
                scale.y /= mod;
                scale.z /= mod;
                const position = mapMakerObject.position;
                position.x /= mod;
                position.y /= mod;
                position.z /= mod;
                const color = mapMakerObject.color;

                // shift position (to center it)
                position.x -= scale.x / 2;
                position.y -= scale.y / 2;
                position.z -= scale.z / 2;

                // Lights
                let light = null;
                if (mapMakerObject.isLight && mapMakerObject.isLight == true && mapMakerObject.lightBrightness > 1) {
                    // create a point light at this position with mapObject.lightBrightness
                    light = new THREE.PointLight(new THREE.Color(color.r, color.g, color.b), mapMakerObject.lightBrightness * 10, 0, 2);
                    light.position.set(position.x + (scale.x / 2), position.y + (scale.y / 2) - 1, position.z + (scale.z / 2));
                    light.position.add(globalOffset);
                    light.baseIntensity = light.intensity;
                    LEVELHANDLER.levelLights.push(light);
                    LEVELHANDLER.scene.add(light);
                }

                // Enemy NPCs
                if (mapMakerObject.isEnemyNPC && mapMakerObject.isEnemyNPC == true) {
                    if (!mapMakerObject.enemyType) mapMakerObject.enemyType = "thug";
                    // sometimes -0 (or a number close to it) is actually 180 deg, so we need to account for that
                    if (mapMakerObject.rotation.y < 0.1 && mapMakerObject.rotation.y > -0.1) mapMakerObject.rotation.y = Math.PI;
                    const thisNPC = new NPC(
                        mapMakerObject.enemyType,
                        '../character_models/thug_idle.png',
                        new THREE.Vector3(position.x, 1, position.z),
                        -mapMakerObject.rotationIntervals,
                        100 + rapidFloat() * 100,
                        100,
                        LEVELHANDLER,
                        voxelField,
                        WEAPONHANDLER,
                        'smg',
                        mapMakerObject.isHostile,
                    );
                    return;
                }
                // Weapon Pickups
                if (mapMakerObject.weaponType != undefined) {
                    
                    WEAPONHANDLER.createWeaponPickup(mapMakerObject.weaponType, new THREE.Vector3(position.x, position.y, position.z));
                }
                else if (mapMakerObject.isExplosive != undefined) {
                    if (position.y == 10) position.y = 3;
                    explosiveList.push(new THREE.Vector3(position.x, position.y, position.z));
                }
                else
                {
                    buildWorldModelFromBox(LEVELHANDLER, WEAPONHANDLER, USERSETTINGS, mapMakerObject.type, scale, position, mapMakerObject.material, color, mapMakerObject.lightBrightness, mapMakerObject.interactionEvent, light);
                }
            });

            explosiveList.forEach(position => {
                WEAPONHANDLER.createExplosive(new THREE.Vector3(position.x + globalOffset.x, position.y + globalOffset.y, position.z + globalOffset.z));
            })
        });
    });

}

export const globalOffset = new THREE.Vector3(10000, 0, 10000);
const buildWorldModelFromBox = function (LEVELHANDLER, WEAPONHANDLER, USERSETTINGS, boxType, scale, position, material, colorData, lightBrightness = 0, interactionEvent, light) {

    if (scale.x > 2) scale.x -= 1;
    if (scale.y > 2) scale.y -= 1;
    if (scale.z > 2) scale.z -= 1;

    const chunkConnector = new BoxData();

    // const preview = new THREE.Mesh(
    //     new THREE.BoxGeometry(scale.x, scale.y, scale.z),
    //     new THREE.MeshBasicMaterial({
    //         color: 0xff0000
    //     })
    // );
    // LEVELHANDLER.scene.add(preview)
    // preview.position.set(position.x + (scale.x / 2), position.y + (scale.y / 2), position.z + (scale.z / 2));
    // preview.position.add(globalOffset);

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

        LEVELHANDLER.interactableObjects.push(interactionBox);
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
            let count = 2 * ((scale.x * scale.z) + (scale.x * scale.y) + (scale.y * scale.z));
            if (boxType == "Wall" || boxType == "Floor") count = 64 * 64 * 2; // 2 is the wall depth
            // Setup the model ...
            instancedWorldModel = new VoxelChunk(
                voxelGeometry,
                voxelMaterial.clone(),
                count,
                LEVELHANDLER
            );
            instancedWorldModel.material.emissive = boxColor;
            instancedWorldModel.material.emissiveIntensity = lightBrightness / 3;
            instancedWorldModel.material.initialEmissiveIntensity = lightBrightness;
            instancedWorldModel.visible = false;
            instancedWorldModel.useCoverBox = true;
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
                color: boxColor
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
            else if (boxType == "Detail") {
                instancedWorldModel.visible = true;
                instancedWorldModel.isDetail = true;
                resetChunkBounds();
                resetInstancedWorldModel();
                return;
            }
// ADD GORE ADD GORE ADD GORE ADD GORE ADD GORE!!!!!!!!!
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
            voxelPosition.add(globalOffset);
            voxelPosition = voxelPosition.round();
            if (cutawayField.get(voxelPosition.x, voxelPosition.y, voxelPosition.z) != null) {
                instancedWorldModel.useCoverBox = false;
                instancedWorldModel.isDetail = true;
                return
            }
            const voxel = voxelField.get(voxelPosition.x, voxelPosition.y, voxelPosition.z);
            chunkMinPosition.min(voxelPosition);
            chunkMaxPosition.max(voxelPosition);
            if (voxel != null) {
                // removing  clones ...
                voxelPosition.set(0,0,0);
            }
            // Commit to the global voxel field
            // update min/max positions for this chunk (for culling)
            voxelField.set(voxelPosition.x, voxelPosition.y, voxelPosition.z, 1, localVoxelIterator, instancedWorldModel, voxelFace);
            instancedWorldModel.setMatrixAt(localVoxelIterator, new THREE.Matrix4().setPosition(new THREE.Vector3(voxelPosition.x, voxelPosition.y, voxelPosition.z)));
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
        else if (boxType == "Detail") {
            buildTop();
            buildBottom();
            buildLeft();
            buildRight();
            buildFront();
            buildBack();
        }
        else console.error("Invalid Box Type: " + boxType)

        itemsBuiltSoFar++;
        const doneness = Math.round((itemsBuiltSoFar/itemsToBuild)*100);
        const loader = document.querySelector("#loader");
        if (doneness < 97) {
            loader.textContent = doneness + "%";
        } else {
            loader.innerHTML = levelName.substring(3).replaceAll('_', ' ');
            document.querySelector("#ui-overlay").style.opacity = 1;
        }
        // When all objects are finished loading ...
        if (itemsBuiltSoFar >= itemsToBuild) {
            console.log("COMPLETE")
            // Remove the Pump Cover
            const loader = document.querySelector("#loader-bg");
            setTimeout(() => { loader.style.animation = "fade-out-sharp 1s ease" }, 1000);
            
            // setTimeout(() => { loader.parentNode.removeChild(loader); LEVELHANDLER.levelFinishedLoading = true; }, 2000);
            loader.parentNode.removeChild(loader);
            LEVELHANDLER.levelFinishedLoading = true;
            
            document.querySelector("#interaction-text").style.display = "block";
            document.querySelector("#npc-text").style.animation = "typewriter 2.5s steps(40, end) forwards";
            WEAPONHANDLER.isAttackAvailable = true;

            // Update the light probe !!!
            cubeCamera.update(LEVELHANDLER.renderer,LEVELHANDLER.scene);
            lightProbe.copy(LightProbeGenerator.fromCubeRenderTarget(LEVELHANDLER.renderer, cubeRenderTarget));

            if (LEVELHANDLER.totalKillableNPCs == 0) LEVELHANDLER.isLevelComplete = true;
        }
    }
    const loader = new THREE.TextureLoader(manager);
    const texture = loader.load(texturePath, (texture) => {
        texture.encoding = THREE.sRGBEncoding;
        pixelData = texture;
    });
}

const buildWorldModelFromSphere = function (position, scale, color) {
    // TODO
}