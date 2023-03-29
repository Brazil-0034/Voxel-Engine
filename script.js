// This is my JavaScript-based Voxel game (engine)

// IMPORTS
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// (Requires Reload) builds the world with random chunk colors, among other changes
var debugMode = false;

// Sets the help text on the bottom center of the player's screen
const setHelpText = (text) => { document.querySelector("#help-text").innerHTML = text } 

// SCENE SETUP
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
// RENDERER SETUP
// Initializes the THREE.js renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.physicallyCorrectLights = true;
renderer.setClearColor(0x00ffff);
document.body.appendChild(renderer.domElement);

// LIGHTING
// Initializes the THREE.js lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
scene.add(hemiLight);
const path = 'skyboxes/SwedishRoyalCastle/';
const format = '.jpg';
const urls = [
    path + 'px' + format, path + 'nx' + format,
    path + 'py' + format, path + 'ny' + format,
    path + 'pz' + format, path + 'nz' + format
];
const reflectionCube = new THREE.CubeTextureLoader().load(urls);
reflectionCube.encoding = THREE.sRGBEncoding;
reflectionCube.mapping = THREE.CubeReflectionMapping;
scene.background = reflectionCube;

// PLAYER CAMERA
// Initializes the local player's camera, rendered to the canvas
const playerMoveSpeed = 50;
camera.position.set(93, 20, 108);
const controls = new PointerLockControls(camera, renderer.domElement);
controls.movementSpeed = 150;
controls.lookSpeed = 100;
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
document.addEventListener('keydown', function (e) {
    switch (e.code) {
        case 'KeyW':
            zAxis = -1;
            break;
        case 'KeyA':
            xAxis = -1;
            break;
        case 'KeyS':
            zAxis = 1;
            break;
        case 'KeyD':
            xAxis = 1;
            break;
        case 'ShiftLeft':
            sprinting = 5;
            break;
        case 'KeyF':
            toggleDebugMode();
            break;
        case 'KeyR':
            controls.getObject().position.set(0, 15, 0);
            break;
    }
});
document.addEventListener('keyup', function (e) {
    switch (e.code) {
        case 'KeyW':
            zAxis = 0;
            break;
        case 'KeyA':
            xAxis = 0;
            break;
        case 'KeyS':
            zAxis = 0;
            break;
        case 'KeyD':
            xAxis = 0;
            break;
        case 'ShiftLeft':
            sprinting = 1;
            break;
    }
});

// This is the ground floor, a simple large box that does not interact with the world 
const groundFloor = new THREE.Mesh(
    new THREE.BoxGeometry(1000, 1, 1000),
    new THREE.MeshStandardMaterial({ color: 0xe0e0e0 })
);
groundFloor.position.y = -1; // we set it just below the origin, to act as a floor
scene.add(groundFloor);

// This is a function that can clamp two numbers within a range.
// For some reason, it doesn't seem to exist in Vanilla JS? so we must write one ourselves:
const clamp = (number, min, max) => Math.max(min, Math.min(number, max));

// FILESYSTEM CONSTANTS
// These mark locations in the local file system that store the map and current weapon
const modelURL = 'maps/' + 'savedata.json';
const weaponURL = 'weapons/' + 'weapon_smg.json';
// This stores any JSON data that is loaded from the file system, on the main thread.
// Since only one thread can access the file system at a time, it is convenient to store the data here.
// TODO - this explanation sucks. just pass it between functions. too many globals.
let JSONData;

// WEAPON DATA
// These objects store data on the currently selected weapon, globally.
// They are global so we can access them from anywhere in the script, if necessary.
var weaponRange = 500,
    weaponPosition,
    weaponRotation,
    weaponRealWorldScaleMultiplier,
    weaponPlacementOffset,
    weaponScale,
    weaponHelpText,
    weaponType,
    rateOfFire, // time in ms in between attacks()
    destroyedChunkRange, // max distance for voxel destruction from intersection
    normalizedGuaranteeRate // minimum % that must be destroyed

// This stores every individual displaced voxel that is currently being simulated.
// TODO: Add gc to this, dead voxels still exist in the array. This will lead to memory problems in big maps.
let destroyedVoxels = [];

