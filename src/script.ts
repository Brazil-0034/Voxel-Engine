// This is my JavaScript-based Voxel game (engine)

// IMPORTS [/addons/ = /examples/jsm/]
import * as THREE from 'three';
const PointerLockControls = require("../addons/PointerLockControls.js");
/**
 * A VoxelChunk is how WreckMesh renders voxels.
 * It inherits from InstancedMesh with some additional properties for rendering and physics.
 * It is a unified class for all mesh operations in WreckMesh.
 * 
 * @param frustumBox: THREE.Box3 - The bounding box of the chunk, used for frustum culling.
 * @param velocities: THREE.Vector3[] - The velocities of each voxel in the chunk. [Physics Processing Only]
 */
class VoxelChunk extends THREE.InstancedMesh {
    public frustumBox: THREE.Box3;
    public velocities: THREE.Vector3[];

    constructor(geometry: THREE.BufferGeometry, material: THREE.Material, count: number) {
        super(geometry, material, count);
        this.frustumBox = new THREE.Box3();
    }
}

class ParticleMesh extends THREE.Points {
    public velocities: THREE.Vector3[];
    public lifetimes: number[];
    public lifetime: number;

    constructor(geometry: THREE.BufferGeometry, material: THREE.Material) {
        super(geometry, material);
    }
}


var ipcRenderer = require('electron').ipcRenderer;

const USERSETTINGS = {
    debugMode: false,
    useSpriteParticles: false
}

// Sets the help text on the bottom center of the player's screen
const setHelpText = (text) => { document.querySelector("#help-text").innerHTML = text }

// SCENE SETUP
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 999999);
// RENDERER SETUP
// Initializes the THREE.js renderer
const renderer = new THREE.WebGLRenderer({
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000);
document.body.appendChild(renderer.domElement);


// LIGHTING
// Initializes the THREE.js lighting
// const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
// scene.add(ambientLight);

// Two opposing directional lights. The opposing light is dimmer. Both lights are angled against each other.
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);
const opposingDirectionalLight = new THREE.DirectionalLight(0xffffff, 0.75);
opposingDirectionalLight.position.set(-1, -1, -1);
scene.add(opposingDirectionalLight);

const path = 'skyboxes/BlueSky/';
const format = '.jpg';
const urls = [
    path + 'bluecloud_ft' + format, path + 'bluecloud_bk' + format,
    path + 'bluecloud_up' + format, path + 'bluecloud_dn' + format,
    path + 'bluecloud_rt' + format, path + 'bluecloud_lf' + format
];
const reflectionCube = new THREE.CubeTextureLoader().load(urls);
reflectionCube.encoding = THREE.sRGBEncoding;
reflectionCube.mapping = THREE.CubeReflectionMapping;
scene.background = reflectionCube;

var pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// PLAYER CAMERA
// Initializes the local player's camera, rendered to the canvas
const playerMoveSpeed = 125;
camera.position.set(0, 50, 0);
const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

// An object that traces the mouse's position in the voxel field.
// This is used to determine where to place objects like dynamite
var mouseRayFollower = new THREE.Mesh(
    new THREE.TorusGeometry(2.5, 0.1, 16, 100),
    new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.15 })
);
scene.add(mouseRayFollower)

// This locks the pointer into the screen, so the player can move the camera without the pointer leaving the screen
document.body.addEventListener('click', () => controls.lock());

// MOTION CONTROLS
// This is the code that handles the player's motion
let xAxis = 0;
let zAxis = 0;
let sprinting = 1;
let weaponLeanDirZ = 0, weaponLeanDirX = 0; //-1 and 1
document.addEventListener('keydown', function (e) {
    switch (e.code) {
        case 'KeyW':
            if (zAxis == 0) zAxis = -1;
            break;
        case 'KeyA':
            if (xAxis == 0) xAxis = -1;
            weaponLeanDirZ = -1;
            break;
        case 'KeyS':
            if (zAxis == 0) zAxis = 1;
            break;
        case 'KeyD':
            if (xAxis == 0) xAxis = 1;
            weaponLeanDirZ = 1;
            break;
        case 'ShiftLeft':
            sprinting = 2.5;
            break;
        case 'KeyR':
            controls.getObject().position.set(0, 15, 0);
            break;
        case 'ControlLeft':
            isCrouching = true;
    }
});
document.addEventListener('keyup', function (e) {
    switch (e.code) {
        case 'KeyW':
            zAxis = 0;
            break;
        case 'KeyA':
            xAxis = 0;
            weaponLeanDirZ = 0;
            break;
        case 'KeyS':
            zAxis = 0;
            break;
        case 'KeyD':
            xAxis = 0;
            weaponLeanDirZ = 0;
            break;
        case 'ShiftLeft':
            sprinting = 1;
            break;
        case 'ControlLeft':
            isCrouching = false;
    }
});

// on mousemove LEFT and RIGHT, rotate the player's camera
var mouseMoveTimer = 0;
document.addEventListener('mousemove', function (e) {
    if (controls.isLocked === true) {
        if (e.movementX < 0) weaponLeanDirX = -1
        else if (e.movementX > 0) weaponLeanDirX = 1
        mouseMoveTimer = 0;
    }
});
setInterval(() => {
    if (mouseMoveTimer > 1) {
        weaponLeanDirZ = 0;
        weaponLeanDirX = 0;
    }
    mouseMoveTimer++;
}, 10);

// This is a function that can clamp two numbers within a range.
// For some reason, it doesn't seem to exist in Vanilla JS? so we must write one ourselves:
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

// FILESYSTEM CONSTANTS
// These mark locations in the local file system that store the map and current weapon
const modelURL = 'maps/' + 'savedata.json';
const weaponURL = 'weapons/' + 'weapon_m4.json';
// This stores any JSON data that is loaded from the file system, on the main thread.
// Since only one thread can access the file system at a time, it is convenient to store the data here.
// TODO - this explanation sucks. just pass it between functions. too many globals.

// WEAPON DATA
// These objects store data on the currently selected weapon, globally.
// They are global so we can access them from anywhere in the script, if necessary.
var weaponRange = 500,
    weaponPosition: THREE.Vector3,
    weaponRotation: THREE.Euler,
    weaponRealWorldScaleMultiplier: number,
    weaponPlacementOffset: THREE.Vector3,
    weaponScale: THREE.Vector3,
    weaponHelpText: string,
    weaponType: string,
    rateOfFire: number, // time in ms in between attacks()
    destroyedChunkRange: number, // max distance for voxel destruction from intersection
    percentMissedHits: number // minimum % that must be destroyed

// This stores every individual displaced voxel that is currently being simulated.
// TODO: Add gc to this, dead voxels still exist in the array. This will lead to memory problems in big maps.
let destroyedVoxels = [];

// This represents a cubic volume where every position with a voxel is labeled as 1, and every position ignoring a voxel is 0.
// The volume is infinite and stores 1s and 0s in a 3D array, along with other relevant information for voxel transformations.
class blockData {
    public value: number;
    public position: THREE.Vector3;
    public chunk: THREE.InstancedMesh;
    public indexInChunk: number;

