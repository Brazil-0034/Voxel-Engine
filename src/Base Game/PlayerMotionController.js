// ##########
// Imports
// ##########
import { lerp, clamp, rapidFloat } from './EngineMath.js'; // math functions
import { voxelField, generateDestroyedChunkAt } from './VoxelStructures.js'; // data structures for handling voxels
import { resetGameState } from './GameStateControl.js'; // Level Data
import { setHelpText, setInteractionText, getInteractionText } from './UIHandler.js'; // User Interface
import * as THREE from 'three';

let reverseTimeout, defaultIdleDuration;

/**
 * @class PlayerController
 * @description This is a BIIIIG class for handling EVERYTHING related to player motion.
 * @param controls - The THREE.js PointerLockControls object
 * @param LEVELHANDLER - The LEVELHANDLER object
 * @param USERSETTINGS - The USERSETTINGS object
 * @param INPUTHANDLER - The INPUTHANDLER object
 * @param WEAPONHANDLER - The WEAPONHANDLER object
 * @param raycaster - The THREE.js Raycaster object
 */
export class PlayerController {
    controls
    
    LEVELHANDLER
    USERSETTINGS
    INPUTHANDLER
    WEAPONHANDLER // dam this class needs everything lol, maybe this is a sign of bad design ... nahhhhh

    playerMotion

    raycaster

    isFirstUpdate

    // Initialize Controller ...
    constructor(controls, LEVELHANDLER, USERSETTINGS, INPUTHANDLER, WEAPONHANDLER, raycaster) {
        this.controls = controls;
        this.USERSETTINGS = USERSETTINGS;
        this.LEVELHANDLER = LEVELHANDLER;
        this.INPUTHANDLER = INPUTHANDLER;
        this.WEAPONHANDLER = WEAPONHANDLER;
        this.raycaster = raycaster;
        this.isFirstUpdate = true;

        this.playerMotion = {
            xAxis: 0,
            zAxis: 0,
        
            acceleration: 0.25,
            maxSpeed: 1.2,
            stepSize: 125,
        }
    }

