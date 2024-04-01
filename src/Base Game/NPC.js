import * as THREE from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { lerp, clamp, createVizSphere, rapidFloat } from './EngineMath.js';
import { pauseGameState, endGameState } from './GameStateControl.js';
import { LevelHandler, USERSETTINGS } from './LevelHandler.js';
import { globalOffset } from './WorldGenerator.js'

// This will be the main system for spawning and handling NPC behavior
export class NPC {
    npcName
    sceneObject // the scene object of the npc - includes the mesh, bones, etc
    npcObject // just the mesh object of the npc (children[0] of sceneObject)
    shootBar // shooting effect

    weaponType // weapon to drop
    canShoot // shoot delay
    shootTimer // shoot delay

    startingPosition // for reset
    startingRotation // for reset
    startingHealth // for reset

    health // health of NPC remaining
    speed // how fast he move -->
    isDead
    isHostile

    runAnimation // u alr know
    idleAnimation // this too
    dieAnimation
    mixer // 3js anim mixer (per-npc until instanced skinning makes its way into main branch)
    fovConeMesh // for vision calculation
    fovConeHull // for vision calculation
    floorgore // for gore
    hitboxCapsule // for raycasting

    knowsWherePlayerIs // self explanatory
    voxelField // for raycasting

    WEAPONHANDLER // how far he can see
    LEVELHANDLER // what it sound like

    blob // death particle handler
    blobs // individual daeth particles

    friendlyNPCs
    meleeNPCs
    isKillable

