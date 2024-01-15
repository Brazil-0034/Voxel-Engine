import * as THREE from 'three';
import { voxelField } from './VoxelStructures.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { rapidFloat } from './EngineMath.js'; // math functions
import { SoundEffectPlayer } from './AudioLibrary.js'; // SFX and Music

// Data relevant to the user's graphics and gameplay settings
export const USERSETTINGS = {
	// LEVEL / DEBUG SETTINGS
	debugMode: false,
	blockoutMode: false,
	disableCollisions: false,
	// GRAPHICS SETTINGS
	useSpriteParticles: true,
	particleQualityMode: 3, // 1 -> 3, the number gets multiplied by 100 for the # of particles
	disablePostProcessing: false,
	// ACCESSIBILITY
	screenShakeIntensity: 50,
	// DISPLAY SETTINGS
	baseFOV: 80,
    // AUDIO SETTINGS
    SFXVolume: 5 / 100,
	musicVolume: 5,
}

// Data relevent to the game's currently loaded level
export class LevelHandler {
	// Data about Renderer
	scene
	camera
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
	defaultBacklightColor
	nextLevelURL
	isLevelComplete
	levelFinishedLoading
	isCameraShaking
	levelLights
	nextLevelText
	levelID
	explosives

	// Data about Player
	playerHeight
	playerHealth
	playerCanMove
	lastKiller
	controls
	deathCount

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

		this.isCameraShaking = false;

		this.globalTextureLoader = new THREE.TextureLoader()
		this.globalModelLoader = new FBXLoader();

		this.NPCBank = [];
		this.totalNPCs = 0;
		this.killBlobs =[];
		
		this.thrownWeaponBank = [];
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
}

export const instancedModelIndex = []; // index of raw voxel instances and cover boxes