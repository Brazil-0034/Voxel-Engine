// IMPORTS
import * as CANNON from '/node_modules/cannon-es/dist/cannon-es.js';

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
const hemiLight = new THREE.HemisphereLight(0xB1E1FF, 0xB97A20, 2);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xFFFFFF, 1);
dirLight.position.set(0, 10, 5);
dirLight.target.position.set(-5, 0, 0);
scene.add(dirLight);
scene.add(dirLight.target);

// first person camera
const playerMoveSpeed = 100;
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
let sprinting = false;

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
            sprinting = true;
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
            sprinting = false;
            break;
    }
});

let worldLength = 100;
let worldWidth = 100;
let worldHeight = 100;

const groundFloor = new THREE.Mesh(
    new THREE.BoxGeometry(1000, 1, 1000),
    new THREE.MeshStandardMaterial({color: 0xe0e0e0})
);
groundFloor.position.y = -worldHeight/2 - 0.5;
scene.add(groundFloor);

const groundBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(0, -worldHeight/2 - 0.5, 0),
    shape: new CANNON.Box(new CANNON.Vec3(1000, 1, 1000)),
    type: CANNON.Body.STATIC
});

world.addBody(groundBody);

let voxelPositions = [];
let destroyedVoxels = [];
let JSONData;

const generateModelWorld = function(modelURL) {
    // load the local file wall.json into a json object
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

const modelURL = 'house.json';
let voxelMesh = new THREE.BoxGeometry(1, 1, 1);
let voxelMaterial = new THREE.MeshStandardMaterial({color: 0xffffff});
let currentModel;

const buildJSONModel = function(jsondata) {

    const startTime = Date.now();
    
    let previousModelExists = false;
    if (currentModel) previousModelExists = true;

    let jsonModel = JSON.parse(JSONData);
    let voxelPositionsFromFile = jsonModel.voxels;
    let foundCount = 0;

    // create an instancedmesh cube to represent each point

    if (!previousModelExists)
    {
        let instancedWorldModel = new THREE.InstancedMesh(
            voxelMesh,
            voxelMaterial,
            voxelPositionsFromFile.length
        );
    
        currentModel = instancedWorldModel;

        for (let i = 0; i < voxelPositionsFromFile.length; i++) {
            const thisVoxelData = voxelPositionsFromFile[i];
            const thisVoxelPosition = new THREE.Vector3(thisVoxelData.x, thisVoxelData.y, thisVoxelData.z);

            instancedWorldModel.setMatrixAt(i, new THREE.Matrix4().makeTranslation(thisVoxelPosition.x, thisVoxelPosition.y, thisVoxelPosition.z));

            const color = new THREE.Color("rgb(" + thisVoxelData.red + "," + thisVoxelData.green + "," + thisVoxelData.blue + ")");
            instancedWorldModel.setColorAt(i, color);
    
            voxelPositions.push(new THREE.Vector3(thisVoxelPosition));
        }
    }
    else
    {
        for (let i = 0; i < currentModel.count; i++) {
            const thisVoxelData = voxelPositionsFromFile[i];
            const thisVoxelPosition = new THREE.Vector3(thisVoxelData.x, thisVoxelData.y, thisVoxelData.z);
    
            for (let k = 0; k < destroyedVoxels.length; k++) {
                if (destroyedVoxels[k].x === thisVoxelPosition.x && destroyedVoxels[k].y === thisVoxelPosition.y && destroyedVoxels[k].z === thisVoxelPosition.z) {
                    // move the voxel to 0,0,0
                    currentModel.setMatrixAt(i, new THREE.Matrix4().makeTranslation(0, 0, 0));
                    foundCount++;
                }
            }
        }

        destroyedVoxels = [];
    }

    currentModel.instanceMatrix.needsUpdate = true;
    currentModel.instanceColor.needsUpdate = true;
    if (!previousModelExists) scene.add( currentModel );

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log("DONE GENERATING with " + foundCount + " destroyed voxels and " + voxelPositions.length + " total voxels in " + totalTime + "ms");
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

        // for each voxel
        this.sceneObjects.forEach(v => {
            // adjust positions
            let realVoxelPosition = new THREE.Vector3(
                v.sceneObject.position.x - center.x,
                v.sceneObject.position.y - center.y,
                v.sceneObject.position.z - center.z
            )

            v.sceneObject.geometry.translate(realVoxelPosition.x, realVoxelPosition.y, realVoxelPosition.z);
            newcolor = v.color;

            // aligning world positions
            this.parentObject.updateWorldMatrix(true, false);
            v.sceneObject.geometry.applyMatrix4(this.parentObject.matrixWorld);
            
            // push to array
            geometries.push(v.sceneObject.geometry);
        });

        const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
        const mergedMesh = new THREE.Mesh(mergedGeometry, new THREE.MeshStandardMaterial({color: newcolor}));
        mergedMesh.position.set(center.x, center.y, center.z);
        this.parentObject.add(mergedMesh);
        mergedMesh.position.set(-mergedMesh.position.x, -mergedMesh.position.y, -mergedMesh.position.z);
        
        // draw a boundingbox for the merged mesh
        // const bbox = new THREE.Box3().setFromObject(mergedMesh);
        // const bboxHelper = new THREE.Box3Helper(bbox, 0xffff00);
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
            cameraDirection.y * force,
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

let destroyedChunkSize = 10;

const color = new THREE.Color( 0, 0, 0 );
const shootRay = function(event) {
    
    if (currentModel == null) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera( new THREE.Vector2( 0, 0 ), camera );
    const intersection = raycaster.intersectObject( currentModel );
    if ( intersection.length > 0 ) {

        let destroyedVoxelsInChunk = [];
        // get the matrixes of all the cubes around the clicked cube
        for ( let i = 0; i < voxelPositions.length; i++ ) {

            const voxelPosition = voxelPositions[ i ].x;
            const distance = voxelPosition.distanceTo( intersection[ 0 ].point );

            if ( distance < destroyedChunkSize ) {
                if (destroyedVoxelsInChunk.length % 10 == 0) destroyedChunkSize = Math.floor(Math.random() * destroyedChunkSize) + 10;
                
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

        // remake the instancedmesh without the cubes that were destroyed
        generateModelWorld(modelURL);

        console.log("Rebuilt World");

    }
}

document.addEventListener( 'click', shootRay );

const clock = new THREE.Clock();
const render = function() {
    const delta = clock.getDelta();

    controls.moveRight(playerMoveSpeed * delta * xAxis);
    controls.moveForward(-playerMoveSpeed * delta * zAxis);

    requestAnimationFrame( render );

    renderer.render( scene, camera );
}

const timestep = 1/60;
const physicsUpdate = function() {
    world.fixedStep();
    
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
    }
    // on press of q or e change the camera height by 10
    if (e.keyCode === 69) {
        camera.position.y += 10;
    }

    if (e.keyCode === 81) {
        camera.position.y -= 10;
    }
});