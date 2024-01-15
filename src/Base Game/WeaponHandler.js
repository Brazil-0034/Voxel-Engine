import * as THREE from 'three';
import { globalOffset } from './WorldGenerator.js';
import { rapidFloat } from './EngineMath.js';
export class WeaponHandler {
    // MAIN
    LEVELHANDLER

    // AMMO
    weaponRemainingAmmo
    defaultRemainingAmmo
	isAttackAvailable

    // MODEL
    weaponModel
    weaponTarget
    weaponPosition
    weaponRotation
	flashlight

	// PARTICLES & JUICE
	hideMuzzleFlash
	fireSprite
	muzzleFire
    
    // SPECS
	weaponIsEquipped
	defaultWeaponIsEquipped
    weaponType
	defaultWeaponType
    destroyedChunkRange
    fireRate
    weaponDamage
    weaponFollowSpeed
    weaponHelpText
	defaultWeaponRange
    weaponRange
	hasFlipped


    constructor(LEVELHANDLER) {

        this.LEVELHANDLER = LEVELHANDLER;
        
		this.weaponRemainingAmmo = 0;
		this.defaultRemainingAmmo = 0;
		this.isAttackAvailable = false;

		this.isAnimated = false;
		this.weaponIsEquipped = this.defaultWeaponIsEquipped = false;
		
		this.hasFlipped = false;

    }

	// TODO i realize i wrote most of this while high out of my mind but this function chain might be the worst piece of code i've ever written
	// like there are two wholly unnecessary, single-use function calls here for the same exact thing?
	// maybe in a networked game it may be necessary ... maybe it's not so dumb after all ...
	// ill look into it later.

	// This will add the player's weapon model to the scene
	pickupWeapon(basePath) {
		const LEVELHANDLER = this.LEVELHANDLER;
		const WEAPONHANDLER = this;
		// Initialize with HANDS
		LEVELHANDLER.globalModelLoader.load(
			'../weapons/fists/fists.fbx',
			function (object) {
				object.scale.divideScalar(50);
				if (WEAPONHANDLER.weaponModel) LEVELHANDLER.scene.remove(WEAPONHANDLER.weaponModel);
				WEAPONHANDLER.weaponModel = object;
				LEVELHANDLER.scene.add(WEAPONHANDLER.weaponModel);
				WEAPONHANDLER.weaponModel.rotation.set(Math.PI/2,Math.PI/2,Math.PI/2)
			}
		);
		// Then, load the weapon metadata from the .json file
		if (basePath)
		{
			this.generateWeaponModel(basePath);
		}
    }

