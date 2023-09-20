import * as THREE from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { lerp, clamp, createVizSphere } from './EngineMath.js';
import { pauseGameState } from './GameStateControl.js';
import { LevelHandler } from './LevelHandler.js';

// This will be the main system for spawning and handling NPC behavior
export class NPC {
    sceneObject // the scene object of the npc - includes the mesh, bones, etc
    npcObject // just the mesh object of the npc (children[0] of sceneObject)

    startingPosition // for reset
    startingRotation // for reset
    startingHealth // for reset

    health // health of NPC remaining
    speed // how fast he move -->

    runAnimation // u alr know
    idleAnimation // this too
    dieAnimation
    mixer // 3js anim mixer (per-npc until instanced skinning makes its way into main branch)
    fovConeMesh // for vision calculation
    fovConeHull // for vision calculation

    knowsWherePlayerIs // self explanatory
    voxelField // for raycasting

    WEAPONHANDLER // how far he can see
    LEVELHANDLER // what it sound like

    deathSound // on death

    // This will build the NPC (setting idle/run animation and loading model into scene)
    constructor(npcName, texturePath, position, rotationIntervals, speed, health, LEVELDATA, voxelField, WEAPONHANDLER, deathSound) {
        this.startingPosition = position;
        this.startingRotation = new THREE.Euler(0, rotationIntervals * Math.PI/4, 0);
        this.startingHealth = health;

        this.deathSound = deathSound;

        this.voxelField = voxelField;
        this.WEAPONHANDLER = WEAPONHANDLER;

        this.LEVELHANDLER = LEVELDATA;

        this.speed = speed;
        this.health = health;
        this.knowsWherePlayerIs = false;
        const basePath = '../character_models/' + npcName + '/';
        LEVELDATA.globalModelLoader.load(basePath + npcName + '_idle.fbx', object => {
            // STEP 1: ASSIGN MATERIALS
            this.sceneObject = object;
            this.npcObject = object.children[0];
            this.npcObject.npcHandler = this;
            this.sceneObject.traverse(function (childObject) {
                if (childObject.isMesh) {
                    // childObject.castShadow = true;
                    // childObject.receiveShadow = true;
                    childObject.material = new THREE.MeshPhongMaterial({
                        map: LEVELDATA.globalTextureLoader.load(basePath + npcName + '.png'),
                        shininess: 0,
                        specular: 0x000000
                    });
                }
            });

            // STEP 2: ASSIGN TRANSFORMS
            this.sceneObject.position.copy(position);
            this.sceneObject.scale.multiplyScalar(0.075);

            // STEP 3: APPLY ANIMATIONS
            this.mixer = new THREE.AnimationMixer(this.sceneObject);
            // load run animation
            LEVELDATA.globalModelLoader.load(basePath + npcName + '_run.fbx', object => {
                this.runAnimation = this.mixer.clipAction(object.animations[0]);
            });
            LEVELDATA.globalModelLoader.load(basePath + npcName + '_die_' + Math.floor(Math.random() * 3) + '.fbx', object => {
                this.dieAnimation = this.mixer.clipAction(object.animations[0]);
                this.dieAnimation.setLoop(THREE.LoopOnce);
                this.dieAnimation.clampWhenFinished = true;
            });
            this.idleAnimation = this.mixer.clipAction(this.sceneObject.animations[0]);
            this.idleAnimation.play();

            // create a "Field of View" cone in front of the head
            this.fovConeMesh = new THREE.Mesh(
                new THREE.ConeGeometry(2, 6, 4),
                new THREE.MeshBasicMaterial({
                    color: 0x00ff00, wireframe: true,
                    visible: false
                })
            );
            const headBone = this.sceneObject.children[1].children[0].children[0].children[0].children[0].children[0].children[0].children[0];

            headBone.attach(this.fovConeMesh);
            
            this.fovConeMesh.scale.multiplyScalar(100);
            this.fovConeMesh.position.set(headBone.position.x, headBone.position.y, headBone.position.z);
            this.fovConeMesh.translateY(-250);
            this.fovConeMesh.translateZ(4000);
            this.fovConeMesh.rotateX(-Math.PI/2);
            

            this.fovConeHull = new ConvexHull();
            this.fovConeHull.setFromObject(this.fovConeMesh);


            // And lastly... add it to the scene!
            if (Math.random() > 0.5) this.sceneObject.scale.x *= -1;
            this.LEVELHANDLER.scene.add(this.sceneObject);

            // add a helper to the bounding sphere
            // compute bounding sphere
            this.npcObject.geometry.computeBoundingSphere();
            this.npcObject.geometry.boundingSphere.set(this.npcObject.position, 512);
            this.sceneObject.rotation.copy(this.startingRotation);

        });

        LEVELDATA.NPCBank.push(this);
    }