    // Update the controller at the framerate
    update(delta) {
        let isMoving = false;
        if (this.controls.isLocked == true)
        {
            // Global RESET Key
            if (this.INPUTHANDLER.isKeyPressed("r")) {
                resetGameState(this.LEVELHANDLER, this.WEAPONHANDLER);
                document.querySelector("#reverse").style.opacity = 0.5;
                if (!reverseTimeout) {
                    reverseTimeout = setTimeout(() => {
                        document.querySelector("#reverse").style.opacity = 0;
                        clearInterval(reverseTimeout);
                        reverseTimeout = undefined;
                    }, 150);
                }
            }

            // WS
            if (this.INPUTHANDLER.isKeyPressed("w")) this.playerMotion.zAxis -= this.playerMotion.acceleration * delta;
            if (this.playerMotion.zAxis < -this.playerMotion.maxSpeed * delta) this.playerMotion.zAxis = -this.playerMotion.maxSpeed * delta;
            if (this.INPUTHANDLER.isKeyPressed("s")) this.playerMotion.zAxis += this.playerMotion.acceleration * delta;
            if (!this.INPUTHANDLER.isKeyPressed("w") && !this.INPUTHANDLER.isKeyPressed("s")) this.playerMotion.zAxis = lerp(this.playerMotion.zAxis, 0, 10 * delta);
            else if (this.playerMotion.zAxis > this.playerMotion.maxSpeed * delta) this.playerMotion.zAxis = this.playerMotion.maxSpeed * delta;
            
            // AD
            if (this.INPUTHANDLER.isKeyPressed("a")) this.playerMotion.xAxis -= this.playerMotion.acceleration * delta;
            if (this.playerMotion.xAxis < -this.playerMotion.maxSpeed * delta) this.playerMotion.xAxis = -this.playerMotion.maxSpeed * delta;
            if (this.INPUTHANDLER.isKeyPressed("d")) this.playerMotion.xAxis += this.playerMotion.acceleration * delta; 
            if (!this.INPUTHANDLER.isKeyPressed("a") && !this.INPUTHANDLER.isKeyPressed("d")) this.playerMotion.xAxis = lerp(this.playerMotion.xAxis, 0, 10 * delta);
            else if (this.playerMotion.xAxis > this.playerMotion.maxSpeed * delta) this.playerMotion.xAxis = this.playerMotion.maxSpeed * delta;

            isMoving = this.INPUTHANDLER.isKeyPressed("w") || this.INPUTHANDLER.isKeyPressed("a") || this.INPUTHANDLER.isKeyPressed("s") || this.INPUTHANDLER.isKeyPressed("d");

            // Walking
            let moveSpeedOffset = this.INPUTHANDLER.isKeyPressed("shift") ? 1.45 : 1;
            let isInWall = false;
            if (this.USERSETTINGS.disableCollisions == false)
            {
                // FORWARDS COLLISION CHECKS
                const collisionRadius = 15;
                const footPosition = new THREE.Vector3(this.LEVELHANDLER.camera.position.x, this.LEVELHANDLER.camera.position.y - this.LEVELHANDLER.playerHeight + 15, this.LEVELHANDLER.camera.position.z);
                if (this.playerMotion.zAxis < 0) {
                    const camForwardDirection = new THREE.Vector3();
                    this.LEVELHANDLER.camera.getWorldDirection(camForwardDirection);
                    camForwardDirection.y = 0;
                    // FIRST, raycast forwards (foot position)
                    let forward = voxelField.raycast(footPosition, camForwardDirection, collisionRadius);
                    // if there is something in the way
                    if (forward != null) {
                        this.playerMotion.zAxis *= -0.0001;
                        // const distance = footPosition.distanceTo(new THREE.Vector3(forward.x, forward.y, forward.z));
                        // if (distance < 15) {
                        //     this.WEAPONHANDLER.weaponTarget.rotation.z = Math.PI/2;
                        // }
                    }
                    else if (voxelField.raycast(new THREE.Vector3(footPosition.x, footPosition.y, footPosition.z).add(camForwardDirection.multiplyScalar(2)), new THREE.Vector3(0, 1, 0), this.LEVELHANDLER.playerHeight - 10) != null
                    || (this.LEVELHANDLER.elevatorHasOpened == false && footPosition.z < 9940)) this.playerMotion.zAxis *= -0.0001;
                }
                // REAR COLLISION CHECKS
                if (this.playerMotion.zAxis > 0) {
                    const camBackwardDirection = new THREE.Vector3();
                    this.LEVELHANDLER.camera.getWorldDirection(camBackwardDirection);
                    camBackwardDirection.negate();
                    camBackwardDirection.y = 0;
                    let rear = voxelField.raycast(footPosition, camBackwardDirection, collisionRadius);
                    if (rear != null) {
                        this.playerMotion.zAxis *= -0.0001;
                        isInWall = true;
                    }
                    else if (voxelField.raycast(new THREE.Vector3(footPosition.x, footPosition.y, footPosition.z).add(camBackwardDirection.multiplyScalar(2)), new THREE.Vector3(0, 1, 0), this.LEVELHANDLER.playerHeight) != null) {
                        this.playerMotion.zAxis *= -0.0001;
                        isInWall = true;
                    }
                }
                // LEFT COLLISION CHECKS
                if (this.playerMotion.xAxis < 0) {
                    const camLeftDirection = new THREE.Vector3();
                    this.LEVELHANDLER.camera.getWorldDirection(camLeftDirection);
                    camLeftDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
                    camLeftDirection.y = 0;
                    let left = voxelField.raycast(footPosition, camLeftDirection, collisionRadius);
                    if (left != null) {
                        this.playerMotion.xAxis *= -0.0001;
                        isInWall = true;
                    }
                    else if (voxelField.raycast(new THREE.Vector3(footPosition.x, footPosition.y, footPosition.z).add(camLeftDirection.multiplyScalar(2)), new THREE.Vector3(0, 1, 0), this.LEVELHANDLER.playerHeight) != null) {
                        this.playerMotion.xAxis *= -0.0001;
                        isInWall = true;
                    }
                }
                // RIGHT COLLISION CHECKS
                if (this.playerMotion.xAxis > 0) {
                    const camRightDirection = new THREE.Vector3();
                    this.LEVELHANDLER.camera.getWorldDirection(camRightDirection);
                    camRightDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
                    camRightDirection.negate();
                    camRightDirection.y = 0;
                    let right = voxelField.raycast(footPosition, camRightDirection, collisionRadius);
                    if (right != null) {
                        this.playerMotion.xAxis *= -0.0001;
                        isInWall = true;
                    }
                    else if (voxelField.raycast(new THREE.Vector3(footPosition.x, footPosition.y, footPosition.z).add(camRightDirection.multiplyScalar(2)), new THREE.Vector3(0, 1, 0), this.LEVELHANDLER.playerHeight) != null) {
                        this.playerMotion.xAxis *= -0.0001;
                        isInWall = true;
                    }
                }
            }


            // Movement
            if (this.LEVELHANDLER.playerCanMove == true) {
                this.controls.moveRight(this.playerMotion.stepSize * this.playerMotion.xAxis * moveSpeedOffset);
                this.controls.moveForward(-this.playerMotion.stepSize * this.playerMotion.zAxis * moveSpeedOffset);
                // if moving right and forward at the same time, reduce speed
                if (this.playerMotion.xAxis != 0 && this.playerMotion.zAxis != 0) {
                    this.playerMotion.xAxis *= 0.75;
                    this.playerMotion.zAxis *= 0.75;
                }
    
                // Animate Crosshair
                const mc = document.querySelector("#middle-crosshair");
                mc.style.maxWidth = lerp(parseInt(mc.style.maxWidth), 32, 10 * delta) + "px";

                // WEAPON ACTION HANDLING
                const ac = document.querySelector("#ammo-counter");
                ac.style.opacity = 0.15;
                // Ranged Anim
                if (this.WEAPONHANDLER.weaponIsEquipped) {
                    if (this.WEAPONHANDLER.holdGunAction && this.WEAPONHANDLER.idleAction && this.WEAPONHANDLER.attackAction) {
                        this.WEAPONHANDLER.holdGunAction.play();
                        this.WEAPONHANDLER.idleAction.weight = lerp(this.WEAPONHANDLER.idleAction.weight, 0, 10 * delta);
                        this.WEAPONHANDLER.attackAction.weight = lerp(this.WEAPONHANDLER.idleAction.weight, 0, 10 * delta);
                        this.WEAPONHANDLER.holdGunAction.weight = lerp(this.WEAPONHANDLER.holdGunAction.weight, 1, 10 * delta);
                    }
                }
                else {
                    if (this.WEAPONHANDLER.holdGunAction && this.WEAPONHANDLER.idleAction && this.WEAPONHANDLER.attackAction) {
                        this.WEAPONHANDLER.holdGunAction.weight = lerp(this.WEAPONHANDLER.holdGunAction.weight, 0, 5 * delta);
                        this.WEAPONHANDLER.idleAction.weight = lerp(this.WEAPONHANDLER.idleAction.weight, 1, 5 * delta);
                        this.WEAPONHANDLER.attackAction.weight = lerp(this.WEAPONHANDLER.attackAction.weight, 0, 5 * delta);
                    }
                }
                // Melee
                const baseScale = 0.0;
                const maxScale = 0.2;
                const speed = 1;
				if (this.LEVELHANDLER.elevatorHasOpened) this.LEVELHANDLER.isCameraShaking = false;
                if (this.INPUTHANDLER.isLeftClicking) {
                    if (this.WEAPONHANDLER.weaponType == "melee") {
                        if (!this.WEAPONHANDLER.weaponIsEquipped) {
                            // smoothly fade from idleAnimation to attackAnimation
                            if (this.WEAPONHANDLER.attackAction && this.WEAPONHANDLER.idleAction) {
                                this.WEAPONHANDLER.attackAction.play();
                                this.WEAPONHANDLER.idleAction.weight = lerp(this.WEAPONHANDLER.idleAction.weight, 0, 10 * delta);
                                this.WEAPONHANDLER.attackAction.weight = lerp(this.WEAPONHANDLER.attackAction.weight, 1, 10 * delta);
                            }
                        }
                    }
                    else this.LEVELHANDLER.hasShotYet = true;
                    if (this.WEAPONHANDLER.weaponRemainingAmmo > 0)
                    {
                        if (this.WEAPONHANDLER.weaponType == "ranged") this.LEVELHANDLER.isCameraShaking = true;
                        ac.textContent = this.WEAPONHANDLER.weaponRemainingAmmo;
                        ac.style.opacity = 0.35;
                        // Animate Crosshair
                        mc.style.maxWidth = lerp(parseInt(mc.style.maxWidth), 0, 10 * delta) + "px";
                        
                        if (this.WEAPONHANDLER.isAttackAvailable) {
                            this.WEAPONHANDLER.weaponRemainingAmmo--;

                            if (this.WEAPONHANDLER.fireAnimation) {
                                this.WEAPONHANDLER.fireAnimation.play();
                            }
                            
                            // Play Sound
                            // shotgun / semi auto sound
                            if (this.WEAPONHANDLER.weaponName == "Shotgun" || this.WEAPONHANDLER.weaponName == "REVOLVER") this.LEVELHANDLER.SFXPlayer.playSound("blastSound", true, 1);
                            // automatic sound
                            else if (this.WEAPONHANDLER.weaponType == "ranged") this.LEVELHANDLER.SFXPlayer.setSoundPlaying("shootSound", true);

                            // GOD i HATE javascript
                            // type annotations? NO.
                            // parameter delcarations? NO.
                            // return types? NO.
                            // why don't i just kill myself now?
                            this.calculateWeaponShot();

                            this.raycaster.far = this.WEAPONHANDLER.weaponRange;
                            this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.LEVELHANDLER.camera);
                            const intersects = this.raycaster.intersectObjects(this.LEVELHANDLER.NPCBank.map(npc => npc.hitboxCapsule));

                            for (let i = 0; i < intersects.length; i++) {
                                const mainObj = intersects[i].object;
                                if (mainObj.npcHandler)
                                {
                                    if (mainObj.npcHandler.health > 0) {
                                        // Register Hit
                                        mainObj.npcHandler.depleteHealth(this.WEAPONHANDLER.weaponDamage);
                                    }
                                    // Squelch!
                                    this.LEVELHANDLER.SFXPlayer.playSound("hitSound");
                                }
                            }

                            this.WEAPONHANDLER.isAttackAvailable = false;
                            setTimeout(() => {this.WEAPONHANDLER.isAttackAvailable = true}, this.WEAPONHANDLER.fireRate, this.WEAPONHANDLER);
                        }
                    }
                    else {
                        ac.innerHTML = `<span style="color:#b82323">0</span>`
                        ac.style.opacity = 1;
                        // Stop Sound
                        this.LEVELHANDLER.SFXPlayer.setSoundPlaying("shootSound", false);
                    }
                }
                else
                {
                    // Stop Sound
                    this.LEVELHANDLER.SFXPlayer.setSoundPlaying("shootSound", false);
                    // smoothly fade from attackAnimation to idleAnimation
                    if (this.WEAPONHANDLER.attackAction && this.WEAPONHANDLER.idleAction && !this.WEAPONHANDLER.weaponIsEquipped) {
                        this.WEAPONHANDLER.idleAction.weight = lerp(this.WEAPONHANDLER.idleAction.weight, 1, 10 * delta);
                        this.WEAPONHANDLER.attackAction.weight = lerp(this.WEAPONHANDLER.attackAction.weight, 0, 10 * delta);
                    }

                }

                if (!defaultIdleDuration) defaultIdleDuration = this.WEAPONHANDLER.idleAction._clip.duration;
                if (isMoving)
                {
                    this.WEAPONHANDLER.idleAction.setDuration(defaultIdleDuration / 3);
                }
                else
                {
                    this.WEAPONHANDLER.idleAction.setDuration(defaultIdleDuration / 1.25);
                }
                
                // Weapon Bouncing (For Juice!!!)
                if (this.WEAPONHANDLER.weaponModel && this.WEAPONHANDLER.weaponTarget && delta > 0) {
                    // SIN the weapon's position
                    if (this.WEAPONHANDLER.disableHeadBop != true)
                    {
                        // const bounceRange = new THREE.Vector3(5, 5, 0);
                        // let speed = new THREE.Vector3(0.1, 0.2, 0.1);
        
                        // this.WEAPONHANDLER.weaponTarget.position.x += (Math.sin(Date.now() * speed.x) * bounceRange.x) * (isMoving) * delta * 1 / this.LEVELHANDLER.timeModifier;
                        // this.WEAPONHANDLER.weaponTarget.position.y += (Math.sin(Date.now() * speed.y) * bounceRange.y) * (isMoving) * delta * 1 / this.LEVELHANDLER.timeModifier;
                        // ^ replaced by new animation system
   
                        const turnRange = 10;
                        if (!isInWall) this.WEAPONHANDLER.weaponTarget.setRotationFromEuler(new THREE.Euler(
                            (this.playerMotion.zAxis * turnRange/10) + this.WEAPONHANDLER.weaponRotation.x,
                            0 + this.WEAPONHANDLER.weaponRotation.y,
                            -(this.playerMotion.xAxis * turnRange) + this.WEAPONHANDLER.weaponRotation.z
                        ));
                    }
                
                    // LERP the weapon's position
                    const instancedWeaponTargetWorldPosition = new THREE.Vector3();
                    this.WEAPONHANDLER.weaponTarget.getWorldPosition(instancedWeaponTargetWorldPosition);
                    if (!this.INPUTHANDLER.isKeyPressed("t"))
                    {
                        this.WEAPONHANDLER.weaponModel.position.copy(instancedWeaponTargetWorldPosition);
                        this.WEAPONHANDLER.weaponModel.rotation.setFromRotationMatrix(this.WEAPONHANDLER.weaponTarget.matrixWorld);
                    }
                    this.WEAPONHANDLER.weaponModel.scale.y = lerp(this.WEAPONHANDLER.weaponModel.scale.y, 1/50, 10 * delta);
                }
            }

            // Weapon Pickups
            this.LEVELHANDLER.weaponPickups.forEach(pickup => {
                if (pickup.position.distanceTo(this.LEVELHANDLER.camera.position.clone().setY(1)) < 75)
                {
                    if (pickup.isActive)
                    {
                        setInteractionText("<b>[E]</b> PICK UP WEAPON");
                        if (this.WEAPONHANDLER.weaponType != "melee") setInteractionText("<b>[E]</b> SWAP WEAPON");
                        if (this.INPUTHANDLER.isKeyPressed("e") && this.LEVELHANDLER.playerCanMove == true)
                        {
                            // pickup.visible = false;
                    		if (this.WEAPONHANDLER.recentlyPickedUpWeapon == false) {
                                this.WEAPONHANDLER.pickupWeapon(pickup);
                                pickup.isActive = false;
                            }
                        }
                    }
                }
            })

            // Health Pickups
            this.LEVELHANDLER.healthPickups.forEach(pickup => {
                if (pickup.isActive && pickup.position.distanceTo(this.LEVELHANDLER.camera.position.clone().setY(1)) < 45)
                {
                    // setInteractionText("<b>[E]</b> PICK UP HEALTH");
                    // if (this.INPUTHANDLER.isKeyPressed("e") && this.LEVELHANDLER.playerCanMove == true)
                    {
                        if (this.LEVELHANDLER.playerHealth < 100) {
                            // claim health pickup
                            this.LEVELHANDLER.playerHealth += 100;
                            if (this.LEVELHANDLER.playerHealth > 100) this.LEVELHANDLER.playerHealth = 100;
                            pickup.isActive = false;
                            pickup.visible = false;
                            this.LEVELHANDLER.SFXPlayer.playSound("healthPickup", false);
                            const flashElement = document.createElement("div");
                            flashElement.id = "health-flash";
                            document.body.appendChild(flashElement);
                            setTimeout(() => flashElement.remove(), 1000);
                        	document.querySelector("#healthbar").style.width = "200px";
                        }
                    }
                }
            });

            // throwing
            if (this.INPUTHANDLER.isKeyPressed("q") && this.LEVELHANDLER.playerCanMove == true) this.WEAPONHANDLER.throwWeapon();
        }
        else
        {
            // Stop Sound
            this.LEVELHANDLER.SFXPlayer.setSoundPlaying("shootSound", false);
            // smoothly fade from attackAnimation to idleAnimation
            if (this.WEAPONHANDLER.attackAction && this.WEAPONHANDLER.idleAction && !this.WEAPONHANDLER.weaponIsEquipped) {
                this.WEAPONHANDLER.idleAction.weight = lerp(this.WEAPONHANDLER.idleAction.weight, 1, 10 * delta);
                this.WEAPONHANDLER.attackAction.weight = lerp(this.WEAPONHANDLER.attackAction.weight, 0, 10 * delta);
            }
        }

