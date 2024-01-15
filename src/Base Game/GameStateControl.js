import * as THREE from 'three';
import { globalOffset } from './WorldGenerator.js'
import { displacedVoxels, resetDisplacedVoxels } from './VoxelStructures.js'
import { voxelField } from './VoxelStructures.js';
import { resetChatIndex } from './ChatSystem.js';

let internalTimer = new THREE.Clock();
internalTimer.start();

export const pauseGameState = function(LEVELHANDLER, WEAPONHANDLER) {
	internalTimer.stop();
	LEVELHANDLER.playerCanMove = false;
	WEAPONHANDLER.setWeaponVisible(false);
	document.querySelector("#dead-overlay").style.animation = "fade-in 0.05s ease-in forwards";
	document.querySelector("#restart-helper").style.visibility = "visible";
}

export const resetGameState = function(LEVELHANDLER, WEAPONHANDLER) {
	// Reset Player ...
	// LEVELHANDLER.camera.position.set(globalOffset.x,LEVELHANDLER.playerHeight,globalOffset.z);
	LEVELHANDLER.camera.position.set(globalOffset.x,LEVELHANDLER.playerHeight,globalOffset.z);
	LEVELHANDLER.camera.rotation.copy(new THREE.Euler(0,0,0));
	LEVELHANDLER.playerCanMove = true;
	WEAPONHANDLER.setWeaponVisible(true);
	LEVELHANDLER.playerHealth = 100;
	if (LEVELHANDLER.deathCount > 0) {
		if (LEVELHANDLER.assistObj) LEVELHANDLER.assistObj.visible = true;
	}
	LEVELHANDLER.camera.rotation.x = Math.PI/4;
	// Reset Voxels ...
	for (let i = 0; i < displacedVoxels.length; i++)
	{
		const dv = displacedVoxels[i];
		dv.chunk.setMatrixAt(dv.indexInChunk, new THREE.Matrix4().makeTranslation(dv.position));
		dv.chunk.instanceMatrix.needsUpdate = true;
		dv.chunk.recover();
		voxelField.set(dv.position.x, dv.position.y, dv.position.z, 1, dv.indexInChunk, dv.chunk);
	}
	LEVELHANDLER.levelLights.forEach(light => {light.intensity = light.baseIntensity});
	resetDisplacedVoxels();
	// // Reset Weapon
	WEAPONHANDLER.pickupWeapon("nothing");
	WEAPONHANDLER.weaponRemainingAmmo = WEAPONHANDLER.defaultRemainingAmmo;
	WEAPONHANDLER.weaponType = WEAPONHANDLER.defaultWeaponType;
	WEAPONHANDLER.weaponRange = WEAPONHANDLER.defaultWeaponRange;
	WEAPONHANDLER.hideMuzzleFlash = WEAPONHANDLER.defaultHideMuzzleFlash;
	WEAPONHANDLER.weaponIsEquipped = WEAPONHANDLER.defaultWeaponIsEquipped;
	if (WEAPONHANDLER.weaponModel) {
		WEAPONHANDLER.weaponModel.position.copy(WEAPONHANDLER.weaponTarget.position);
		WEAPONHANDLER.weaponModel.children.forEach(child => {
			child.visible = true;
			if (child.isHoldableWeapon == true) WEAPONHANDLER.weaponModel.remove(child)
		});
	}
	LEVELHANDLER.explosives.map(explosives => explosives.children[0]).forEach(explosive => explosive.parent.visible = true);
	// Reset Pickups
	LEVELHANDLER.weaponPickups.forEach(pickup => {
		if (pickup.isSpawnedPostLoad == false) pickup.visible = pickup.isActive = true;
		else pickup.visible = pickup.isActive = false;
	});
	document.querySelector("#ammo-counter").textContent = WEAPONHANDLER.weaponRemainingAmmo
	// Reset NPCs ...
	LEVELHANDLER.totalNPCs = LEVELHANDLER.NPCBank.length;
	LEVELHANDLER.NPCBank.forEach(thisNPC => {
		thisNPC.sceneObject.rotation.set(thisNPC.startingRotation.x, thisNPC.startingRotation.y, thisNPC.startingRotation.z);
		thisNPC.sceneObject.position.set(thisNPC.startingPosition.x, thisNPC.startingPosition.y, thisNPC.startingPosition.z);
		thisNPC.sceneObject.position.add(globalOffset);
        thisNPC.shootBar.visible = false;
		thisNPC.health = thisNPC.startingHealth;
		thisNPC.isDead = false;
		if (thisNPC.npcName != "entity") thisNPC.knowsWherePlayerIs = false;
		thisNPC.mixer.stopAllAction();
		thisNPC.idleAnimation.play();
		thisNPC.mixer.timeScale = 1;
		thisNPC.floorgore.visible = false;
		if (thisNPC.isHostile == false) LEVELHANDLER.totalNPCs--;
	})
	LEVELHANDLER.killBlobs.forEach(blob => {LEVELHANDLER.scene.remove(blob.iMesh); blob.isAlive = false;});
	LEVELHANDLER.killBlobs = [];
	// Reset UI
	document.querySelector("#dead-overlay").style.animation = "dead-fade-out 1.5s ease-out ";
	document.querySelector("#restart-helper").style.visibility = "hidden";
	document.querySelector("#healthbar").style.width = "200px";
	document.querySelector("#end-screen").innerHTML = "";
	document.querySelector("#center-ui").style.visibility = "visible";
	document.querySelectorAll(".health").forEach(health => {health.style.visibility = "visible"});
	document.querySelector("#interaction-text").style.visibility = "visible";
	document.querySelector("#middle-crosshair").style.visibility = "visible";
	LEVELHANDLER.backlight.color = LEVELHANDLER.defaultBacklightColor;
	LEVELHANDLER.outliner.selectedObjects = [];
	resetChatIndex();
	// Reset SFX
	// LEVELHANDLER.SFXPlayer.setSoundPlaying("levelClearSound", false);
	// Clean Garbage
	LEVELHANDLER.clearGarbage();
	// Reset Timer ...
	internalTimer = new THREE.Clock();
	internalTimer.start();
}

export const endGameState = function(LEVELHANDLER) {
	internalTimer.stop();
	document.querySelector("#center-ui").style.visibility = "hidden";
	document.querySelectorAll(".health").forEach(health => {health.style.visibility = "hidden"});
	if (LEVELHANDLER.assistObj) LEVELHANDLER.assistObj.visible = false;
	// add end screen to DOM
	const endScreen = `
	<div id="fade-control">
		<div id="widebar-carrier">
			<div id="widebar">
				<img id="widebar-text" src="../img/level_clear.gif"/>
			</div>
			<b id="next-level-text">Hold [SPACE] to <span id="next-phrase"></span></b>
		</div>
	</div>`
	document.querySelector("#end-screen").innerHTML = endScreen;

	document.querySelector("#middle-crosshair").style.visibility = "hidden";
	document.querySelector("#interaction-text").style.visibility = "hidden";
	document.querySelector("#next-phrase").innerHTML = LEVELHANDLER.nextLevelText;

	setTimeout(() => {
		document.querySelector("#fade-control").style.animation = "fade-out-some 1s ease-out forwards";
	}, 8000);
	
	LEVELHANDLER.SFXPlayer.playSound("levelClearSound", false);
	LEVELHANDLER.isLevelComplete = true;
}