    constructor(value: number, position: THREE.Vector3, chunk: THREE.InstancedMesh, chunkIndex: number) {
        this.value = value;
        this.position = position;
        this.chunk = chunk;
        this.indexInChunk = chunkIndex;
    }
}
class DiscreteVectorField {
    // field: a 3d array featuring {x, y, z, value} objects
    private field: blockData[][][] = []; // stores the value of each voxel
    private chunkIndexes: { [key: string]: { minIndex: number, maxIndex: number } }; // stores the min and max index of each chunk
    constructor() {
        this.field = [];
        this.chunkIndexes = {};
    }

    setChunkMinIndex(chunkName: string, index: number) {
        if (!this.chunkIndexes[chunkName]) {
            this.chunkIndexes[chunkName] = {
                minIndex: 0,
                maxIndex: 0
            };
        }
        this.chunkIndexes[chunkName].minIndex = index;
    }

    setChunkMaxIndex(chunkName: string, index: number) {
        if (!this.chunkIndexes[chunkName]) {
            this.chunkIndexes[chunkName] = {
                minIndex: 0,
                maxIndex: 0
            };
        }
        this.chunkIndexes[chunkName].maxIndex = index;
    }

    getChunkMinIndex(chunkName: string) {
        return this.chunkIndexes[chunkName].minIndex || 0;
    }

    getChunkMaxIndex(chunkName: string) {
        return this.chunkIndexes[chunkName].maxIndex || 0;
    }

    // Sets the value of the vector field at the given position
    set(x: number, y: number, z: number, value: number, chunkIndex: number, chunk: THREE.InstancedMesh) {
        x = Math.round(x);
        y = Math.round(y);
        z = Math.round(z);
        if (!this.field[x]) {
            this.field[x] = [];
        }
        if (!this.field[x][y]) {
            this.field[x][y] = [];
        }
        if (!this.field[x][y][z]) {
            this.field[x][y][z] = new blockData(
                value,
                new THREE.Vector3(x, y, z),
                chunk,
                chunkIndex
            );
        }
    }

    // Retrieves the value of the vector field at the given position
    // 0 if none
    get(x: number, y: number, z: number) {
        if (this.field[x] && this.field[x][y] && this.field[x][y][z]) {
            return this.field[x][y][z];
        }
        return null;
    }

    // Shoots a "ray" with direction, origin, and length
    // Returns the first position where the ray intersects a voxel
    // Origin: Starting Position
    // Direction: Normalized Vector (ex. [0, 1, 0] is up from the origin)
    // Length: The maximum number of steps to take. If the ray does not intersect a voxel, return null
    raycast(origin, direction, length) {
        let x = Math.round(origin.x);
        let y = Math.round(origin.y);
        let z = Math.round(origin.z);

        const sqrMagnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);

        direction.x /= sqrMagnitude;
        direction.y /= sqrMagnitude;
        direction.z /= sqrMagnitude;
        for (let i = 0; i < length; i++) {
            const stepVoxel = this.get(Math.floor(x), Math.floor(y), Math.floor(z));
            if (stepVoxel != null && stepVoxel.value == 1) {
                return {
                    x: Math.floor(x),
                    y: Math.floor(y),
                    z: Math.floor(z),
                    index: stepVoxel.indexInChunk,
                    chunk: stepVoxel.chunk
                };
            }
            x += direction.x;
            y += direction.y;
            z += direction.z;
        }
        return null; // TODO: js hates nulls, switch to 0 or change get() to return null as well
    }

    // pretty useless implementation
    // TODO: make this useful???
    toString() {
        let str = '';
        for (let x in this.field) {
            for (let y in this.field[x]) {
                for (let z in this.field[x][y]) {
                    if (this.field[x][y][z].value === 1) {
                        str += '1';
                    } else {
                        str += '0';
                    }
                }
                str += ' ';
            }
        }
        return str;
    }
}
// This initializes the voxelField used for physics calculations
// This engine uses a two-fold representation of voxel data.
// One is stored in main memory (RAM), and the other is stored in GPU memory (vRAM)
// the GPU memory is used to render and display millions of voxels in as few draw calls as possible (the higher maxChunkSize, the fewer)
// the CPU memory is used to store the positions of these voxels, and use them for physics (such as raycasting, explosions, etc)
const voxelField = new DiscreteVectorField();

// This starts building the map, loaded from modelURL (at the top of the file)
// It attempts to load the JSON file, and allows quick transformations to the file (if needed / between versions) before calling buildWorldModel(), which actually builds the instanceMeshes
// (Only one map can be loaded at once... unless?)
// TODO - origin offsets for multiple map loading?
//  ^ this is very unncessary but could be useful for features like streaming
const crouchDepth = 15;
const crouchSpeed = 7.5;
const standYPosition = 60;
const crouchYPosition = standYPosition - crouchDepth;

let groundSize: THREE.Vector3;
const generateWorld = function (modelURL: string) {

    // send IPC message 'list-maps' and wait for response (sends eventResponse)
    // TODO - make this a promise
    ipcRenderer.send('list-maps');
    ipcRenderer.on('list-maps-reply', (event, arg) => {
        // THIS LISTS ALL AVAILABLE MAPS (later: map selector)
        // console.log(arg);

        // THIS CHOOSES THE MAP TO LOAD
        ipcRenderer.send('get-map-metadata', {
            mapName: 'fast food'
        });

        // THIS GETS METADATA (PRELOAD)
        ipcRenderer.on('get-map-metadata-reply', (event, arg) => {
            console.log("RECEIVED METADATA [ONLY SEE ONCE]");
            
            const mapCameraData = {
                position: JSON.parse(arg.metaData).cameraData.cameraPosition,
                rotation: JSON.parse(arg.metaData).cameraData.cameraRotation
            };
            camera.position.set(mapCameraData.position.x, standYPosition, mapCameraData.position.z);
            camera.rotation.set(mapCameraData.rotation.x, mapCameraData.rotation.y, mapCameraData.rotation.z);
            
            const groundData = JSON.parse(arg.metaData).groundData;
            groundSize = groundData.groundSize;
            if (groundData) {
                const groundFloor = new THREE.Mesh(
                    new THREE.BoxGeometry(groundSize.x, 1, groundSize.y),
                    new THREE.MeshBasicMaterial({
                        color: new THREE.Color(groundData.groundColor.r, groundData.groundColor.g, groundData.groundColor.b),
                    })
                );
                groundFloor.position.y = -1; // we set it just below the origin, to act as a floor
                scene.add(groundFloor);
            }

            const mapObjects = JSON.parse(arg.metaData).mapMakerSave;

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

                    buildWorldModelFromBox(scale, position, mapObject.material, color);
                }
            });
        });

    });
}
// VOXEL OBJECT DATA
const voxelSize = 1; // the relative size of voxels
let voxelGeometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
const voxelMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1.0,
    envMap: reflectionCube,
    envMapIntensity: 1.0,
});

// Maximum size for chunking
// Lower size = fewer chunks
// It is best to alter this dynamically between maps for performance
// TODO implement some algorithm to determine this value on the fly
let maxChunkSize = 5000; // 1d max size

