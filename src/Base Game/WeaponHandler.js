import * as THREE from 'three';
import { globalOffset } from './WorldGenerator.js';
import { rapidFloat } from './EngineMath.js';
import { voxelField } from './VoxelStructures.js';


const getClipByName = (animations, clipName) => {
	for (let i = 0; i < animations.length; i++)
		if (animations[i].name.toLowerCase().includes(clipName.toLowerCase())) return animations[i];
}

export class WeaponHandler {
    // MAIN
    LEVELHANDLER

	// DEFAULTS
	defaultWeaponIsEquipped
    defaultRemainingAmmo
	defaultWeaponRange
	defaultWeaponType
	defaultDestroyChunkRange
	defaultFireRate
	defaultWeaponDamage

    // AMMO
    weaponRemainingAmmo
	isAttackAvailable

    // MODEL
    weaponModel // hands
	gunObject // gun
	importedWeaponPosition
	importedWeaponRotation
	importedWeaponScale
    weaponTarget
    weaponPosition
    weaponRotation
	flashlight

	// ANIMATION
	handAnimationMixer
	idleAction
	attackAction
	holdGunAction

	// PARTICLES & JUICE
	hideMuzzleFlash
	fireSprite
	muzzleFire
    
    // SPECS
	weaponIsEquipped
    weaponType
    destroyedChunkRange
    fireRate
    weaponDamage
    weaponFollowSpeed
    weaponRange
	hasFlipped


    constructor(LEVELHANDLER) {

        this.LEVELHANDLER = LEVELHANDLER;
        
		this.weaponRemainingAmmo = 0;
		this.defaultRemainingAmmo = 0;
		this.isAttackAvailable = false;

		this.isAnimated = false;
		this.weaponIsEquipped = this.defaultWeaponIsEquipped = false; // TODO: add modifier to start round with a weapon.
		this.defaultWeaponType = "melee"; // ^^^
		
		this.hasFlipped = false;

    }

	initializeWeaponInfo(name, object, assignDefaults = false) {
		const LEVELHANDLER = this.LEVELHANDLER;
		const WEAPONHANDLER = this;
		const jsonLoader = new THREE.FileLoader();
		jsonLoader.load(
			'../weapons/' + name + '/' + name + '.json',
			function (json) {
				const jsonModel = JSON.parse(json);
				object.name = jsonModel.weaponData.name;
				// json reads for weapon data
				// camera adjustments
				WEAPONHANDLER.weaponType = jsonModel.weaponData.type;
				if (WEAPONHANDLER.weaponType == "ranged") {
					LEVELHANDLER.camera.near = 1/10;
				}
				else LEVELHANDLER.camera.near = 1;
				LEVELHANDLER.camera.updateProjectionMatrix();
				// ammo
				WEAPONHANDLER.weaponRemainingAmmo = document.querySelector("#ammo-counter").textContent = jsonModel.weaponData.totalAmmo;
				// account for infinite ammo ...
				if (WEAPONHANDLER.weaponRemainingAmmo == 0) {
					document.querySelector("#ammo-counter").style.display = "none";
					WEAPONHANDLER.weaponRemainingAmmo = 9999999;
				}
				else document.querySelector("#ammo-counter").style.display = "block";
				WEAPONHANDLER.destroyedChunkRange = jsonModel.weaponData.damageRange;
				WEAPONHANDLER.fireRate = jsonModel.weaponData.fireRate;
				WEAPONHANDLER.weaponDamage = jsonModel.weaponData.weaponDamage;
				WEAPONHANDLER.weaponPosition = new THREE.Vector3(0,0,0);
				WEAPONHANDLER.weaponRange = jsonModel.weaponData.minimumDistance;
				WEAPONHANDLER.weaponTarget = new THREE.Mesh(
					new THREE.BoxGeometry(1, 1, 1),
					new THREE.MeshBasicMaterial({ color: 0x00ff00, visible: false })
				);
				LEVELHANDLER.camera.add(WEAPONHANDLER.weaponTarget);
				WEAPONHANDLER.weaponTarget.position.copy(WEAPONHANDLER.weaponPosition);

				WEAPONHANDLER.weaponRotation = new THREE.Euler(jsonModel.weaponData.rotation.x, jsonModel.weaponData.rotation.y, jsonModel.weaponData.rotation.z);
				WEAPONHANDLER.weaponTarget.rotation.copy(WEAPONHANDLER.weaponRotation);

				if (assignDefaults) {
					WEAPONHANDLER.defaultWeaponType = WEAPONHANDLER.weaponType;
					WEAPONHANDLER.defaultRemainingAmmo = WEAPONHANDLER.weaponRemainingAmmo;
					WEAPONHANDLER.defaultWeaponRange = WEAPONHANDLER.weaponRange;
					WEAPONHANDLER.defaultDestroyChunkRange = WEAPONHANDLER.destroyedChunkRange;
					WEAPONHANDLER.defaultFireRate = WEAPONHANDLER.fireRate;
					WEAPONHANDLER.defaultWeaponDamage = WEAPONHANDLER.weaponDamage;
				}
			}
		);
	}

