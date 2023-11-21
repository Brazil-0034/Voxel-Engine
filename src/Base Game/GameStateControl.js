import * as THREE from 'three';
import { globalOffset } from './WorldGenerator.js'
import { displacedVoxels, resetDisplacedVoxels } from './VoxelStructures.js'
import { voxelField } from './VoxelStructures.js';

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
	// LEVELHANDLER.camera.rotation.x = Math.PI/4;
	// Reset Voxels ...
	for (let i = 0; i < displacedVoxels.length; i++)
	{
		const dv = displacedVoxels[i];
		dv.chunk.setMatrixAt(dv.indexInChunk, new THREE.Matrix4().makeTranslation(dv.position));
		dv.chunk.instanceMatrix.needsUpdate = true;
		dv.chunk.recover();
		voxelField.set(dv.position.x, dv.position.y, dv.position.z, 1, dv.indexInChunk, dv.chunk);
	}
	resetDisplacedVoxels();
	// Reset Weapon
	WEAPONHANDLER.weaponRemainingAmmo = WEAPONHANDLER.defaultRemainingAmmo;
	WEAPONHANDLER.weaponType = WEAPONHANDLER.defaultWeaponType;
	WEAPONHANDLER.weaponRange = WEAPONHANDLER.defaultWeaponRange;
	WEAPONHANDLER.hideMuzzleFlash = WEAPONHANDLER.defaultHideMuzzleFlash;
	WEAPONHANDLER.weaponIsEquipped = WEAPONHANDLER.defaultWeaponIsEquipped;
	WEAPONHANDLER.weaponModel.position.copy(WEAPONHANDLER.weaponTarget.position);
	WEAPONHANDLER.weaponModel.children.forEach(child => { child.visible = true });
	document.querySelector("#ammo-counter").textContent = WEAPONHANDLER.weaponRemainingAmmo
	// Reset NPCs ...
	LEVELHANDLER.NPCBank.forEach(thisNPC => {
		thisNPC.sceneObject.rotation.set(thisNPC.startingRotation.x, thisNPC.startingRotation.y, thisNPC.startingRotation.z);
		thisNPC.sceneObject.position.set(thisNPC.startingPosition.x, thisNPC.startingPosition.y, thisNPC.startingPosition.z);
		thisNPC.sceneObject.position.add(globalOffset);
        thisNPC.shootBar.visible = false;
		thisNPC.health = thisNPC.startingHealth;
		thisNPC.knowsWherePlayerIs = false;
		thisNPC.mixer.stopAllAction();
		thisNPC.idleAnimation.play();
		thisNPC.mixer.timeScale = 1;
		thisNPC.floorgore.visible = false;
	})
	LEVELHANDLER.totalNPCs = LEVELHANDLER.NPCBank.length;
	LEVELHANDLER.killBlobs.forEach(blob => {LEVELHANDLER.scene.remove(blob.iMesh); blob.isAlive = false;});
	LEVELHANDLER.killBlobs = [];
	// Reset UI
	document.querySelector("#dead-overlay").style.animation = "dead-fade-out 1.5s ease-out ";
	document.querySelector("#restart-helper").style.visibility = "hidden";
	document.querySelector("#healthbar").style.width = "200px";
	document.querySelector("#end-screen").innerHTML = "";
	LEVELHANDLER.backlight.color = LEVELHANDLER.defaultBacklightColor;
	// Clean Garbage
	LEVELHANDLER.clearGarbage();
	LEVELHANDLER.outliner.selectedObjects = [];
	// Reset Timer ...
	internalTimer = new THREE.Clock();
	internalTimer.start();
}

export const endGameState = function(LEVELHANDLER) {
	internalTimer.stop();
	// add end screen to DOM
	const endScreen = `
	<div id="widebar-carrier">
		<div id="widebar">
			<div id="widebar-text">
				LEVEL CLEAR
			</div>
		</div>
		<div id="level-stats" style="margin-top:50px">
			<div class="stat-holder">
				<div class="left-stat">REMAINING HEALTH:</div>
				<div class="right-stat" id="stat-remain-health">100</div>
			</div>
			<div class="stat-holder">
				<div class="left-stat">TOTAL TIME:</div>
				<div class="right-stat" id="stat-time-total">0:00</div>
			</div>
			<div class="stat-holder">
				<div class="left-stat">LEVEL DESTRUCTION:</div>
				<div class="right-stat" id="stat-destruction-total">0%</div>
			</div>
			<div class="stat-holder" style="margin-top:50px">
				<b>Press [Spacebar]<br />to go to the Next Floor</b>
			</div>
		</div>
	</div>`

	LEVELHANDLER.isLevelComplete = true;

	document.querySelector("#end-screen").innerHTML = endScreen;
	document.querySelector("#stat-remain-health").textContent = LEVELHANDLER.playerHealth.toFixed(2) + "%";
	document.querySelector("#stat-time-total").textContent = internalTimer.getElapsedTime().toFixed(2) + "s";
	document.querySelector("#stat-destruction-total").textContent = (displacedVoxels.length / LEVELHANDLER.numVoxels).toFixed(4) + "%";

	// for each stat-holder, increment animation-delay by 1
	for (let i = 0; i < document.querySelectorAll(".stat-holder").length; i++) {
		document.querySelectorAll(".stat-holder")[i].style.animationDelay = 1.25 + (i/3) + "s";
	}

	// setInterval(() => {
	// 	LEVELHANDLER.backlight.color.lerp(new THREE.Color(0xffffff), 1/100);
	// }, 10);
}