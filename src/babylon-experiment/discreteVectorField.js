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
            new BABYLON.Vector3(x, y, z),
            chunk,
            indexInChunk,
            face
        );
        if (value == 0) {
            // for holeBorder processing
            chunk.deadVoxels.push([x, y, z]);
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
