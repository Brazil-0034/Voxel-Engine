import * as THREE from 'three';
import { clamp } from './EngineMath.js';

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
    hasBounced

    constructor(particleMesh, position, direction, color, speed) {
        this.position = position;
        this.scale = new THREE.Vector3(1,1,1);
        this.rotation = new THREE.Quaternion();
        this.rotation.setFromUnitVectors(new THREE.Vector3(0,(Math.random() < 0.5 ? 1 : -1), 0), direction.clone().normalize());
        this.direction = direction.multiplyScalar(speed * Math.random());
        this.color = color;
        this.targetSpeed = speed;
        this.speed = 0.25;
        this.instanceBufferPosition = particleMesh.addParticle(this);
        this.lifetime = 0;
        this.hasBounced = false;
    }
}

export class ParticleMesh extends THREE.InstancedMesh {
    bufferPosition
    maxCount
    particlesList
    particleLifetime
    
    constructor(geometry, material, count, particleLifetime) {
        super(geometry, material, count)
        this.bufferPosition = 0;
        this.maxCount = count;
        this.particlesList = [];
        this.particleLifetime = particleLifetime;
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
        for (let i = 0; i < this.particlesList.length; i++)
        {
            let particle = this.particlesList[i];
            if (particle.lifetime > (this.particleLifetime + 5000) * delta) {
                // its outlived its life, kill it
                this.particlesList.splice(i, 1);
                particle.scale.set(0,0,0);
            }
            {
                if (particle.position.y < 3) {
                    if (!particle.hasBounced) particle.direction.y = clamp(Math.random() * 2500, 10, 2500) / (particle.lifetime + 25);
                    else {
                        particle.position.y = 3;
                        particle.speed /= 2;
                    }
                    particle.hasBounced = true;
                }
                particle.direction.y -= (256 - (particle.lifetime / 4)) * delta;
                particle.position.x += particle.direction.x * delta * particle.speed / ((particle.lifetime + 1) * 10 * delta);
                particle.position.y += particle.direction.y * delta * particle.speed / 2// ((particle.lifetime + 1) * 10 * delta);
                particle.position.z += particle.direction.z * delta * particle.speed / ((particle.lifetime + 1) * 10 * delta);
                particle.lifetime += 1;
    
                // delay scaling until after a little while
                if (particle.lifetime < this.particleLifetime * delta) {
                    particle.scale.set(1,1,1);
                    if (particle.speed < particle.targetSpeed) particle.speed += 5 * delta;
                }
    
                // rotate on x and z axis based on lifetime
                particle.rotation.setFromEuler(new THREE.Euler(particle.lifetime * 0.01, 0, particle.lifetime * 0.01));
            }

            // rescale with delta
            this.setMatrixAt(particle.instanceBufferPosition, new THREE.Matrix4().compose(particle.position, particle.rotation, particle.scale.multiplyScalar(1 - (delta * 1.5))));
        }
        this.instanceMatrix.needsUpdate = true;
    }
}