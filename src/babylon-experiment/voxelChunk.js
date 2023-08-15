/**
 * 
 * A VoxelChunk is how WreckMesh renders voxels.
 * It inherits from InstancedMesh with some additional properties for rendering and physics.
 * It is a unified class for all mesh operations in WreckMesh.
 * 
 * @param frustumBox: THREE.Box3 - The bounding box of the chunk, used for frustum culling.
 * @param velocities: THREE.Vector3[] - The velocities of each voxel in the chunk. [Physics Processing Only]
 */
class VoxelChunk {
    // instancing
    baseObject
    positionsBuffer
    colorsBuffer
    voxelColorsArray
    deadVoxels
    runningVoxelCount

    // culling
    frustumBox
    isActivated
    coverBox
    isCovered

    constructor() {
        this.baseObject = BABYLON.MeshBuilder.CreateBox("baseObject", { size: 1 }, scene);
        this.positionsBuffer = new Float32Array(16 * 4096);
        this.colorsBuffer = new Float32Array(4 * 4096);
        this.voxelColorsArray = [];
        this.runningVoxelCount = 0;
        // this.baseObject.showBoundingBox = true;
        this.deadVoxels = [];
        this.isCovered = false;
        this.coverBox = []
    }

    addVoxelToChunk(x, y, z, r, g, b, a) {
        const matrix = BABYLON.Matrix.Translation(x, y, z);
        this.voxelColorsArray.push(r, g, b, a);
        matrix.copyToArray(this.positionsBuffer, this.runningVoxelCount);
        this.runningVoxelCount += 16;
    }

    finalizeConstruction() {
        this.baseObject.thinInstanceSetBuffer("matrix", this.positionsBuffer, 16);
        this.colorsBuffer.set(this.voxelColorsArray);
        this.voxelColorsArray = []; // i wholeheartedly misunderstand v8 garbage collection and have no idea if it will actually dump this array or not
        this.baseObject.thinInstanceSetBuffer("color", this.colorsBuffer, 4);
    }

    addCoverBox(coverBox) {
        this.isCovered = true;
        this.coverBox.push(coverBox);
    }

    uncover() {
        if (this.isCovered == true) {
            this.coverBox.forEach(box => {
                scene.remove(box);
                box.material.map.dispose();
                box.material.dispose();
                box.geometry.dispose();
            })
            this.isCovered = false;
            this.visible = true;
        }
    }
}

const VoxelFace = Object.freeze({
    TOP: "top",
    BOTTOM: "bottom",
    LEFT: "left",
    RIGHT: "right",
    FRONT: "front",
    BACK: "back"
});