// IMPORTS
import * as CANNON from '/node_modules/cannon-es/dist/cannon-es.js';
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

var debugMode = false;

// Raycast Acceleration using THREE-MESH-BVH
// THREE.InstancedMesh.prototype.raycast = acceleratedRaycast;

// SCENE
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 );
const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82 * 10, 0)
});

// RENDERER
const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
// set dpi
renderer.setPixelRatio(window.devicePixelRatio);
renderer.physicallyCorrectLights = true;
renderer.setClearColor( 0x00ffff );
document.body.appendChild( renderer.domElement );

// POST PROCESSING
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);

// MOTION BLUR PASS

composer.addPass(renderPass);

// PHOTOREALISTIC LIGHTING
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
scene.add(hemiLight);

// cubemap
const path = 'SwedishRoyalCastle/';
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

// first person camera
const playerMoveSpeed = 50;
camera.position.set(93, 20, 108);
const controls = new PointerLockControls(camera, renderer.domElement);
controls.movementSpeed = 150;
controls.lookSpeed = 100;
scene.add(controls.getObject());

document.body.addEventListener('click', function () {
    controls.lock();
});

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

const groundFloor = new THREE.Mesh(
    new THREE.BoxGeometry(1000, 1, 1000),
    new THREE.MeshStandardMaterial({color: 0xe0e0e0})
);
groundFloor.position.y = -1;
scene.add(groundFloor);

// material for bouncy objects
const bouncyMaterial = new CANNON.Material('bouncyMaterial');
// material for the ground
const groundMaterial = new CANNON.Material('groundMaterial');
// contact material to make the ground bouncy
const groundBouncyContactMaterial = new CANNON.ContactMaterial(groundMaterial, bouncyMaterial, {
    friction: 0.1,
    restitution: 0.25,
});
// add the contact material to the world
world.addContactMaterial(groundBouncyContactMaterial);

const groundBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(groundFloor.position.x, groundFloor.position.y, groundFloor.position.z),
    shape: new CANNON.Box(new CANNON.Vec3(1000, 1, 1000)),
    type: CANNON.Body.STATIC,
    material: groundMaterial
});

world.addBody(groundBody);

const clamp = (number, min, max) => Math.max(min, Math.min(number, max));

const modelURL = 'maps/' + 'roads.json';
const weaponURL = 'weapons/' + 'weapon_ar.json';
const weaponRange = 500;

let destroyedVoxels = [];
let JSONData;

// a cubic volume where every position with a voxel is labeled as 1, and every position ignoring a voxel is 0.
// the cube is infinite and does not have a set volume size
// the cube is a 3D array of 1s and 0s
class DiscreteVectorField {
    constructor() {
        this.field = [];
    }

    // Sets the value of the vector field at the given position
    set(x, y, z, value, indexInChunk, chunk) {
        // round to nearest integer
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
        let x = origin.x;
        let y = origin.y;
        let z = origin.z;

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
        return null;
    }

    // tostring
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
const voxelField = new DiscreteVectorField();
const generateModelWorld = function(modelURL) {
    if (!JSONData)
    {
        let loader = new THREE.FileLoader();
        loader.load(
            modelURL,
            function(jsondata) {
                JSONData = jsondata;
                buildJSONModel();
            },
            function(err) {
                // console.log(err);
            }
        );
    }
    else
    {
        buildJSONModel();
    }
}

const voxelSize = 1;
let voxelGeometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
const voxelMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    // roughness: 0.0,
    // envMap: reflectionCube
});

let maxChunkSize =  150;
maxChunkSize = Math.pow(maxChunkSize, 2);
let instancedModelIndex = [];

// dict with chunk instancedmesh : array of voxel objects in that chunk
let voxelPositions = [];

