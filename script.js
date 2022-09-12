// IMPORTS
import * as CANNON from '/node_modules/cannon-es/dist/cannon-es.js';
var debugMode = false;

// SCENE
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82 * 10, 0)
});

// RENDERER
const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.physicallyCorrectLights = true;
renderer.setClearColor( 0x00ffff );
document.body.appendChild( renderer.domElement );

// LIGHTS
const ambientLight = new THREE.AmbientLight( 0xffffff, 1 );
scene.add( ambientLight );

const pointLight = new THREE.PointLight(0xffffff, 50, 1500);
pointLight.position.set(0, 0, 0);
scene.add(pointLight);

// first person camera
const playerMoveSpeed = 25;
camera.position.set(2.8, 50, 153);
const controls = new THREE.PointerLockControls(camera, renderer.domElement);
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

const groundBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(groundFloor.position.x, groundFloor.position.y, groundFloor.position.z),
    shape: new CANNON.Box(new CANNON.Vec3(1000, 1, 1000)),
    type: CANNON.Body.STATIC
});

world.addBody(groundBody);

const modelURL = 'house.json';

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

let voxelMesh = new THREE.BoxGeometry(1, 1, 1);
let voxelMaterial = new THREE.MeshStandardMaterial({color: 0xffffff});

let maxChunkSize = 100;
maxChunkSize = Math.pow(maxChunkSize, 2);
let instancedModelIndex = [];

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
            voxelMesh,
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


        instancedModelIndex.push(instancedWorldModel);
        instancedWorldModel.instanceMatrix.needsUpdate = true;
        scene.add(instancedWorldModel);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log("DONE GENERATING with " + foundCount + " destroyed voxels and " + globalVoxelIterator + " total voxels in " + totalTime + "ms");
}

generateModelWorld(modelURL);

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

        console.log("Meshing geometry with length " + geometries.length);
        const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
        const mergedMesh = new THREE.Mesh(mergedGeometry, new THREE.MeshStandardMaterial({color: newcolor}));
        mergedMesh.position.set(center.x, center.y, center.z);
        this.parentObject.add(mergedMesh);
        mergedMesh.position.set(-mergedMesh.position.x, -mergedMesh.position.y, -mergedMesh.position.z);
        
        // draw a boundingbox for the merged mesh
        // const bbox = new THREE.Box3().setFromObject(mergedMesh);
        // const bboxHelper = new THREE.Box3Helper(bbox, 0xffffff * Math.random());
        // scene.add(bboxHelper);
        
        this.physicsBody = new CANNON.Body({
            mass: 1,
            position: new CANNON.Vec3(center.x, center.y, center.z),
            shape: new CANNON.Box(new CANNON.Vec3(
                maxX - minX,
                maxY - minY,
                maxZ - minZ
            )),
        });


        world.addBody(this.physicsBody);

        // velocity based on camera direction
        const force = -50;
        const cameraDirection = new THREE.Vector3(
            camera.position.x - center.x,
            camera.position.y - center.y,
            camera.position.z - center.z
        );
        cameraDirection.normalize();
        this.physicsBody.velocity.set(
            cameraDirection.x * force,
            0,
            cameraDirection.z * force
        );

        // time of life
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
    raycaster.far = 50;
    raycaster.setFromCamera( new THREE.Vector2( 0, 0 ), camera );

    let nearbyObjectsToIntersect = [];
    for (let i = 0; i < instancedModelIndex.length; i++) {
        // if it is NOT frustum culled, add it to the nearbyObjectsToIntersect array
        if (instancedModelIndex[i].frustumCulled === false) {
            nearbyObjectsToIntersect.push(instancedModelIndex[i]);
        }
        // console.log the difference in lengths
    }

    const intersection = raycaster.intersectObjects( nearbyObjectsToIntersect, false );

    if ( intersection.length > 0 ) {
        const currentModel = intersection[0].object;
        // put a large red sphere at the position
        // const sphere = new THREE.Mesh(
        //     new THREE.SphereGeometry(0.5),
        //     new THREE.MeshStandardMaterial({color: 0xff0000})
        // );
        // sphere.position.copy(intersection[0].point);
        // scene.add(sphere);
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

        console.log("Rebuilt World");

    }
}

