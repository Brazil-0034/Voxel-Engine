import * as THREE from 'three';
export class WeaponHandler {
    // MAIN
    LEVELDATA

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

        this.LEVELDATA = LEVELDATA;
        
		this.weaponRemainingAmmo = 0;
		this.defaultRemainingAmmo = 0;

    }

	// TODO i realize i wrote most of this while high out of my mind but this function chain might be the worst piece of code i've ever written
	// like there are two wholly unnecessary, single-use function calls here for the same exact thing?
	// maybe in a networked game it may be necessary ... maybe it's not so dumb after all ...
	// ill look into it later.

	// This will add the player's weapon model to the scene
	generateWeaponModel(basePath) {
        let LEVELDATA = this.LEVELDATA;
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

}