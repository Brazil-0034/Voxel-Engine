const cubeSprite = LEVELHANDLER.globalTextureLoader.load("../img/cubesprite.png");
const conjunctionCheckTimesPerSecond = 1;
const conjunctionCheck = function () {

    const holeBorder = [];

    // CONJUNCTION CHECK
    recentlyEditedWorldModels.forEach(instancedModel => {
        const deadVoxels = instancedModel.deadVoxels;
        for (let i = 0; i < deadVoxels.length; i++) {
            const thisVector = new THREE.Vector3(
                deadVoxels[i][0],
                deadVoxels[i][1],
                deadVoxels[i][2]
            );
            const voxel = voxelField.get(thisVector.x, thisVector.y, thisVector.z);
            if (voxel != null && voxel.value == 0) {
                holeBorder.push(thisVector);
            }
        }
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
        const hasAYPosition = function (x, z) {
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
                        voxel.chunk.setMatrixAt(voxel.indexInChunk, new THREE.Matrix4());
                        voxel.chunk.instanceMatrix.needsUpdate = true;

                        voxel.position = new THREE.Vector3(x, i, z);
                        voxel.color = voxelField.get(x, i, z).color;

                        fullHole.push(voxel);
                    }
                }
            }
        }
        const endTime = performance.now();
        console.log("conjunction check took " + (endTime - startTime) + " milliseconds");

        if (fullHole.length > 5) {
            LEVELHANDLER.SFXPlayer.playRandomSound("bigDropSounds");
        }
        
        // fullhole = array of voxels that are in the hole, and need to be removed
    }
}

document.addEventListener('mousedown', function (e) {
    // if mouse4 click
    if (e.button == 3) {
        conjunctionCheck();
        activateExplosives();
    }
});