	resetToDefaults() {
		this.weaponIsEquipped = this.defaultWeaponIsEquipped;
		this.weaponRemainingAmmo = this.defaultRemainingAmmo;
		this.weaponType = this.defaultWeaponType;
		this.weaponRange = this.defaultWeaponRange;
		this.destroyedChunkRange = this.defaultDestroyChunkRange;
		this.fireRate = this.defaultFireRate;
		this.weaponDamage = this.defaultWeaponDamage;

		if (this.weaponRemainingAmmo == 9999999) {
			document.querySelector("#ammo-counter").style.display = "none";
		}
	}

	// TODO i realize i wrote most of this while high out of my mind but this function chain might be the worst piece of code i've ever written
	// like there are two wholly unnecessary, single-use function calls here for the same exact thing?
	// maybe in a networked game it may be necessary ... maybe it's not so dumb after all ...
	// ill look into it later.

	// This will add the player's weapon model to the scene
	initializeHands() {
		const LEVELHANDLER = this.LEVELHANDLER;
		const WEAPONHANDLER = this;
		this.weaponIsEquipped = false;
		// Initialize with HANDS
		LEVELHANDLER.globalModelLoader.load(
			'../weapons/hands/hands.fbx',
			function (object) {
				object.scale.divideScalar(50);
				if (WEAPONHANDLER.weaponModel) LEVELHANDLER.scene.remove(WEAPONHANDLER.weaponModel);
				WEAPONHANDLER.weaponModel = object;
				LEVELHANDLER.scene.add(WEAPONHANDLER.weaponModel);

				// play the first animation in the fbx
				WEAPONHANDLER.handAnimationMixer = new THREE.AnimationMixer(object);

				WEAPONHANDLER.attackAction = WEAPONHANDLER.handAnimationMixer.clipAction(getClipByName(object.animations, "Attack"));
				WEAPONHANDLER.attackAction.setLoop(THREE.LoopRepeat);
				WEAPONHANDLER.attackAction.setDuration(WEAPONHANDLER.attackAction._clip.duration / 4); // 4x speed

				WEAPONHANDLER.holdGunAction = WEAPONHANDLER.handAnimationMixer.clipAction(getClipByName(object.animations, "HoldGun"));
				WEAPONHANDLER.holdGunAction.setLoop(THREE.LoopRepeat);

				WEAPONHANDLER.idleAction = WEAPONHANDLER.handAnimationMixer.clipAction(getClipByName(object.animations, "Idle"));
				WEAPONHANDLER.idleAction.setLoop(THREE.LoopRepeat);
				WEAPONHANDLER.idleAction.play();

				// imported weapon position
				// find the child object named "WEAPON_POSITION" and set it to the weapon position importedWeaponPosition
				object.traverse((child) => {
					if (child.name == "WEAPON_POSITION") {
						WEAPONHANDLER.importedWeaponPosition = child.position;
						WEAPONHANDLER.importedWeaponRotation = child.rotation;
						WEAPONHANDLER.importedWeaponScale = child.scale;
						WEAPONHANDLER.importedWeaponScale.divideScalar(100);
					}
				});

				WEAPONHANDLER.initializeWeaponInfo('nothing', object, true);
			}
		);
    }