// This represents a cubic volume where every position with a voxel is labeled as 1, and every position ignoring a voxel is 0.
// The volume is infinite and stores 1s and 0s in a 3D array, along with other relevant information for voxel transformations.
class DiscreteVectorField {
    constructor() {
        this.field = [];
    }

    // Sets the value of the vector field at the given position
    set(x, y, z, value, indexInChunk, chunk) {
        x = Math.round(x);
        y = Math.round(y);
        z = Math.round(z);
        if (!this.field[x]) {
            this.field[x] = [];
        }
        if (!this.field[x][y]) {
            this.field[x][y] = [];
        }
        this.field[x][y][z] = {
            value: value,
            indexInChunk: indexInChunk,
            chunk: chunk
        };
    }

    // Retrieves the value of the vector field at the given position
    // 0 if none
    get(x, y, z) {
        if (this.field[x] && this.field[x][y] && this.field[x][y][z]) {
            return this.field[x][y][z];
        }
        return 0;
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
            if (stepVoxel.value === 1) {
                return {
                    x: x,
                    y: y,
                    z: z,
                    indexInChunk: stepVoxel.indexInChunk,
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

// This is my 3D physics implementation for the DiscreteVectorField.
// It is used when testing the physics of a voxel map, but not in the game as of now.
const gravitationalConstant = 0.01;
const airResistance = 0.99;
const physicsBodies = [];
class DiscreteVectorFieldPhysicsObject {
    constructor(position, range, velocity, mass, sceneObject) {
        this.position = position; // an integer rounded position (ALL PHYSICS OBJECTS MUST BE INTEGER POSITIONED)
        this.range = range; // the radius of the sphere
        this.velocity = velocity; // the initial speed (and direction, normalized) of the object's motion
        this.mass = mass; // the mass (to multiply with world gravity)
        this.sceneObject = sceneObject; // the THREE.js object to update the position of

        // convert position to integer
        this.position.x = Math.round(this.position.x);
        this.position.y = Math.round(this.position.y);
        this.position.z = Math.round(this.position.z);

        this.hasCollided = false;
    }

    update() {
        // // STEP 1: UPDATE VELOCITY by multiplying it by resistance
        // this.velocity.x *= airResistance;
        // this.velocity.y *= airResistance;
        // this.velocity.z *= airResistance;

        //  STEP 2: UPDATE VELOCITY by adding gravity
        this.velocity.y -= gravitationalConstant * this.mass;

        // STEP 3: UPDATE POSITION by adding velocity
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.position.z += this.velocity.z;

        // STEP 4: CHECK FOR COLLISIONS
        // check if the object is colliding with a voxel

        const intersection = voxelField.raycast(this.position, this.velocity, this.range);
        // debug:
        // const arrowHelper = new THREE.ArrowHelper(this.velocity, raycastOrigin, this.range, 0xffff00);
        // scene.add(arrowHelper);

        if (intersection) {
            console.log('intersection');

            // remove this from the physicsBodies array so we do not traverse dead items (gc)
            const index = physicsBodies.indexOf(this);
            if (index > -1) {
                physicsBodies.splice(index, 1);
            }

            // scene.remove(this.sceneObject);

            const currentModel = intersection.chunk;
        }

        // STEP 5: UPDATE THE SCENE OBJECT'S POSITION
        this.sceneObject.position.x = this.position.x;
        this.sceneObject.position.y = this.position.y;
        this.sceneObject.position.z = this.position.z;
    }
}

// This starts building the map, loaded from modelURL (at the top of the file)
// It attempts to load the JSON file, and allows quick transformations to the file (if needed / between versions) before calling buildJSONModel(), which actually builds the instanceMeshes
// (Only one map can be loaded at once... unless?)
// TODO - origin offsets for multiple map loading?
//  ^ this is very unncessary but could be useful for features like streaming
const generateModelWorld = function (modelURL) {
    if (!JSONData) {
        let loader = new THREE.FileLoader();
        loader.load(
            modelURL,
            function (jsondata) {
                JSONData = jsondata;
                buildJSONModel();
            },
            function (err) {
                // console.log(err);
            }
        );
    }
    else {
        buildJSONModel();
    }
}
// VOXEL OBJECT DATA
const voxelSize = 1; // the relative size of voxels
let voxelGeometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
const voxelMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    // roughness: 0.0,
    // envMap: reflectionCube
});

// Maximum size for chunking
// Lower size = fewer chunks
// It is best to alter this dynamically between maps for performance
// TODO implement some algorithm to determine this value on the fly
let maxChunkSize = 150;
maxChunkSize = Math.pow(maxChunkSize, 2); // squares it cuz why not? :3

let instancedModelIndex = []; // An index of all instancedMeshes (which for my own sake, are called Models instead)
let voxelPositions = []; // same as above, but contains voxels, for later physics simulations
const buildJSONModel = function () {
    const startTime = Date.now();
    let voxelPositionsFromFile = JSON.parse(JSONData).voxels;
    let foundCount = 0;
    // create an instancedmesh cube to represent each point
    const numberOfChunks = Math.ceil(voxelPositionsFromFile.length / maxChunkSize);
    const chunkSize = Math.ceil(voxelPositionsFromFile.length / numberOfChunks);
    let globalVoxelIterator = 0;
    for (let i = 0; i < numberOfChunks; i++) {
        // For every chunk ...
        let instancedWorldModel = new THREE.InstancedMesh(
            voxelGeometry,
            voxelMaterial,
            chunkSize
        );
        instancedWorldModel.name = i;
        let localVoxelIterator = 0;
        let startPos = globalVoxelIterator;
        let voxelsInChunk = [];
        let thisVoxelColor = new THREE.Color(0xffffff);
        const thisChunkDebugColor = new THREE.Color(Math.random(), Math.random(), Math.random());
        for (let x = globalVoxelIterator; x < startPos + chunkSize; x++) {
            const thisVoxelData = voxelPositionsFromFile[globalVoxelIterator];
            if (thisVoxelData != undefined) {
                thisVoxelColor = new THREE.Color("rgb(" + thisVoxelData.r + "," + thisVoxelData.g + "," + thisVoxelData.b + ")");
                if (debugMode) thisVoxelColor = thisChunkDebugColor;
                const thisVoxelPosition = new THREE.Vector3(thisVoxelData.x, thisVoxelData.y, thisVoxelData.z);
                // if the color is BLACK, set its position to the origin
                if (thisVoxelColor.r == 0 && thisVoxelColor.g == 0 && thisVoxelColor.b == 0) {
                    thisVoxelPosition.set(0, 0, 0);
                    console.log("Voxel Blacked");
                }
                // multiply by voxel size to get correct position
                thisVoxelPosition.multiplyScalar(voxelSize);
                // adjust floor color
                if (globalVoxelIterator == 0) groundFloor.material.color.set(thisVoxelColor);
                instancedWorldModel.setMatrixAt(localVoxelIterator, new THREE.Matrix4().makeTranslation(thisVoxelPosition.x, thisVoxelPosition.y, thisVoxelPosition.z));
                instancedWorldModel.setColorAt(localVoxelIterator, thisVoxelColor);
                voxelsInChunk.push(thisVoxelData);
                voxelField.set(thisVoxelData.x, thisVoxelData.y, thisVoxelData.z, 1, localVoxelIterator, instancedWorldModel);
                globalVoxelIterator++;
                localVoxelIterator++;
            }
        }
        voxelPositions.push({
            chunkID: instancedWorldModel.name,
            voxels: voxelsInChunk
        });
        instancedModelIndex.push(instancedWorldModel);
        instancedWorldModel.instanceMatrix.needsUpdate = true;
        scene.add(instancedWorldModel);
        convertInstancedMeshtoConvexHull(instancedWorldModel); // leftover code for computing hulls for physics. may return to this later for volumetric explosions.
    }
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    console.log("DONE GENERATING with " + foundCount + " destroyed voxels and " + globalVoxelIterator + " total voxels in " + totalTime + "ms");
}

generateModelWorld(modelURL); // finally, we load and generate the model!

// TODO i realize i wrote most of this while high out of my mind but this function chain might be the worst piece of code i've ever written
// like there are two wholly unnecessary, single-use function calls here for the same exact thing?
// maybe in a networked game it may be necessary ... maybe it's not so dumb after all ...
// ill look into it later.
const generateModelWeapon = function (modelURL) {
    let loader = new THREE.FileLoader();
    loader.load(
        modelURL,
        function (jsondata) {
            buildJSONWeapon(jsondata);
        },
        function (err) {
            // console.log(err);
        }
    );
}

var instancedWeaponModel;
const weaponModelMaterial = new THREE.MeshStandardMaterial({
    // highly reflective for funzies / make it contrast
    envMap: reflectionCube,
    roughness: 0,
    color: 0xffffff
});
var instancedWeaponTarget; // target position for instancedWeapon (for lerping :P)
const buildJSONWeapon = function (jsondata) {
    let jsonModel = JSON.parse(jsondata);
    let voxelPositionsFromFile = jsonModel.voxels;
    instancedWeaponModel = new THREE.InstancedMesh(
        voxelGeometry,
        weaponModelMaterial,
        voxelPositionsFromFile.length
    );
    // make it render above everything else, cuz FPS!!
    instancedWeaponModel.renderOrder = 1000;
    instancedWeaponModel.onBeforeRender = function (renderer) { renderer.clearDepth(); };
    instancedWeaponModel.name = jsonModel.weaponData.name;
    instancedWeaponTarget = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
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
    normalizedGuaranteeRate = jsonModel.weaponData.basepotency;
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
}

generateModelWeapon(weaponURL); // same as map, but for the weapon!

// Represents a physical voxel object to be tracked!
// ya see, the lil cubes floating (when u break something) around are entirely new objects,
// and the voxels actually in the instancedmeshes are just eradicated from existence
class trackedVoxel {
    constructor(sceneObject, color) {
        this.sceneObject = sceneObject;
        this.color = color;
    }
}

const shootRay = function () {
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
    if (intersection != null) {
        const color = new THREE.Color(0, 0, 0);
        const currentModel = intersection.chunk;
        const allVoxelsInChunk = voxelPositions[currentModel.name].voxels;
        let destroyedVoxelsInChunk = [];
        for (let i = 0; i < allVoxelsInChunk.length; i++) {
            let currentRange = destroyedChunkRange * clamp(Math.random() + normalizedGuaranteeRate, 0, 1);
            const voxelPosition = new THREE.Vector3(
                allVoxelsInChunk[i].x,
                allVoxelsInChunk[i].y,
                allVoxelsInChunk[i].z
            );
            const distance = voxelPosition.distanceTo(intersection);
            if (distance < currentRange) {
                if (destroyedVoxelsInChunk.length % 10 == 0) currentRange = Math.floor(Math.random() * currentRange) + 10;
                destroyedVoxels.push(voxelPosition);
                const newCube = new THREE.BoxGeometry(1, 1, 1);
                currentModel.getColorAt(i, color);
                const newCubeMaterial = new THREE.MeshStandardMaterial({ color: color });
                const newCubeMesh = new THREE.Mesh(newCube, newCubeMaterial);
                newCubeMesh.position.set(voxelPosition.x, voxelPosition.y, voxelPosition.z);
                const voxel = new trackedVoxel(newCubeMesh, color);
                destroyedVoxelsInChunk.push(voxel);
            }
        }
        generateDestroyedChunkAt(currentModel.name, allVoxelsInChunk, destroyedVoxelsInChunk, currentModel);
    }
}

// TODO: for future physics engine enhancements, this could be useful for volumetric smoke/explosions
const convexMeshes = [];
const convertInstancedMeshtoConvexHull = function (imesh) {
    // ### STEP 1 ###
    // get the Vector3 positions of all the instances in imesh.getMatrixAt(i) for imesh.count
    // const points = [];
    // for (let i = 0; i < imesh.count; i++) {
    //     const matrix = new THREE.Matrix4();
    //     imesh.getMatrixAt(i, matrix);
    //     const position = new THREE.Vector3();
    //     position.setFromMatrixPosition(matrix);
    //     // if the position is NOT 0,0,0
    //     if (position.x != 0 || position.y != 0 || position.z != 0) {
    //         points.push(position);
    //     }
    // }

    // // ### STEP 2 ###
    // // create a convex hull from the points
    // const meshGeometry = new ConvexGeometry(points);
    // const convexMesh = new THREE.Mesh(meshGeometry, new THREE.MeshBasicMaterial({color: 0xffffff * Math.random()}));
    // convexMesh.userData.relatedInstancedMesh = imesh;

    // convexMeshes.push(convexMesh);
    // scene.add(convexMesh);
}
const toggleDebugMode = function () {
    for (let i = 0; i < convexMeshes.length; i++) {
        convexMeshes[i].visible = !convexMeshes[i].visible;
    }
}

// Dict of tracked voxels for physics... i think? idrk, wrote this awhile ago
const triVoxelDroppedPieces = [];
const generateDestroyedChunkAt = function (modelName, allVoxelsInChunk, destroyedVoxelsInChunk) {
    const color = new THREE.Color(0, 0, 0);
    const model = scene.getObjectByName(modelName);
    for (let i = 0; i < allVoxelsInChunk.length; i++) {
        // get the position of the block
        const voxelPosition = new THREE.Vector3(
            allVoxelsInChunk[i].x,
            allVoxelsInChunk[i].y,
            allVoxelsInChunk[i].z
        );
        // if it exists in destroyedVoxelsInChunk, tset its matrix position to 0,0,0
        let found = false;
        for (let x = 0; x < destroyedVoxelsInChunk.length; x++) {
            const thisDestroyedVoxelPosition = destroyedVoxelsInChunk[x].sceneObject.position;
            if (voxelPosition.x == thisDestroyedVoxelPosition.x && voxelPosition.y == thisDestroyedVoxelPosition.y && voxelPosition.z == thisDestroyedVoxelPosition.z) {
                // set its position using setMatrixAt to far away
                // setTimeOut 10 ms
                found = true;
                setTimeout(function () {
                    model.setMatrixAt(i, new THREE.Matrix4().makeTranslation(0, 0, 0));
                    // set matrix world needs to be called after setMatrixAt
                    model.instanceMatrix.needsUpdate = true;
                    voxelField.set(voxelPosition.x, voxelPosition.y, voxelPosition.z, 0, x, model);
                }, 100 * Math.random());
                break;
            }
        }
        model.getColorAt(i, color)
        if (Math.random() < 1 && found) {
            // if (Object.keys(triVoxelDroppedPieces).length < 250)
            {
                if (Math.random() < 0.1)
                {
                    const triVoxel = new THREE.Mesh(
                        // cone with minimal segments
                        new THREE.BoxGeometry(1, 1, 1),
                        new THREE.MeshStandardMaterial({ color: color })
                    );
                    // for some reason i named the destroyed pieces of a mesh 'trivoxels', prolly cuz they were originally triangular prisms.
                    // that has changed since, but the name still slaps.
                    triVoxel.name = "TRIVOXEL-" + Math.random();
                    scene.add(triVoxel);
                    const x = parseInt(voxelPosition.x);
                    const y = parseInt(voxelPosition.y);
                    const z = parseInt(voxelPosition.z);
                    triVoxel.position.set(x, y, z);
                    
                    // velocity (random)
                    const velocityRange = 0.25;
                    const triVoxelVelocity = new THREE.Vector3(
                        (Math.random() * velocityRange) - (velocityRange / 2),
                        (Math.random() * velocityRange) - (velocityRange / 2),
                        (Math.random() * velocityRange) - (velocityRange / 2)
                    );

                    // normalize the velocity
                    triVoxelVelocity.normalize();
    
                    triVoxelDroppedPieces.push({
                        "sceneObject" : triVoxel,
                        "velocity" : triVoxelVelocity
                    });
                }
            }
        }
    }
};

// MOUSE BUTTONS
var isLeftClicking = false;
document.addEventListener('mousedown', (e) => { if (e.button != 0) return; isLeftClicking = true; });
document.addEventListener('mouseup', (e) => { if (e.button != 0) return; isLeftClicking = false; });

// MUZZLE FLASH (for weapons)
const muzzleFlash = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 2, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
);
muzzleFlash.name = "muzzleFlash";
camera.add(muzzleFlash);
const muzzleFlashReverseAngle = muzzleFlash.clone();
muzzleFlashReverseAngle.rotateZ(-90 * Math.PI / 180);
camera.add(muzzleFlashReverseAngle);
muzzleFlash.attach(muzzleFlashReverseAngle);
muzzleFlash.add(new THREE.PointLight(0xffffff, 1, 100));
var isAttackAvailable = true;

// ### RENDER LOOP ###
// this renders things. separate from the physics loop.
const clock = new THREE.Clock();
var frameRate = 0;
const render = function () {
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
    if (instancedWeaponModel && instancedWeaponTarget && delta > 0) {
        const instancedWeaponTargetWorldPosition = new THREE.Vector3();
        instancedWeaponTarget.getWorldPosition(instancedWeaponTargetWorldPosition);
        instancedWeaponModel.position.lerp(instancedWeaponTargetWorldPosition, 30 * delta);
        instancedWeaponModel.rotation.setFromRotationMatrix(instancedWeaponTarget.matrixWorld);
        muzzleFlash.position.set(weaponPosition.x - 1, weaponPosition.y + 8, weaponPosition.z - 8);
    }
    if (isLeftClicking) {
        switch (weaponType) {
            default:
                console.error("Illegal Weapon Type - \"" + weaponType + "\"");
                break;
            case "ranged":
                muzzleFlash.visible = false;
                if (isAttackAvailable) {
                    muzzleFlash.visible = true;
                    const scaleRange = 0.15;
                    const rotationRange = 0.6;
                    muzzleFlash.scale.set(Math.random() * scaleRange + 1, Math.random() * scaleRange + 1, Math.random() * scaleRange + 1);
                    muzzleFlash.rotation.z = Math.random() * rotationRange - rotationRange / 2;
                    const baseColor = new THREE.Color(0xffdfbd);
                    const randomColor = baseColor.offsetHSL(Math.random() * 0.2 - 0.1, Math.random() * 0.2 - 0.1, Math.random() * 0.2 - 0.1);
                    muzzleFlash.material.color = randomColor;
                    shootRay();
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
                    const physicsModel = instancedWeaponModel.clone();
                    physicsModel.renderOrder = 0;
                    physicsModel.scale.set(
                        instancedWeaponModel.scale.x * (weaponRealWorldScaleMultiplier),
                        instancedWeaponModel.scale.y * (weaponRealWorldScaleMultiplier),
                        instancedWeaponModel.scale.z * (weaponRealWorldScaleMultiplier)
                    );
                    physicsModel.position.copy(mouseRayFollower.position);
                    physicsModel.rotation.copy(mouseRayFollower.rotation);
                    scene.add(physicsModel);
                    const direction = new THREE.Vector3();
                    camera.getWorldDirection(direction);
                    physicsModel.position.addScaledVector(direction, -2);
                    physicsModel.rotateY(-90 * Math.PI / 180);
                    physicsModel.rotateX(-90 * Math.PI / 180);
                    physicsModel.position.addScaledVector(direction, weaponPlacementOffset.z);
                    physicsModel.position.addScaledVector(camera.up, weaponPlacementOffset.y);
                    physicsModel.position.addScaledVector(new THREE.Vector3().crossVectors(camera.up, direction), weaponPlacementOffset.x);
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
    if (weaponType == "explosive")
    {
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
    requestAnimationFrame(render);
    renderer.render(scene, camera);
}

// ### PHYSICS LOOP ###
const timesPerSecond = 60; // physics speed
const physicsUpdate = function () {
    // for each sceneObject in triVoxelDroppedPieces
    triVoxelDroppedPieces.forEach((triVoxel) => {
        if (Math.random() < 1 / timesPerSecond) {
            scene.remove(triVoxel.sceneObject);
            triVoxelDroppedPieces.splice(triVoxelDroppedPieces.indexOf(triVoxel), 1);
        }
        else
        {
            const sceneObject = triVoxel.sceneObject;
            const velocity = triVoxel.velocity;
            
            const newPosition = new THREE.Vector3(
                sceneObject.position.x + velocity.x,
                sceneObject.position.y + velocity.y,
                sceneObject.position.z + velocity.z
            );
    
            // apply some gravity (-1 y)
            velocity.y -= 1 / (timesPerSecond / 2);
    
            sceneObject.position.copy(newPosition);
        }
    });
}

setInterval(physicsUpdate, 1000 / timesPerSecond); // calls physics loop
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