const buildJSONModel = function(jsondata) {

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
            if (thisVoxelData != undefined)
            {
                thisVoxelColor = new THREE.Color("rgb(" + thisVoxelData.red + "," + thisVoxelData.green + "," + thisVoxelData.blue + ")");
                if (debugMode) thisVoxelColor = thisChunkDebugColor;
                const thisVoxelPosition = new THREE.Vector3(thisVoxelData.x, thisVoxelData.y, thisVoxelData.z);
                // if the color is BLACK, set its position to the origin
                if (thisVoxelColor.r == 0 && thisVoxelColor.g == 0 && thisVoxelColor.b == 0) thisVoxelPosition.set(0, 0, 0);

                // multiply by voxel size to get correct position
                thisVoxelPosition.multiplyScalar(voxelSize);

                // adjust floor color
                if (globalVoxelIterator == 0) groundFloor.material.color.set(thisVoxelColor);
    
                instancedWorldModel.setMatrixAt(localVoxelIterator, new THREE.Matrix4().makeTranslation(thisVoxelPosition.x, thisVoxelPosition.y, thisVoxelPosition.z));
    
                const color = thisVoxelColor;
                instancedWorldModel.setColorAt(localVoxelIterator, color);
                voxelsInChunk.push(thisVoxelData);

                voxelField.set(thisVoxelData.x, thisVoxelData.y, thisVoxelData.z, 1, localVoxelIterator, instancedWorldModel);
    
                globalVoxelIterator++;
                localVoxelIterator++;

            }
        }



        // voxelPositions dict with chunk instancedmesh : array of voxel objects in that chunk
        voxelPositions.push({
            chunkID: instancedWorldModel.name,
            voxels: voxelsInChunk
        });


        instancedModelIndex.push(instancedWorldModel);
        instancedWorldModel.instanceMatrix.needsUpdate = true;
        scene.add(instancedWorldModel);

        convertInstancedMeshtoConvexHull(instancedWorldModel);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log("DONE GENERATING with " + foundCount + " destroyed voxels and " + globalVoxelIterator + " total voxels in " + totalTime + "ms");
}


generateModelWorld(modelURL);

// TODO i realize i wrote most of this while high out of my mind but this function chain might be the worst piece of code i've ever written
// like there are two wholly unnecessary, single-use function calls here for the same exact thing?
// maybe in a networked game it may be necessary ... maybe it's not so dumb after all ...
// ill look into it later.
const generateModelWeapon = function(modelURL) {
    let loader = new THREE.FileLoader();
    loader.load(
        modelURL,
        function(jsondata) {
            buildJSONWeapon(jsondata);
        },
        function(err) {
            // console.log(err);
        }
    );
}

var instancedWeaponModel;
const weaponModelMaterial = new THREE.MeshStandardMaterial({
    // highly reflective
    envMap: reflectionCube,
    roughness: 0,
    color: 0xffffff
});
var instancedWeaponTarget;

const weaponPosition = new THREE.Vector3(7, -10, -20);
const buildJSONWeapon = function(jsondata) {
    let jsonModel = JSON.parse(jsondata);
    let voxelPositionsFromFile = jsonModel.voxels;

    instancedWeaponModel = new THREE.InstancedMesh(
        voxelGeometry,
        weaponModelMaterial,
        voxelPositionsFromFile.length
    );
    // make it render above everything else
    instancedWeaponModel.renderOrder = 1000;
    instancedWeaponModel.onBeforeRender = function (renderer) { renderer.clearDepth(); };

    instancedWeaponTarget = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({color: 0xff0000})
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

    // add the weapon to the scene
    scene.add(instancedWeaponModel);
    // set the position to just in front of, to the right of the camera
    instancedWeaponTarget.position.copy(weaponPosition);
    // on press of up arrow, move the weapon up
    document.addEventListener('keydown', function(event) {
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
        if (event.key == '3')
        {
            // rotate X
            instancedWeaponTarget.rotation.z += Math.PI / 100;
        }
        if (event.key == '4')
        {
            instancedWeaponTarget.rotation.z -= Math.PI / 100;
            console.log(instancedWeaponTarget.rotation);
        }
        if (event.key == '5')
        {
            // rotate Y
            instancedWeaponTarget.rotation.y += Math.PI / 100;
        }
        if (event.key == '6')
        {
            instancedWeaponTarget.rotation.y -= Math.PI / 100;
            console.log(instancedWeaponTarget.rotation);
        }
    });
    // set euler 0.06283185307179587, 1.4959965017094252, 0
    instancedWeaponTarget.rotation.set(0.06283185307179587, 1.4959965017094252, 0);
    
    // make the instancedWeaponTarget follow the camera while keeping the same offset
}

