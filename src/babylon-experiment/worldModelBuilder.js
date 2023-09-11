/**
 * The WorldModelBuilder class is an extension of the WorldGenerator class, and handles the raw voxel placement and the lod generation.
 */
const instancedWorldSafetyOffset = new BABYLON.Vector3(-10000, -10000, -10000);
const buildWorldModelFromBox = async function (scale, position, material, colorData, lightBrightness = 0, interactionEvent) {
    // round the position
    position.x = Math.round(position.x);
    position.y = Math.round(position.y);
    position.z = Math.round(position.z);


    // Interactions
    if (interactionEvent != "none") {
    	// box (for raycasting)
    	const interactionBox = new THREE.Mesh(
    		voxelGeometry,
    		voxelMaterial
    	);
    	interactionBox.position.set(position.x + (scale.x / 2), position.y + (scale.y / 2), position.z + (scale.z / 2));
    	interactionBox.scale.set(scale.x, scale.y, scale.z);
    	interactionBox.visible = false;
    	scene.add(interactionBox);

    	interactionBox.interactionEvent = interactionEvent;

    	interactableObjects.push(interactionBox);
    }

    const texturePath = 'textures/' + material + '.png';
    const boxTexture = new BABYLON.Texture(texturePath, scene);

    let pixelData = await getPixelsFromImage(texturePath); // we load the texture twice because a. the textures are small (32x32) and b. loading directly from URL rather than using readPixels() is much faster for canvas operations, speeding up load times at the expense of some slight short-term memory usage. dont @ me.
    const getPixelColorAt = function (x, y) {
        // pixelData is 32 arrays of 32. Each array is a row of pixels
        // x and y can be beyond 32, but it will wrap around
        x = x % 32;
        y = y % 32;
        let data = pixelData[x][y];
        return new BABYLON.Color3(data[0] / 255, data[1] / 255, data[2] / 255);
    }

    // compute the chunk
    var debugModeChunkColor = new BABYLON.Vector3(Math.random(), Math.random(), Math.random());
    let chunkCounter = 0;
    var chunkMinPosition, chunkMaxPosition;
    const resetChunkBounds = function () {
        // For every chunk ...
        chunkMinPosition = new BABYLON.Vector3(
            Number.MAX_SAFE_INTEGER,
            Number.MAX_SAFE_INTEGER,
            Number.MAX_SAFE_INTEGER
        );
        chunkMaxPosition = new BABYLON.Vector3(
            Number.MIN_SAFE_INTEGER,
            Number.MIN_SAFE_INTEGER,
            Number.MIN_SAFE_INTEGER
        );
    }
    resetChunkBounds();

    let instancedWorldModel, localVoxelIterator;
    const resetInstancedWorldModel = function () {
        instancedWorldModel = new VoxelChunk();
        // instancedWorldModel.position.copyFrom(instancedWorldSafetyOffset);
        instancedWorldModel.name = chunkCounter.toString();
        localVoxelIterator = 0;
        chunkCounter++;
    }
    resetInstancedWorldModel();


    const squareChunkSize = 64;
    const finalizeChunk = function (voxelFace, isAbnormal = false) {

        debugModeChunkColor = new BABYLON.Vector3(Math.random(), Math.random(), Math.random());

        instancedWorldModel.finalizeConstruction(); 

        // Reset Everything!!
        resetChunkBounds();
        resetInstancedWorldModel();return;

        // create a cover box with the same dimensions and position as the frustum box
        const boxColor = new BABYLON.Color3(colorData.r, colorData.g, colorData.b);

        const coverBox = new BABYLON.MeshBuilder.CreatePlane("coverBox", { width: 1, height: 1 }, scene);
        coverBox.material = new BABYLON.StandardMaterial("coverBoxMaterial", scene);
        coverBox.material.diffuseTexture = boxTexture.clone();
        coverBox.material.diffuseColor = boxColor;
        coverBox.material.diffuseTexture.hasAlpha = true;
        coverBox.material.diffuseTexture.uScale = squareChunkSize / 32;
        coverBox.material.diffuseTexture.vScale = squareChunkSize / 32;
        coverBox.material.diffuseTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
        coverBox.material.diffuseTexture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
        coverBox.material.diffuseTexture.anisotropicFilteringLevel = 1;
        coverBox.material.diffuseTexture.updateSamplingMode(BABYLON.Texture.NEAREST_SAMPLINGMODE);

        let subBox; // switch cases require parent block scoped variables? guess i don kno much about js ... or coding ... or life
        // whose idea to make this project in js was it anyway?
        switch (voxelFace) {
            default:
                console.error("Invalid VoxelFace: " + voxelFace);
                return;
            case VoxelFace.TOP:
            case VoxelFace.BOTTOM:
                // set the scaling from the chunkMinPosition and chunkMaxPosition Vector3s
                coverBox.scaling.set(
                    chunkMaxPosition.x - chunkMinPosition.x,
                    chunkMaxPosition.z - chunkMinPosition.z,
                );
                coverBox.material.diffuseTexture.wrapU *= (coverBox.scaling.x / (squareChunkSize));
                coverBox.material.diffuseTexture.wrapV *= (coverBox.scaling.y / (squareChunkSize));

                if (coverBox.scaling.y < squareChunkSize) {
                    // CENTERS:
                    // default (0,0) bottom left
                    coverBox.material.diffuseTexture.uRotationCenter = 1;
                    coverBox.material.diffuseTexture.vRotationCenter = 1;
                }
                if (coverBox.scaling.x < squareChunkSize) {
                    // CENTERS:
                    // default (0,0) bottom left
                    coverBox.material.diffuseTexture.uRotationCenter = 0;
                    coverBox.material.diffuseTexture.vRotationCenter = 1;
                }

                coverBox.rotation.x = -Math.PI / 2;
                coverBox.position.y += 0.5;

                subBox = coverBox.clone();
                subBox.position.y -= 1;

                instancedWorldModel.addCoverBox(subBox);
                instancedWorldModel.addCoverBox(coverBox);
                break;
            case VoxelFace.LEFT:
            case VoxelFace.RIGHT:
                coverBox.scaling.set(
                    chunkMaxPosition.z - chunkMinPosition.z,
                    chunkMaxPosition.y - chunkMinPosition.y,
                );
                coverBox.material.diffuseTexture.wrapU *= (coverBox.scaling.y / (squareChunkSize));
                coverBox.material.diffuseTexture.wrapV *= -(coverBox.scaling.x / (squareChunkSize));
                if (coverBox.scaling.x < squareChunkSize) {
                    // CENTERS:
                    // default (0,0) bottom left
                    coverBox.material.diffuseTexture.uRotationCenter = 1;
                    coverBox.material.diffuseTexture.vRotationCenter = 1;
                    if (coverBox.scaling.y < squareChunkSize) {
                        // CENTERS:
                        // default (0,0) bottom left
                        coverBox.material.diffuseTexture.uRotationCenter = 1;
                        coverBox.material.diffuseTexture.vRotationCenter = 0;
                    }
                }

                coverBox.material.diffuseTexture.wAng = Math.PI / 2;
                coverBox.rotation.y = Math.PI / 2;
                coverBox.position.x += 0.5;

                subBox = coverBox.clone();
                subBox.position.x -= 1;

                instancedWorldModel.addCoverBox(subBox);
                instancedWorldModel.addCoverBox(coverBox);
                break;
            case VoxelFace.FRONT:
            case VoxelFace.BACK:
                coverBox.scaling.set(
                    chunkMaxPosition.x - chunkMinPosition.x,
                    chunkMaxPosition.y - chunkMinPosition.y
                );
                coverBox.material.diffuseTexture.wrapU *= -(coverBox.scaling.x / (squareChunkSize));
                coverBox.material.diffuseTexture.wrapV *= -(coverBox.scaling.y / (squareChunkSize));

                if (coverBox.scaling.x < squareChunkSize) {
                    // CENTERS:
                    // default (0,0) bottom left
                    coverBox.material.diffuseTexture.uRotationCenter = 1;
                    coverBox.material.diffuseTexture.vRotationCenter = 1;
                    if (coverBox.scaling.y < squareChunkSize) {
                        // CENTERS:
                        // default (0,0) bottom left
                        coverBox.material.diffuseTexture.uRotationCenter = 1;
                        coverBox.material.diffuseTexture.vRotationCenter = 0;
                    }
                }

                coverBox.material.diffuseTexture.wAng = Math.PI;
                coverBox.position.z += 0.5;

                subBox = coverBox.clone();
                subBox.position.z -= 1;

                instancedWorldModel.addCoverBox(subBox);
                instancedWorldModel.addCoverBox(coverBox);
                break;
        }
        // coverBox.visible = false;
        LEVELDATA.numCoverBoxes++;

    }

    const setVoxel = function (voxelPosition, voxelFace, voxelColor) {
        // first, check if a voxel already exists here OR if a cutaway voids voxels from existing here
        if (cutawayField.get(voxelPosition.x, voxelPosition.y, voxelPosition.z) != null) return;
        // removing  clones ...
        // if (voxelField.get(voxelPosition.x, voxelPosition.y, voxelPosition.z) != null) {
        //     voxelPosition.copyFrom(instancedWorldSafetyOffset);
        // }
        // culling adjustments
        chunkMinPosition.minimizeInPlace(voxelPosition);
        chunkMaxPosition.maximizeInPlace(voxelPosition);
        // Commit to the global voxel field
        voxelField.set(voxelPosition.x, voxelPosition.y, voxelPosition.z, 1, localVoxelIterator * 4, instancedWorldModel, voxelFace);
        // color adjustment (multiply texture * color)
        voxelColor.multiply(colorData);
        // debugging ...
        if (USERSETTINGS.debugMode == true) voxelColor = debugModeChunkColor;
        // update the actual instance
        instancedWorldModel.addVoxelToChunk(voxelPosition.x, voxelPosition.y, voxelPosition.z, voxelColor.r, voxelColor.g, voxelColor.b, 1); // 1 for non-glass
        // push forward ...
        localVoxelIterator++;
        LEVELDATA.numVoxels++;
    }

    // Create the ROOF (top) of the box:
    for (let x = 0; x < Math.ceil(scale.x / squareChunkSize); x++) {
        for (let z = 0; z < Math.ceil(scale.z / squareChunkSize); z++) {
            let isFullChunk = true;
            let thisChunkSizeX = squareChunkSize;
            let thisChunkSizeZ = squareChunkSize;
            for (let i = 0; i < thisChunkSizeX; i++) {
                for (let j = 0; j < thisChunkSizeZ; j++) {
                    const voxelPosition = new BABYLON.Vector3(position.x + x * squareChunkSize + i, position.y + scale.y, position.z + z * squareChunkSize + j);
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

    // Create the RIGHT WALL of the box:
    for (let y = 0; y < Math.ceil(scale.y / squareChunkSize); y++) {
        for (let z = 0; z < Math.ceil(scale.z / squareChunkSize); z++) {
            let isFullChunk = true;
            let thisChunkSizeY = squareChunkSize;
            let thisChunkSizeZ = squareChunkSize;
            for (let i = 0; i < thisChunkSizeY; i++) {
                for (let j = 0; j < thisChunkSizeZ; j++) {
                    const voxelPosition = new BABYLON.Vector3(position.x + scale.x, position.y + y * squareChunkSize + i, position.z + z * squareChunkSize + j);
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

    // Create the BACK WALL of the box:
    for (let x = 0; x < Math.ceil(scale.x / squareChunkSize); x++) {
        for (let y = 0; y < Math.ceil(scale.y / squareChunkSize); y++) {
            let isFullChunk = true;
            let thisChunkSizeX = squareChunkSize;
            let thisChunkSizeY = squareChunkSize;
            for (let i = 0; i < thisChunkSizeX; i++) {
                for (let j = 0; j < thisChunkSizeY; j++) {
                    const voxelPosition = new BABYLON.Vector3(position.x + x * squareChunkSize + i, position.y + y * squareChunkSize + j, position.z + scale.z);
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

    // Create the FRONT WALL of the box:
    for (let x = 0; x < Math.ceil(scale.x / squareChunkSize); x++) {
        for (let y = 0; y < Math.ceil(scale.y / squareChunkSize); y++) {
            let isFullChunk = true;
            let thisChunkSizeX = squareChunkSize;
            let thisChunkSizeY = squareChunkSize;
            for (let i = 0; i < thisChunkSizeX; i++) {
                for (let j = 0; j < thisChunkSizeY; j++) {
                    const voxelPosition = new BABYLON.Vector3(position.x + x * squareChunkSize + i, position.y + y * squareChunkSize + j, position.z);
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

    // Create the LEFT WALL of the box:
    for (let y = 0; y < Math.ceil(scale.y / squareChunkSize); y++) {
        for (let z = 0; z < Math.ceil(scale.z / squareChunkSize); z++) {
            let isFullChunk = true;
            let thisChunkSizeY = squareChunkSize;
            let thisChunkSizeZ = squareChunkSize;
            for (let i = 0; i < thisChunkSizeY; i++) {
                for (let j = 0; j < thisChunkSizeZ; j++) {
                    const voxelPosition = new BABYLON.Vector3(position.x, position.y + y * squareChunkSize + i, position.z + z * squareChunkSize + j);
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

    // Create the FLOOR (bottom) of the box:
    for (let x = 0; x < Math.ceil(scale.x / squareChunkSize); x++) {
        for (let z = 0; z < Math.ceil(scale.z / squareChunkSize); z++) {
            let isFullChunk = true;
            let thisChunkSizeX = squareChunkSize;
            let thisChunkSizeZ = squareChunkSize;
            for (let i = 0; i < thisChunkSizeX; i++) {
                for (let j = 0; j < thisChunkSizeZ; j++) {
                    const voxelPosition = new BABYLON.Vector3(position.x + x * squareChunkSize + i, position.y, position.z + z * squareChunkSize + j);
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