let instancedModelIndex = []; // An index of all instancedMeshes (which for my own sake, are called Models instead)
const buildWorldModelFromBox = function (scale: THREE.Vector3, position: THREE.Vector3, material: string, color: THREE.Color) {
    // round the position
    position.x = Math.round(position.x);
    position.y = Math.round(position.y);
    position.z = Math.round(position.z);
    
    let chunkCounter = 0;

    var chunkMinPosition: THREE.Vector3, chunkMaxPosition: THREE.Vector3;
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
    
    let instancedWorldModel = new VoxelChunk(
        voxelGeometry,
        voxelMaterial,
        maxChunkSize
    );
    instancedWorldModel.name = chunkCounter.toString();
    let localVoxelIterator = 0;

    const finalizeChunk = function() {
        instancedWorldModel.instanceMatrix.needsUpdate = true;
        instancedWorldModel.instanceColor.needsUpdate = true;
        scene.add(instancedWorldModel);
        instancedModelIndex.push(instancedWorldModel);

        // For Frustum Culling...
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
        // A Debug Box (for the bounds for culling)
        if (USERSETTINGS.debugMode) {
            const box = new THREE.Box3Helper(instancedWorldModel.frustumBox, new THREE.Color(0x00ff00));
            scene.add(box);
        }

        // Reset Everything!!
        resetChunkBounds();
        localVoxelIterator = 0;
        chunkCounter++;
        instancedWorldModel = new VoxelChunk(
            voxelGeometry,
            voxelMaterial,
            maxChunkSize
        );
        instancedWorldModel.name = chunkCounter.toString();
    }

    const setVoxel = function(voxelPosition: THREE.Vector3) {
        // first, check if a voxel already exists here.
        const voxel = voxelField.get(voxelPosition.x, voxelPosition.y, voxelPosition.z);
        if (voxel != null && voxel.value != 0)
        {
            voxelPosition = new THREE.Vector3(0, -2, 0);
        }
        // Push to the global voxel field
        voxelField.set(voxelPosition.x, voxelPosition.y, voxelPosition.z, 1, localVoxelIterator, instancedWorldModel);
        // update min/max positions for this chunk
        chunkMinPosition.min(voxelPosition);
        chunkMaxPosition.max(voxelPosition);
        // update the instancedWorldModel
        instancedWorldModel.setMatrixAt(localVoxelIterator, new THREE.Matrix4().setPosition(voxelPosition));
        instancedWorldModel.setColorAt(localVoxelIterator, new THREE.Color(color.r, color.g, color.b));
        localVoxelIterator++;
        // check if we need to create a new chunk
        if (localVoxelIterator == maxChunkSize) {
            finalizeChunk();
        }
    }
    
    // Create the FLOOR (bottom) of the box:
    for (let x = 0; x < scale.x; x++)
    {
        for (let z = 0; z < scale.z; z++)
        {
            setVoxel(new THREE.Vector3(
                position.x + x,
                position.y,
                position.z + z
            ));
        }
    }
    finalizeChunk();

    // Create the CEILING (top) of the box:
    for (let x = 0; x < scale.x; x++)
    {
        for (let z = 0; z < scale.z; z++)
        {
            setVoxel(new THREE.Vector3(
                position.x + x,
                position.y + scale.y,
                position.z + z
            ));
        }
    }
    finalizeChunk();

    // Create the WALLS of the box:
    for (let y = 0; y < scale.y; y++)
    {
        for (let z = 0; z < scale.z; z++)
        {
            setVoxel(new THREE.Vector3(
                position.x,
                position.y + y,
                position.z + z
            ));
            setVoxel(new THREE.Vector3(
                position.x + scale.x,
                position.y + y,
                position.z + z
            ));
        }
    }
    finalizeChunk();

    for (let y = 0; y < scale.y; y++)
    {
        for (let x = 0; x < scale.x; x++)
        {
            setVoxel(new THREE.Vector3(
                position.x + x,
                position.y + y,
                position.z
            ));
            setVoxel(new THREE.Vector3(
                position.x + x,
                position.y + y,
                position.z + scale.z
            ));
        }
    }
    finalizeChunk();
}

generateWorld(modelURL); // finally, we load and generate the model!

// TODO i realize i wrote most of this while high out of my mind but this function chain might be the worst piece of code i've ever written
// like there are two wholly unnecessary, single-use function calls here for the same exact thing?
// maybe in a networked game it may be necessary ... maybe it's not so dumb after all ...
// ill look into it later.

var instancedWeaponModel;
const weaponModelMaterial = new THREE.MeshStandardMaterial({
    // highly reflective for funzies / make it contrast
    envMap: reflectionCube,
    roughness: 1.0,
    color: 0x8c8c8c
});

var instancedWeaponTarget; // target position for instancedWeapon (for lerping :P)

const generateWeaponModel = function (modelURL) {
    let loader = new THREE.FileLoader();
    loader.load(
        modelURL,
        function (jsondata) {
            let jsonModel = JSON.parse(jsondata as string);
            let voxelPositionsFromFile = jsonModel.voxels;
            instancedWeaponModel = new VoxelChunk(
                voxelGeometry,
                weaponModelMaterial,
                voxelPositionsFromFile.length
            );
            // make it render above everything else, cuz FPS!!
            instancedWeaponModel.onBeforeRender = function (renderer) { renderer.clearDepth(); };
            instancedWeaponModel.renderOrder = 999999;
            instancedWeaponModel.name = jsonModel.weaponData.name;
            instancedWeaponTarget = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial({ color: 0xff0000 })
            );
            instancedWeaponTarget.material.visible = false; // uncomment to position weapon better
            camera.add(instancedWeaponTarget);
            for (let i = 0; i < voxelPositionsFromFile.length; i++) {
                const thisVoxelData = voxelPositionsFromFile[i];
                const thisVoxelPosition = new THREE.Vector3(thisVoxelData.x, thisVoxelData.y, thisVoxelData.z);
                const thisVoxelColor = new THREE.Color("rgb(" + thisVoxelData.red + "," + thisVoxelData.green + "," + thisVoxelData.blue + ")");
                instancedWeaponModel.setMatrixAt(i, new THREE.Matrix4().makeTranslation(thisVoxelPosition.x, thisVoxelPosition.y, thisVoxelPosition.z));
                instancedWeaponModel.setColorAt(i, thisVoxelColor);
            }
            instancedWeaponModel.instanceMatrix.needsUpdate = true;
            // json reads for weapon data
            weaponType = jsonModel.weaponData.type;
            percentMissedHits = jsonModel.weaponData.percentMissedHits;
            destroyedChunkRange = jsonModel.weaponData.damageRange;
            rateOfFire = jsonModel.weaponData.fireRate;
            weaponHelpText = jsonModel.weaponData.helpText;
            // finally, add the weapon to the scene
            scene.add(instancedWeaponModel);
            weaponPosition = new THREE.Vector3(jsonModel.weaponData.position.x, jsonModel.weaponData.position.y, jsonModel.weaponData.position.z);
            if (jsonModel.weaponData.placementOffset) weaponPlacementOffset = new THREE.Vector3(jsonModel.weaponData.placementOffset.x, jsonModel.weaponData.placementOffset.y, jsonModel.weaponData.placementOffset.z);
            weaponScale = new THREE.Vector3(jsonModel.dimension.width, jsonModel.dimension.height, jsonModel.dimension.depth);
            weaponScale.divideScalar(15);
            weaponRange = jsonModel.weaponData.minimumDistance;
            if (jsonModel.weaponData.realWorldScaleMultiplier != undefined) weaponRealWorldScaleMultiplier = jsonModel.weaponData.realWorldScaleMultiplier;
            instancedWeaponTarget.position.copy(weaponPosition);
            // DEBUG KEYS to move weapon target around, see what looks best :)
            document.addEventListener('keydown', function (event) {
                if (event.key == 'ArrowLeft') {
                    instancedWeaponTarget.position.x -= 1;
                    console.log(instancedWeaponTarget.position);
                }
                if (event.key == 'ArrowRight') {
                    instancedWeaponTarget.position.x += 1;
                    console.log(instancedWeaponTarget.position);
                }
                if (event.key == 'ArrowUp') {
                    instancedWeaponTarget.position.y += 1;
                    console.log(instancedWeaponTarget.position);
                }
                if (event.key == 'ArrowDown') {
                    instancedWeaponTarget.position.y -= 1;
                    console.log(instancedWeaponTarget.position);
                }
                if (event.key == '1') {
                    instancedWeaponTarget.position.z -= 1;
                    console.log(instancedWeaponTarget.position);
                }
                if (event.key == '2') {
                    instancedWeaponTarget.position.z += 1;
                    console.log(instancedWeaponTarget.position);
                }
                if (event.key == '3') {
                    instancedWeaponTarget.rotation.z += Math.PI / 100;
                }
                if (event.key == '4') {
                    instancedWeaponTarget.rotation.z -= Math.PI / 100;
                    console.log(instancedWeaponTarget.rotation);
                }
                if (event.key == '5') {
                    instancedWeaponTarget.rotation.y += Math.PI / 100;
                }
                if (event.key == '6') {
                    instancedWeaponTarget.rotation.y -= Math.PI / 100;
                    console.log(instancedWeaponTarget.rotation);
                }
            });
            weaponRotation = new THREE.Euler(jsonModel.weaponData.rotation.x, jsonModel.weaponData.rotation.y, jsonModel.weaponData.rotation.z);
            instancedWeaponTarget.rotation.copy(weaponRotation);
            if (weaponHelpText) setHelpText(weaponHelpText);
        },
        function (err) {
            // console.log(err);
        }
    );
}