generateModelWeapon(weaponURL);

const voxelLifetime = 5;
const voxelLifetimeVariability = voxelLifetime/2;

/**
 * An individual voxel to be tracked by the physics engine.
 */
class trackedVoxel {
    constructor(sceneObject, color) {
        this.sceneObject = sceneObject;
        this.color = color;
    }
}

// put a big green cube at 0, 0, 0
const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({color: 0x00ff00})
);
scene.add(cube);

/**
 * A chunk of trackedVoxels being tracked by the physics engine.
 * Voxels in the chunk will move together.
 */
class trackedVoxelChunk {
    constructor(voxels) {
        // positional
        this.sceneObjects = voxels;

        // get the max and min Y, max and min X for sceneObjects, along with the center point
        let maxY = Math.max(...voxels.map(v => v.sceneObject.position.y));
        let minY = Math.min(...voxels.map(v => v.sceneObject.position.y));
        let maxX = Math.max(...voxels.map(v => v.sceneObject.position.x));
        let minX = Math.min(...voxels.map(v => v.sceneObject.position.x));
        let minZ = Math.min(...voxels.map(v => v.sceneObject.position.z));
        let maxZ = Math.max(...voxels.map(v => v.sceneObject.position.z));

        let center = new THREE.Vector3(
            (maxX + minX) / 2,
            (maxY + minY) / 2,
            (maxZ + minZ) / 2
        );

        // create a parentObject to merge all voxels into one geometry
        this.parentObject = new THREE.Object3D();
        this.parentObject.position.set(center.x, center.y, center.z);
        scene.add(this.parentObject);

        const geometries = [];

        let newcolor = new THREE.Color();

        let placed = false;
        // for each voxel
        this.sceneObjects.forEach(v => {
            return;
            // adjust positions
            let realVoxelPosition = new THREE.Vector3(
                v.sceneObject.position.x - center.x,
                v.sceneObject.position.y - center.y,
                v.sceneObject.position.z - center.z
            )

            if (placed == false)
            {
                // put a red sphere size 2 at the realVoxelPosition
                // const sphere = new THREE.Mesh(
                //     new THREE.SphereGeometry(2),
                //     new THREE.MeshStandardMaterial({color: 0xff0000})
                // );
                // sphere.position.set(v.sceneObject.position.x, v.sceneObject.position.y, v.sceneObject.position.z);
                // scene.add(sphere);
                placed = true;
            }

            // if it exists in destroyedVoxels, skip it
            if (destroyedVoxels.includes(realVoxelPosition)) {
                console.log("skipping destroyed voxel");
                return;
            }

            v.sceneObject.geometry.translate(realVoxelPosition.x, realVoxelPosition.y, realVoxelPosition.z);
            newcolor = v.color;

            // aligning world positions
            this.parentObject.updateWorldMatrix(true, false);
            v.sceneObject.geometry.applyMatrix4(this.parentObject.matrixWorld);
            
            // push to array
            geometries.push(v.sceneObject.geometry);
        });

        // console.log("Meshing geometry with length " + geometries.length);
        // const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
        // const mergedMesh = new THREE.Mesh(mergedGeometry, new THREE.MeshStandardMaterial({color: newcolor}));
        // mergedMesh.position.set(center.x, center.y, center.z);
        // this.parentObject.add(mergedMesh);
        // mergedMesh.position.set(-mergedMesh.position.x, -mergedMesh.position.y, -mergedMesh.position.z);
        
        // draw a boundingbox for the merged mesh
        // const bbox = new THREE.Box3().setFromObject(mergedMesh);
        // const bboxHelper = new THREE.Box3Helper(bbox, 0xffffff * Math.random());
        // scene.add(bboxHelper);
        
        // this.physicsBody = new CANNON.Body({
        //     mass: 1,
        //     position: new CANNON.Vec3(center.x, center.y, center.z),
        //     shape: new CANNON.Box(new CANNON.Vec3(
        //         maxX - minX,
        //         maxY - minY,
        //         maxZ - minZ
        //     )),
        // });


        // world.addBody(this.physicsBody);

        // // velocity based on camera direction
        // const force = -50;
        // const cameraDirection = new THREE.Vector3(
        //     camera.position.x - center.x,
        //     camera.position.y - center.y,
        //     camera.position.z - center.z
        // );
        // cameraDirection.normalize();
        // this.physicsBody.velocity.set(
        //     cameraDirection.x * force,
        //     0,
        //     cameraDirection.z * force
        // );

        // // time of life
        this.secondsAlive = 0;
        this.lifetime = voxelLifetime + Math.floor(Math.random() * voxelLifetimeVariability);

        // visual
        this.color = color;
    }
}