	pickupWeapon(pickedupWeaponModel) {
		this.throwWeapon();
		this.LEVELHANDLER.SFXPlayer.playSound("rustleSound", false);
		
		this.weaponIsEquipped = true;
		pickedupWeaponModel.scale.copy(this.importedWeaponScale);
		pickedupWeaponModel.position.copy(this.importedWeaponPosition);
		pickedupWeaponModel.rotation.copy(this.importedWeaponRotation);
		pickedupWeaponModel.isHoldableWeapon = true;
		this.weaponModel.add(pickedupWeaponModel);
		this.weaponModel.scale.y = 0.1;
		this.gunObject = pickedupWeaponModel;
		// if (!jsonModel.weaponData.hasNoTexture) pickedupWeaponModel.children[0].material.map = LEVELHANDLER.globalTextureLoader.load(basePath + '.png');
		// pickedupWeaponModel.name = jsonModel.weaponData.name;

		this.initializeWeaponInfo(pickedupWeaponModel.weaponType, pickedupWeaponModel);
		
		// Muzzle Flash
		this.hideMuzzleFlash = this.defaultHideMuzzleFlash = true;

		const map = new THREE.TextureLoader().load('../img/impact.png');
		this.hideMuzzleFlash = this.defaultHideMuzzleFlash = false;
		this.fireSprite = new THREE.Sprite(new THREE.SpriteMaterial({
			map: map,
			color: 0xffffff,
			side: THREE.DoubleSide,
			depthTest: false,
			transparent: true,
		}));
		pickedupWeaponModel.add(this.fireSprite);
		this.fireSprite.position.x = 50;
		this.fireSprite.position.y = 250;
		this.fireSprite.position.z = -700;

		this.fireSprite.material.opacity = 0;

		// Muzzle Fire
		this.muzzleFire = new THREE.Mesh(
			new THREE.PlaneGeometry(6000, 45),
			new THREE.MeshBasicMaterial({
				map: new THREE.TextureLoader().load('../img/muzzlefire.png'),
				color: 0xffffff,
				side: THREE.DoubleSide,
				depthTest: false,
				transparent: true,
			})
		);
		pickedupWeaponModel.add(this.muzzleFire);
		this.muzzleFire.position.x = 50;
		this.muzzleFire.position.y = 250;
		this.muzzleFire.position.z = -3600;
		this.muzzleFire.rotation.y = Math.PI / 2;

		this.muzzleFire.material.opacity = 0;
	}

	createWeaponPickup(weaponType, position, isSpawnedPostLoad=false, npcReference=null) {
		const LEVELHANDLER = this.LEVELHANDLER;

		const weaponURL = '../weapons/' + weaponType + '/' + weaponType;

		LEVELHANDLER.globalModelLoader.load(
			weaponURL + '.fbx',
			function (pickup) {
				LEVELHANDLER.scene.add(pickup);
				LEVELHANDLER.weaponPickups.push(pickup);
				LEVELHANDLER.outliner.selectedObjects.push(pickup);
				pickup.isActive = true;
				pickup.weaponType = weaponType;
				pickup.isSpawnedPostLoad = isSpawnedPostLoad;
				if (Math.round(position.y) == 10) position.y = 1;
				pickup.position.set(position.x, position.y+1, position.z);
				if (isSpawnedPostLoad) pickup.position.add(globalOffset);
				pickup.scale.divideScalar(50);
				pickup.rotation.set(0, Math.random(), Math.PI/2);
				// assign defaults
				pickup.initialPosition = pickup.position.clone();
				pickup.initialRotation = pickup.rotation.clone();
				pickup.initialScale = pickup.scale.clone();
				if (npcReference) {
					// we are building a pickup for an NPC
					npcReference.weaponPickup = pickup;
					pickup.visible = pickup.isActive = false;
				}
			}
		);

	}