generateWeaponModel(weaponURL); // same as map, but for the weapon!

const triVoxelDroppedPieces = [];
const createTrivoxelAt = function (x, y, z, color) {
    const triVoxel = new THREE.Mesh(
        // cone with minimal segments
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: color })
    );
    // for some reason i named the destroyed pieces of a mesh 'trivoxels', prolly cuz they were originally triangular prisms.
    // that has changed since, but the name still slaps.
    triVoxel.name = "TRIVOXEL-" + Math.random();
    scene.add(triVoxel);
    x = parseInt(x);
    y = parseInt(y);
    z = parseInt(z);
    triVoxel.position.set(x, y, z);

    // velocity (random)
    const velocityRange = 0.25;
    const dropAngleModifier = 50;
    const dropAngle = Math.floor(Math.random() * dropAngleModifier) - (dropAngleModifier / 2);
    const triVoxelVelocity = new THREE.Vector3(
        (Math.random() * velocityRange/dropAngle) - (velocityRange/dropAngle),
        (Math.random() * velocityRange/(dropAngle/5)) - (velocityRange/(dropAngle/5)),
        (Math.random() * velocityRange/dropAngle) - (velocityRange/dropAngle)
    );

    // normalize the velocity
    triVoxelVelocity.normalize();

    triVoxelDroppedPieces.push({
        "sceneObject": triVoxel,
        "velocity": triVoxelVelocity
    });
}

class ParticleEffect {
    private count: number;
    private lifetime: number;
    private color: THREE.Color;
    private size: number;
    private spread: THREE.Vector3;
    private direction: THREE.Vector3;
    private filePath: string;
    private useRandomSprite: boolean;
    private randomSpriteRange: number;
    private useGravity: boolean;
    private fadeOut: boolean;

    constructor(count: number, lifetime: number, color: THREE.Color, size: number, spread: THREE.Vector3, direction: THREE.Vector3, filePath: string, useRandomSprite: boolean, randomSpriteRange: number, useGravity: boolean, fadeOut: boolean) {
        this.count = count;
        this.lifetime = lifetime;
        this.color = color;
        this.size = size;
        this.spread = spread;
        this.direction = direction;
        this.filePath = filePath;
        this.useRandomSprite = useRandomSprite;
        this.randomSpriteRange = randomSpriteRange;
        this.useGravity = useGravity;
        this.fadeOut = fadeOut;
    }
}

const particleInstances = [];
const createParticleInstance = function(effect, worldPos) {
    var path = effect.filePath;
    if (effect.useRandomSprite) {
        var num = Math.floor(Math.random() * effect.randomSpriteRange);
        if (num != 0) {
            path += num
        }
        path += ".png";
    }
    const particleTexture = new THREE.TextureLoader().load(path);
    const particleMaterial = new THREE.PointsMaterial({
        map: particleTexture,
        color: effect.color,
        size: effect.size
    });

    // randomize the color a bit
    const rand = Math.random() / 5;
    particleMaterial.color.r += rand;
    particleMaterial.color.g += rand;
    particleMaterial.color.b += rand;

    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = [];
    const particleVelocities = [];
    const particleLifetimes = [];

    for (let i = 0; i < effect.count; i++) {
        particlePositions.push(
            (Math.random() * effect.spread.x) - (effect.spread.x / 2),
            (Math.random() * effect.spread.y) - (effect.spread.y / 2),
            (Math.random() * effect.spread.z) - (effect.spread.z / 2)
        );
        particleVelocities.push(
            effect.direction.x * (Math.random() + 0.5),
            effect.direction.y * (Math.random() + 0.5),
            effect.direction.z * (Math.random() + 0.5)
        );
        particleLifetimes.push(0);
    }

    const particleSystem = new ParticleMesh(particleGeometry, particleMaterial);
    // no billboarding

    particleSystem.frustumCulled = false;

    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    particleSystem.velocities = particleVelocities;
    particleSystem.lifetimes = particleLifetimes;
    particleSystem.lifetime = effect.lifetime;

    particleSystem.position.copy(worldPos);
    particleInstances.push(particleSystem);

    scene.add(particleSystem);
}

const generateDestroyedChunkAt = function (destroyedVoxelsInChunk, trivoxelChance=0.25) {
    let found = false;
    for (let x = 0; x < destroyedVoxelsInChunk.length; x++) {
        let position = destroyedVoxelsInChunk[x];
        const thisVoxel = voxelField.get(position.x, position.y, position.z);
        if (thisVoxel != null && thisVoxel.value != 0)
        {
            thisVoxel.chunk.setMatrixAt(thisVoxel.indexInChunk, new THREE.Matrix4().makeTranslation(0, -2, 0));
            thisVoxel.chunk.instanceMatrix.needsUpdate = true;
            voxelField.set(position.x, position.y, position.z, 0, thisVoxel.indexInChunk, thisVoxel.chunk);
            if (Math.random() < trivoxelChance) {
                const color = new THREE.Color();
                thisVoxel.chunk.getColorAt(thisVoxel.indexInChunk, color);
                createTrivoxelAt(position.x, position.y, position.z, color);
            }
        }
    }
    // if (found) {
    //     {
    //     }
    // }
}

// MOUSE BUTTONS
var isLeftClicking = false;
document.addEventListener('mousedown', (e) => { if (e.button != 0) return; isLeftClicking = true; });
document.addEventListener('mouseup', (e) => { if (e.button != 0) return; isLeftClicking = false; });

// MUZZLE FLASH (for weapons)
const muzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(5, 75, 8, 1),
    new THREE.MeshBasicMaterial({ 
        color: 0xffd6c4
    })
);
muzzleFlash.rotation.z = Math.PI / 2;
muzzleFlash.rotation.y =-Math.PI / 2;
muzzleFlash.name = "muzzleFlash";

