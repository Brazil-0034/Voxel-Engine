import * as THREE from 'three';
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

	// ANIMATION
	isAnimated
	mixer
	fireAnimation

	// PARTICLES & JUICE
	fireSprite
	muzzleFire
    
    // SPECS
    weaponType
    destroyedChunkRange
    fireRate
    weaponDamage
    weaponFollowSpeed
    weaponHelpText
    weaponRange


    constructor(LEVELHANDLER) {

        this.LEVELHANDLER = LEVELHANDLER;
        
		this.weaponRemainingAmmo = 0;
		this.defaultRemainingAmmo = 0;
		this.isAttackAvailable = true;

		this.isAnimated = false;

    }

	// TODO i realize i wrote most of this while high out of my mind but this function chain might be the worst piece of code i've ever written
	// like there are two wholly unnecessary, single-use function calls here for the same exact thing?
	// maybe in a networked game it may be necessary ... maybe it's not so dumb after all ...
	// ill look into it later.

	// This will add the player's weapon model to the scene
	generateWeaponModel(basePath) {
        let LEVELHANDLER = this.LEVELHANDLER;
        let WEAPONHANDLER = this;
		// First, load the weapon metadata from the .json file
		let jsonLoader = new THREE.FileLoader();
		jsonLoader.load(
			basePath + '.json',
			function (json) {
				let jsonModel = JSON.parse(json);
				LEVELHANDLER.globalModelLoader.load(
					basePath + '.fbx',
					function (object) {
						WEAPONHANDLER.weaponModel = object;
						// Load in the texture for the weapon
						WEAPONHANDLER.weaponModel.children[0].material.map = LEVELHANDLER.globalTextureLoader.load(basePath + '.png');
						// Adjust the scale from standard magicavoxel scaling
						WEAPONHANDLER.weaponModel.scale.divideScalar(100);
						WEAPONHANDLER.weaponModel.name = jsonModel.weaponData.name;
						WEAPONHANDLER.weaponTarget = new THREE.Mesh(
							new THREE.BoxGeometry(1, 1, 1),
							new THREE.MeshBasicMaterial({ color: 0x00ff00 })
						);
						WEAPONHANDLER.weaponTarget.material.visible = false; // uncomment to position weapon better
						LEVELHANDLER.camera.add(WEAPONHANDLER.weaponTarget);
						// json reads for weapon data
						WEAPONHANDLER.weaponType = jsonModel.weaponData.type;
				        WEAPONHANDLER.defaultRemainingAmmo = WEAPONHANDLER.weaponRemainingAmmo = jsonModel.weaponData.totalAmmo;
						WEAPONHANDLER.destroyedChunkRange = jsonModel.weaponData.damageRange;
						WEAPONHANDLER.fireRate = jsonModel.weaponData.fireRate;
						WEAPONHANDLER.weaponDamage = jsonModel.weaponData.weaponDamage;
						WEAPONHANDLER.weaponFollowSpeed = jsonModel.weaponData.followSpeed;
						WEAPONHANDLER.weaponHelpText = jsonModel.weaponData.helpText;
						// animations
						console.log(WEAPONHANDLER.weaponModel.animations);
						if (WEAPONHANDLER.weaponModel.animations.length > 0)
						{
							WEAPONHANDLER.isAnimated = true;
							WEAPONHANDLER.mixer = new THREE.AnimationMixer(WEAPONHANDLER.weaponModel);
							WEAPONHANDLER.fireAnimation = WEAPONHANDLER.mixer.clipAction(WEAPONHANDLER.weaponModel.animations[0]);
						}
						// finally, add the weapon to the scene
						LEVELHANDLER.scene.add(WEAPONHANDLER.weaponModel);
						WEAPONHANDLER.weaponPosition = new THREE.Vector3(jsonModel.weaponData.position.x, jsonModel.weaponData.position.y, jsonModel.weaponData.position.z);
						if (jsonModel.weaponData.placementOffset) weaponPlacementOffset = new THREE.Vector3(jsonModel.weaponData.placementOffset.x, jsonModel.weaponData.placementOffset.y, jsonModel.weaponData.placementOffset.z);
						WEAPONHANDLER.weaponRange = jsonModel.weaponData.minimumDistance;
						WEAPONHANDLER.weaponTarget.position.copy(WEAPONHANDLER.weaponPosition);

						// add a clone of the weaponModel as a child of itself, shifted to the left by 5 units
						// const weaponModelClone = weaponModel.clone();
						// weaponModelClone.scale.multiplyScalar(15);
						// weaponModelClone.position.z -= 865;
						// weaponModel.add(weaponModelClone);

						// WEAPONHANDLER.weaponRotation = new THREE.Euler(jsonModel.weaponData.rotation.x, jsonModel.weaponData.rotation.y, jsonModel.weaponData.rotation.z);
						WEAPONHANDLER.weaponRotation = WEAPONHANDLER.weaponModel.rotation;
						WEAPONHANDLER.weaponTarget.rotation.copy(WEAPONHANDLER.weaponRotation);
						// if (WEAPONDATA.weaponHelpText) setHelpText(WEAPONDATA.weaponHelpText);

						// Muzzle Flash
						if (jsonModel.weaponData.hasMuzzleFlash == true) {
							const map = new THREE.TextureLoader().load('../img/impact.png');
							WEAPONHANDLER.fireSprite = new THREE.Sprite(new THREE.SpriteMaterial({
								map: map,
								color: 0xffffff,
								side: THREE.DoubleSide,
								depthTest: false,
								transparent: true,
							}));
							WEAPONHANDLER.weaponModel.add(WEAPONHANDLER.fireSprite);
							WEAPONHANDLER.fireSprite.position.x = 50;
							WEAPONHANDLER.fireSprite.position.y = 250;
							WEAPONHANDLER.fireSprite.position.z = -700;
	
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
							WEAPONHANDLER.weaponModel.add(WEAPONHANDLER.muzzleFire);
							WEAPONHANDLER.muzzleFire.position.x = 50;
							WEAPONHANDLER.muzzleFire.position.y = 250;
							WEAPONHANDLER.muzzleFire.position.z = -3600;
							WEAPONHANDLER.muzzleFire.rotation.y = Math.PI / 2;
						}
					},
					function (err) {
						// console.log(err);
					}
				);
			}
        );
    }

	setWeaponVisible(toggle) {
		this.weaponModel.children[0].visible = toggle;
	}

	throwWeapon(voxelField) {
		if (this.LEVELHANDLER.playerCanMove == false) return
		// Raycast and throw it!!
		const cameraDir = new THREE.Vector3(0, 0, 0);
		this.LEVELHANDLER.camera.getWorldDirection(cameraDir);
		const intersect = voxelField.raycast(this.LEVELHANDLER.camera.position, cameraDir, 1000);
		if (intersect != null) {
			// Generate a Weapon Clone
			const weaponClone = this.weaponModel.clone();
			this.weaponModel.children[0].visible = false;
			weaponClone.children[0].material = this.weaponModel.children[0].material.clone();
			weaponClone.position.copy(this.LEVELHANDLER.camera.position);
			weaponClone.rotation.set(0, 0, 0);
			this.LEVELHANDLER.addThrownWeapon(weaponClone);
			const intersectPosition = new THREE.Vector3(intersect.x, intersect.y, intersect.z);
			// Raycast for Enemies
			const NPCs = this.LEVELHANDLER.NPCBank.map((NPC) => NPC.sceneObject.children[0]);
			const raycaster = new THREE.Raycaster();
			raycaster.setFromCamera(new THREE.Vector2(0, 0), this.LEVELHANDLER.camera);
			const intersects = raycaster.intersectObjects(this.LEVELHANDLER.NPCBank.map(npc => npc.sceneObject.children[0]));
			intersects.forEach((intersect) => {
				if (intersect.distance > this.LEVELHANDLER.camera.position.distanceTo(intersectPosition)) return;
				intersect.object.npcHandler.depleteHealth(100);
			});
			// Prevent Shooting
			this.weaponRemainingAmmo = 0;
			// Lastly, fire the interval ...
			let n;
			n = setInterval(() => {
				if (weaponClone.position.distanceTo(intersectPosition) > 5) {
					weaponClone.position.lerp(intersectPosition, 0.25);
					weaponClone.rotation.y += 0.25;
				} else {
					clearInterval(n);
				}
			}, 10);
		}
	}

}