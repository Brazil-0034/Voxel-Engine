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
camera.position.set(2.8, 10, 153);
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
let worldWidth = 1;
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

// create an instancedmesh cube to represent each point
let voxelMesh = new THREE.BoxGeometry(1, 1, 1);
let voxelMaterial = new THREE.MeshStandardMaterial({color: 0xffffff});
let instancedCube = new THREE.InstancedMesh(
    voxelMesh,
    voxelMaterial,
    worldLength * worldHeight * worldWidth
);

let voxelPositions = [];
let i = 0;
for ( let x = -worldLength / 2; x < worldLength / 2; x++ ) {
    for ( let y = -worldHeight / 2; y < worldHeight / 2; y++ ) {
        for ( let z = 0; z < worldWidth; z++ ) {
            instancedCube.setMatrixAt( i, new THREE.Matrix4().makeTranslation( x, y, z ) );
            voxelPositions.push( new THREE.Vector3(x, y, z) );
            // setColorAt random
            let t = new THREE.Color();
            // if it's mod of 10, set t to black. else it's white
            if (i % 10 === 0 || x % 10 === 0) {
                t.setRGB(0, 0, 0);
            } else {
                t.setRGB(1, 1, 1);
            }
            instancedCube.setColorAt( i, t );
            i++;
        }
    }
}

console.log(voxelPositions);

// rotate the cube randomly
// instancedCube.rotation.set(Math.floor(Math.random() * 360), Math.floor(Math.random() * 360), Math.floor(Math.random() * 360));

instancedCube.instanceMatrix.needsUpdate = true;
scene.add( instancedCube );

console.log("... DONE GENERATING UNIVERSE");


// on left click, shoot a ray from the camera, add an arrowhelper
// to the scene

const voxelLifetime = 5;
const voxelLifetimeVariability = voxelLifetime/2;

class trackedVoxel {
    constructor(sceneObject, color) {
        // positional
        this.sceneObject = sceneObject;

        // simulated
        this.physicsBody = new CANNON.Body({
            mass: 1,
            shape: new CANNON.Particle()
        });
        this.physicsBody.position.copy(this.sceneObject.position);
        // random velocity
        const velocityLimit = -50;
        this.physicsBody.velocity.set(
            Math.random() * velocityLimit,
            Math.random() * velocityLimit,
            Math.random() * velocityLimit
        );
        world.addBody(this.physicsBody);
        this.secondsAlive = 0;
        this.lifetime = voxelLifetime + Math.floor(Math.random() * voxelLifetimeVariability);

        // visual
        this.color = color;
    }
}

const trackedVoxels = [];
const destroyedVoxels = [];
const destroyedChunkSize = 10;

const color = new THREE.Color( 0, 0, 0 );
const shootRay = function(event) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera( new THREE.Vector2( 0, 0 ), camera );
    const intersection = raycaster.intersectObject( instancedCube );
    if ( intersection.length > 0 ) {

        // get the matrixes of all the cubes around the clicked cube
        for ( let i = 0; i < voxelPositions.length; i++ ) {

            const voxelPosition = voxelPositions[ i ];
            const distance = voxelPosition.distanceTo( intersection[ 0 ].point );

            if ( distance < destroyedChunkSize ) {
                let collectionChance = distance / (destroyedChunkSize/1.5);
                if (Math.random() < collectionChance) continue;
                destroyedVoxels.push( voxelPosition );

                // create a new cube at the position of the clicked cube, with the color of the clicked cube
                const newCube = new THREE.BoxGeometry(1, 1, 1);

                instancedCube.getColorAt(i, color);
                const newCubeMaterial = new THREE.MeshStandardMaterial({color: color});
                const newCubeMesh = new THREE.Mesh(newCube, newCubeMaterial);

                newCubeMesh.position.set(voxelPosition.x, voxelPosition.y, voxelPosition.z);
                scene.add(newCubeMesh);

                const voxel = new trackedVoxel(newCubeMesh, color);
                trackedVoxels.push(voxel);

            }
        }

        // remake the instancedmesh without the cubes that were destroyed
        const newInstancedCube = new THREE.InstancedMesh(
            voxelMesh,
            voxelMaterial,
            worldLength * worldHeight * worldWidth
        );
        const newVoxelPositions = [];
        let j = 0;
        let foundCount = 0;
        for ( let x = -worldLength / 2; x < worldLength / 2; x++ ) {
            for ( let y = -worldHeight / 2; y < worldHeight / 2; y++ ) {
                for ( let z = 0; z < worldWidth; z++ ) {
                    // if the position of the cube is not in the destroyedVoxels array, add it to the newInstancedCube
                    // without using array.includes
                    let found = false;
                    for (let k = 0; k < destroyedVoxels.length; k++) {
                        if (destroyedVoxels[k].x === x && destroyedVoxels[k].y === y && destroyedVoxels[k].z === z) {
                            found = true;
                            foundCount++;
                        }
                    }
                    if (!found) {
                        newInstancedCube.setMatrixAt( j+foundCount, new THREE.Matrix4().makeTranslation( x, y, z ) );
                        newVoxelPositions.push( new THREE.Vector3(x, y, z) );
                        instancedCube.getColorAt(j+foundCount, color);
                        newInstancedCube.setColorAt( j+foundCount, color );
                        j++;
                    }
                }
            }
        }

        scene.remove(instancedCube);
        instancedCube = newInstancedCube;
        scene.add(instancedCube);
        instancedCube.instanceMatrix.needsUpdate = true;
        instancedCube.instanceColor.needsUpdate = true;

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

const timestep = 1/20;
const physicsUpdate = function() {
    world.fixedStep();
    
    for (let i = 0; i < trackedVoxels.length; i++) {
        const voxel = trackedVoxels[i];
        // update the secondsAlive
        voxel.secondsAlive += (timestep / 10);
        // if secondsAlive is greater than voxelLifetime, remove the voxel from the scene
        if (voxel.secondsAlive > (voxel.lifetime)) {
            scene.remove(voxel.sceneObject);
            // destroy the body
            world.removeBody(voxel.physicsBody);
            // remove the voxel from the trackedVoxels array
            trackedVoxels.splice(i, 1);
        }

        voxel.sceneObject.position.copy(voxel.physicsBody.position);
        voxel.sceneObject.quaternion.copy(voxel.physicsBody.quaternion);
    }
}
setInterval(physicsUpdate, timestep);

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
        console.log("trackedVoxels");
        console.log(trackedVoxels);
    }
});