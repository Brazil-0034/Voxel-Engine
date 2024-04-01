import * as THREE from 'three';
import { globalOffset } from './WorldGenerator.js'
import { displacedVoxels, resetDisplacedVoxels } from './VoxelStructures.js'
import { voxelField } from './VoxelStructures.js';
import { resetChatIndex } from './ChatSystem.js';
import { WeaponHandler } from './WeaponHandler.js';
import { createVizSphere } from './EngineMath.js';

// when die
export const pauseGameState = function(LEVELHANDLER, WEAPONHANDLER) {
	LEVELHANDLER.playerCanMove = false;
	LEVELHANDLER.camera.fov = 180;
	LEVELHANDLER.camera.lookAt(LEVELHANDLER.lastPlayerKiller.sceneObject.position.clone().setY(35));
	LEVELHANDLER.lastPlayerKiller.npcObject.material.color = new THREE.Color(0xff0000);
	WEAPONHANDLER.setWeaponVisible(false);
	document.querySelector("#dead-overlay").style.animation = "fade-in 0.05s ease-in forwards";
	document.querySelector("#restart-helper").style.visibility = "visible";
	LEVELHANDLER.isCameraShaking = false;
}

// when level reset
export const resetGameState = function(LEVELHANDLER, WEAPONHANDLER) {
	LEVELHANDLER.gameStateEnded = false;
	// Reset Player ...
	// LEVELHANDLER.camera.position.set(globalOffset.x,LEVELHANDLER.playerHeight,globalOffset.z);
	LEVELHANDLER.camera.position.set(globalOffset.x,LEVELHANDLER.playerHeight,globalOffset.z);
	LEVELHANDLER.camera.rotation.copy(new THREE.Euler(0,0,0));
	LEVELHANDLER.playerCanMove = true;
	LEVELHANDLER.hasBeenShot = false;
	LEVELHANDLER.hasShotYet = false;
	WEAPONHANDLER.setWeaponVisible(true);
	LEVELHANDLER.playerHealth = 100;
	if (LEVELHANDLER.deathCount > 0) {
		if (LEVELHANDLER.assistObj) LEVELHANDLER.assistObj.visible = true;
	}
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
	LEVELHANDLER.levelLights.forEach(light => {light.intensity = light.baseIntensity});
	resetDisplacedVoxels();
	// // Reset Weapon
	// WEAPONHANDLER.pickupWeapon("nothing");
	WEAPONHANDLER.throwWeapon(true);
	LEVELHANDLER.explosives.map(explosives => explosives.children[0]).forEach(explosive => explosive.parent.visible = true);
	// Reset Pickups
	LEVELHANDLER.weaponPickups.forEach(pickup => {
		if (pickup.isSpawnedPostLoad) // if it is a level-placed weapon
		{
			pickup.visible = true;
			pickup.isActive = true;
		}
		else { // if it is an NPC weapon drp[]
			pickup.visible = false;
			pickup.isActive = false;
		}
		if (pickup.thrownWeaponAnimationInterval) clearInterval(pickup.thrownWeaponAnimationInterval);
		pickup.position.copy(pickup.initialPosition);
		pickup.rotation.copy(pickup.initialRotation);
		pickup.scale.copy(pickup.initialScale);
	});
	document.querySelector("#ammo-counter").textContent = WEAPONHANDLER.weaponRemainingAmmo;
	// Reset NPCs ...
	LEVELHANDLER.totalNPCs = LEVELHANDLER.totalKillableNPCs = 0;
	LEVELHANDLER.NPCBank.forEach(thisNPC => {
		thisNPC.npcObject.material.color = new THREE.Color(0xffffff);
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
		thisNPC.shootTimer = undefined;
		thisNPC.canShoot = false;
		thisNPC.blobs.forEach(blob => blob.reset());
		if (thisNPC.isHostile) LEVELHANDLER.totalKillableNPCs++;
		LEVELHANDLER.totalNPCs++;
	})
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
	document.querySelector("#reverse").style.opacity = 0.5;
	LEVELHANDLER.outliner.selectedObjects = [];
	LEVELHANDLER.initializeTimer();
	resetChatIndex();
}

// when next level
export const endGameState = function(LEVELHANDLER) {
	if (LEVELHANDLER.gameStateEnded) return
	LEVELHANDLER.gameStateEnded = true;
	LEVELHANDLER.freezeTimer();
	
	document.querySelector("#center-ui").style.visibility = "hidden";
	document.querySelectorAll(".health").forEach(health => {health.style.visibility = "hidden"});
	if (LEVELHANDLER.assistObj) LEVELHANDLER.assistObj.visible = false;
	// add end screen to DOM
	const endScreen = `
	<div id="widebar-carrier">
		<div id="widebar">
			<div id="fade-control">
				<img id="widebar-text" src="../img/level_clear.gif?` + new Date().getTime() + `"/>
			</div>
		</div>
		<b id="next-level-text"></b>
	</div>`
	document.querySelector("#end-screen").innerHTML = endScreen;
	const createBar = () => {
		const whiteBar = document.createElement("div");
		whiteBar.innerHTML = "🠶";
		whiteBar.id = "whitebar";
		document.body.appendChild(whiteBar);
	}
	createBar();
	// setTimeout(() => createBar(), 100);

	document.querySelector("#middle-crosshair").style.visibility = "hidden";
	document.querySelector("#interaction-text").style.visibility = "hidden";

	setTimeout(() => {
		document.querySelector("#fade-control").style.display = "none";
		document.querySelector("#widebar-carrier").innerHTML += `
		<div id="bonus-challenges">
			<img src="../img/challenges.gif?` + new Date().getTime() + `" class="bonus-challenges-text-header" />
		</div>`

		console.log("HAS SHOT YET:", LEVELHANDLER.hasShotYet);
		console.log("HAS BEEN SHOT:", LEVELHANDLER.hasBeenShot);

		setTimeout(() => {
			document.querySelector("#bonus-challenges").innerHTML += `
			<img src="../img/noshotsfired` + (LEVELHANDLER.hasShotYet ? `-failed` : ``) + `.gif?` + new Date().getTime() + `" class="bonus-challenges-text" />`
		}, 250);
		setTimeout(() => {
			document.querySelector("#bonus-challenges").innerHTML += `
			<img src="../img/noshotstaken` + (LEVELHANDLER.hasBeenShot ? `-failed` : ``) + `.gif?` + new Date().getTime() + `" class="bonus-challenges-text" />`
		}, 500);
		const timerSeconds = document.querySelector("#timer-seconds");
		const timerCentiseconds = document.querySelector("#timer-centiseconds");
		setTimeout(() => {
			document.querySelector("#bonus-challenges").innerHTML += `
			<img src="../img/under7seconds` + (parseInt(timerSeconds.textContent) > 6 ? `-failed` : ``) + `.gif?` + new Date().getTime() + `" class="bonus-challenges-text" />`
		}, 750);
	}, 3500);
	
	LEVELHANDLER.SFXPlayer.playSound("levelClearSound", false);
	LEVELHANDLER.isLevelComplete = true;
}