import * as THREE from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { lerp, clamp } from './EngineMath.js';
import { resetGameState } from './GameStateControl.js';

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
    LEVELDATA // what it sound like

    deathSound // on death

    // This will build the NPC (setting idle/run animation and loading model into scene)
    constructor(npcName, texturePath, position, rotation, speed, health, LEVELDATA, voxelField, WEAPONHANDLER, deathSound) {
        this.startingPosition = position;
        this.startingRotation = rotation;
        this.startingHealth = health;

        this.deathSound = deathSound;

        this.voxelField = voxelField;
        this.WEAPONHANDLER = WEAPONHANDLER;

        this.LEVELDATA = LEVELDATA;

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
            this.LEVELDATA.scene.add(this.sceneObject);

            // add a helper to the bounding sphere
            // compute bounding sphere
            this.npcObject.geometry.computeBoundingSphere();
            this.npcObject.geometry.boundingSphere.set(this.npcObject.position, 512);

            // apply rotation
            this.sceneObject.rotation.set(rotation.x, rotation.y, rotation.z);
        });

        LEVELDATA.NPCBank.push(this);
    }

    depleteHealth(amount) {
        // this.knowsWherePlayerIs = true;
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

        if (this.health > 0 && this.knowsWherePlayerIs == false && Math.random() < 0.1) // 1 in ten frames ... good enough i guess
        {
            this.fovConeHull.setFromObject(this.fovConeMesh);
            if (this.fovConeHull.containsPoint(this.LEVELDATA.camera.position)) {
                const playerDirection = new THREE.Vector3();
                this.LEVELDATA.camera.getWorldDirection(playerDirection);
                playerDirection.negate();
                const intersection = this.voxelField.raycast(this.sceneObject.position, playerDirection, this.WEAPONHANDLER.weaponRange);
                if (intersection != null) {

                    const intersectPosition = new THREE.Vector3(
                        intersection.x,
                        intersection.y,
                        intersection.z
                    )

                    if (this.sceneObject.position.distanceTo(this.LEVELDATA.camera.position) < this.sceneObject.position.distanceTo(intersectPosition))
                    {
                        this.knowsWherePlayerIs = true;
                        console.log("FOUND YOU!!!");
                        this.shootPlayer(Math.random() * 20);
                    }

                }
                else
                {
                    this.knowsWherePlayerIs = true;
                    console.log("FOUND YOU!!!");
                    this.shootPlayer(0);
                }
            }
            // else
            // {
            // 	this.knowsWherePlayerIs = false;
            // }
        }

        if (this.health > 0) {
            if (this.knowsWherePlayerIs == true)
            {
                // Look towards the nearest player (this.playerCamera) smoothly, using the lerp(a, b, t) function
                const targetRotation = Math.atan2(this.LEVELDATA.camera.position.x - this.sceneObject.position.x, this.LEVELDATA.camera.position.z - this.sceneObject.position.z);
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
                const distanceToPlayerCamera = this.sceneObject.position.distanceTo(this.LEVELDATA.camera.position);
                if (distanceToPlayerCamera > 150) {
                    const direction = new THREE.Vector3();
                    this.LEVELDATA.camera.getWorldDirection(direction);
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

    shootPlayer(delay) {
        setTimeout(() => {
                const playerDirection = new THREE.Vector3();
                this.LEVELDATA.camera.getWorldDirection(playerDirection);
                playerDirection.negate();
                const intersection = this.voxelField.raycast(this.sceneObject.position, playerDirection, this.WEAPONHANDLER.weaponRange);
                if (intersection != null) {
                    const intersectPosition = new THREE.Vector3(
                        intersection.x,
                        intersection.y,
                        intersection.z
                    )
                    if (this.sceneObject.position.distanceTo(this.LEVELDATA.camera.position) < this.sceneObject.position.distanceTo(intersectPosition))
                    {
                        resetGameState(this.LEVELDATA, this.WEAPONHANDLER, this.sceneObject.position);
                    }
                }
        }, delay);
    }

    kill() {
        // disable all animation
        this.mixer.stopAllAction();
        this.dieAnimation.play();
        // this.npcObject.material.color = new THREE.Color(0x00ff00);
        // this.sceneObject.remove(this.npcObject);
        // this.npcObject.geometry.dispose();
        // this.npcObject.material.dispose();
    }
}