	createExplosive(position) {
		position.round();
		console.log("CREATING EXPLOSIVE at", position.x, position.y, position.z);
		const LEVELHANDLER = this.LEVELHANDLER;

		const explosiveURL = '../weapons/explosive/explosive';

		LEVELHANDLER.globalModelLoader.load(
			explosiveURL + '.fbx',
			function (object) {
				object.scale.divideScalar(30);
				object.position.set(position.x, position.y, position.z);
				LEVELHANDLER.scene.add(object);
				LEVELHANDLER.registerExplosive(object);
				LEVELHANDLER.numExplosivesProcessed++;
				if (LEVELHANDLER.numExplosivesProcessed == LEVELHANDLER.numExplosives) {
					LEVELHANDLER.computeNPCBlobs();
				}
			}
		);
	}

	setWeaponVisible(toggle) {
		this.weaponModel.children[0].visible = toggle;
	}

	throwWeapon(hideWeapon=false) {
		if (this.weaponIsEquipped)
		{
			this.weaponIsEquipped = false;
			// Raycast and throw it!!
			const cameraDir = new THREE.Vector3(0, 0, 0);
			this.LEVELHANDLER.camera.getWorldDirection(cameraDir);
			const intersect = voxelField.raycast(this.LEVELHANDLER.camera.position, cameraDir, 1000);
	
			// Generate a Weapon Clone
			const thrownGun = this.gunObject;
			thrownGun.remove(this.muzzleFire);
			thrownGun.remove(this.fireSprite);
			if (hideWeapon) thrownGun.visible = false;
			this.LEVELHANDLER.scene.add(this.gunObject);
			thrownGun.scale.divideScalar(this.importedWeaponPosition.x / 5);

			thrownGun.position.copy(this.LEVELHANDLER.camera.position);
			thrownGun.rotation.set(0, 0, 0);
			const intersectPosition = new THREE.Vector3(0,0,0);
			if (intersect != null) {
				intersectPosition.set(intersect.x, intersect.y, intersect.z);
			}
			else
			{
				intersectPosition.set(this.LEVELHANDLER.camera.position.x + cameraDir.x * 100, this.LEVELHANDLER.camera.position.y + cameraDir.y * 100, this.LEVELHANDLER.camera.position.z + cameraDir.z * 100);
			}
			// Raycast for Enemies
			const raycaster = new THREE.Raycaster();
			raycaster.setFromCamera(new THREE.Vector2(0, 0), this.LEVELHANDLER.camera);
			const intersects = raycaster.intersectObjects(this.LEVELHANDLER.NPCBank.map(npc => npc.hitboxCapsule));
			intersects.forEach((intersect) => {
				if (intersectPosition.x != 0 && intersectPosition.y != 0 && intersectPosition.z != 0)
				{
					if (intersect.distance > this.LEVELHANDLER.camera.position.distanceTo(intersectPosition)) return;
				}
				if (intersect.object.npcHandler && !hideWeapon) intersect.object.npcHandler.depleteHealth(100);
			});
			// Prevent Shooting
			this.weaponRemainingAmmo = 0;
			// Lastly, fire the interval ...
			let n;
			let reached = false;
			thrownGun.thrownWeaponAnimationInterval = n = setInterval(() => {
				thrownGun.position.lerp(intersectPosition, 0.05);
				thrownGun.rotation.y += 0.025;
				thrownGun.rotation.x += 0.025;
				thrownGun.rotation.z += 0.025;
				if (thrownGun.position.distanceTo(intersectPosition) < 5) {
					thrownGun.scale.multiplyScalar(0.85);
					if (reached == false)
					{
						reached = true;
						setTimeout(() => {
							clearInterval(n);
						}, 10000);
					}
				}
			}, 10);

			this.resetToDefaults();
			console.log(this.defaultRemainingAmmo, this.defaultWeaponType);
		}
	}


}