muzzleFlash.onBeforeRender = function (renderer) { renderer.clearDepth(); };

var isAttackAvailable = true;

const lerp = function(a, b, t)
{
    return a + (b - a) * t;
}

/*

public static float Berp(float start, float end, float value)
{
    value = Mathf.Clamp01(value);
    value = (Mathf.Sin(value * Mathf.PI * (0.2f + 2.5f * value * value * value)) * Mathf.Pow(1f - value, 2.2f) + value) * (1f + (1.2f * (1f - value)));
    return start + (end - start) * value;
}

*/

const elasticLerp = function(a, b, t)
{
    t = Math.min(Math.max(t, 0), 0.25);
    t = (Math.sin(t * Math.PI * (0.2 + 2.5 * t * t * t)) * Math.pow(1 - t, 0.2) + t) * (1 + (0.1 * (1 - t)));
    return a + (b - a) * t;
}

var isMouseMoving = false;
let timer = 0;
renderer.domElement.addEventListener('mousemove', (e) => {
    if (isMouseMoving) {
        timer = 0;
        return;
    }
    timer = 0;
    isMouseMoving = true;
});
setInterval(() => {
    if (isMouseMoving) {
        timer++;
        if (timer > 10) {
            isMouseMoving = false;
        }
    }
}, 5);


// ### RENDER LOOP ###
// this renders things. separate from the physics loop.
const clock = new THREE.Clock();
var frameRate = 0;
var frameCounter = 0;
var weaponStartPosition;
var defaultInstancedWeaponTargetPosition;
var isCrouching = false;
var crouchLerp = 0;
const render = function () {
    frameCounter = (frameCounter + 1) % 60;
    const delta = clock.getDelta();
    frameRate = Math.round(1 / delta);
    controls.moveRight(playerMoveSpeed * delta * xAxis * sprinting);
    controls.moveForward(-playerMoveSpeed * delta * zAxis * sprinting);
    document.querySelector("#position-overlay").innerHTML = (
        "<font color='red'>X: " + Math.round(controls.getObject().position.x) +
        "<font color='lightgreen'> Y: " + Math.round(controls.getObject().position.y) +
        "<font color='cyan'> Z: " + Math.round(controls.getObject().position.z) +
        "<font color='yellow'> FPS: " + frameRate
    );
    // crouching
    if (isCrouching)
    {
        camera.position.y = lerp(standYPosition, crouchYPosition, crouchLerp);
        crouchLerp += crouchSpeed * delta;
        if (crouchLerp > 1) crouchLerp = 1;
    }
    else
    {
        var headPosition = standYPosition
        if (zAxis != 0 || xAxis != 0) {
            const freq = 75;
            const strength = 2.5;
            headPosition = standYPosition + (Math.sin(Date.now() / freq) * strength);
        }
        camera.position.y = lerp(camera.position.y, headPosition, delta * 10);
        crouchLerp -= crouchSpeed * delta;
        if (crouchLerp < 0) crouchLerp = 0;
    }
    if (instancedWeaponModel && instancedWeaponTarget && delta > 0) {
        muzzleFlash.renderOrder = instancedWeaponModel.renderOrder - 1;

        if (!defaultInstancedWeaponTargetPosition) defaultInstancedWeaponTargetPosition = instancedWeaponTarget.position.clone();

        // SIN the weapon's position
        const bounceRange = new THREE.Vector3(0.25, 0.25, 0);
        let speed = new THREE.Vector3(100, 50, 100);
        let isMoving = false;
        if (xAxis != 0 || zAxis != 0) {
            isMoving = true;
        } 
        else if (isMouseMoving == true && controls.isLocked == true)
        {
            isMoving = true;
            bounceRange.divideScalar(2.5);
            speed.multiplyScalar(2.5);
        }
        instancedWeaponTarget.position.x += (Math.sin(Date.now() / speed.x) * bounceRange.x) * Number(isMoving);
        instancedWeaponTarget.position.y += (Math.sin(Date.now() / speed.y) * bounceRange.y) * Number(isMoving);

        // LERP the weapon's position
        const instancedWeaponTargetWorldPosition = new THREE.Vector3();
        instancedWeaponTarget.getWorldPosition(instancedWeaponTargetWorldPosition);
        instancedWeaponModel.position.set(instancedWeaponTargetWorldPosition.x, instancedWeaponTargetWorldPosition.y, instancedWeaponTargetWorldPosition.z);
        
        // always realign the rotation of the weapon to the target
        instancedWeaponModel.rotation.setFromRotationMatrix(instancedWeaponTarget.matrixWorld);
    }
    if (isLeftClicking) {
        if (!weaponStartPosition && instancedWeaponModel) {
            weaponStartPosition = instancedWeaponTarget.position.clone();
            instancedWeaponModel.add(muzzleFlash);
            muzzleFlash.position.y = 55;
            muzzleFlash.position.x = 5;
        }
        switch (weaponType) {
            case undefined:
                break;
            default:
                console.error("Illegal Weapon Type - \"" + weaponType + "\"");
                break;
            case "ranged":
                if (isAttackAvailable) {
                    muzzleFlash.visible = true;
                    // muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
                    // for EACH vertex in the muzzle flash, set its position to a random position within a sphere
                    const bzzStrength = 2.5;
                    instancedWeaponTarget.position.set(
                        weaponStartPosition.x + Math.random() * bzzStrength - bzzStrength / 2 - 0.5,
                        weaponStartPosition.y + Math.random() * bzzStrength - bzzStrength / 2 + 0.5,
                        weaponStartPosition.z + Math.random() * bzzStrength - bzzStrength / 2 + 0.5
                    );
                    const muzzleFlashYScaleModifierStrength = 1;
                    muzzleFlash.scale.y = Math.random() * muzzleFlashYScaleModifierStrength + muzzleFlashYScaleModifierStrength;
                    
                    // GOD i HATE javascript
                    // type annotations? NO.
                    // parameter delcarations? NO.
                    // return types? NO.
                    // why don't i just kill myself now?
                    shootRay(Math.random() < 0.25 ? true : false);

                    isAttackAvailable = false;
                    setTimeout(function () {
                        isAttackAvailable = true;
                    }, rateOfFire);
                }
                break;
            case "melee":
                // TODO
                break;
            case "explosive":
                if (isAttackAvailable) {
                    
                    plantExplosive();

                    isAttackAvailable = false;
                    setTimeout(function () {
                        isAttackAvailable = true;
                    }, rateOfFire);
                }
                break;
        }
    }
    else {
        muzzleFlash.visible = false;
    }
    mouseRayFollower.visible = false;
    if (weaponType == "explosive") {
        const cameraCenterPosition = new THREE.Vector3();
        camera.getWorldPosition(cameraCenterPosition);
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        // const intersect = voxelField.raycast(
        //     cameraCenterPosition,
        //     direction,
        //     weaponRange
        // );
        // if (intersect) {
        //     mouseRayFollower.visible = true;
        //     mouseRayFollower.position.set(intersect.x, intersect.y, intersect.z);
        //     mouseRayFollower.lookAt(cameraCenterPosition);
        // }
    }

    var frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    instancedModelIndex.forEach(model => {
        if (frustum.intersectsBox(model.frustumBox)) {
            model.visible = true;
        }
        else {
            model.visible = false;
        }
    });

    requestAnimationFrame(render);
    renderer.render(scene, camera);

    // console.log(renderer.info.render.calls);
}

