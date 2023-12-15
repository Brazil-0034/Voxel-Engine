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
	if (LEVELHANDLER.deathCount > 1) {
		if (LEVELHANDLER.assistObj) LEVELHANDLER.assistObj.visible = true;
	}
	console.log(LEVELHANDLER.deathCount);
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
	// Reset Weapon
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
	// Reset Pickups
	LEVELHANDLER.weaponPickups.forEach(pickup => {
		if (pickup.isSpawnedPostLoad == false) pickup.visible = pickup.isActive = true;
		else pickup.visible = pickup.isActive = false;
	});
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
	document.querySelector("#center-ui").style.visibility = "visible";
	document.querySelectorAll(".health").forEach(health => {health.style.visibility = "visible"});
	LEVELHANDLER.backlight.color = LEVELHANDLER.defaultBacklightColor;
	LEVELHANDLER.outliner.selectedObjects = [];
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
			<div id="level-stats" style="margin-top:50px; display:none">
				<div style="opacity: 0.5">
					<div class="stat-holder">
						<div class="left-stat">LEVEL DESTRUCTION:</div>
						<div class="right-stat" id="stat-destruction-total">0 blocks</div>
					</div>
				</div>
				<div id="tips"></div>
				<div id="bonuses"></div>
				<br />
				<div class="stat-holder">
					<b id="nextkey">Press <font style="color:gold">[Spacebar]</font><br />to go to the Next Floor</b>
				</div>
			</div>
		</div>
	</div>`

	document.querySelector("#end-screen").innerHTML = endScreen;
	// document.querySelector("#level-stats").style.opacity = 0;

	if (LEVELHANDLER.playerHealth <= 10) {
		document.querySelector("#bonuses").innerHTML += `
		<div class="stat-holder">
			<div class="right-stat" id="clutch-bonus"><b>+ 180pts</b> <i style="color: gold">(Clutch Bonus)</i></div>
		</div>`;
	}

	// document.querySelectorAll(".right-stat")[document.querySelectorAll(".right-stat").length-2].style.borderBottom = "2px solid white";

	const numDestroyedVoxels = displacedVoxels.length;
	const remainingHealth = Math.ceil(LEVELHANDLER.playerHealth);

	// document.querySelector("#stat-remain-health").textContent = remainingHealth + " %";
	document.querySelector("#stat-destruction-total").textContent = numDestroyedVoxels + " blocks";
	// document.querySelector("#stat-time-total").textContent = "÷ " + internalTimer.getElapsedTime().toFixed(2) + " seconds";

	const scorebox = document.querySelector("#stat-destruction-total");
	// const scorebox = document.querySelector("#stat-score-total");
	// scorebox.textContent = Math.ceil(numDestroyedVoxels / internalTimer.getElapsedTime()) + " POINTS";

	const score = parseInt(scorebox.textContent);
	if (score > 20) LEVELHANDLER.isLevelComplete = true;

	setTimeout(() => {
		if (score >= 200) {
			scorebox.style.animation = "score-animate-good 0.45s infinite"
			scorebox.textContent += " 😁";
		}
		else {
			scorebox.style.animation = "score-animate-bad 0.45s infinite"
			if (score < 100) scorebox.textContent += " 🤬";
			else scorebox.textContent += " ☹";
			document.querySelector("#nextkey").innerHTML = "<b>Press <font style='color:rgb(188, 49, 49); text-shadow: 0px 0px 10px rgb(188, 49, 49)'>[R]</font> to Try Again</b>";
			document.querySelector("#tips").innerHTML += `
			<div class="stat-holder">
				<div class="right-stat"><sup style="font-size: 75%">(MINIMUM: 200)</sup></div>
			</div>`;
			if (internalTimer.getElapsedTime() > 7) {
				document.querySelector("#tips").innerHTML += `
				<div class="stat-holder">
					<div class="right-stat"><sup style="font-size: 75%"><b>TIP:</b> GO FASTER</sup></div>
				</div>`;
			}
			
		}
	}, 2000);

	// setTimeout(() => {
	// 	document.querySelector("#fade-control").style.animation = "fade-out-some 1s ease-out forwards";
	// }, 10000);

	// for each stat-holder, increment animation-delay by 1
	for (let i = 0; i < document.querySelectorAll(".stat-holder").length; i++) {
		document.querySelectorAll(".stat-holder")[i].style.animationDelay = 1.25 + (i/3) + "s";
	}

	// setInterval(() => {
	// 	LEVELHANDLER.backlight.color.lerp(new THREE.Color(0xffffff), 1/100);
	// }, 10);
}