const trackedVoxelChunks = [];

let destroyedChunkRange = 2; // max distance for voxel destruction from intersection
const normalizedGuaranteeRate = 0.15; // minimum % that must be destroyed

const color = new THREE.Color( 0, 0, 0 );
var lastObjectIntersected;
const shootRay = function(event) {

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

    // CAMERA DIRECTION
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    // round the direction to the nearest integer

    // RAYCAST
    const intersection = voxelField.raycast(cameraPosition, cameraDirection, weaponRange);
    
    if (intersection != null)
    {
        // intersection is an object with x, y, z, and indexInChunk, and the chunk it's in

        const currentModel = intersection.chunk;

        const allVoxelsInChunk = voxelPositions[currentModel.name].voxels;

        let destroyedVoxelsInChunk = [];
        // get the matrixes of all the cubes around the clicked cube
        for ( let i = 0; i < allVoxelsInChunk.length; i++ ) {

            let currentRange = destroyedChunkRange * clamp(Math.random() + normalizedGuaranteeRate, 0, 1);

            const voxelPosition = new THREE.Vector3(
                allVoxelsInChunk[i].x,
                allVoxelsInChunk[i].y,
                allVoxelsInChunk[i].z
            );
            const distance = voxelPosition.distanceTo( intersection );

            if ( distance < currentRange ) {
                if (destroyedVoxelsInChunk.length % 10 == 0) currentRange = Math.floor(Math.random() * currentRange) + 10;
                
                destroyedVoxels.push( voxelPosition );

                // create a new cube at the position of the clicked cube, with the color of the clicked cube
                const newCube = new THREE.BoxGeometry(1, 1, 1);

                currentModel.getColorAt(i, color);
                const newCubeMaterial = new THREE.MeshStandardMaterial({color: color});
                const newCubeMesh = new THREE.Mesh(newCube, newCubeMaterial);

                newCubeMesh.position.set(voxelPosition.x, voxelPosition.y, voxelPosition.z);

                const voxel = new trackedVoxel(newCubeMesh, color);
                destroyedVoxelsInChunk.push(voxel);
            }
        }
        trackedVoxelChunks.push(new trackedVoxelChunk(destroyedVoxelsInChunk));

        // generateDestroyedChunkAt = function(modelName, chunk, destroyedVoxelsInChunk)
        generateDestroyedChunkAt(currentModel.name, allVoxelsInChunk, destroyedVoxelsInChunk, currentModel);

        // console.log("Rebuilt World");

    }
}