// ### PHYSICS LOOPS ###
const physicsUpdatesPerSecond = 60; // physics speed
const cubeDestructionParticlesSimulator = []; // index of all cubedestructionparticle
const wreckedMeshes = [];
const physicsUpdate = function () {
    // UPDATE PARTICLES
    particleInstances.forEach(particleInstance => {
        // for each position in the particle instance, move it by its velocity
        const positions = particleInstance.geometry.attributes.position.array;
        const velocities = particleInstance.velocities;
        const lifetimes = particleInstance.lifetimes;

        let tally = 0;
        
        for (let i = 0; i < positions.length; i += 3) {
            if (lifetimes[i / 3] > particleInstance.lifetime) {
                // remove from positions (move it to -2 and set velocity to 0)
                positions[i] = -2;
                positions[i + 1] = -2;
                positions[i + 2] = -2;
                velocities[i] = 0;
                velocities[i + 1] = 0;
                velocities[i + 2] = 0;
                lifetimes[i / 3] = 999;
                tally += 1;
                if (tally >= positions.length / 3) {
                    scene.remove(particleInstance);
                    particleInstances.splice(particleInstances.indexOf(particleInstance), 1);
                }
            }
            else
            {
                positions[i] += velocities[i];
                positions[i + 1] += velocities[i + 1];
                positions[i + 2] += velocities[i + 2];
                lifetimes[i / 3] += 1 / physicsUpdatesPerSecond;
                particleInstance.material.opacity = 1 - (lifetimes[i / 3] / particleInstance.lifetime);
            }
        }

        particleInstance.geometry.attributes.position.needsUpdate = true;
    })
    // UPDATE TRIVOXELS
    triVoxelDroppedPieces.forEach((triVoxel) => {
        if (Math.random() < 0.1 / physicsUpdatesPerSecond) {
            scene.remove(triVoxel.sceneObject);
            triVoxelDroppedPieces.splice(triVoxelDroppedPieces.indexOf(triVoxel), 1);
        }
        else {
            const sceneObject = triVoxel.sceneObject;
            const velocity = triVoxel.velocity;

            const newPosition = new THREE.Vector3(
                sceneObject.position.x + velocity.x,
                sceneObject.position.y + velocity.y,
                sceneObject.position.z + velocity.z
            );

            // apply some gravity (-1 y)
            // get the position of the first matrix object
            const position = newPosition.clone();

            if (position.y > 1) {
                velocity.y -= 1 / (physicsUpdatesPerSecond / 2);
                sceneObject.position.copy(newPosition);

                // add velocity to rotation ( with 50% chance to be negative )
                sceneObject.rotation.x += velocity.x / 50;
                sceneObject.rotation.y += velocity.y / 50;
                sceneObject.rotation.z += velocity.z / 50;
            }
        }
    });
    if (USERSETTINGS.useSpriteParticles) {
        // UPDATE CUBEDESTRUCTIONPARTICLES (POINTS MESHES)
        cubeDestructionParticlesSimulator.forEach(cubeDestructionParticlesObject => {
            if (Math.random() < 0.000001 / physicsUpdatesPerSecond) {
                scene.remove(cubeDestructionParticlesObject);
                cubeDestructionParticlesSimulator.splice(cubeDestructionParticlesSimulator.indexOf(cubeDestructionParticlesObject), 1);
            }
            else {
                // this is a bufferGeometry with a position attribute
                const cubeDestructionParticles = cubeDestructionParticlesObject.geometry.attributes.position.array;
                // if the length of the geometry is 0, remove this object from scene AND array, then skip
                if (cubeDestructionParticles.length == 0) {
                    scene.remove(cubeDestructionParticlesObject);
                    cubeDestructionParticlesSimulator.splice(cubeDestructionParticlesSimulator.indexOf(cubeDestructionParticlesObject), 1);
                    return;
                }
                for (let i = 0; i < cubeDestructionParticles.length; i += 3) {
                    if (Math.random() < 1 / physicsUpdatesPerSecond) {
                        // remove this vertex
                        cubeDestructionParticles[i] = 0;
                        cubeDestructionParticles[i + 1] = 0;
                        cubeDestructionParticles[i + 2] = 0;
                    }
                    else {
                        // get the position of the first matrix object
                        const position = new THREE.Vector3(
                            cubeDestructionParticles[i],
                            cubeDestructionParticles[i + 1],
                            cubeDestructionParticles[i + 2]
                        );
                        // apply velocity (they are Vector3s in the cubeDestructionParticlesObject.velocities array)
                        position.add(cubeDestructionParticlesObject.velocities[i / 3]);
                        // apply position
                        // if the world position Y is greater than 0
                        if (cubeDestructionParticles[i + 1] > 1) {
                            cubeDestructionParticles[i] = position.x;
                            cubeDestructionParticles[i + 1] = position.y;
                            cubeDestructionParticles[i + 2] = position.z;
                        }
                    }
                }
                cubeDestructionParticlesObject.geometry.attributes.position.needsUpdate = true;
            }
        });
    }
    else
    {
        wreckedMeshes.forEach(wreckedMesh => {
            if (wreckedMesh.count == 0) {
                scene.remove(wreckedMesh);
                wreckedMeshes.splice(wreckedMeshes.indexOf(wreckedMesh), 1);
                return;
            }
            // wreckedMesh is an instancedmesh.
            const matrix = new THREE.Matrix4();
            for (let i = 0; i < wreckedMesh.count; i++)
            {
                if (Math.random() < 1 / physicsUpdatesPerSecond) {
                    wreckedMesh.count--;
                    continue;
                }
                const velocity = wreckedMesh.velocities[i];
                // multiply velocity by 1.1
                velocity.multiplyScalar(1.02);
                wreckedMesh.getMatrixAt(i, matrix);
                const position = new THREE.Vector3();
                position.setFromMatrixPosition(matrix);

                // adjust the position by the velocity
                position.add(velocity);

                // apply some gravity (-1 y)
                // get the position of the first matrix object
                if (position.y > 1) {
                    velocity.y -= 1 / (physicsUpdatesPerSecond / 2);
                    matrix.setPosition(position);
                    wreckedMesh.setMatrixAt(i, matrix);
                    wreckedMesh.instanceMatrix.needsUpdate = true;
                }
                else
                {
                    if (!wreckedMesh.velocities[i].bounceCount) wreckedMesh.velocities[i].bounceCount = 1;
                    wreckedMesh.velocities[i].x /= 2.5;
                    wreckedMesh.velocities[i].y = 0.5 / wreckedMesh.velocities[i].bounceCount;
                    wreckedMesh.velocities[i].z /= 2.5;
                    wreckedMesh.velocities[i].bounceCount++;
                }
            }
        });
    }
}

setInterval(physicsUpdate, 1000 / physicsUpdatesPerSecond);

const createVizSphere = function (x, y, z, color=0x00ff00, size=1.5) {
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(size, 2, 2),
        new THREE.MeshBasicMaterial({ color: color })
    );
    sphere.position.set(x, y, z);
    scene.add(sphere);
}

