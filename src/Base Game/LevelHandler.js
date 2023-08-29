import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
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
	// DISPLAY SETTINGS
	baseFOV: 60,
    // AUDIO SETTINGS
    SFXVolume: 0.05
}

// Data relevent to the game's currently loaded level
export class LevelHandler {
	// Data about Renderer
	scene
	camera
	renderer
	potentialCleanCalls

	// Data about Audio
	SFXPlayer
	MusicPlayer

	// Data about World
	interactableObjects
	numCoverBoxes
	numVoxels
	timeModifier
	particleHandler

	// Data about Player
	playerHeight

	// Data about WorldBuilding
	globalTextureLoader
	globalModelLoader

	// Data about NPCs
	NPCBank

	// Data about Weapons
	WEAPONHANDLER
	thrownWeaponBank

	constructor(scene, camera) {
		this.scene = scene;
		this.camera = camera;
		this.renderer = new THREE.WebGLRenderer({ /* antialias: true */ });

		this.potentialCleanCalls = 0;

		this.SFXPlayer = new SoundEffectPlayer(USERSETTINGS);

		this.interactableObjects = [];
		this.numCoverBoxes = 0;
		this.numVoxels = 0;
		this.timeModifier = 1;
		
		this.playerHeight = 40;

		this.globalTextureLoader = new THREE.TextureLoader()
		this.globalModelLoader = new FBXLoader();

		this.NPCBank = [];
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
}