const convexMeshes = [];
const convertInstancedMeshtoConvexHull = function(imesh) {
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

const toggleDebugMode = function() {
    for (let i = 0; i < convexMeshes.length; i++) {
        convexMeshes[i].visible = !convexMeshes[i].visible;
    }
}

const triVoxelDroppedPieces = {};

const generateDestroyedChunkAt = function(modelName, allVoxelsInChunk, destroyedVoxelsInChunk) {
    // first, get the scene object with the modelName, and copy it
    const model = scene.getObjectByName(modelName);
    // for each block in the chunk
    for (let i = 0; i < allVoxelsInChunk.length; i++) {
        // get the position of the block
        const voxelPosition = new THREE.Vector3(
            allVoxelsInChunk[i].x,
            allVoxelsInChunk[i].y,
            allVoxelsInChunk[i].z
        );
        // if it exists in destroyedVoxelsInChunk, tset its matrix position to 0,0,0
        let found = false;
        for (let x = 0; x < destroyedVoxelsInChunk.length; x++)
        {
            const thisDestroyedVoxelPosition = destroyedVoxelsInChunk[x].sceneObject.position;
            if (voxelPosition.x == thisDestroyedVoxelPosition.x && voxelPosition.y == thisDestroyedVoxelPosition.y && voxelPosition.z == thisDestroyedVoxelPosition.z) {
                // set its position using setMatrixAt to far away
                model.setMatrixAt(i, new THREE.Matrix4().makeTranslation(0, 0, 0));
                found = true;
                // set matrix world needs to be called after setMatrixAt
                model.instanceMatrix.needsUpdate = true;
                voxelField.set(voxelPosition.x, voxelPosition.y, voxelPosition.z, 0, x, model);
                break;
            }
        }
        
        model.getColorAt(i, color)
        const voxel = new trackedVoxel(model.children[i], color);

        if (Math.random() < 1 && found)
        {
            if (Object.keys(triVoxelDroppedPieces).length > 250) continue;
            const triVoxel = new THREE.Mesh(
                // cone with minimal segments
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial({color: color})
            );
            triVoxel.name = "TRIVOXEL-" + Math.random();
            scene.add(triVoxel);

            const x = parseInt(voxelPosition.x);
            const y = parseInt(voxelPosition.y);
            const z = parseInt(voxelPosition.z);
    
            const range = 10;

            // create a cannon-es point body
            const triVoxelBody = new CANNON.Body({
                mass: 1,
                position: new CANNON.Vec3(x, y, z),
                shape: new CANNON.Box(new CANNON.Vec3(0.9, 0.9, 0.9)),
                material: bouncyMaterial
            });

            // random rotation velocity
            triVoxelBody.angularVelocity.set(Math.floor(Math.random() * range) - range/2, Math.floor(Math.random() * range) - range/2, Math.floor(Math.random() * range) - range/2);
            
            world.addBody(triVoxelBody);
            
            triVoxel.position.set(triVoxelBody.position.x, triVoxelBody.position.y, triVoxelBody.position.z);
            
            // push triVoxel as a key, and triVoxelBody as a value
            triVoxelDroppedPieces[triVoxel.name] = triVoxelBody;
        }
    }
}

var isLeftClicking = false;
document.addEventListener('mousedown', function(e) {
    // if its not left click, return
    if (e.button != 0) return;
    isLeftClicking = true;
});

document.addEventListener('mouseup', function(e) {
    // if its not left click, return
    if (e.button != 0) return;
    isLeftClicking = false;
});

const muzzleFlash = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 2, 0.05),
    new THREE.MeshBasicMaterial({color: 0xffffff})
);
// x is left/right
// y is up/down
// z is closeness to cam
muzzleFlash.position.set(weaponPosition.x - 1, weaponPosition.y + 8, weaponPosition.z - 8);
muzzleFlash.name = "muzzleFlash";
camera.add(muzzleFlash);
const muzzleFlashReverseAngle = muzzleFlash.clone();
muzzleFlashReverseAngle.rotateZ(-90 * Math.PI / 180);
camera.add(muzzleFlashReverseAngle);
muzzleFlash.attach(muzzleFlashReverseAngle);
muzzleFlash.add(new THREE.PointLight(0xffffff, 1, 100));
var shootRayAvailable = true;
const rateOfFire = 1; // time in ms in between shootRay()

