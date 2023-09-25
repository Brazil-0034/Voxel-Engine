// BIG class for all things level related
import * as THREE from 'three';

export const pauseGameState = function(LEVELHANDLER, WEAPONHANDLER) {
	LEVELHANDLER.playerCanMove = false;
	WEAPONHANDLER.setWeaponVisible(false);
	document.querySelector("#dead-overlay").style.animation = "fade-in 0.12s ease-in forwards";
}

export const resetGameState = function(LEVELHANDLER, WEAPONHANDLER) {
	// Reset Player ...
	LEVELHANDLER.camera.position.set(0,LEVELHANDLER.playerHeight,0);
	LEVELHANDLER.camera.rotation.copy(new THREE.Euler(0,0,0));
	LEVELHANDLER.playerCanMove = true;
	WEAPONHANDLER.setWeaponVisible(true);
	LEVELHANDLER.playerHealth = 100;
	// LEVELHANDLER.camera.rotation.x = Math.PI/4;
	// Reset Weapon
	WEAPONHANDLER.weaponRemainingAmmo = WEAPONHANDLER.defaultRemainingAmmo;
	WEAPONHANDLER.weaponModel.position.copy(WEAPONHANDLER.weaponTarget.position);
	WEAPONHANDLER.weaponModel.children.forEach(child => { child.visible = true });
	// Reset NPCs ...
	LEVELHANDLER.NPCBank.forEach(thisNPC => {
		thisNPC.sceneObject.rotation.set(thisNPC.startingRotation.x, thisNPC.startingRotation.y, thisNPC.startingRotation.z);
		thisNPC.sceneObject.position.set(thisNPC.startingPosition.x, thisNPC.startingPosition.y, thisNPC.startingPosition.z);
		thisNPC.health = thisNPC.startingHealth;
		thisNPC.knowsWherePlayerIs = false;
		thisNPC.mixer.stopAllAction();
		thisNPC.idleAnimation.play();
		thisNPC.mixer.timeScale = 1;
	})
	// Reset UI
	document.querySelector("#dead-overlay").style.animation = "dead-fade-out 1.5s ease-out ";
	document.querySelector("#healthbar").style.width = "200px";
	// Clean Garbage
	LEVELHANDLER.clearGarbage();
	LEVELHANDLER.outliner.selectedObjects = [];
}