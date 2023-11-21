import * as THREE from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { lerp, clamp, createVizSphere, rapidFloat } from './EngineMath.js';
import { pauseGameState, endGameState } from './GameStateControl.js';
import { LevelHandler } from './LevelHandler.js';
import { globalOffset } from './WorldGenerator.js'

// This will be the main system for spawning and handling NPC behavior
export class NPC {
    sceneObject // the scene object of the npc - includes the mesh, bones, etc
    npcObject // just the mesh object of the npc (children[0] of sceneObject)
    shootBar // shooting effect

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
    floorgore // for gore

    knowsWherePlayerIs // self explanatory
    voxelField // for raycasting

    WEAPONHANDLER // how far he can see
    LEVELHANDLER // what it sound like

    // This will build the NPC (setting idle/run animation and loading model into scene)
    constructor(npcName, texturePath, position, rotationIntervals, speed, health, LEVELHANDLER, voxelField, WEAPONHANDLER) {
        this.startingPosition = position;
        this.startingRotation = new THREE.Euler(0, rotationIntervals * Math.PI/4, 0);
        this.startingHealth = health;

        this.voxelField = voxelField;
        this.WEAPONHANDLER = WEAPONHANDLER;

        this.LEVELHANDLER = LEVELHANDLER;

        this.speed = speed;
        this.health = health;
        this.knowsWherePlayerIs = false;
        const basePath = '../character_models/' + npcName + '/';
        LEVELHANDLER.globalModelLoader.load(basePath + npcName + '_idle.fbx', object => {
            // STEP 1: ASSIGN MATERIALS
            this.sceneObject = object;
            this.npcObject = object.children[0];
            this.npcObject.npcHandler = this;
            this.sceneObject.traverse(function (childObject) {
                if (childObject.isMesh) {
                    // childObject.castShadow = true;
                    // childObject.receiveShadow = true;
                    childObject.material = new THREE.MeshPhongMaterial({
                        map: LEVELHANDLER.globalTextureLoader.load(basePath + npcName + '.png'),
                        shininess: 0,
                        specular: 0x000000
                    });
                }
            });

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

            // create a "Field of View" cone in front of the head
            this.fovConeMesh = new THREE.Mesh(
                new THREE.ConeGeometry(2, 6, 4),
                new THREE.MeshBasicMaterial({
                    color: 0x00ff00, wireframe: true,
                    visible: false
                })
            );
            const headBone = this.sceneObject.children[1].children[0].children[0].children[0].children[0].children[0].children[0].children[0] || this.sceneObject.children[1].children[0].children[0].children[0].children[0].children[0].children[0];

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

            // Add a shooting effect
            this.shootBar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.025, 0.025, 60, 8),
                new THREE.MeshBasicMaterial({
                    map: LEVELHANDLER.globalTextureLoader.load("../img/shootbar.png"),
                    transparent: true,
                    emissive: 0xffffff,
                    emissiveIntensity: 2.5,
                })
            );
            this.npcObject.add(this.shootBar);
            this.shootBar.material.map.wrapS = this.shootBar.material.map.wrapT = THREE.RepeatWrapping;
            this.shootBar.material.map.repeat.set(1, 3);
            this.shootBar.rotation.set(Math.PI/2, 0, 0);
            this.shootBar.position.z += 32;
            this.shootBar.position.y += 4;
            this.shootBar.visible = false;

        });

        LEVELHANDLER.NPCBank.push(this);
        LEVELHANDLER.totalNPCs++;
    }

    depleteHealth(amount) {
        this.knowsWherePlayerIs = true;
		// Adjust Color
		this.npcObject.material.color.r = 20 - (Math.random() * 5);
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
        this.npcObject.material.color.lerp(new THREE.Color(0xffffff), delta * 10);

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
        let c = 0.25;
        if (this.LEVELHANDLER.playerHealth < 25) c = 0.5;
        if (rapidFloat() < c) return;
        if (this.health > 0) {
            // Update AI
            this.knowsWhrePlayerIs = true;
            // Update Player Health
            this.LEVELHANDLER.playerHealth -= damage * 170;
            // Animations
            this.shootBar.visible = true;
            this.shootBar.material.map.offset.y -= damage * 15;
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
            pauseGameState(this.LEVELHANDLER, this.WEAPONHANDLER);
            // Fix gun sfx bug
            this.LEVELHANDLER.SFXPlayer.setSoundPlaying("shootSound", false);
            // Outline the killer
            this.LEVELHANDLER.outliner.selectedObjects = [this.npcObject];
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

    kill() {
        this.mixer.stopAllAction();
        this.health = 0;
        this.dieAnimation.play();
        this.shootBar.visible = false;
        this.floorgore.visible = true;
        this.floorgore.position.copy(this.sceneObject.position.clone().setY(2));
        this.LEVELHANDLER.totalNPCs--;

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

        const count = 500;
        const scale = 2;
        const blob = new THREE.InstancedMesh(
            new THREE.SphereGeometry(scale, 2, 2),
            new THREE.MeshLambertMaterial({color: new THREE.Color(clamp(rapidFloat(), 0.35, 0.95), 0, 0)}),
            count
        );
        blob.frustumCulled = false;
        for (let i = 0; i < count; i++)
        {
            const dir = new THREE.Vector3(rapidFloat() * 2 - 1, rapidFloat() + 0.25, rapidFloat() * 2 - 1).normalize();
            const pos = this.sceneObject.position.clone().setY(this.sceneObject.position.y + (rapidFloat() * 60));
            const rot = new THREE.Euler(
                rapidFloat() * Math.PI * 2,
                rapidFloat() * Math.PI * 2,
                rapidFloat() * Math.PI * 2
            );
            const initScale = 4 + (3 * rapidFloat());

            const r = this.voxelField.raycast(
                pos,
                dir,
                1000
            );
            let endPosition;
            if (r != null) endPosition = new THREE.Vector3(r.x, r.y, r.z);

            blob.setMatrixAt(i, new THREE.Matrix4().compose(pos, rot, new THREE.Vector3(0,0,0)));
            blob.setColorAt(i, new THREE.Color(clamp(rapidFloat(), 0.35, 0.95), 0, 0));
            const thisBlob = new killBlob(
                dir,
                initScale,
                250 + (rapidFloat() * 100),
                endPosition,
                blob,
                i,
                this.voxelField
            );
            this.LEVELHANDLER.killBlobs.push(thisBlob);
        }
        this.LEVELHANDLER.scene.add(blob);

        if (this.LEVELHANDLER.totalNPCs == 0) {
            endGameState(this.LEVELHANDLER);
        }
    }
}

class killBlob {
    dir
    initScale
    speed
    sceneObject
    lifetime
    isAlive
    endPosition

    iMesh
    iMeshIndex

    constructor(dir, initScale, speed, endPosition, iMesh, iMeshIndex, voxelField) {
        this.dir = dir;
        this.initScale = initScale;
        this.speed = speed;
        this.lifetime = 0;
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

        if (this.endPosition && pos.distanceTo(this.endPosition) < 25)
        {
            this.iMesh.setMatrixAt(this.iMeshIndex, newMatrix.setPosition(this.endPosition));
            this.isAlive = false;
        }

        // motion
        if (this.isAlive == true)
        {
            newMatrix.makeRotationX(delta * (rapidFloat() - 0.5) * 100);
            newMatrix.makeRotationY(delta * (rapidFloat() - 0.5) * 100);
            newMatrix.makeRotationZ(delta * (rapidFloat() - 0.5) * 100);

            this.initScale = clamp(this.initScale * (1 - (delta * 15)), 1, 100);
            newMatrix.makeScale(this.initScale, this.initScale, this.initScale);

            const npos = pos.addScaledVector(this.dir, this.speed * delta);
            this.iMesh.setMatrixAt(this.iMeshIndex, newMatrix.setPosition(npos));
            this.lifetime++;
            this.iMesh.instanceMatrix.needsUpdate = true;
        }
    }
}