// ENGINE TOOLS !!!
// IMPORTS
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

var debugMode = false;

// Raycast Acceleration using THREE-MESH-BVH
// THREE.InstancedMesh.prototype.raycast = acceleratedRaycast;

// SCENE
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 );

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

var promptIsOpen = false;
document.body.addEventListener('click', function (e) {
    if (promptIsOpen) return;
    if (e.target == renderer.domElement) {
        controls.lock();
    }
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
            mouseRayFollower.rotation.y += 90 * Math.PI / 180;
            break;
        case 'KeyQ':
            camera.position.y -= 10;
            break;
        case 'KeyE':
            camera.position.y += 10;
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

const clamp = (number, min, max) => Math.max(min, Math.min(number, max));

// a cubic volume where every position with a voxel is labeled as 1, and every position ignoring a voxel is 0.
// the cube is infinite and does not have a set volume size
// the cube is a 3D array of 1s and 0s
class DiscreteVectorField {
    constructor() {
        this.field = [];
        this.size = {
            x: 0,
            y: 0,
            z: 0
        }
    }

    // Sets the value of the vector field at the given position
    set(x, y, z, value, color = {r: 0, g: 0, b: 0}) {
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
            color: color
        };

        // update size
        this.size.x = Math.max(this.size.x, x);
        this.size.y = Math.max(this.size.y, y);
        this.size.z = Math.max(this.size.z, z);
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
    raycast(origin, direction, length, cutoff=0) {
        let x = origin.x;
        let y = origin.y;
        let z = origin.z;

        for (let i = 0; i < length; i++) {
            const stepVoxel = this.get(Math.floor(x), Math.floor(y), Math.floor(z));
            if (stepVoxel.value === 1) {
                x -= (direction.x * cutoff);
                y -= (direction.y * cutoff);
                z -= (direction.z * cutoff);
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
// set the whole floor (y=-1) to 1
for (let x = -500; x < 500; x++) {
    for (let z = -500; z < 500; z++) {
        voxelField.set(x, -1, z, 1);
    }
}

const mouseRayFollower = new THREE.AxesHelper(10);
scene.add(mouseRayFollower);

const mouseRayCenterCube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5
    })
);

mouseRayCenterCube.position.set(0, 0.5, 0);
mouseRayFollower.add(mouseRayCenterCube);
var preVizCube;

var objectPlacementOffset = new THREE.Vector3(0, 0.5, 0);
const mouseLight = new THREE.PointLight(0xffffff, 10, 100);
mouseLight.position.set(0, 1, 0);
mouseRayFollower.add(mouseLight);

// call ipc read-models
const { ipcRenderer } = require('electron');
const models = ipcRenderer.sendSync('read-models');
const UIModelsList = document.getElementById("available-models");
UIModelsList.innerHTML = "";

var selectedModel = models[0];

for (var i = 0; i < models.length; i++) {
    var model = models[i];
    var li = document.createElement("li");
    li.appendChild(document.createTextNode(model));
    UIModelsList.appendChild(li);
    if (i == 0) li.classList.add('selected');
    // add event listener
    li.addEventListener("click", function() {
        selectedModel = this.innerHTML;
    });
}

let JSONData;
// on scrollwheel, change selected model
document.addEventListener('wheel', function(e) {
    // remove previous preVizCube
    if (preVizCube) {
        mouseRayFollower.remove(preVizCube);
    }
    if (e.deltaY > 0) {
        // scroll down
        var selected = document.getElementsByClassName('selected')[0];
        var next = selected.nextElementSibling;
        if (next) {
            selected.classList.remove('selected');
            next.classList.add('selected');
            selectedModel = next.innerHTML;
        }
        // if at end of list, go to beginning
        else {
            selected.classList.remove('selected');
            UIModelsList.firstChild.classList.add('selected');
            selectedModel = UIModelsList.firstChild.innerHTML;
        }
    } else {
        // scroll up
        var selected = document.getElementsByClassName('selected')[0];
        var prev = selected.previousElementSibling;
        if (prev) {
            selected.classList.remove('selected');
            prev.classList.add('selected');
            selectedModel = prev.innerHTML;
        }
        // if at beginning of list, go to end
        else {
            selected.classList.remove('selected');
            UIModelsList.lastChild.classList.add('selected');
            selectedModel = UIModelsList.lastChild.innerHTML;
        }
    }

    const modelURL = 'level_models/' +  selectedModel + '.json';
    let loader = new THREE.FileLoader();
    loader.load(
        modelURL,
        function(data) {
            // once json is loaded ...
            JSONData = data;

            // find the dimensions of the model, and resize mouseRayFollower to resemble them
            const model = JSON.parse(data);
            const modelWidth = model.dimension[0].width;
            const modelHeight = parseInt(model.dimension[0].height) + 1;
            const modelDepth = model.dimension[0].depth;
            console.log(modelWidth, modelHeight, modelDepth)

            // draw a cube between the two cubes
            const geometry = new THREE.BoxGeometry(modelWidth, modelHeight, modelDepth);
            const material = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.5
            });

            preVizCube = new THREE.Mesh(geometry, material);
            preVizCube.position.set(
                (modelWidth / 2) - (modelWidth % 2 == 0 ? 0.5 : 0), // adjust for even numbers
                (modelHeight / 2) - (modelHeight % 2 == 0 ? 0.5 : 0), // adjust for even numbers
                (modelDepth / 2) - 0.5 // adjust for even numbers
            );
            mouseRayFollower.add(preVizCube);

            // create a green arrow helper attached to the preVizCube, pointing forward from it
            const arrowHelper = new THREE.ArrowHelper(
                new THREE.Vector3(0, 0, 1),
                new THREE.Vector3(0, 0, 0),
                10,
                0x00ff00,
                10,
                5
            );
            preVizCube.add(arrowHelper);
        },
        function(err) {
            // console.log(err);
        }
    );
});

// on left click
document.addEventListener('mousedown', function(e) {
    if (e.button == 0) {
        // if controls arent locked, return
        if (!controls.isLocked) return;
        // if mouserayfollower is not at 0,0,0
        if (mouseRayFollower.position.x == 0 && mouseRayFollower.position.y == 0 && mouseRayFollower.position.z == 0) return;
        // first, start the raycast from the very center
        // CAMERA POSITION
        const cameraPosition = new THREE.Vector3();
        camera.getWorldPosition(cameraPosition);
        cameraPosition.x = Math.round(cameraPosition.x);
        cameraPosition.y = Math.round(cameraPosition.y);
        cameraPosition.z = Math.round(cameraPosition.z);

        // CAMERA DIRECTION
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);

        // adjust position by objectPlacementOffset
        const adjustedPosition = new THREE.Vector3();
        adjustedPosition.copy(mouseRayFollower.position);
        // subtract objectPlacementOffset
        adjustedPosition.sub(objectPlacementOffset);
        
        buildJSONModel(JSONData, adjustedPosition);
    }
});

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