	generateWeaponModel = function(basePath) {
		let isNothing = false;
		if (basePath == "nothing") isNothing = true;
		basePath = '../weapons/' + basePath + '/' + basePath;
		const LEVELHANDLER = this.LEVELHANDLER;
		if (!isNothing) LEVELHANDLER.SFXPlayer.playSound("rustleSound", false);
		const WEAPONHANDLER = this;
		const jsonLoader = new THREE.FileLoader();
		jsonLoader.load(
			basePath + '.json',
			function (json) {
				const jsonModel = JSON.parse(json);
				LEVELHANDLER.globalModelLoader.load(
					basePath + '.fbx',
					function (object) {
						if (!isNothing) {
							WEAPONHANDLER.weaponModel.scale.set(1/50,1/50,1/50);
						}
						object.isHoldableWeapon = true;
						WEAPONHANDLER.weaponModel.add(object);
						WEAPONHANDLER.weaponModel.scale.y = 0;
						if (!isNothing) WEAPONHANDLER.weaponIsEquipped = WEAPONHANDLER.defaultWeaponIsEquipped = true;
						// Load in the texture for the weapon
						if (!jsonModel.weaponData.hasNoTexture) object.children[0].material.map = LEVELHANDLER.globalTextureLoader.load(basePath + '.png');
						// Adjust the scale from standard magicavoxel scaling
						object.name = jsonModel.weaponData.name;
						// json reads for weapon data
						WEAPONHANDLER.weaponType = WEAPONHANDLER.defaultWeaponType = jsonModel.weaponData.type;
						WEAPONHANDLER.defaultRemainingAmmo = WEAPONHANDLER.weaponRemainingAmmo = document.querySelector("#ammo-counter").textContent = jsonModel.weaponData.totalAmmo;
						// account for infinite ammo ...
						if (WEAPONHANDLER.weaponRemainingAmmo == 0) {
							document.querySelector("#ammo-counter").style.display = "none";
							WEAPONHANDLER.defaultRemainingAmmo = WEAPONHANDLER.weaponRemainingAmmo = 9999999;
						}
						else document.querySelector("#ammo-counter").style.display = "block";
						WEAPONHANDLER.destroyedChunkRange = jsonModel.weaponData.damageRange;
						WEAPONHANDLER.fireRate = jsonModel.weaponData.fireRate;
						WEAPONHANDLER.weaponDamage = jsonModel.weaponData.weaponDamage;
						WEAPONHANDLER.weaponFollowSpeed = jsonModel.weaponData.followSpeed;
						WEAPONHANDLER.weaponHelpText = jsonModel.weaponData.helpText;
						WEAPONHANDLER.weaponPosition = new THREE.Vector3(jsonModel.weaponData.position.x, jsonModel.weaponData.position.y, jsonModel.weaponData.position.z);
						WEAPONHANDLER.weaponRange = WEAPONHANDLER.defaultWeaponRange = jsonModel.weaponData.minimumDistance;
						WEAPONHANDLER.weaponTarget = new THREE.Mesh(
							new THREE.BoxGeometry(1, 1, 1),
							new THREE.MeshBasicMaterial({ color: 0x00ff00 })
						);

						// FLASHLIGHT
						WEAPONHANDLER.flashlight = new THREE.SpotLight(0xffffff, 250);
						// LEVELHANDLER.camera.add(WEAPONHANDLER.flashlight);
						WEAPONHANDLER.flashlight.rotation.set(-Math.PI/2, 0, 0);

						WEAPONHANDLER.flashlight.castShadow = false;
						WEAPONHANDLER.flashlight.penumbra = 0.75;
						WEAPONHANDLER.flashlight.decay = 2;

						const targetObject = new THREE.Object3D()
						WEAPONHANDLER.flashlight.add(targetObject)
						targetObject.position.set(0,LEVELHANDLER.playerHeight,0)
						WEAPONHANDLER.flashlight.target = targetObject

						WEAPONHANDLER.weaponTarget.material.visible = false; // uncomment to position weapon better
						LEVELHANDLER.camera.add(WEAPONHANDLER.weaponTarget);
						WEAPONHANDLER.weaponTarget.position.copy(WEAPONHANDLER.weaponPosition);

						// add a clone of the weaponModel as a child of itself, shifted to the left by 5 units
						// const weaponModelClone = weaponModel.clone();
						// weaponModelClone.scale.multiplyScalar(15);
						// weaponModelClone.position.z -= 865;
						// weaponModel.add(weaponModelClone);

						WEAPONHANDLER.weaponRotation = new THREE.Euler(jsonModel.weaponData.rotation.x, jsonModel.weaponData.rotation.y, jsonModel.weaponData.rotation.z);
						WEAPONHANDLER.weaponTarget.rotation.copy(WEAPONHANDLER.weaponRotation);
						// if (WEAPONDATA.weaponHelpText) setHelpText(WEAPONDATA.weaponHelpText);

						// Muzzle Flash
						WEAPONHANDLER.hideMuzzleFlash = WEAPONHANDLER.defaultHideMuzzleFlash = true;
						if (jsonModel.weaponData.hasMuzzleFlash == true) {
							const map = new THREE.TextureLoader().load('../img/impact.png');
							WEAPONHANDLER.hideMuzzleFlash = WEAPONHANDLER.defaultHideMuzzleFlash = false;
							WEAPONHANDLER.fireSprite = new THREE.Sprite(new THREE.SpriteMaterial({
								map: map,
								color: 0xffffff,
								side: THREE.DoubleSide,
								depthTest: false,
								transparent: true,
							}));
							object.add(WEAPONHANDLER.fireSprite);
							WEAPONHANDLER.fireSprite.position.x = 50;
							WEAPONHANDLER.fireSprite.position.y = 250;
							WEAPONHANDLER.fireSprite.position.z = -700;

							WEAPONHANDLER.fireSprite.material.opacity = 0;
	
							// Muzzle Fire
							WEAPONHANDLER.muzzleFire = new THREE.Mesh(
								new THREE.PlaneGeometry(6000, 45),
								new THREE.MeshBasicMaterial({
									map: new THREE.TextureLoader().load('../img/muzzlefire.png'),
									color: 0xffffff,
									side: THREE.DoubleSide,
									depthTest: false,
									transparent: true,
								})
							);
							object.add(WEAPONHANDLER.muzzleFire);
							WEAPONHANDLER.muzzleFire.position.x = 50;
							WEAPONHANDLER.muzzleFire.position.y = 250;
							WEAPONHANDLER.muzzleFire.position.z = -3600;
							WEAPONHANDLER.muzzleFire.rotation.y = Math.PI / 2;

							WEAPONHANDLER.muzzleFire.material.opacity = 0;
						}
					},
					function (err) {
						// console.log(err);
					}
				);
			}
		);
	}