        // Assign Weapon Position
        if (this.WEAPONHANDLER.weaponTarget) this.WEAPONHANDLER.weaponTarget.position.set(this.WEAPONHANDLER.weaponPosition.x, this.WEAPONHANDLER.weaponPosition.y, this.WEAPONHANDLER.weaponPosition.z);

        // Adjust Camera FOV (For ADS Effects)
		let targetFOV = this.USERSETTINGS.baseFOV;
        if (!this.USERSETTINGS.baseFOV) targetFOV = 80;
		if (this.INPUTHANDLER.isRightClicking) targetFOV = this.USERSETTINGS.baseFOV - 20;
        this.LEVELHANDLER.camera.fov = lerp(this.LEVELHANDLER.camera.fov, targetFOV, 10 * delta);
		if (Math.abs(this.LEVELHANDLER.camera.fov - targetFOV) > 1) this.LEVELHANDLER.camera.updateProjectionMatrix();
    }

    calculateWeaponShot = function () {
        // Impact Effect
        if (this.WEAPONHANDLER.fireSprite && this.WEAPONHANDLER.hideMuzzleFlash != true) {
            let scale = 325 + rapidFloat() * 100;
            if (this.WEAPONHANDLER.weaponName == "Shotgun") {
                scale *= 2;
            }
            this.WEAPONHANDLER.fireSprite.scale.set(scale, scale);
            this.WEAPONHANDLER.fireSprite.material.rotation = rapidFloat() * Math.PI * 2;
            this.WEAPONHANDLER.fireSprite.material.opacity = rapidFloat() + 0.5;
            this.WEAPONHANDLER.muzzleFire.material.opacity = rapidFloat() + 0.5;
            this.WEAPONHANDLER.muzzleFire.rotateX(rapidFloat());
            if (this.WEAPONHANDLER.torus) this.WEAPONHANDLER.torus.scale.set(1,1,1);
        }

        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.LEVELHANDLER.camera);
        this.raycaster.far = this.WEAPONHANDLER.weaponRange;
        const intersects = this.raycaster.intersectObjects(this.LEVELHANDLER.explosives.map(explosives => explosives.children[0]));
        if (intersects.length > 0)
        {
            const explosive = intersects[0].object;
            this.LEVELHANDLER.triggerExplosive(explosive);
        }
        else
        {
            // else, check blocks
                
            // RAYCAST INTO THE VOXEL FIELD
            // STEP 1: GET THE CAMERA POSITION
            // STEP 2: GET THE CAMERA DIRECTION
            // STEP 3: CALL voxelField.raycast() WITH THE CAMERA POSITION AND DIRECTION, and a step range of weaponRange
            // STEP 4: IF THE RAYCAST RETURNS A HIT, DESTROY THE VOXEL AT THAT POSITION
            // CAMERA POSITION
            const cameraPosition = new THREE.Vector3();
            this.LEVELHANDLER.camera.getWorldPosition(cameraPosition);
            cameraPosition.x = Math.round(cameraPosition.x);
            cameraPosition.y = Math.round(cameraPosition.y);
            cameraPosition.z = Math.round(cameraPosition.z);
            const cameraDirection = new THREE.Vector3();
            this.LEVELHANDLER.camera.getWorldDirection(cameraDirection);

            const intersection = voxelField.raycast(cameraPosition, cameraDirection, this.WEAPONHANDLER.weaponRange);
            // Determine which voxels in chunk are to be destroyed
            if (intersection != null) {
                // get the lowest lod model for this voxel
                const currentModel = intersection.chunk;
        
                // disable any attached light
                if (currentModel.attachedLight != undefined) // TODO: this check may be unnecessary
                {
                    currentModel.attachedLight.intensity = 0;
                }
        
                // build a list of each destroyed voxel
                let destroyedVoxelsInChunk = [];
        
                // the position at which we hit
                const intersectPosition = new THREE.Vector3(
                    intersection.x,
                    intersection.y,
                    intersection.z
                )
        
                let damageSize = this.WEAPONHANDLER.destroyedChunkRange;
                // shotgun ammo spread ...
                if (this.WEAPONHANDLER.weaponName == "Shotgun")
                {
                    const distanceFromPlayer = this.LEVELHANDLER.camera.position.distanceTo(intersectPosition);
                    damageSize = parseInt(Math.min(damageSize + (distanceFromPlayer / 10), damageSize * 4));
                    // console.log("Adjusted damage size: ", damageSize, "Distance from player: ", distanceFromPlayer);
                }
                for (let x = intersectPosition.x - damageSize; x <= intersectPosition.x + damageSize; x++) {
                    for (let y = intersectPosition.y - damageSize; y <= intersectPosition.y + damageSize; y++) {
                        for (let z = intersectPosition.z - damageSize; z <= intersectPosition.z + damageSize; z++) {
                            {
                                if (
                                    x == intersectPosition.x + damageSize ||
                                    x == intersectPosition.x - damageSize ||
                                    y == intersectPosition.y + damageSize ||
                                    y == intersectPosition.y - damageSize ||
                                    z == intersectPosition.z + damageSize ||
                                    z == intersectPosition.z - damageSize
                                )
                                {
                                    if (rapidFloat() < 0.5) continue;
                                }
                                destroyedVoxelsInChunk.push(new THREE.Vector3(
                                    x,
                                    y,
                                    z
                                ));
                            }
                        }
                    }
                }
    
                generateDestroyedChunkAt(destroyedVoxelsInChunk, this.USERSETTINGS, this.LEVELHANDLER, this.LEVELHANDLER.particleHandler, currentModel);
            }
        }
    }
}