const cubeSprite = new THREE.TextureLoader().load("img/cubesprite.png");
const conjunctionCheckTimesPerSecond = 1;
const recentlyEditedWorldModels = [];
const maxChunksInPhysicsCache = 15;
const conjunctionCheck = function () {

    const holeBorder = [];

    // CONJUNCTION CHECK
    recentlyEditedWorldModels.forEach(instancedModel => {
        // voxelPositions[instancedModel.name].voxels.forEach(voxel => {
        //     const fieldValue = voxelField.get(voxel.x, voxel.y, voxel.z).value;
        //     if (fieldValue == 0) {
        //         holeBorder.push(voxel);
        //     }
        // });
        // recentlyEditedWorldModels.splice(recentlyEditedWorldModels.indexOf(instancedModel), 1);
    });

    // if all voxels in the holeSet touch each other, then they are a hole.
    const startTime = performance.now();
    const confirmedTouch = [];
    holeBorder.forEach(holeA => {
        const holeApos = new THREE.Vector3(holeA.x, holeA.y, holeA.z);
        holeBorder.forEach(holeB => {
            const holeBpos = new THREE.Vector3(holeB.x, holeB.y, holeB.z);
            if (holeApos.distanceTo(holeBpos) < 2) {
                // if it isnt in the confirmedTouch array, add it
                if (!confirmedTouch.includes(holeA)) {
                    confirmedTouch.push(holeA);
                }
            }
        });
    });

    const fullHole = [];
    if (confirmedTouch.length == holeBorder.length) {
        const maxPositions = [];
        const minPositions = [];
        const clearedYPositions = []; // store Y positions that have at LEAST two X,Z positions
        for (let i = 1; i < holeBorder.length; i++) {
            // min positions for EVERY Y LEVEL
            if (minPositions[holeBorder[i].y] == undefined) {
                minPositions[holeBorder[i].y] = holeBorder[i];
            }
            else {
                if (holeBorder[i].x < minPositions[holeBorder[i].y].x) {
                    minPositions[holeBorder[i].y] = holeBorder[i];
                }
                if (holeBorder[i].z < minPositions[holeBorder[i].y].z) {
                    minPositions[holeBorder[i].y] = holeBorder[i];
                }
            }
            // max positions for EVERY Y LEVEL
            if (maxPositions[holeBorder[i].y] == undefined) {
                maxPositions[holeBorder[i].y] = holeBorder[i];
            }
            else {
                if (holeBorder[i].x > maxPositions[holeBorder[i].y].x) {
                    maxPositions[holeBorder[i].y] = holeBorder[i];
                }
                if (holeBorder[i].z > maxPositions[holeBorder[i].y].z) {
                    maxPositions[holeBorder[i].y] = holeBorder[i];
                }
            }
        }
        const hasAYPosition = function(x, z) {
            let count = 0;
            for (let i = 0; i < holeBorder.length; i++) {
                if (holeBorder[i].x == x && holeBorder[i].z == z) count++;
                if (count >= 2) return true;
            }
            return false;
        }
        for (let i = 1; i < minPositions.length; i++) {
            const minPos = minPositions[i];
            const maxPos = maxPositions[i];
            if (minPos == undefined || maxPos == undefined) continue;
            // if clearedYpositions does NOT include this Y position, or its length is less than 2, then skip it
            // for every voxel beween min and max, add it to the fullHole array
            for (let x = minPos.x; x <= maxPos.x; x++) {
                for (let z = minPos.z; z <= maxPos.z; z++) {
                    const voxel = voxelField.get(x, i, z);
                    if (!hasAYPosition(x, z)) continue;
                    if (voxel.value == 1) {
                        voxelField.set(x, i, z, 2, voxel.indexInChunk, voxel.chunk);
                        voxel.chunk.setMatrixAt(voxel.indexInChunk, new THREE.Matrix4().makeTranslation(0, -2, 0));
                        voxel.chunk.instanceMatrix.needsUpdate = true;

                        voxel.position = new THREE.Vector3(x, i, z);

                        fullHole.push(voxel);
                    }
                }
            }
        }
        const endTime = performance.now();
        console.log("conjunction check took " + (endTime - startTime) + " milliseconds");

        if (USERSETTINGS.useSpriteParticles) {
            const geometry = new THREE.BufferGeometry();
            const vertexPositions = [];
            const vertexColors = [];
            const material = new THREE.PointsMaterial({
                size: 2.5,
                map: cubeSprite,
                sizeAttenuation: true
            });
            const cubeDestructionParticles = new ParticleMesh(geometry, material);
            cubeDestructionParticles.velocities = [];
            for (let i = 0; i < fullHole.length; i++) {
                const voxelData = fullHole[i];
                if (voxelData == undefined) break;
                vertexPositions.push(voxelData.x, voxelData.y, voxelData.z);
                vertexColors.push(voxelData.color);
                // random velocity X,Y
                const velocityStrength = 1 / 5;
                cubeDestructionParticles.velocities.push(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * velocityStrength,
                        -(Math.random() + 0.5) * (velocityStrength * 5),
                        (Math.random() - 0.5) * velocityStrength
                    )
                );
            }
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertexPositions, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
            material.color = vertexColors[Math.floor(vertexColors.length / 2)]

            scene.add(cubeDestructionParticles);
            cubeDestructionParticles.frustumCulled = false;
            cubeDestructionParticlesSimulator.push(cubeDestructionParticles);
        }
        else
        {
            const wreckedMesh = new VoxelChunk(
                voxelGeometry,
                voxelMaterial,
                fullHole.length
            );
            wreckedMesh.velocities = [];
            for (let i = 0; i < fullHole.length; i++) {
                const voxelData = fullHole[i];
                if (voxelData == undefined) break;
                wreckedMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(voxelData.x, voxelData.y, voxelData.z));
                const velocityStrength = 0.5;
                wreckedMesh.velocities.push(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * velocityStrength,
                        -(Math.random() + 0.5) * velocityStrength,
                        (Math.random() - 0.5) * velocityStrength
                    )
                );
                wreckedMesh.setColorAt(i, voxelData.color);
            }
            scene.add(wreckedMesh);
            wreckedMeshes.push(wreckedMesh);
        }
    }
}

// setInterval(conjunctionCheck, conjunctionCheckTimesPerSecond * 1000);

document.addEventListener('mousedown', function (e) {
    // if right click
    if (e.button == 2) {
        conjunctionCheck();
        activateExplosives();
    }
});