const buildJSONModel = function(JSONData, position) {

    const startTime = Date.now();

    let jsonModel = JSON.parse(JSONData);
    let voxelPositionsFromFile = jsonModel.voxels;
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
        instancedWorldModel.position.copy(position);
        instancedWorldModel.rotation.set(mouseRayFollower.rotation.x, mouseRayFollower.rotation.y, mouseRayFollower.rotation.z);
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
                // if (globalVoxelIterator == 0) groundFloor.material.color.set(thisVoxelColor);
    
                instancedWorldModel.setMatrixAt(localVoxelIterator, new THREE.Matrix4().makeTranslation(thisVoxelPosition.x, thisVoxelPosition.y, thisVoxelPosition.z));
    
                instancedWorldModel.setColorAt(localVoxelIterator, thisVoxelColor);
                voxelsInChunk.push(thisVoxelData);

                // converts thisVoxelColor (0-1 rgb) to 0-255 rgb
                thisVoxelColor.r = Math.round(thisVoxelColor.r * 255);
                thisVoxelColor.g = Math.round(thisVoxelColor.g * 255);
                thisVoxelColor.b = Math.round(thisVoxelColor.b * 255);


                // set the voxel field position to this voxel's REAL WORLD position
                // set(x, y, z, value, indexInChunk, chunk)
                // first convert thisVoxelPosition localToWorld
                thisVoxelPosition.applyMatrix4(instancedWorldModel.matrixWorld);
                // set the voxel field position to this voxel's REAL WORLD position
                voxelField.set( thisVoxelPosition.x, thisVoxelPosition.y, thisVoxelPosition.z, 1, thisVoxelColor);

                if (Math.random() < 0.1)
                {
                    // create a green sphere
                    const sphereGeometry = new THREE.SphereGeometry(2, 32, 32);
                    const sphereMaterial = new THREE.MeshStandardMaterial({
                        color: 0x00ff00,
                        roughness: 0.0,
                        envMap: reflectionCube
                    });
                    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
                    sphere.position.copy(thisVoxelPosition);
                }

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


const editRange = 1000;
const clock = new THREE.Clock();
const render = function() {
    const delta = clock.getDelta();

    controls.moveRight(playerMoveSpeed * delta * xAxis * sprinting);
    controls.moveForward(-playerMoveSpeed * delta * zAxis * sprinting);

    document.querySelector("#position-overlay").innerHTML = "X: " + Math.round(controls.getObject().position.x) + " Y: " + Math.round(controls.getObject().position.y) + " Z: " + Math.round(controls.getObject().position.z);


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
    const intersection = voxelField.raycast(cameraPosition, cameraDirection, editRange);
    
    if (intersection != null)
    {
        const roundedIntersection = new THREE.Vector3(
            Math.round(intersection.x + objectPlacementOffset.x) - 0.5,
            Math.round(intersection.y + objectPlacementOffset.y) - 0.5,
            Math.round(intersection.z + objectPlacementOffset.z) - 0.5
        );
        mouseRayFollower.position.copy( roundedIntersection );
    }
    else
    {
        mouseRayFollower.position.set(0, 0, 0);
    }

    // composer
    requestAnimationFrame( render );

    composer.render();
}

render();

const getMapName = function() {
    promptIsOpen = true;
    // create a new div
    const promptDiv = document.createElement("div");
    promptDiv.id = "prompt-div";

    // create a new h1
    const promptTitle = document.createElement("h1");
    promptTitle.innerHTML = "Export Map";

    // create a new label
    const promptLabel = document.createElement("label");
    promptLabel.innerHTML = "Map Name: ";

    // create a new input
    const promptInput = document.createElement("input");
    promptInput.autofocus = true;
    promptInput.type = "text";
    promptInput.value = "Untitled";

    // create a new button
    const promptButton = document.createElement("button");
    promptButton.innerHTML = "OK";

    // append all the elements to the div
    promptDiv.appendChild(promptTitle);
    promptDiv.appendChild(promptLabel);
    promptDiv.appendChild(promptInput);
    promptDiv.appendChild(promptButton);

    // append the div to the body
    document.body.appendChild(promptDiv);

    // add event listener to the button
    promptButton.addEventListener('click', () => {
        // remove the div
        document.body.removeChild(promptDiv);
        promptIsOpen = false;
        // return the input value
        exportMap(promptInput.value);
    });
}

// ### EXPORTING ###
const exportMap = function(fileName) {
    // EXPORTING TO .JSON
    // STEP 1: ITERATE THROUGH EVERY instancedModelIndex INSTANCEDMESH AND ITERATE THE VOXELS IN EACH CHUNK
    // EXAMPLE: { "x": 9, "y": 0, "z": 0, "red": 129, "green": 21, "blue": 18 }
    const json = {
        "name": fileName,
        "dimension": {
            "width": voxelField.size.x,
            "height": voxelField.size.y,
            "depth": voxelField.size.z
        },
        "voxels": []
    };
    
    var matrix;
    for (let i = 0; i < instancedModelIndex.length; i++)
    {
        // this is an instancedmesh
        const thisChunk = instancedModelIndex[i];
        for (let c = 0; c < thisChunk.count; c++)
        {
            // get the voxel position
            const thisVoxelPosition = new THREE.Vector3();
            // get the matrix of this voxel
            matrix = new THREE.Matrix4();
            matrix.fromArray(thisChunk.instanceMatrix.array, c * 16);
            // get the position of this voxel
            thisVoxelPosition.setFromMatrixPosition(matrix);

            // now rotate the entire shape (around the origin, NOT the center) by the rotation of the chunk
            thisVoxelPosition.applyQuaternion(thisChunk.quaternion);

            // now get the world position
            thisVoxelPosition.x += thisChunk.position.x;
            thisVoxelPosition.y += thisChunk.position.y;
            thisVoxelPosition.z += thisChunk.position.z;

            // round the position to the nearest integer
            thisVoxelPosition.x = Math.round(thisVoxelPosition.x);
            thisVoxelPosition.y = Math.round(thisVoxelPosition.y);
            thisVoxelPosition.z = Math.round(thisVoxelPosition.z);
            
            // get the voxel color
            const thisVoxelColor = new THREE.Color();
            thisChunk.getColorAt(c, thisVoxelColor);
            // convert the color to 0-255
            thisVoxelColor.r = Math.round(thisVoxelColor.r * 255);
            thisVoxelColor.g = Math.round(thisVoxelColor.g * 255);
            thisVoxelColor.b = Math.round(thisVoxelColor.b * 255);

            // add this voxel to the json
            json.voxels.push({
                "x": thisVoxelPosition.x,
                "y": thisVoxelPosition.y,
                "z": thisVoxelPosition.z,
                "red": thisVoxelColor.r,
                "green": thisVoxelColor.g,
                "blue": thisVoxelColor.b
            });
        }
    }

    // now send this via ipc to the main process
    ipcRenderer.send('save-map', json);
}

document.querySelector("#export-button").addEventListener('click', getMapName);

// on press 'p' console.log instancedModelIndex
document.addEventListener('keydown', (event) => {
    if (event.key == "p")
    {
        console.log(instancedModelIndex);
    }
});


// window resize
window.addEventListener( 'resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize( width, height );
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}, false );

document.querySelector("#loader-overlay").style.visibility = "hidden";