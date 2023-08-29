import * as THREE from 'three';

export class Particle {
    instanceBufferPosition
    position
    scale
    rotation
    direction
    color
    speed
    targetSpeed
    lifetime

    constructor(particleMesh, position, direction, color, speed) {
        this.position = position;
        this.scale = new THREE.Vector3(1,1,1);
        this.rotation = new THREE.Quaternion();
        this.rotation.setFromUnitVectors(new THREE.Vector3(0,(Math.random() < 0.5 ? 1 : -1), 0), direction.clone().normalize());
        this.direction = direction.multiplyScalar(speed);
        this.color = color;
        this.targetSpeed = speed;
        this.speed = 0.25;
        this.instanceBufferPosition = particleMesh.addParticle(this);
        this.lifetime = 0;
    }
}

export class ParticleMesh extends THREE.InstancedMesh {
    bufferPosition
    maxCount
    particlesList
    
    constructor(geometry, material, count) {
        super(geometry, material, count)
        this.bufferPosition = 0;
        this.maxCount = count;
        this.particlesList = [];
    }

    addParticle(particle) {
        if (this.bufferPosition >= this.maxCount) {
            this.bufferPosition = 0;
        }
        this.setMatrixAt(this.bufferPosition, new THREE.Matrix4().makeTranslation(particle.position.x, particle.position.y, particle.position.z))
        this.setColorAt(this.bufferPosition, particle.color);
        this.instanceColor.needsUpdate = true;
        this.particlesList.push(particle);
        this.bufferPosition += 1;

        return this.bufferPosition - 1;
    }

    update(delta) {
        console.log(this.particlesList.length);
        for (let i = 0; i < this.particlesList.length; i++)
        {
            let particle = this.particlesList[i];
            if (particle.lifetime > 6500 * delta) {
                this.particlesList.splice(i, 1);
                particle.scale.set(0,0,0);
            }
            {
                particle.position.x += particle.direction.x * delta * particle.speed;
                particle.position.y += (particle.direction.y - (particle.lifetime * 1.5)) * delta * particle.speed;
                particle.position.z += particle.direction.z * delta * particle.speed;
                particle.lifetime += 1;
    
                if (particle.speed < particle.targetSpeed) particle.speed += 1 * delta;
    
                // delay scaling until after a little while
                if (particle.lifetime < 2000 * delta) particle.scale.set(1,1,1);
    
                // rotate on x and z axis based on lifetime
                particle.rotation.setFromEuler(new THREE.Euler(particle.lifetime * 0.01, 0, particle.lifetime * 0.01));
            }

            // rescale with delta
            this.setMatrixAt(particle.instanceBufferPosition, new THREE.Matrix4().compose(particle.position, particle.rotation, particle.scale.multiplyScalar(1 - (delta * 1.5))));
        }
        this.instanceMatrix.needsUpdate = true;
    }
}