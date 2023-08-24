import * as THREE from 'three';

class blockData {
	value
	position
	chunk
	indexInChunk
	face

	constructor(value, position, chunk, indexInChunk, face) {
		this.value = value;
		this.position = position;
		this.chunk = chunk;
		this.indexInChunk = indexInChunk;
		this.face = face;
	}
}


/**
 * 
 * A DiscreteVectorField is the primary method of storing voxel data in WreckMesh.
 * It is a 3D array of blockData objects, which contain the value, position, and chunk of the voxel.
 * 
 */
class DiscreteVectorField {
	constructor() {
		this.field = [];
		this.indexInChunkes = {};
	}

	setChunkMinIndex(chunkName, index) {
		if (!this.indexInChunkes[chunkName]) {
			this.indexInChunkes[chunkName] = {
				minIndex: 0,
				maxIndex: 0
			};
		}
		this.indexInChunkes[chunkName].minIndex = index;
	}

	setChunkMaxIndex(chunkName, index) {
		if (!this.indexInChunkes[chunkName]) {
			this.indexInChunkes[chunkName] = {
				minIndex: 0,
				maxIndex: 0
			};
		}
		this.indexInChunkes[chunkName].maxIndex = index;
	}

	getChunkMinIndex(chunkName) {
		return this.indexInChunkes[chunkName].minIndex || 0;
	}

	getChunkMaxIndex(chunkName) {
		return this.indexInChunkes[chunkName].maxIndex || 0;
	}

	// Sets the value of the vector field at the given position
	set(x, y, z, value, indexInChunk, chunk, face = null) {
		x = Math.round(x);
		y = Math.round(y);
		z = Math.round(z);
		if (!this.field[x]) {
			this.field[x] = [];
		}
		if (!this.field[x][y]) {
			this.field[x][y] = [];
		}
		if (!this.field[x][y][z]) {
			this.field[x][y][z] = []
		}
		this.field[x][y][z] = new blockData(
			value,
			new THREE.Vector3(x, y, z),
			chunk,
			indexInChunk,
			face
		);
		if (value == 0) {
			// for holeBorder processing
			chunk.deadVoxels.push([x, y, z]);
			if (chunk.material.emissiveIntensity > 0) chunk.material.emissiveIntensity = 0;
		}
	}

	// Retrieves the value of the vector field at the given position
	// 0 if none
	get(x, y, z) {
		if (this.field[x] && this.field[x][y] && this.field[x][y][z]) {
			return this.field[x][y][z];
		}
		return null;
	}

	// Shoots a "ray" with direction, origin, and length
	// Returns the first position where the ray intersects a voxel
	// Origin: Starting Position
	// Direction: Normalized Vector (ex. [0, 1, 0] is up from the origin)
	// Length: The maximum number of steps to take. If the ray does not intersect a voxel, return null
	raycast(origin, direction, length) {
		if (!origin || !direction || !length) console.error("Incorrect Parameters for Raycast");
		let x = Math.round(origin.x);
		let y = Math.round(origin.y);
		let z = Math.round(origin.z);

		const sqrMagnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);

		direction.x /= sqrMagnitude;
		direction.y /= sqrMagnitude;
		direction.z /= sqrMagnitude;
		for (let i = 0; i < length; i++) {
			const stepVoxel = this.get(Math.floor(x), Math.floor(y), Math.floor(z));
			if (stepVoxel != null && stepVoxel.value == 1) {
				return {
					x: Math.floor(x),
					y: Math.floor(y),
					z: Math.floor(z),
					index: stepVoxel.indexInChunk,
					chunk: stepVoxel.chunk
				};
			}
			x += direction.x;
			y += direction.y;
			z += direction.z;
		}
		return null; // TODO: js hates nulls, switch to 0 or change get() to return null as well
	}

	// pretty useless implementation
	// TODO: make this useful???
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
// This initializes the voxelField used for physics calculations
// This engine uses a two-fold representation of voxel data.
// One is stored in main memory (RAM), and the other is stored in GPU memory (vRAM)
// the GPU memory is used to render and display millions of voxels in as few draw calls as possible (the higher squareChunkSize, the fewer)
// the CPU memory is used to store the positions of these voxels, and use them for physics (such as raycasting, explosions, etc)
export const voxelField = new DiscreteVectorField();


/**
 * 
 * A VoxelChunk is how WreckMesh renders voxels.
 * It inherits from InstancedMesh with some additional properties for rendering and physics.
 * It is a unified class for all mesh operations in WreckMesh.
 * 
 * @param frustumBox: THREE.Box3 - The bounding box of the chunk, used for frustum culling.
 * @param velocities: THREE.Vector3[] - The velocities of each voxel in the chunk. [Physics Processing Only]
 */
export class VoxelChunk extends THREE.InstancedMesh {
	frustumBox
	isActivated
	deadVoxels
	coverBox
	isCovered
	LEVELHANDLER
	connectedBox

	constructor(geometry, material, count, LEVELHANDLER) {
		super(geometry, material, count);
		this.frustumBox = new THREE.Box3();
		this.deadVoxels = [];
		this.isCovered = false;
		this.coverBox = []
		this.LEVELHANDLER = LEVELHANDLER;
	}

	addCoverBox(coverBox) {
		this.isCovered = true;
		this.coverBox.push(coverBox);
	}

	uncover() {
		if (this.isCovered == true) {
			this.coverBox.forEach(box => {
				this.LEVELHANDLER.scene.remove(box);
				box.material.map.dispose();
				box.material.dispose();
				box.geometry.dispose();
			})
			this.isCovered = false;
			this.visible = true;
			this.connectedBox.voxelChunks.forEach(chunk => {
				if (chunk.isSideChunk == true) {
					chunk.uncover();
				}
			});
		}
	}
}

/**
 * 
 * A Box is a cuboid consisting of any number of VoxelChunks.
 * It is used to handle the uncovering of boxes that may have more than one chunk (often having side-chunks unless they are a perfect multiple of two)
 * 
 */

export class BoxData {
	voxelChunks

	constructor() {
		this.voxelChunks = [];
	}

	addChunk(chunk) {
		this.voxelChunks.push(chunk);
		chunk.connectedBox = this;
	}
}

export const VoxelFace = Object.freeze({
	TOP: "top",
	BOTTOM: "bottom",
	LEFT: "left",
	RIGHT: "right",
	FRONT: "front",
	BACK: "back"
});

// CUTAWAYS: These allow map builders to make "cuts" in the map, using either cuboids or spheres
// They act as a pre-filter for the world builder, masking out sections voxels should NOT be placed at
export const cutawayField = new DiscreteVectorField();
export const addToCutawayStack = function (scale, position) {
	console.log("Added a cutaway at " + position.x + ", " + position.y + ", " + position.z + " with scale " + scale);
	for (let x = position.x - (scale.x / 2); x < position.x + (scale.x / 2); x++) {
		for (let y = position.y - (scale.y / 2); y < position.y + (scale.y / 2); y++) {
			for (let z = position.z - (scale.z / 2); z < position.z + (scale.z / 2); z++) {
				cutawayField.set(
					Math.round(x),
					Math.round(y),
					Math.round(z),
					1
				);
			}
		}
	}
}