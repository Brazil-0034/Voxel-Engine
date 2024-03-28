import * as THREE from 'three';
import { voxelField } from './VoxelStructures.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { rapidFloat } from './EngineMath.js'; // math functions
import { SoundEffectPlayer } from './AudioLibrary.js'; // SFX and Music

// Data relevant to the user's graphics and gameplay settings
export const USERSETTINGS = {};

// Data relevent to the game's currently loaded level
export class LevelHandler {
	// Data about Renderer
	scene
	camera
	weaponCamera
	renderer
	potentialCleanCalls
	outliner

	// Data about Audio
	SFXPlayer
	MusicPlayer

	// Data about World
	interactableObjects
	weaponPickups
	numCoverBoxes
	numVoxels
	timeModifier
	particleHandler
	backlight
	worldSphere
	defaultBacklightColor
	nextLevelURL
	isLevelComplete
	levelFinishedLoading
	isCameraShaking
	levelLights
	nextLevelText
	levelID
	explosives

	// Data aboutt Elevator
	elevatorText
	elevatorLoadingText
	elevatorDoorRight
	elevatorDoorLeft
	elevatorHasOpened

	// Data about Player
	playerHeight
	playerHealth
	playerCanMove
	hasKilledYet
	lastKiller
	controls
	deathCount
	timers

	// Data about Player Challenges
	hasBeenShot
	hasShotYet

	// Data about WorldBuilding
	globalTextureLoader
	globalModelLoader

	// Data about NPCs
	NPCBank
	totalNPCs
	killBlobs

	// Data about Weapons
	WEAPONHANDLER
	thrownWeaponBank

	constructor(scene, camera) {
		this.scene = scene;
		this.camera = camera;
		this.camera.nextEuler = new THREE.Euler(0, 0, 0, 'XYZ');
		this.renderer = new THREE.WebGLRenderer({ /* antialias: true */ });

		this.potentialCleanCalls = 0;

		this.SFXPlayer = new SoundEffectPlayer(USERSETTINGS);

		this.interactableObjects = [];
		this.weaponPickups = [];
		this.numCoverBoxes = 0;
		this.numVoxels = 0;
		this.timeModifier = 1;
		this.isLevelComplete = this.levelFinishedLoading = false;
		this.levelLights = [];
		this.explosives = [];
		
		this.playerHeight = 30;
		this.playerHealth = 100;
		this.playerCanMove = true;
		this.lastKiller = [];
		this.deathCount = 0;
		this.hasKilledYet = false;

		this.isCameraShaking = false;

		this.globalTextureLoader = new THREE.TextureLoader()
		this.globalModelLoader = new FBXLoader();

		this.NPCBank = [];
		this.totalNPCs = 0;
		this.totalKillableNPCs = 0;
		this.killBlobs =[];
		
		this.thrownWeaponBank = [];
		this.timers = [];

		this.hasBeenShot = false;
		this.hasShotYet = false;
	}

	clearGarbage() {
		this.thrownWeaponBank.forEach((thrownWeapon) => {
			this.scene.remove(thrownWeapon);
			thrownWeapon.children[0].material.dispose();
		});
	}

	addThrownWeapon(thrownWeapon) {
		this.scene.add(thrownWeapon);
		this.thrownWeaponBank.push(thrownWeapon);
	}

	registerExplosive(explosive) {
		const blocksToDestroy = [];
		const explosiveRadius = 35;
		for (let x = explosive.position.x - explosiveRadius; x < explosive.position.x + explosiveRadius; x++) {
			for (let y = explosive.position.y - explosiveRadius; y < explosive.position.y + explosiveRadius; y++) {
				for (let z = explosive.position.z - explosiveRadius; z < explosive.position.z + explosiveRadius; z++) {
					if (y < 3) continue;
					const block = voxelField.get(x, y, z);
					if (block != null) {
						if (x == explosive.position.x - explosiveRadius || x == explosive.position.x + explosiveRadius - 1 || y == explosive.position.y - explosiveRadius || y == explosive.position.y + explosiveRadius - 1 || z == explosive.position.z - explosiveRadius || z == explosive.position.z + explosiveRadius - 1)
						{
							if (rapidFloat() < 0.5) continue;
						}
						blocksToDestroy.push(block.position);
						voxelField.set(x,y,z, 2, block.indexInChunk, block.chunk);
					}
				}
			}
		}
		explosive.children[0].blocksToDestroy = blocksToDestroy;

		this.explosives.push(explosive);
	}

	freezeTimer() {
		this.timers.forEach(timer => clearInterval(timer));
		document.querySelector("#timer").classList.add("done");
	}

	initializeTimer() {
		this.freezeTimer();
		document.querySelector("#timer").classList.remove("done");
		const timerSeconds = document.querySelector("#timer-seconds");
		const timerCentiseconds = document.querySelector("#timer-centiseconds");
		timerSeconds.textContent = "0";
		timerCentiseconds.textContent = "00";
		// update seconds
		this.timers.push(setInterval(() => {
			if (this.playerHealth > 0) {
				timerSeconds.textContent = parseInt(timerSeconds.textContent) + 1;
			}
		}, 1000));
		// update centiseconds
		this.timers.push(setInterval(() => {
			if (this.playerHealth > 0) {
				timerCentiseconds.textContent = parseInt(timerCentiseconds.textContent) + 1;
				// if it is single-digit centiseconds, add a leading zero
				if (parseInt(timerCentiseconds.textContent) < 10) {
					timerCentiseconds.textContent = "0" + parseInt(timerCentiseconds.textContent);
				}
				if (parseInt(timerCentiseconds.textContent) > 99) {
					timerCentiseconds.textContent = "00";
				}
			}
		}, 10));
	}

	goToNextLevel() {
		this.SFXPlayer.playSound("endLevelSound", false);
		this.isCameraShaking = true;
		setTimeout(() => {this.isCameraShaking = false}, 150);
		USERSETTINGS.screenShakeIntensity /= 0.25;
		this.isLevelComplete = false;
		document.querySelector("#cover-flash").style.animation = "expand 0.75s";
		document.querySelector("#end-screen").style.display = document.querySelector("#ui-overlay").style.display = "none";
		setTimeout(() => {
			let target = "index.html?mapName=" + this.nextLevelURL;
			if (this.nextLevelURL.substring(0, 3) == "../") target = this.nextLevelURL;
			window.location.href = target;
		}, 500);
		this.renderer.domElement.style.animation = "shrink 0.75s ease-in-out forwards";
	}
}

export const instancedModelIndex = []; // index of raw voxel instances and cover boxes