const generateDestroyedChunkAt = function(modelName, allVoxelsInChunk, destroyedVoxelsInChunk) {
    // first, get the scene object with the modelName, and copy it
    const model = scene.getObjectByName(modelName);
    const newModel = model.clone();
    // remove the old model
    scene.remove(model);
    // also remove it from the instancedModelIndex
    instancedModelIndex.splice(instancedModelIndex.indexOf(model), 1);
    // new voxels array
    const newVoxels = [];
    // for each block in the chunk
    for (let i = 0; i < allVoxelsInChunk.length; i++) {
        // get the position of the block
        const voxelPosition = new THREE.Vector3(
            allVoxelsInChunk[i].x,
            allVoxelsInChunk[i].y,
            allVoxelsInChunk[i].z
        );
        // if it exists in destroyedVoxelsInChunk, then remove it from the chunk by setMatrixAt to 0,0,0
        // also remove it from destroyedVoxelsInChunk
        let found = false;
        for (let x = 0; x < destroyedVoxelsInChunk.length; x++)
        {
            const thisDestroyedVoxelPosition = destroyedVoxelsInChunk[x].sceneObject.position;
            if (voxelPosition.x == thisDestroyedVoxelPosition.x && voxelPosition.y == thisDestroyedVoxelPosition.y && voxelPosition.z == thisDestroyedVoxelPosition.z) {
                newModel.setMatrixAt(i, new THREE.Matrix4().makeTranslation(0, 0, 0));
                destroyedVoxelsInChunk.splice(destroyedVoxelsInChunk.indexOf(voxelPosition), 1);
                found = true;
            }
            if (found == true) {
                break;
            }
        }

        newModel.getColorAt(i, color)
        const voxel = new trackedVoxel(newModel.children[i], color);
        if (!found) {
            newVoxels.push(voxel);
        }
        else {
            console.log(i);
        }
    }
    // add to the scene
    scene.add(newModel);
    // add to the instancedmesh
    instancedModelIndex.push(newModel);
    // update the instancedmesh
    newModel.instanceMatrix.needsUpdate = true;
    // update voxelPositions
    console.log("BEFORE");
    console.log(voxelPositions[modelName]);
    voxelPositions.push({
        chunkID: newModel.name,
        voxels: newVoxels
    });
    console.log("AFTER");
    console.log(voxelPositions[modelName]);
}

document.addEventListener( 'click', function(e) {
    // if its not left click, return
    if (e.button != 0) return;
    shootRay();
});

const clock = new THREE.Clock();
const render = function() {
    const delta = clock.getDelta();

    controls.moveRight(playerMoveSpeed * delta * xAxis * sprinting);
    controls.moveForward(-playerMoveSpeed * delta * zAxis * sprinting);

    requestAnimationFrame( render );

    renderer.render( scene, camera );
}

const timestep = 1/60;
const physicsUpdate = function() {
    world.fixedStep();

    pointLight.position.copy(camera.position);
    
    for (let i = 0; i < trackedVoxelChunks.length; i++) {
        const voxelChunk = trackedVoxelChunks[i];

        voxelChunk.secondsAlive += timestep / 1000;
        if (voxelChunk.secondsAlive > voxelChunk.lifetime) {
            scene.remove(voxelChunk.parentObject);
            trackedVoxelChunks.splice(i, 1);
            // remove the physicsBody
            world.removeBody(voxelChunk.physicsBody);
        }

        voxelChunk.parentObject.position.copy(voxelChunk.physicsBody.position);
        voxelChunk.parentObject.quaternion.copy(voxelChunk.physicsBody.quaternion);
    }
}
setInterval(physicsUpdate, timestep * 1000);

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
    if (e.keyCode === 80) {
        console.log("world");
        console.log(world);
        console.log("trackedVoxelChunks");
        console.log(trackedVoxelChunks);
        console.log("draw calls");
        console.log(renderer.info.render.calls);
        console.log("scene");
        console.log(scene);
        console.log("instanced model index");
        console.log(instancedModelIndex);
    }
    // on press of q or e change the camera height by 10
    if (e.keyCode === 69) {
        camera.position.y += 10;
    }

    if (e.keyCode === 81) {
        camera.position.y -= 10;
    }
});