// create an array of random numbers
const bankLength = 10;
const randomBank = [];
for (let i = 0; i < bankLength; i++) {
    randomBank.push(Math.random());
}
var bankIterator = 0;
const rapidFloat = () => { return randomBank[bankIterator++ % bankLength]; }
const shootRay = function (emitParticleEffect) {
    // RAYCAST INTO THE VOXEL FIELD
    // STEP 1: GET THE CAMERA POSITION
    // STEP 2: GET THE CAMERA DIRECTION
    // STEP 3: CALL voxelField.raycast() WITH THE CAMERA POSITION AND DIRECTION, and a step range of weaponRange
    // STEP 4: IF THE RAYCAST RETURNS A HIT, DESTROY THE VOXEL AT THAT POSITION
    // CAMERA POSITION
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    cameraPosition.x = Math.round(cameraPosition.x);
    cameraPosition.y = Math.round(cameraPosition.y);
    cameraPosition.z = Math.round(cameraPosition.z);
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    const intersection = voxelField.raycast(cameraPosition, cameraDirection, weaponRange);
    // Determine which voxels in chunk are to be destroyed
    if (intersection != null) {
        const currentModel = intersection.chunk;
        let destroyedVoxelsInChunk = [];

        const intersectPosition = new THREE.Vector3(
            intersection.x,
            intersection.y,
            intersection.z
        )

        if (emitParticleEffect)
        {
            const color = new THREE.Color(0xffdd8f);
            voxelField.get(intersectPosition.x, intersectPosition.y, intersectPosition.z).chunk.getColorAt(intersection.index, color);
            createParticleInstance(new ParticleEffect(
                /*count:*/Math.floor(Math.random() * 20),
                /*lifetime:*/5,
                /*color:Math.random() < 0.25 ? new THREE.Color(0xffec82) : */color,
                /*size:*/2,
                /*spread:*/new THREE.Vector3(1, 1, 1),
                /*direction:*/new THREE.Vector3((Math.random() - 0.5)/2.5, -1, (Math.random() - 0.5)/2.5),
                /*filePath:"./img/smoke/smoke"*/"./img/cubesprite.png",
                /*useRandomSprite:*/false, //true
                /*randomSpriteRange:*/3,
                /*useGravity:*/false,
                /*fadeOut:*/true
            ), intersectPosition);
        }

        // for every voxel within a destroyedChunkRange of the intersection, destroy it
        for (let x = intersectPosition.x - destroyedChunkRange; x <= intersectPosition.x + destroyedChunkRange; x++) {
            for (let y = intersectPosition.y - destroyedChunkRange; y <= intersectPosition.y + destroyedChunkRange; y++) {
                for (let z = intersectPosition.z - destroyedChunkRange; z <= intersectPosition.z + destroyedChunkRange; z++) {
                    const voxelPosition = new THREE.Vector3(
                        x,
                        y,
                        z
                    );

                    const distanceToIntersectPos = voxelPosition.distanceTo(intersectPosition);
                    // further the distance is from center, increase chance of missing
                    // use percentMissedHits (0-1)
                    if ((distanceToIntersectPos * percentMissedHits) < rapidFloat()) destroyedVoxelsInChunk.push(voxelPosition);
                }
            }
        }

        // 
        // ### ASSIGN PHYSICS
        // 
        // if recentlyeditedworldmodels DOES NOT HAVE currentmodel
        if (!recentlyEditedWorldModels.some(model => model.name == currentModel.name)) {
            recentlyEditedWorldModels.push(currentModel);
        }
        if (recentlyEditedWorldModels.length > maxChunksInPhysicsCache) recentlyEditedWorldModels.shift();
        generateDestroyedChunkAt(destroyedVoxelsInChunk);
    }
}

var explosives = [];
const plantExplosive = function() {

    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    cameraPosition.x = Math.round(cameraPosition.x);
    cameraPosition.y = Math.round(cameraPosition.y);
    cameraPosition.z = Math.round(cameraPosition.z);
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    const intersection = voxelField.raycast(cameraPosition, cameraDirection, 100);
    // Determine which voxels in chunk are to be destroyed
    if (intersection != null) {
        const weaponModel = instancedWeaponModel.clone();
        weaponModel.explodeRange = destroyedChunkRange;
        weaponModel.onBeforeRender = function() {return};
        weaponModel.renderOrder = 0;
        weaponModel.scale.multiplyScalar(weaponRealWorldScaleMultiplier);
        const intersectionPosition = new THREE.Vector3(
            intersection.x,
            intersection.y,
            intersection.z
        );
        intersectionPosition.addScaledVector(cameraDirection, -2);
        weaponModel.position.copy(intersectionPosition);
        scene.add(weaponModel);
        explosives.push(weaponModel);
    }
}

const activateExplosives = function() {
    explosives.forEach(explosive => {
        const position = new THREE.Vector3();
        explosive.getWorldPosition(position);
        // round
        position.x = Math.round(position.x/* + (explosive.scale.x/2) */);
        position.y = Math.round(position.y/* + (explosive.scale.y/2) */);
        position.z = Math.round(position.z/* + (explosive.scale.z/2) */);

        const damageRange = explosive.explodeRange;
        const destroyedVoxelsInChunk = [];

        // const vizSphere = new THREE.Mesh(
        //     new THREE.SphereGeometry(damageRange/2, 8, 8),
        //     new THREE.MeshBasicMaterial({color:0xff0000, wireframe:true})
        // );
        // vizSphere.position.copy(position);
        // scene.add(vizSphere);

        for (let x = -(damageRange/2); x <= (damageRange/2); x++) {
            for (let y = -(damageRange/2); y <= (damageRange/2); y++) {
                for (let z = -(damageRange/2); z <= (damageRange/2); z++) {
                    const voxelPosition = new THREE.Vector3(
                        x + position.x,
                        y + position.y,
                        z + position.z
                    );
                    const voxel = voxelField.get(voxelPosition.x, voxelPosition.y, voxelPosition.z);
                    if (voxel.value != 0) {
                        const crumbleRange = 5;
                        const distanceToExplosive = voxelPosition.distanceTo(position);
                        if (distanceToExplosive < damageRange/2 - crumbleRange) {
                            destroyedVoxelsInChunk.push(voxelPosition);
                        } else if (distanceToExplosive < damageRange/2) {
                            if (Math.random() < 0.5) destroyedVoxelsInChunk.push(voxelPosition);
                        }
                    }
                }
            }
        }

        scene.remove(explosive);
        explosive.geometry.dispose();

        generateDestroyedChunkAt(destroyedVoxelsInChunk, 0.05);
    });

    explosives = [];
}

render(); // calls render loop

// window resize handler
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}, false);

// DEBUG PANEL (in console)
document.addEventListener('keydown', function (e) {
    if (e.key == "p") {
        console.log("\n+==============================+\n")
        console.log("CAMERA POSITION");
        console.log(camera.position);
        console.log("draw calls #");
        console.log(renderer.info.render.calls);
        console.log("THREE SCENE");
        console.log(scene);
        console.log("instanced model index");
        console.log(instancedModelIndex);
        console.log("TRIVOXELS INDEX");
        console.log(triVoxelDroppedPieces);
        console.log("\n+==============================+\n")
    }
    if (e.key == 'e') camera.position.y += 10;
    if (e.key == 'q') camera.position.y -= 10;

    // stolen from stackoverflow:
    // guesses the size of an object
    if (e.key == 'z') {
        function roughSizeOfObject(object) {

            var objectList = [];
            var stack = [object];
            var bytes = 0;

            while (stack.length) {
                var value = stack.pop();

                if (typeof value === 'boolean') {
                    bytes += 4;
                }
                else if (typeof value === 'string') {
                    bytes += value.length * 2;
                }
                else if (typeof value === 'number') {
                    bytes += 8;
                }
                else if
                    (
                    typeof value === 'object'
                    && objectList.indexOf(value) === -1
                ) {
                    objectList.push(value);

                    for (var i in value) {
                        if (value.hasOwnProperty(i)) {
                            if (value[i] !== null) {
                                stack.push(value[i]);
                            }
                        }
                    }
                }
            }
            return bytes;
        }

        console.log('Rough size of all instancedmeshes in bytes: ');
        var total = 0;
        for (const mesh in instancedModelIndex) {
            total += roughSizeOfObject(instancedModelIndex[mesh]);
        }
        console.log(total);
    }
});

setHelpText("[WASD] Move [Mouse] Look");