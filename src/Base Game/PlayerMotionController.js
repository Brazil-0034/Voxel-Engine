import { lerp, clamp, moveTowards } from './EngineMath.js'; // math functions
import { voxelField } from './VoxelStructures.js'; // data structures for handling voxels
import * as THREE from 'three';

// ##########
// PLAYER MOTION CONSTANTS
// ##########
export class PlayerController {
    controls
    
    LEVELHANDLER
    USERSETTINGS
    INPUTHANDLER
    WEAPONHANDLER // dam this class needs everything lol

    playerMotion

    constructor(controls, LEVELHANDLER, USERSETTINGS, INPUTHANDLER, WEAPONHANDLER) {
        this.controls = controls;
        this.USERSETTINGS = USERSETTINGS;
        this.LEVELHANDLER = LEVELHANDLER;
        this.INPUTHANDLER = INPUTHANDLER;
        this.WEAPONHANDLER = WEAPONHANDLER;

        this.playerMotion = {
            xAxis: 0,
            zAxis: 0,
        
            acceleration: 0.25,
            maxSpeed: 0.015,
            stepSize: 125,
        
            crouchSpeed: 7.5,
            crouchLerp: 0,
            crouchYPosition: this.LEVELHANDLER.playerHeight - 15,
            isCrouching: false
        }
    }

    
    update(delta) {
        if (this.controls.isLocked == true)
        {
            // Crouching
            this.playerMotion.isCrouching = this.INPUTHANDLER.isKeyPressed("control");

            // // Drugs
            // if (isCapsLockPressed) {
            //     this.LEVELHANDLER.renderer.domElement.classList.add("on-drugs");
            //     this.LEVELHANDLER.timeModifier = 0.25;

            //     bloomPass.threshold = lerp(bloomPass.threshold, 0.25, delta * 5);
            //     bloomPass.radius = lerp(bloomPass.radius, 2.5, delta * 5);
            // } else {
            //     this.LEVELHANDLER.renderer.domElement.classList.remove("on-drugs");
            //     this.LEVELHANDLER.timeModifier = 1;

            //     bloomPass.threshold = lerp(bloomPass.threshold, 0.75, delta * 0.5);
            //     bloomPass.radius = lerp(bloomPass.radius, 0, delta * 0.5);
            // }

            // Global RESET Key
            if (this.INPUTHANDLER.isKeyPressed("r")) resetGameState(this.LEVELHANDLER, this.WEAPONHANDLER);
            
            // WS
            if (this.INPUTHANDLER.isKeyPressed("w")) this.playerMotion.zAxis -= this.playerMotion.acceleration * delta;
            if (this.INPUTHANDLER.isKeyPressed("s")) this.playerMotion.zAxis += this.playerMotion.acceleration * delta;
            if ((!this.INPUTHANDLER.isKeyPressed("w") && !this.INPUTHANDLER.isKeyPressed("s")) || this.INPUTHANDLER.isKeyPressed("w") && this.INPUTHANDLER.isKeyPressed("s")) this.playerMotion.zAxis = lerp(this.playerMotion.zAxis, 0, delta * 10);
            // AD
            if (this.INPUTHANDLER.isKeyPressed("a")) this.playerMotion.xAxis -= this.playerMotion.acceleration * delta;
            if (this.INPUTHANDLER.isKeyPressed("d")) this.playerMotion.xAxis += this.playerMotion.acceleration * delta;
            if ((!this.INPUTHANDLER.isKeyPressed("a") && !this.INPUTHANDLER.isKeyPressed("d")) || this.INPUTHANDLER.isKeyPressed("a") && this.INPUTHANDLER.isKeyPressed("d")) this.playerMotion.xAxis = lerp(this.playerMotion.xAxis, 0, delta * 10);

            // Keep within safe range
            this.playerMotion.zAxis = clamp(this.playerMotion.zAxis, -this.playerMotion.maxSpeed, this.playerMotion.maxSpeed);
            this.playerMotion.xAxis = clamp(this.playerMotion.xAxis, -this.playerMotion.maxSpeed, this.playerMotion.maxSpeed);

            // Sprinting
            let sprinting = this.INPUTHANDLER.isKeyPressed("shift") ? 2 : 1;
            if (this.USERSETTINGS.disableCollisions == false)
            {
                // FORWARDS COLLISION CHECKS
                const collisionRadius = 15;
                const footPosition = new THREE.Vector3(this.LEVELHANDLER.camera.position.x, this.LEVELHANDLER.camera.position.y - this.LEVELHANDLER.playerHeight + 5, this.LEVELHANDLER.camera.position.z);
                if (this.playerMotion.zAxis < 0) {
                    const camForwardDirection = new THREE.Vector3();
                    this.LEVELHANDLER.camera.getWorldDirection(camForwardDirection);
                    camForwardDirection.y = 0;
                    // FIRST, raycast forwards (foot position)
                    let forward = voxelField.raycast(footPosition, camForwardDirection, collisionRadius);
                    // if there is something in the way
                    if (forward != null) this.playerMotion.zAxis *= -0.0001;
                    else if (voxelField.raycast(new THREE.Vector3(footPosition.x, footPosition.y, footPosition.z).add(camForwardDirection.multiplyScalar(2)), new THREE.Vector3(0, 1, 0), this.LEVELHANDLER.playerHeight) != null) this.playerMotion.zAxis *= -0.0001;
                }
                // REAR COLLISION CHECKS
                if (this.playerMotion.zAxis > 0) {
                    const camBackwardDirection = new THREE.Vector3();
                    this.LEVELHANDLER.camera.getWorldDirection(camBackwardDirection);
                    camBackwardDirection.negate();
                    camBackwardDirection.y = 0;
                    let rear = voxelField.raycast(footPosition, camBackwardDirection, collisionRadius);
                    if (rear != null) this.playerMotion.zAxis *= -0.0001;
                    else if (voxelField.raycast(new THREE.Vector3(footPosition.x, footPosition.y, footPosition.z).add(camBackwardDirection.multiplyScalar(2)), new THREE.Vector3(0, 1, 0), this.LEVELHANDLER.playerHeight) != null) this.playerMotion.zAxis *= -0.0001;
                }
                // LEFT COLLISION CHECKS
                if (this.playerMotion.xAxis < 0) {
                    const camLeftDirection = new THREE.Vector3();
                    this.LEVELHANDLER.camera.getWorldDirection(camLeftDirection);
                    camLeftDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
                    camLeftDirection.y = 0;
                    let left = voxelField.raycast(footPosition, camLeftDirection, collisionRadius);
                    if (left != null) this.playerMotion.xAxis *= -0.0001;
                    else if (voxelField.raycast(new THREE.Vector3(footPosition.x, footPosition.y, footPosition.z).add(camLeftDirection.multiplyScalar(2)), new THREE.Vector3(0, 1, 0), this.LEVELHANDLER.playerHeight) != null) this.playerMotion.xAxis *= -0.0001;
                }
                // RIGHT COLLISION CHECKS
                if (this.playerMotion.xAxis > 0) {
                    const camRightDirection = new THREE.Vector3();
                    this.LEVELHANDLER.camera.getWorldDirection(camRightDirection);
                    camRightDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
                    camRightDirection.negate();
                    camRightDirection.y = 0;
                    let right = voxelField.raycast(footPosition, camRightDirection, collisionRadius);
                    if (right != null) this.playerMotion.xAxis *= -0.0001;
                    else if (voxelField.raycast(new THREE.Vector3(footPosition.x, footPosition.y, footPosition.z).add(camRightDirection.multiplyScalar(2)), new THREE.Vector3(0, 1, 0), this.LEVELHANDLER.playerHeight) != null) this.playerMotion.xAxis *= -0.0001;
                }
            }
            // Movement
            this.controls.moveRight(this.playerMotion.stepSize * this.playerMotion.xAxis * sprinting);
            this.controls.moveForward(-this.playerMotion.stepSize * this.playerMotion.zAxis * sprinting);
            let isMoving = false;
            if (this.playerMotion.zAxis > this.playerMotion.maxSpeed/2 || this.playerMotion.xAxis > this.playerMotion.maxSpeed/2 || this.playerMotion.zAxis < -this.playerMotion.maxSpeed/2 || this.playerMotion.xAxis < -this.playerMotion.maxSpeed/2) {
                isMoving = true;
            }
            // Crouching
            if (this.playerMotion.isCrouching) {
                this.LEVELHANDLER.camera.position.y = lerp(this.LEVELHANDLER.playerHeight, this.playerMotion.crouchYPosition, this.playerMotion.crouchLerp);
                this.playerMotion.crouchLerp += this.playerMotion.crouchSpeed * delta;
                if (this.playerMotion.crouchLerp > 1) this.playerMotion.crouchLerp = 1;
            }
            else {
                var headPosition = this.LEVELHANDLER.playerHeight
                if (isMoving) {
                    const freq = 75;
                    const strength = 2.5;
                    headPosition = this.LEVELHANDLER.playerHeight + (Math.sin(Date.now() / freq) * strength);
                }
                this.LEVELHANDLER.camera.position.y = lerp(this.LEVELHANDLER.camera.position.y, headPosition, delta * 10);
                this.playerMotion.crouchLerp -= this.playerMotion.crouchSpeed * delta;
                if (this.playerMotion.crouchLerp < 0) this.playerMotion.crouchLerp = 0;
            }
            if (this.WEAPONHANDLER.weaponModel && this.WEAPONHANDLER.weaponTarget && delta > 0) {
                // SIN the weapon's position
                const bounceRange = new THREE.Vector3(100, 100, 0);
                let speed = new THREE.Vector3(0.01, 0.02, 0.01);
                if (this.isCapsLockPressed) speed.multiplyScalar(0.5)

                this.WEAPONHANDLER.weaponTarget.position.x += (Math.sin(Date.now() * speed.x) * bounceRange.x) * (isMoving) * delta * 1 / this.LEVELHANDLER.timeModifier;
                this.WEAPONHANDLER.weaponTarget.position.y += (Math.sin(Date.now() * speed.y) * bounceRange.y) * (isMoving) * delta * 1 / this.LEVELHANDLER.timeModifier;
            
                // LERP the weapon's position
                const instancedWeaponTargetWorldPosition = new THREE.Vector3();
                this.WEAPONHANDLER.weaponTarget.getWorldPosition(instancedWeaponTargetWorldPosition);
                this.WEAPONHANDLER.weaponModel.position.copy(moveTowards(this.WEAPONHANDLER.weaponModel.position, instancedWeaponTargetWorldPosition, delta * this.WEAPONHANDLER.weaponFollowSpeed * 1 / this.LEVELHANDLER.timeModifier));

                // always realign the rotation of the weapon to the target
                this.WEAPONHANDLER.weaponModel.rotation.setFromRotationMatrix(this.WEAPONHANDLER.weaponTarget.matrixWorld);
            }
        }
    }
}
