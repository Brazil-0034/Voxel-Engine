import * as THREE from 'three';
export class WeaponHandler {
    // MAIN
    LEVELHANDLER

    // AMMO
    weaponRemainingAmmo
    defaultRemainingAmmo

    // MODEL
    weaponModel
    weaponTarget
    weaponPosition
    weaponRotation
    
    // SPECS
    weaponType
    adsPosition
    adsRotation
    percentMissedHits
    destroyedChunkRange
    fireRate
    weaponDamage
    weaponFollowSpeed
    weaponHelpText
    weaponRange


    constructor(LEVELDATA) {

        this.LEVELHANDLER = LEVELDATA;
        
		this.weaponRemainingAmmo = 0;
		this.defaultRemainingAmmo = 0;

    }

	// TODO i realize i wrote most of this while high out of my mind but this function chain might be the worst piece of code i've ever written
	// like there are two wholly unnecessary, single-use function calls here for the same exact thing?
	// maybe in a networked game it may be necessary ... maybe it's not so dumb after all ...
	// ill look into it later.

	// This will add the player's weapon model to the scene
	generateWeaponModel(basePath) {
        let LEVELDATA = this.LEVELHANDLER;
        let WEAPONHANDLER = this;
		// First, load the weapon metadata from the .json file
		let jsonLoader = new THREE.FileLoader();
		jsonLoader.load(
			basePath + '.json',
			function (json) {
				let jsonModel = JSON.parse(json);
				LEVELDATA.globalModelLoader.load(
					basePath + '.fbx',
					function (object) {
						WEAPONHANDLER.weaponModel = object;
						// Load in the texture for the weapon
						WEAPONHANDLER.weaponModel.children[0].material.map = LEVELDATA.globalTextureLoader.load(basePath + '.png');
						// Adjust the scale from standard magicavoxel scaling
						WEAPONHANDLER.weaponModel.scale.divideScalar(15);
						WEAPONHANDLER.weaponModel.name = jsonModel.weaponData.name;
						WEAPONHANDLER.weaponModel.children[0].material.depthTest = false;
						WEAPONHANDLER.weaponTarget = new THREE.Mesh(
							new THREE.BoxGeometry(1, 1, 1),
							new THREE.MeshBasicMaterial({ color: 0x00ff00 })
						);
						WEAPONHANDLER.weaponTarget.material.visible = false; // uncomment to position weapon better
						LEVELDATA.camera.add(WEAPONHANDLER.weaponTarget);
						// json reads for weapon data
						WEAPONHANDLER.weaponType = jsonModel.weaponData.type;
						WEAPONHANDLER.adsPosition = jsonModel.weaponData.adsPosition;
						WEAPONHANDLER.adsRotation = jsonModel.weaponData.adsRotation;
				        WEAPONHANDLER.defaultRemainingAmmo = WEAPONHANDLER.weaponRemainingAmmo = jsonModel.weaponData.totalAmmo;
						WEAPONHANDLER.percentMissedHits = jsonModel.weaponData.basepotency;
						WEAPONHANDLER.destroyedChunkRange = jsonModel.weaponData.damageRange;
						WEAPONHANDLER.fireRate = jsonModel.weaponData.fireRate;
						WEAPONHANDLER.weaponDamage = jsonModel.weaponData.weaponDamage;
						WEAPONHANDLER.weaponFollowSpeed = jsonModel.weaponData.followSpeed;
						WEAPONHANDLER.weaponHelpText = jsonModel.weaponData.helpText;
						// finally, add the weapon to the scene
						LEVELDATA.scene.add(WEAPONHANDLER.weaponModel);
						WEAPONHANDLER.weaponPosition = new THREE.Vector3(jsonModel.weaponData.position.x, jsonModel.weaponData.position.y, jsonModel.weaponData.position.z);
						if (jsonModel.weaponData.placementOffset) weaponPlacementOffset = new THREE.Vector3(jsonModel.weaponData.placementOffset.x, jsonModel.weaponData.placementOffset.y, jsonModel.weaponData.placementOffset.z);
						WEAPONHANDLER.weaponRange = jsonModel.weaponData.minimumDistance;
						if (jsonModel.weaponData.realWorldScaleMultiplier != undefined) weaponRealWorldScaleMultiplier = jsonModel.weaponData.realWorldScaleMultiplier;
						WEAPONHANDLER.weaponTarget.position.copy(WEAPONHANDLER.weaponPosition);

						// add a clone of the weaponModel as a child of itself, shifted to the left by 5 units
						// const weaponModelClone = weaponModel.clone();
						// weaponModelClone.scale.multiplyScalar(15);
						// weaponModelClone.position.z -= 865;
						// weaponModel.add(weaponModelClone);

						WEAPONHANDLER.weaponRotation = new THREE.Euler(jsonModel.weaponData.rotation.x, jsonModel.weaponData.rotation.y, jsonModel.weaponData.rotation.z);
						WEAPONHANDLER.weaponTarget.rotation.copy(WEAPONHANDLER.weaponRotation);
						// if (WEAPONDATA.weaponHelpText) setHelpText(WEAPONDATA.weaponHelpText);
					},
					function (err) {
						// console.log(err);
					}
				);
			}
        );
    }

	throwWeapon(voxelField) {
		console.log("Throwing Weapon...")
		// Raycast and throw it!!
		const cameraDir = new THREE.Vector3(0, 0, 0);
		this.LEVELHANDLER.camera.getWorldDirection(cameraDir);
		const intersect = voxelField.raycast(this.LEVELHANDLER.camera.position, cameraDir, 1000);
		if (intersect != null) {
			// Generate a Weapon Clone
			const weaponClone = this.weaponModel.clone();
			this.weaponModel.children[0].visible = false;
			weaponClone.children[0].material = this.weaponModel.children[0].material.clone();
			weaponClone.children[0].material.depthTest = true;
			weaponClone.children[0].rotation.x = Math.PI/2;
			weaponClone.children[0].rotation.z = Math.PI/2;
			weaponClone.scale.multiplyScalar(0.5);
			weaponClone.position.copy(this.LEVELHANDLER.camera.position);
			weaponClone.rotation.set(0, 0, 0);
			this.LEVELHANDLER.addThrownWeapon(weaponClone);
			const intersectPosition = new THREE.Vector3(intersect.x, intersect.y, intersect.z);
			// Raycast for Enemies
			let enemiesToKill = [];
			const NPCs = this.LEVELHANDLER.NPCBank.map((NPC) => NPC.sceneObject.children[0]);
			const raycaster = new THREE.Raycaster();
			raycaster.setFromCamera(new THREE.Vector2(0, 0), this.LEVELHANDLER.camera);
			console.log(NPCs);
			const intersects = raycaster.intersectObjects(this.LEVELHANDLER.NPCBank.map(npc => npc.sceneObject.children[0]));
			intersects.forEach((intersect) => {
				if (intersect.distance > this.LEVELHANDLER.camera.position.distanceTo(intersectPosition)) return;
				enemiesToKill.push(intersect.object.npcHandler);
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
					enemiesToKill.forEach((enemy) => {
						console.log(enemy);
						enemy.depleteHealth(100);
					});
					clearInterval(n);
				}
			}, 10);
		}
	}

}