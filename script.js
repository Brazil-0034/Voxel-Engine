// IMPORTS
import * as CANNON from '/node_modules/cannon-es/dist/cannon-es.js';
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

var debugMode = true;

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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 1, 0);
scene.add(directionalLight);

const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x000000, 0.5);
scene.add(hemisphereLight);

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
camera.position.set(2.8, 40, 153);
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

const modelURL = 'maps/' + 'jafro.json';
const weaponURL = 'weapons/' + 'weapon_ar.json';
const weaponRange = 500;

let destroyedVoxels = [];
let JSONData;

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
                console.log(err);
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
const voxelMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff
});

let maxChunkSize = 100;
maxChunkSize = Math.pow(maxChunkSize, 2);
let instancedModelIndex = [];
// const chunkParent = new THREE.Object3D();
// scene.add(chunkParent);
// rotate chunkParent to match model rotation
// chunkParent.rotation.set(modelRotation.x, modelRotation.y, modelRotation.z);

// dict with chunk instancedmesh : array of voxel objects in that chunk
let voxelPositions = [];

const buildJSONModel = function(jsondata) {

    const startTime = Date.now();

    let jsonModel = JSON.parse(JSONData);
    let voxelPositionsFromFile = jsonModel.voxels;
    let foundCount = 0;

    // create an instancedmesh cube to represent each point

    const numberOfChunks = Math.ceil(voxelPositionsFromFile.length / maxChunkSize);
    const chunkSize = Math.ceil(voxelPositionsFromFile.length / numberOfChunks);
    let globalVoxelIterator = 0;

    console.log("Starting generation of " + modelURL + " with " + voxelPositionsFromFile.length + " voxels within " + numberOfChunks + " chunks of " + chunkSize + " voxels each.");

    for (let i = 0; i < numberOfChunks; i++) {
        let instancedWorldModel = new THREE.InstancedMesh(
            voxelGeometry,
            voxelMaterial,
            chunkSize
        );
        instancedWorldModel.name = i;

        let localVoxelIterator = 0;
        let startPos = globalVoxelIterator;
        let voxelsInChunk = [];
        // random color
        let thisVoxelColor = new THREE.Color(Math.random(), Math.random(), Math.random());

        for (let x = globalVoxelIterator; x < startPos + chunkSize; x++) {
            const thisVoxelData = voxelPositionsFromFile[globalVoxelIterator];
            if (thisVoxelData != undefined)
            {
                if (!debugMode) thisVoxelColor = new THREE.Color("rgb(" + thisVoxelData.red + "," + thisVoxelData.green + "," + thisVoxelData.blue + ")");
                const thisVoxelPosition = new THREE.Vector3(thisVoxelData.x, thisVoxelData.y, thisVoxelData.z);
                // multiply by voxel size to get correct position
                thisVoxelPosition.multiplyScalar(voxelSize);

                // adjust floor color
                if (globalVoxelIterator == 0) groundFloor.material.color.set(thisVoxelColor);
    
                instancedWorldModel.setMatrixAt(localVoxelIterator, new THREE.Matrix4().makeTranslation(thisVoxelPosition.x, thisVoxelPosition.y, thisVoxelPosition.z));
    
                const color = thisVoxelColor;
                instancedWorldModel.setColorAt(localVoxelIterator, color);
                voxelsInChunk.push(thisVoxelData);
    
                globalVoxelIterator++;
                localVoxelIterator++;
            }
        }

        // voxelPositions dict with chunk instancedmesh : array of voxel objects in that chunk
        voxelPositions.push({
            chunkID: instancedWorldModel.name,
            voxels: voxelsInChunk
        });

        // generate a MeshBVH boundstree that encapsulates all the voxels in this chunk
        // this is used for raycasting
        // STEP 1: Create an imaginary geometry in memory that contains all the voxels in this chunk
        // STEP 2: Create a MeshBVH boundstree from that geometry
        // STEP 3: Add the boundstree to the instancedmesh

        // STEP 1: Create an imaginary geometry in memory that contains all the voxels in this chunk
        // let imaginaryChunkGeometry = voxelGeometry;
        // for (let i = 0; i < voxelsInChunk.length; i++) {
        //     // add this geometry to the imaginary geometry, keeping its real position
        //     const scale = 10000;
        //     const newVoxelGeometryWithPosition = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
        //     newVoxelGeometryWithPosition.translate(voxelsInChunk[i].x * scale, voxelsInChunk[i].y * scale, voxelsInChunk[i].z * scale);
        //     BufferGeometryUtils.mergeBufferGeometries([imaginaryChunkGeometry, newVoxelGeometryWithPosition]);

        // }
        // const testMesh = new THREE.Mesh(imaginaryChunkGeometry, voxelMaterial);
        // scene.add(testMesh);
        // testMesh.position.z -= 3;


        // // STEP 2: Create a MeshBVH boundstree from that geometry
        // const voxelBoundsTree = new MeshBVH(imaginaryChunkGeometry);
        // console.log(new MeshBVH(imaginaryChunkGeometry));

        // // STEP 3: Add the boundstree to the instancedmesh
        // instancedWorldModel.boundsTree = voxelBoundsTree;
        
        instancedModelIndex.push(instancedWorldModel);
        instancedWorldModel.instanceMatrix.needsUpdate = true;
        scene.add(instancedWorldModel);
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
            console.log(err);
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

const weaponPosition = new THREE.Vector3(4, -9, -8);
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
    });
    // rotate it 90
    instancedWeaponTarget.rotation.set(0, Math.PI / 2.1, 0);
    
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
        
        // // draw a boundingbox for the merged mesh
        // // const bbox = new THREE.Box3().setFromObject(mergedMesh);
        // // const bboxHelper = new THREE.Box3Helper(bbox, 0xffffff * Math.random());
        // // scene.add(bboxHelper);
        
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