const clock = new THREE.Clock();
const render = function() {
    const delta = clock.getDelta();

    controls.moveRight(playerMoveSpeed * delta * xAxis * sprinting);
    controls.moveForward(-playerMoveSpeed * delta * zAxis * sprinting);

    document.querySelector("#position-overlay").innerHTML = "X: " + Math.round(controls.getObject().position.x) + " Y: " + Math.round(controls.getObject().position.y) + " Z: " + Math.round(controls.getObject().position.z);

    // lerp the instancedweaponmodel to the instancedWeaponTarget
    if (instancedWeaponModel && instancedWeaponTarget && delta > 0)
    {
        // first get the world position of instancedWeaponTarget
        const instancedWeaponTargetWorldPosition = new THREE.Vector3();
        instancedWeaponTarget.getWorldPosition(instancedWeaponTargetWorldPosition);
        // then lerp it
        instancedWeaponModel.position.lerp(instancedWeaponTargetWorldPosition, 30 * delta);
        // set the rotation
        instancedWeaponModel.rotation.setFromRotationMatrix(instancedWeaponTarget.matrixWorld);
    }

    if (isLeftClicking) {
        muzzleFlash.visible = false;
        if (shootRayAvailable)
        {
            muzzleFlash.visible = true;

            // random scale and rotation X
            const scaleRange = 0.15;
            const rotationRange = 0.6;
            muzzleFlash.scale.set(Math.random() * scaleRange + 1, Math.random() * scaleRange + 1, Math.random() * scaleRange + 1);
            muzzleFlash.rotation.z = Math.random() * rotationRange - rotationRange/2;

            const baseColor = new THREE.Color(0xffdfbd);
            // randomize the color
            const randomColor = baseColor.offsetHSL(Math.random() * 0.2 - 0.1, Math.random() * 0.2 - 0.1, Math.random() * 0.2 - 0.1);
            muzzleFlash.material.color = randomColor;

            shootRay();
            shootRayAvailable = false;
            setTimeout(function() {
                shootRayAvailable = true;
            }, rateOfFire);
        }
    }
    else
    {
        muzzleFlash.visible = false;
    }

    // composer
    requestAnimationFrame( render );

    composer.render();
}

var camCube, cubeBody;
const physicsUpdate = function() {
    world.fixedStep();

    // for each triVoxelDroppedPiece, update its position with its body
    // first iterate all keys
    for (const key in triVoxelDroppedPieces) {
        // if random chance, remove the triVoxelDroppedPiece
        if (Math.random() < 0.01) {
            world.removeBody(triVoxelDroppedPieces[key]);
            scene.remove(scene.getObjectByName(key));
            delete triVoxelDroppedPieces[key];
            continue;
        }
        const sceneObject = scene.getObjectByName(key);
        const body = triVoxelDroppedPieces[key];
        sceneObject.position.copy(body.position);
        sceneObject.quaternion.copy(body.quaternion);
    }

    // update cameCube to cubeBody
    if (cubeBody) camCube.position.copy(cubeBody.position);
}
setInterval(physicsUpdate, 1000 / 60);

render();

// window resize
window.addEventListener( 'resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize( width, height );
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}, false );

// on click of "p", console log the world and trackedVoxels
document.addEventListener('keydown', function(e) {
    if (e.key == "p") {
        console.log("\n+==============================+\n")
        console.log("PHYSICS WORLD:");
        console.log(world);
        console.log("CAMERA POSITION");
        console.log(camera.position);
        console.log("trackedVoxelChunks");
        console.log(trackedVoxelChunks);
        console.log("draw calls #");
        console.log(renderer.info.render.calls);
        console.log("THREE SCENE");
        console.log(scene);
        console.log("instanced model index");
        console.log(instancedModelIndex);
        console.log("TRIVOXELS INDEX");
        console.log(triVoxelDroppedPieces);
        console.log("\n+==============================+\n")

        // create a cube at the camer's position, give it a body
        camCube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({color: 0xffffff})
        );
        camCube.position.copy(camera.position);
        scene.add(camCube);
        cubeBody = new CANNON.Body({
            mass: 1,
            position: new CANNON.Vec3(camera.position.x, camera.position.y, camera.position.z),
            shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5))
        });
        world.addBody(cubeBody);
    }
    // on press of q or e change the camera height by 10
    if (e.keyCode === 69) {
        camera.position.y += 10;
    }

    if (e.keyCode === 81) {
        camera.position.y -= 10;
    }

    if (e.key == 'z') {
        function roughSizeOfObject( object ) {

            var objectList = [];
            var stack = [ object ];
            var bytes = 0;
        
            while ( stack.length ) {
                var value = stack.pop();
        
                if ( typeof value === 'boolean' ) {
                    bytes += 4;
                }
                else if ( typeof value === 'string' ) {
                    bytes += value.length * 2;
                }
                else if ( typeof value === 'number' ) {
                    bytes += 8;
                }
                else if
                (
                    typeof value === 'object'
                    && objectList.indexOf( value ) === -1
                )
                {
                    objectList.push( value );
        
                    for( var i in value ) {
                        if (value.hasOwnProperty(i))
                        {
                            if (value[i] !== null) {
                                stack.push( value[ i ] );
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