    // This will build the NPC (setting idle/run animation and loading model into scene)
    constructor(npcName, texturePath, position, rotationIntervals, speed, health, LEVELHANDLER, voxelField, WEAPONHANDLER, weaponType, isHostile) {
        this.npcName = npcName;
        this.friendlyNPCs = []
        this.meleeNPCs = ["entity", "alien_combat"];

        if (this.friendlyNPCs.includes(this.npcName)) this.isKillable = false;
        else this.isKillable = true;

        this.startingPosition = position;
        this.startingRotation = new THREE.Euler(0, rotationIntervals * Math.PI/4, 0);
        this.startingHealth = health;
        
        this.weaponType = weaponType;

        if (isHostile == undefined) isHostile = true;
        this.isHostile = isHostile;

        this.voxelField = voxelField;
        this.WEAPONHANDLER = WEAPONHANDLER;

        this.LEVELHANDLER = LEVELHANDLER;

        this.canShoot = false;

        this.speed = speed;
        this.health = health;
        this.isDead = false;
        this.knowsWherePlayerIs = false;
        const basePath = '../character_models/' + npcName + '/';
        LEVELHANDLER.globalModelLoader.load(basePath + npcName + '_idle.fbx', object => {
            // STEP 1: ASSIGN MATERIALS
            this.sceneObject = object;
            if (object.children[0].type == "SkinnedMesh") this.npcObject = object.children[0];
            else this.npcObject = object.children[1];
            this.npcObject.npcHandler = this;

            this.sceneObject.traverse(function (childObject) {
                if (childObject.isMesh) {
                    // childObject.castShadow = true;
                    // childObject.receiveShadow = true;
                    childObject.material = new THREE.MeshLambertMaterial({
                        map: LEVELHANDLER.globalTextureLoader.load(basePath + npcName + '.png')
                    });
                }
            });
            
            // Expand the bounding box (scale it 2x)
            this.npcObject.geometry.computeBoundingBox();
            this.npcObject.geometry.boundingBox.min.subScalar(50);
            this.npcObject.geometry.boundingBox.max.addScalar(50);

            // Hitbox Capsule
            const hitboxScale = 200;
            this.hitboxCapsule = new THREE.Mesh(
                new THREE.CylinderGeometry(hitboxScale, hitboxScale, 900, 8),
                new THREE.MeshBasicMaterial({
                    color: 0x00ff00, wireframe: true,
                    visible: false
                })
            );
            this.hitboxCapsule.npcHandler = this;
            this.hitboxCapsule.position.set(0, 350, 0);
            this.sceneObject.add(this.hitboxCapsule);


            // STEP 2: ASSIGN TRANSFORMS
            this.sceneObject.position.copy(position);
            this.sceneObject.position.add(globalOffset);
            this.sceneObject.scale.multiplyScalar(0.065);

            // STEP 3: APPLY ANIMATIONS
            this.mixer = new THREE.AnimationMixer(this.sceneObject);
            // load run animation
            LEVELHANDLER.globalModelLoader.load(basePath + npcName + '_run.fbx', object => {
                this.runAnimation = this.mixer.clipAction(object.animations[0]);
            });
            LEVELHANDLER.globalModelLoader.load(basePath + npcName + '_die_' + Math.floor(Math.random() * 3) + '.fbx', object => {
                this.dieAnimation = this.mixer.clipAction(object.animations[0]);
                this.dieAnimation.setLoop(THREE.LoopOnce);
                this.dieAnimation.clampWhenFinished = true;
            });
            this.idleAnimation = this.mixer.clipAction(this.sceneObject.animations[0]);
            this.idleAnimation.play();

            // also, grab the floor gore effect
            LEVELHANDLER.globalTextureLoader.load("../img/floorgore.png", texture => {
                this.floorgore = new THREE.Mesh(
                    new THREE.PlaneGeometry(1, 1),
                    new THREE.MeshLambertMaterial({
                        map: texture,
                        transparent: true
                    })
                );
                this.floorgore.material.map.magFilter = this.floorgore.material.map.minFilter = THREE.NearestFilter;
                this.floorgore.visible = false;
                this.floorgore.rotation.set(-Math.PI/2, 0, 0);
                const scale = 100;
                this.floorgore.scale.set(scale, scale, scale);
                this.LEVELHANDLER.scene.add(this.floorgore);
            });

            if (this.isHostile) this.initializeWeaponPickup();

            // create a "Field of View" cone in front of the head
            const fovLength = 125;
            const fovConeGeometry = new THREE.CylinderGeometry(5, 20, fovLength, 10);
            // shift the pivot point of the cone to the tip
            fovConeGeometry.translate(0, -fovLength/2, 0);
            this.fovConeMesh = new THREE.Mesh(
                fovConeGeometry,
                new THREE.MeshBasicMaterial({
                    color: 0xffffff * Math.random(), wireframe: true,
                    visible: false
                })
            );
            
            let headBone;
            const bones = this.npcObject.skeleton.bones;
            for (let i = 0; i < bones.length; i++)
            {
                if (!headBone) headBone = bones[i];
                if (bones[i].position.y > headBone.position.y) headBone = bones[i];
            }

            this.npcObject.add(this.fovConeMesh);
            this.fovConeMesh.position.set(headBone.position.x, headBone.position.y - 150, headBone.position.z);
            if (this.npcName.includes("thug")) this.fovConeMesh.position.y -= 2;
            this.fovConeMesh.rotation.x = -Math.PI/2;

            
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

            // Add a shooting effect
            this.shootBar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.05, 70, 8),
                new THREE.MeshBasicMaterial({
                    map: LEVELHANDLER.globalTextureLoader.load("../img/shootbar.png"),
                    transparent: true,
                    emissive: 0xffffff,
                    emissiveIntensity: 2.5,
                })
            );
            this.npcObject.add(this.shootBar);
            this.shootBar.material.map.wrapS = this.shootBar.material.map.wrapT = THREE.RepeatWrapping;
            this.shootBar.material.map.repeat.set(1, 6);
            this.shootBar.visible = false;
            this.shootBar.rotation.x = Math.PI/2;
            this.shootBar.position.y = 4.25;

            if (this.meleeNPCs.includes(this.npcName)) {
                if (this.npcName == "entity") this.sceneObject.scale.divideScalar(4);
                this.shootBar.position.y = 9999;
                this.knowsWherePlayerIs = true;
                this.fovConeMesh.scale.divideScalar(2);
            }
        });

        LEVELHANDLER.NPCBank.push(this);
        if (this.isHostile) LEVELHANDLER.totalKillableNPCs++;
        LEVELHANDLER.totalNPCs++;
    }

    computeBlob() {
        // hahahahahahahaha ...
        if (!this.sceneObject) {
            setTimeout(() => {
                this.computeBlob();
            }, 100);
            return;
        }
        // blob handling
        const count = 250;
        const scale = 2;
        this.blob = new THREE.InstancedMesh(
            new THREE.BoxGeometry(scale, scale, scale),
            new THREE.MeshLambertMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.9
            }),
            count
        );
        this.blobs = [];
        this.blob.frustumCulled = false;
        for (let i = 0; i < count; i++)
        {
            // determine direction
            const dir = new THREE.Vector3();
            dir.x += (rapidFloat() * 0.5) - 0.25;
            dir.y += (rapidFloat() * 0.5) - 0.25;
            dir.z += (rapidFloat() * 0.5) - 0.25;

            const pos = this.sceneObject.position.clone().setY(this.sceneObject.position.y + (rapidFloat() * 60));
            const rot = new THREE.Euler(
                rapidFloat() * Math.PI * 2,
                rapidFloat() * Math.PI * 2,
                rapidFloat() * Math.PI * 2
            );
            const initScale = 1 + (4 * rapidFloat());

            const r = this.voxelField.raycast(
                pos,
                dir,
                10000,
                true
            );
            let endPosition;
            if (r == null) {
                continue;
            }

            endPosition = new THREE.Vector3(r.x, r.y, r.z);
            
            this.blob.setMatrixAt(i, new THREE.Matrix4().compose(pos, rot, new THREE.Vector3(0,0,0)));
            const col = new THREE.Color(0xff0000);
            // randomize color
            col.r += clamp((rapidFloat()) - 0.5, 0, 1);
            col.multiplyScalar(0.25);
            this.blob.setColorAt(i, col);
            const thisBlob = new killBlob(
                pos,
                dir,
                initScale,
                350 + (rapidFloat() * 100),
                endPosition,
                this.blob,
                i,
                this.voxelField
            );
            this.blobs.push(thisBlob);
        }
        this.LEVELHANDLER.scene.add(this.blob);
    }

    depleteHealth(amount) {
        this.knowsWherePlayerIs = true;
		// Adjust Color
		if (this.npcObject.material.color) this.npcObject.material.color.r = 20 - (Math.random() * 5);
        this.health -= amount;
        if (this.health <= 0) {
            this.kill();
        }
    }

    // This will update the NPC's behavior (every frame)
    update(delta) {
        if (!this.sceneObject || !this.mixer || !this.runAnimation || !this.idleAnimation || !this.dieAnimation) return;

        // Update the animation mixer keyframe step
        this.mixer.update(delta);
        // lerp the color to 0xffffff
        if (this.npcObject.material.color) this.npcObject.material.color.lerp(new THREE.Color(0xffffff), delta * 10);

        if (this.health > 0) // 1 in ten frames ... good enough i guess
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
                    else
                    {
                        this.shootBar.visible = false;
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
                if (distanceToPlayerCamera > 20 || (this.meleeNPCs.includes(this.npcName) && distanceToPlayerCamera > 50)) {
                    const direction = new THREE.Vector3();
                    this.LEVELHANDLER.camera.getWorldDirection(direction);
                    direction.y = 0;
                    direction.normalize();
                    direction.negate();
                    const r = this.voxelField.raycast(this.sceneObject.position.clone().setY(4), direction, 100);
                    if (!r) {
                        this.sceneObject.position.addScaledVector(direction, delta * this.speed);
                        this.runAnimation.play();
                    }
                }
                else {
                    this.runAnimation.stop();
                    this.idleAnimation.play();
                    if (this.meleeNPCs.includes(this.npcName)) this.shootPlayer(100);
                }
            }
        }
    }

    shootPlayer(delta) {
        if (this.friendlyNPCs.includes(this.npcName) || !this.isHostile) return
        if (this.canShoot == false) {
            if (!this.shootTimer) {
                this.shootTimer = setTimeout(() => {
                    this.canShoot = true;
                }, 250);
            }
            return;
        }
        let c = 0.25;
        if (this.LEVELHANDLER.playerHealth < 25) c = 0.5;
        if (rapidFloat() < c) return;
        if (this.health > 0) {
            // Update AI
            this.knowsWherePlayerIs = true;
            // Update Player Health
            this.LEVELHANDLER.playerHealth -= delta * 250;
            this.LEVELHANDLER.hasBeenShot = true;
            // Animations
            this.shootBar.visible = true;
            this.shootBar.material.map.offset.y -= delta * 15;
            document.querySelector("#dead-overlay").style.opacity = 1;
            document.querySelector("#healthbar").style.width = this.LEVELHANDLER.playerHealth * 2 + "px";
            for (let i = 1; i < 3; i++)
            {
                const thisAnim = document.querySelector("#health-anim-" + i);
                if (!thisAnim.classList.contains("has-begun"))
                {
                    thisAnim.beginElement();
                    thisAnim.classList.add("has-begun");
                    setTimeout(() => {
                        thisAnim.endElement();
                        thisAnim.classList.remove("has-begun");
                    }, 250);
                }
            }
            // snap lookat the player
            this.sceneObject.rotation.set(
                0,
                Math.atan2(this.LEVELHANDLER.camera.position.x - this.sceneObject.position.x, this.LEVELHANDLER.camera.position.z - this.sceneObject.position.z),
                0
            );
        }
        if (this.LEVELHANDLER.playerHealth <= 0 && this.health > 0) {
            // Freeze player motion and interactivity
            this.LEVELHANDLER.lastPlayerKiller = this;
            pauseGameState(this.LEVELHANDLER, this.WEAPONHANDLER);
            this.LEVELHANDLER.deathCount += 1;
            // Fix gun sfx bug
            this.LEVELHANDLER.SFXPlayer.setSoundPlaying("shootSound", false);
            // Outline the killer
            this.LEVELHANDLER.outliner.selectedObjects.push(this.npcObject);
            // Draw Last Kill Line
            // const killArrow = new THREE.ArrowHelper(
            //     new THREE.Vector3(
            //         this.LEVELHANDLER.camera.position.x - this.sceneObject.position.x,
            //         this.LEVELHANDLER.camera.position.y - this.sceneObject.position.y - this.LEVELHANDLER.playerHeight,
            //         this.LEVELHANDLER.camera.position.z - this.sceneObject.position.z
            //     ).normalize(),
            //     this.sceneObject.position.clone().setY(this.LEVELHANDLER.playerHeight),
            //     this.sceneObject.position.distanceTo(this.LEVELHANDLER.camera.position) + 5000,
            //     0xffff63
            // );
            // this.LEVELHANDLER.scene.add(killArrow);
            // Fix endless run animation bug
            this.runAnimation.stop();
            this.idleAnimation.play();
            // Prevent further action
            this.health = -1;
        }
    }

    initializeWeaponPickup() {
        this.WEAPONHANDLER.createWeaponPickup(this.weaponType, this.sceneObject.position.clone().setY(2), false, this);
    }

    kill() {
        if (this.isKillable == false) return;
        if (this.isDead == true) return
        this.isDead = true;
        this.mixer.stopAllAction();
        this.health = 0;
        this.dieAnimation.play();
        this.shootBar.visible = false;
        this.floorgore.position.copy(this.sceneObject.position.clone().setY(3 - rapidFloat()));
        if (this.isHostile) this.LEVELHANDLER.totalKillableNPCs--;
        if (this.LEVELHANDLER.levelID == "00") {
            this.LEVELHANDLER.assistObj.visible = false;
            this.LEVELHANDLER.assistObj.material.opacity = 0;
        }
        this.LEVELHANDLER.totalNPCs--;
        if (!this.LEVELHANDLER.meleeNPCs.includes(this.npcName))
        {
            if (!USERSETTINGS.disableParticles)
            {
                this.LEVELHANDLER.killBlobs.push(...this.blobs);
                this.floorgore.visible = true;
            }
            if (this.isHostile) {
                this.weaponPickup.isActive = true;
                this.weaponPickup.visible = true;
                console.log(this.weaponPickup);
            }
        }

        this.LEVELHANDLER.isCameraShaking = true;
        setTimeout(() => { this.LEVELHANDLER.isCameraShaking = false; }, 150);
        const ec = document.querySelector("#enemy-counter");
        ec.style.color = "#fc3903";
        ec.style.opacity = 1;
        ec.style.fontWeight = "bolder";
        setTimeout(() => {
            ec.style.color = "white";
            ec.style.opacity = 0.15;
            ec.style.fontWeight = "normal";
        }, 150);

        this.LEVELHANDLER.SFXPlayer.playRandomSound("killSounds", 1 + rapidFloat());
        if (this.LEVELHANDLER.hasKilledYet == false) {
            this.LEVELHANDLER.SFXPlayer.startMusicPlayback(this.LEVELHANDLER.SFXPlayer.SelectMusicID(this.LEVELHANDLER.levelID));
            this.LEVELHANDLER.hasKilledYet = true;
        }

        if (this.LEVELHANDLER.totalKillableNPCs == 0) {
            endGameState(this.LEVELHANDLER);
        }

        const killUIEffect = document.createElement("div");
        killUIEffect.innerHTML = `<img src="../img/diamond-expand.gif" style="position: absolute; margin: auto; left: 0; right: 0; top: 0; bottom: 0; max-width: 64px; z-index: 1000; opacity: 0.75">`;
        document.body.appendChild(killUIEffect);
        setTimeout(() => {
            killUIEffect.remove();
        }, 300);
    }
}