    depleteHealth(amount) {
        this.knowsWherePlayerIs = true;
		// Adjust Color
		this.npcObject.material.color.r = 20 - (Math.random() * 5);
        this.health -= amount;
        if (this.health <= 0) {
            this.deathSound.rate(clamp(Math.random() + 0.8, 0, 1))
            this.deathSound.play();
            this.kill();
        }
    }

    // This will update the NPC's behavior (every frame)
    update(delta) {
        if (!this.sceneObject || !this.mixer || !this.runAnimation || !this.idleAnimation || !this.dieAnimation) return;

        // Update the animation mixer keyframe step
        this.mixer.update(delta);
        // lerp the color to 0xffffff
        this.npcObject.material.color.lerp(new THREE.Color(0xffffff), delta * 10);

        if (this.health > 0 && this.knowsWherePlayerIs == false) // 1 in ten frames ... good enough i guess
        {
            this.fovConeHull.setFromObject(this.fovConeMesh);
            if (this.fovConeHull.containsPoint(this.LEVELHANDLER.camera.position)) {
                const rayStartPos = this.sceneObject.position.clone().setY(this.LEVELHANDLER.playerHeight);
                const playerDirection = new THREE.Vector3();
                playerDirection.subVectors(this.LEVELHANDLER.camera.position, rayStartPos).normalize();

                const intersection = this.voxelField.raycast(rayStartPos, playerDirection, 1000);
                if (intersection != null) {
                    // if there is a voxel in the way ...
                    const intersectPosition = new THREE.Vector3(
                        intersection.x,
                        intersection.y,
                        intersection.z
                    )

                    // if the player is closer than the nearest voxel, he can be seen
                    if (this.sceneObject.position.distanceTo(this.LEVELHANDLER.camera.position) < this.sceneObject.position.distanceTo(intersectPosition))
                    {
                        this.shootPlayer(delta);
                    }

                }
                else
                {
                    // else, if there is no voxel in the way, the player can be seen
                    this.shootPlayer(delta);
                }
            }
        }

        if (this.health > 0) {
            if (this.knowsWherePlayerIs == true)
            {
                // Look towards the nearest player (this.playerCamera) smoothly, using the lerp(a, b, t) function
                const targetRotation = Math.atan2(this.LEVELHANDLER.camera.position.x - this.sceneObject.position.x, this.LEVELHANDLER.camera.position.z - this.sceneObject.position.z);
                // prevent spinning by flipping the rotation value
                if (Math.abs(targetRotation - this.sceneObject.rotation.y) > Math.PI) {
                    if (targetRotation > this.sceneObject.rotation.y) {
                        this.sceneObject.rotation.y += Math.PI * 2;
                    }
                    else {
                        this.sceneObject.rotation.y -= Math.PI * 2;
                    }
                }
                this.sceneObject.rotation.y = lerp(this.sceneObject.rotation.y, targetRotation, delta * 5);

                // If too far, move closer
                const distanceToPlayerCamera = this.sceneObject.position.distanceTo(this.LEVELHANDLER.camera.position);
                if (distanceToPlayerCamera > 150) {
                    const direction = new THREE.Vector3();
                    this.LEVELHANDLER.camera.getWorldDirection(direction);
                    direction.y = 0;
                    direction.normalize();
                    this.sceneObject.position.addScaledVector(direction, -delta * this.speed);
                    this.runAnimation.play();
                }
                else {
                    this.runAnimation.stop();
                    this.idleAnimation.play();
                }
            }
        }
    }

    shootPlayer(damage) {
        if (this.health > 0) {
            this.LEVELHANDLER.playerHealth -= damage * 45;
            // console.log(this.LEVELHANDLER.playerHealth);
            // snap lookat the player
            this.sceneObject.rotation.set(
                0,
                Math.atan2(this.LEVELHANDLER.camera.position.x - this.sceneObject.position.x, this.LEVELHANDLER.camera.position.z - this.sceneObject.position.z),
                0
            );
        }
        if (this.LEVELHANDLER.playerHealth <= 0) {
            pauseGameState(this.LEVELHANDLER, this.WEAPONHANDLER);
            // Outline the killer
            this.LEVELHANDLER.outliner.selectedObjects = [this.npcObject];
            // Draw Last Kill Line
            const killArrow = new THREE.ArrowHelper(
                new THREE.Vector3(
                    this.LEVELHANDLER.camera.position.x - this.sceneObject.position.x,
                    this.LEVELHANDLER.camera.position.y - this.sceneObject.position.y - this.LEVELHANDLER.playerHeight,
                    this.LEVELHANDLER.camera.position.z - this.sceneObject.position.z
                ).normalize(),
                this.sceneObject.position.clone().setY(this.LEVELHANDLER.playerHeight),
                this.sceneObject.position.distanceTo(this.LEVELHANDLER.camera.position) + 5000,
                0xffff63
            );
            this.LEVELHANDLER.scene.add(killArrow);
        }
    }

    kill() {
        this.mixer.stopAllAction();
        this.health = 0;
        this.dieAnimation.play();
    }
}