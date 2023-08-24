// BIG class for all things level related
import * as THREE from 'three';

export const resetGameState = function(LEVELHANDLER, WEAPONHANDLER, killStartPosition) {
	// Draw Last Kill Line
	if (killStartPosition)
	{
		const killLine = new THREE.Line(
			new THREE.BufferGeometry().setFromPoints([
				killStartPosition.clone().setY(LEVELHANDLER.playerHeight),
				LEVELHANDLER.camera.position.multiply(new THREE.Vector3(1000,0,1000))
			]),
			new THREE.LineBasicMaterial({
				color: 0xcccccc
			})
		)

		LEVELHANDLER.scene.add(killLine);
	}
	// Reset Player ...
	LEVELHANDLER.camera.position.set(0,60,0);
	LEVELHANDLER.camera.rotation.copy(new THREE.Euler(0,0,0));
	// LEVELHANDLER.camera.rotation.x = Math.PI/4;
	// Reset Weapon
	WEAPONHANDLER.weaponRemainingAmmo = WEAPONHANDLER.defaultRemainingAmmo;
	WEAPONHANDLER.weaponModel.position.copy(WEAPONHANDLER.weaponTarget.position);
	WEAPONHANDLER.weaponModel.children[0].visible = true;
	WEAPONHANDLER.weaponModel.children[0].rotation.set(0,0,0);
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
}