class killBlob {
    dir
    initScale
    speed
    sceneObject
    isAlive
    endPosition

    iMesh
    iMeshIndex

    constructor(initPosition, dir, initScale, speed, endPosition, iMesh, iMeshIndex, voxelField) {
        this.initPosition = initPosition;
        this.dir = dir;
        this.initScale = initScale;
        this.speed = speed;
        this.isAlive = true;
        this.iMesh = iMesh;
        this.iMeshIndex = iMeshIndex;
        this.voxelField = voxelField;

        if (endPosition) this.endPosition = endPosition;

    }

    move(delta) {
        const newMatrix = new THREE.Matrix4();
        this.iMesh.getMatrixAt(this.iMeshIndex, newMatrix);

        // constraints
        const pos = new THREE.Vector3().setFromMatrixPosition(newMatrix);

        if (pos.distanceTo(this.endPosition) < 25)
        {
            this.iMesh.setMatrixAt(this.iMeshIndex, newMatrix.setPosition(this.endPosition));
            this.iMesh.instanceMatrix.needsUpdate = true;
            this.isAlive = false;
        }

        // motion
        if (this.isAlive == true)
        {
            this.iMesh.visible = true;

            // set scale
            this.initScale = clamp(this.initScale * (1 - (delta * 5)), 1, 100);
            newMatrix.makeScale(this.initScale, this.initScale, this.initScale);

            // set position
            const npos = pos.addScaledVector(this.dir, this.speed * delta);
            this.iMesh.setMatrixAt(this.iMeshIndex, newMatrix.setPosition(npos));
            this.iMesh.instanceMatrix.needsUpdate = true;
        }
    }

    reset() {
        // set position to initialPosition
        const newMatrix = new THREE.Matrix4();
        this.iMesh.getMatrixAt(this.iMeshIndex, newMatrix);
        this.iMesh.setMatrixAt(this.iMeshIndex, newMatrix.setPosition(this.initPosition));
        this.iMesh.instanceMatrix.needsUpdate = true;

        // // set scale to initScale
        // newMatrix.makeScale(this.initScale, this.initScale, this.initScale);
        // this.iMesh.setMatrixAt(this.iMeshIndex, newMatrix);
        // this.iMesh.instanceMatrix.needsUpdate = true;
        this.iMesh.visible = false;

        this.isAlive = true;
    }
}