	createWeaponPickup(weaponType, position, isSpawnedPostLoad=false) {
        const LEVELHANDLER = this.LEVELHANDLER;

		const weaponURL = '../weapons/' + weaponType + '/' + weaponType;

		LEVELHANDLER.globalModelLoader.load(
			weaponURL + '.fbx',
			function (object) {
				LEVELHANDLER.scene.add(object);
				LEVELHANDLER.weaponPickups.push(object);
				LEVELHANDLER.outliner.selectedObjects.push(object);
				object.isActive = true;
				object.weaponType = weaponType;
				object.isSpawnedPostLoad = isSpawnedPostLoad;
				if (position.y == 10) position.y = 0;
				object.position.set(position.x, position.y+1, position.z);
				if (!isSpawnedPostLoad) object.position.add(globalOffset);
				object.scale.divideScalar(50);
				object.rotation.set(0, Math.random(), Math.PI/2)
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
			}
		);
	}

	setWeaponVisible(toggle) {
		this.weaponModel.children[0].visible = toggle;
	}

	throwWeapon(voxelField) {
		if (this.weaponIsEquipped)
		{
			this.weaponIsEquipped = false;
			// Raycast and throw it!!
			const cameraDir = new THREE.Vector3(0, 0, 0);
			this.LEVELHANDLER.camera.getWorldDirection(cameraDir);
			const intersect = voxelField.raycast(this.LEVELHANDLER.camera.position, cameraDir, 1000);
	
			// Generate a Weapon Clone
			const weaponClone = this.weaponModel.clone();
			weaponClone.children.forEach((child) => {
				if (child.name == "hand") child.visible = false;
			});
			this.setWeaponVisible(false);
			weaponClone.children[0].material = this.weaponModel.children[0].material.clone();
			weaponClone.position.copy(this.LEVELHANDLER.camera.position);
			weaponClone.rotation.set(0, 0, 0);
			this.LEVELHANDLER.addThrownWeapon(weaponClone);
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
			const intersects = raycaster.intersectObjects(this.LEVELHANDLER.NPCBank.map(npc => npc.npcObject));
			intersects.forEach((intersect) => {
				if (intersect.distance > this.LEVELHANDLER.camera.position.distanceTo(intersectPosition)) return;
				if (intersect.object.npcHandler) intersect.object.npcHandler.depleteHealth(100);
			});
			// Prevent Shooting
			this.weaponRemainingAmmo = 0;
			// Lastly, fire the interval ...
			let n;
			let reached = false;
			n = setInterval(() => {
				weaponClone.position.lerp(intersectPosition, 0.05);
				weaponClone.rotation.y += 0.025;
				weaponClone.rotation.x += 0.025;
				weaponClone.rotation.z += 0.025;
				if (weaponClone.position.distanceTo(intersectPosition) < 5) {
					weaponClone.scale.multiplyScalar(0.85);
					if (reached == false)
					{
						reached = true;
						setTimeout(() => {
							this.LEVELHANDLER.scene.remove(weaponClone);
							clearInterval(n);
						}, 10000);
					}
				}
			}, 10);

			this.pickupWeapon("nothing");
		}
	}


}