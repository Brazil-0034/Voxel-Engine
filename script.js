const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// orbit camera
camera.position.z = 5;
const orbitControls = new THREE.OrbitControls( camera, renderer.domElement );

let worldLength = 100;
let worldWidth = 100;
let worldHeight = 1;

// create an instancedmesh cube to represent each point
let voxelMesh = new THREE.BoxGeometry(1, 1, 1);
let voxelMaterial = new THREE.MeshBasicMaterial({color: 0xffffff});
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
            instancedCube.setColorAt( i, new THREE.Color( Math.random(), Math.random(), Math.random() ) );
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
const destroyedVoxels = [];
const color = new THREE.Color( 0, 0, 0 );
const shootRay = function(event) {
    const mouse = new THREE.Vector2();
    mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera( mouse, camera );
    const intersection = raycaster.intersectObject( instancedCube );
    if ( intersection.length > 0 ) {

        // get the matrixes of all the cubes around the clicked cube
        for ( let i = 0; i < voxelPositions.length; i++ ) {

            const voxelPosition = voxelPositions[ i ];
            const distance = voxelPosition.distanceTo( intersection[ 0 ].point );

            if ( distance < 3 ) {
                destroyedVoxels.push( voxelPosition );
                // create a new cube at the position of the clicked cube, with the color of the clicked cube
                const newCube = new THREE.BoxGeometry(1, 1, 1);
                instancedCube.getColorAt(i, color);
                const newCubeMaterial = new THREE.MeshBasicMaterial({color: color});
                const newCubeMesh = new THREE.Mesh(newCube, newCubeMaterial);

                newCubeMesh.position.set(voxelPosition.x, voxelPosition.y-1, voxelPosition.z);
                scene.add(newCubeMesh);
            }
        }

        // remake the instancedmesh without the cubes that were destroyed
        const newInstancedCube = new THREE.InstancedMesh(
            voxelMesh,
            voxelMaterial,
            worldLength * worldHeight * worldWidth
        );
        console.log(destroyedVoxels.length);
        const newVoxelPositions = [];
        let j = 0;
        for ( let x = -worldLength / 2; x < worldLength / 2; x++ ) {
            for ( let y = -worldHeight / 2; y < worldHeight / 2; y++ ) {
                for ( let z = 0; z < worldWidth; z++ ) {
                    // if the position of the cube is not in the destroyedVoxels array, add it to the newInstancedCube
                    // without using array.includes
                    let found = false;
                    for (let k = 0; k < destroyedVoxels.length; k++) {
                        if (destroyedVoxels[k].x === x && destroyedVoxels[k].y === y && destroyedVoxels[k].z === z) {
                            found = true;
                        }
                    }
                    if (!found) {
                        newInstancedCube.setMatrixAt( j, new THREE.Matrix4().makeTranslation( x, y, z ) );
                        newVoxelPositions.push( new THREE.Vector3(x, y, z) );
                        newInstancedCube.setColorAt( j, new THREE.Color( Math.random(), Math.random(), Math.random() ) );
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

const render = function() {
    requestAnimationFrame( render );
    renderer.render( scene, camera );
}

render();

// window resize
window.addEventListener( 'resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize( width, height );
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}, false );