let destroyedChunkRange = 10;
let minDestroyedChunkVoxelsCount = 100;

const color = new THREE.Color( 0, 0, 0 );
const shootRay = function(event) {

    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;
    raycaster.far = weaponRange;
    raycaster.setFromCamera( new THREE.Vector2( 0, 0 ), camera );

    let nearbyObjectsToIntersect = [];
    for (let i = 0; i < voxelPositions.length; i++) {
        // if it is NOT frustum culled, add it to the nearbyObjectsToIntersect array
        // #####
        // IMPORTANT OPTIMIZATION NOTE: Three.js doesnt frustrum cull instanced meshes automatically. It can be implemented fairly easily, know this for the future in case u need bigger maps!!
        // #####
        // check if distance is less than weaponRange
        const thisChunkFirstPos = new THREE.Vector3(
            voxelPositions[i].voxels[0].x,
            voxelPositions[i].voxels[0].y,
            voxelPositions[i].voxels[0].z
        );
        const thisChunkLastPos = new THREE.Vector3(
            voxelPositions[i].voxels[voxelPositions[i].voxels.length - 1].x,
            voxelPositions[i].voxels[voxelPositions[i].voxels.length - 1].y,
            voxelPositions[i].voxels[voxelPositions[i].voxels.length - 1].z
        );
        if (thisChunkFirstPos.distanceTo(camera.position) <= weaponRange || thisChunkLastPos.distanceTo(camera.position) <= weaponRange) {
            // find the object in instancedModelIndex that has the name instancedModelName
            nearbyObjectsToIntersect.push(instancedModelIndex[parseInt(voxelPositions[i].chunkID)]);
        }
    }
    
    console.log("Raycasting to objects: " + nearbyObjectsToIntersect.length)
    console.log(nearbyObjectsToIntersect);

    // measaure the time for raycast
    const t0 = performance.now();

    const intersection = raycaster.intersectObjects( nearbyObjectsToIntersect );

    if ( intersection.length > 0 ) {
        console.log("TOTAL FOUND INTERSECTIONS: " + intersection.length);
        const currentModel = intersection[0].object;
        // console.log("FOUND INTERSECTION");
        // console.log(currentModel);

        const allVoxelsInChunk = voxelPositions[intersection[0].object.name].voxels;

        let destroyedVoxelsInChunk = [];
        // get the matrixes of all the cubes around the clicked cube
        for ( let i = 0; i < allVoxelsInChunk.length; i++ ) {

            const voxelPosition = new THREE.Vector3(
                allVoxelsInChunk[i].x,
                allVoxelsInChunk[i].y,
                allVoxelsInChunk[i].z
            );
            const distance = voxelPosition.distanceTo( intersection[ 0 ].point );

            if ( distance < destroyedChunkRange ) {
                if (destroyedVoxelsInChunk.length % 10 == 0) destroyedChunkRange = Math.floor(Math.random() * destroyedChunkRange) + 10;
                
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
        generateDestroyedChunkAt(currentModel.name, allVoxelsInChunk, destroyedVoxelsInChunk);

        // console.log("Rebuilt World");

    }

    const t1 = performance.now();
    // console.log("Call to raycast took " + (t1 - t0) + " milliseconds.")
}

const triVoxelDroppedPieces = {};

const generateDestroyedChunkAt = function(modelName, allVoxelsInChunk, destroyedVoxelsInChunk) {
    // measure time
    const t0 = performance.now();
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
    // add tpo the scene
    // add to the instancedmesh
    // update the instancedmesh
    // update voxelPositions
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

const bulletTracer = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({color: 0xffffff})
);
// x is left/right
// y is up/down
// z is closeness to cam
bulletTracer.position.set(weaponPosition.x - 0.5, weaponPosition.y + 7, weaponPosition.z - 8);
// rotate 15 degrees Y
bulletTracer.rotateY(-1.75 * Math.PI / 180);
bulletTracer.name = "BULLETTRACER";
camera.add(bulletTracer);
const muzzleFlashSize = 4.5;
var shootRayAvailable = true;
const rateOfFire = 10; // time in ms in between shootRay()

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
        if (shootRayAvailable)
        {
            bulletTracer.visible = true;
            bulletTracer.scale.x = Math.random() * muzzleFlashSize;
            bulletTracer.scale.y = Math.random() * muzzleFlashSize;
            bulletTracer.rotateZ(Math.random() * 5);
            const baseColor = new THREE.Color(0xffdfbd);
            // randomize the color
            const randomColor = baseColor.offsetHSL(Math.random() * 0.2 - 0.1, Math.random() * 0.2 - 0.1, Math.random() * 0.2 - 0.1);
            bulletTracer.material.color = randomColor;

            shootRay();
            shootRayAvailable = false;
            setTimeout(function() {
                shootRayAvailable = true;
            }, rateOfFire);
        }
    }
    else
    {
        bulletTracer.visible = false;
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
});
