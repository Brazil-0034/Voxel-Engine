import { rapidFloat } from './EngineMath.js';

// This stores all loaded sfx and music, and offers a convenient place to grab them randomly (for SFX)
let musicIndex;
export class SoundEffectPlayer {
    dropSounds
    bigDropSounds
    hitSound
    killSounds
    music
    shootSound
    chatSounds
    dingSound
    elevatorShakeSound
    isPlayingShootSound
    isPlayingNPCShootSound
    musicEnergy

    USERSETTINGS

    constructor(USERSETTINGS) {
        this.USERSETTINGS = USERSETTINGS;
        this.musicEnergy = 'low';

        this.dropSounds = [
            new Howl({
                src: ['../sfx/lego_drop.wav'],
                volume: USERSETTINGS.SFXVolume * 7
            }),
            new Howl({
                src: ['../sfx/lego_drop_2.wav'],
                volume: USERSETTINGS.SFXVolume * 10
            })
        ]

        this.bigDropSounds = [
            new Howl({
                src: ['../sfx/big_drop.wav'],
            })
        ]

        // replace with loader from weaponhandler later ...
        this.hitSound = new Howl({
            src: ['../sfx/hit_ding.wav'],
            volume: USERSETTINGS.SFXVolume
        })
        this.rustleSound = new Howl({
            src: ['../sfx/rustle.mp3'],
            volume: USERSETTINGS.SFXVolume * 20
        })
        this.levelClearSound = new Howl({
            src: ['../sfx/level_clear.mp3'],
            volume: USERSETTINGS.SFXVolume * 20,
        })
        this.startLevelSound = new Howl({
            src: ['../sfx/start_level.mp3'],
            volume: USERSETTINGS.SFXVolume * 30,
        })
        this.endLevelSound = new Howl({
            src: ['../sfx/end_level.mp3'],
            volume: USERSETTINGS.SFXVolume * 35,
        })

        this.chatSounds = [
            new Howl({
                src: ['../sfx/keeb_1.ogg'],
                volume: USERSETTINGS.SFXVolume * 10
            }),
            new Howl({
                src: ['../sfx/keeb_2.ogg'],
                volume: USERSETTINGS.SFXVolume * 10
            }),
            new Howl({
                src: ['../sfx/keeb_3.ogg'],
                volume: USERSETTINGS.SFXVolume * 10
            }),
            new Howl({
                src: ['../sfx/keeb_4.ogg'],
                volume: USERSETTINGS.SFXVolume * 10
            }),
        ]

        this.killSounds = [
            new Howl({
                src: ['../sfx/kill_ding.wav'],
                volume: USERSETTINGS.SFXVolume * 10
            })
        ]

        this.music = [
            // #0 - nukem
            [
                new Howl({
                    src: ['../music/Nukem/lowenergy.ogg'],
                    volume: USERSETTINGS.musicVolume * 1,
                    loop: true
                }),
                new Howl({
                    src: ['../music/Nukem/highenergy.ogg'],
                    volume: USERSETTINGS.musicVolume * 1,
                    loop: true
                })
            ],
            
            // #1 - speed sensor
            [
                new Howl({
                    src: ['../music/Speed Sensor/lowenergy.ogg'],
                    volume: USERSETTINGS.musicVolume * 1,
                    loop: true
                }),
                new Howl({
                    src: ['../music/Speed Sensor/highenergy.ogg'],
                    volume: USERSETTINGS.musicVolume * 1,
                    loop: true
                })
            ],
            
            // #2 - dark energy
            [
                new Howl({
                    src: ['../music/Dark Energy/lowenergy.ogg'],
                    volume: USERSETTINGS.musicVolume * 1,
                    loop: true
                }),
                new Howl({
                    src: ['../music/Dark Energy/highenergy.ogg'],
                    volume: USERSETTINGS.musicVolume * 1,
                    loop: true
                })
            ],
            
            // #3 - ambient waves
            [
                new Howl({
                    src: ['../music/ambient - ambient_waves.mp3'],
                    volume: USERSETTINGS.musicVolume * 1,
                    loop: true
                }),
                new Howl({
                    src: ['../music/ambient - ambient_waves.mp3'],
                    volume: USERSETTINGS.musicVolume * 1,
                    loop: true
                })
            ],

            // #4 - Primal
            [
                new Howl({
                    src: ['../music/Primal/lowenergy.ogg'],
                    volume: USERSETTINGS.musicVolume * 1,
                    loop: true
                }),
                new Howl({
                    src: ['../music/Primal/highenergy.ogg'],
                    volume: USERSETTINGS.musicVolume * 1,
                    loop: true
                })
            ],
        ]

        this.dingSound = new Howl({
            src: ['../sfx/ding.wav'],
            volume: USERSETTINGS.SFXVolume * 10
        });

        this.elevatorShakeSound = new Howl({
            src: ['../sfx/elevator.wav'],
            volume: USERSETTINGS.SFXVolume * 10
        });

        this.shootSound = new Howl({
            src: ['../sfx/heavy_shoot.ogg'],
            volume: USERSETTINGS.SFXVolume * 10,
            loop: true
        });

        this.npcShootSound = new Howl({
            src: ['../sfx/heavy_shoot.ogg'],
            volume: USERSETTINGS.SFXVolume * 10
        });

        this.blastSound = new Howl({
            src: ['../sfx/blast.wav'],
            volume: USERSETTINGS.SFXVolume * 7.5
        });

        this.isPlayingShootSound = this.isPlayingNPCShootSound = false;

    }

    startMusicPlayback(index, energy='low') {
        musicIndex = index;
        if (index > -1) {
            if (energy == 'low') this.music[index][0].play();
            if (energy == 'high') this.music[index][1].play();
        }
    }

    stopMusicPlayback() {
        if (musicIndex > -1) {
            this.music[musicIndex][0].stop();
            this.music[musicIndex][1].stop();
        }
    }

    shiftEnergy(energy) {
        // if the sound does not exist / not yet loaded ...
        if (!this.music[musicIndex] || !this.music[musicIndex][0] || !this.music[musicIndex][1]) return
        // if the energy is the same ...
        if (energy == this.musicEnergy) return
        // if the music index has only one energy level ...
        if (musicIndex == 1) return
        console.log("Shifting music energy to:", energy, "from", this.musicEnergy);
        if (energy == 'high') {
            this.musicEnergy = 'high';
            this.music[musicIndex][0].stop();
            this.music[musicIndex][1].play();
        }
        if (energy == 'low') {
            this.musicEnergy = 'low';
            this.music[musicIndex][1].stop();
            this.music[musicIndex][0].play();
        }
    }

    SelectMusicID(LevelID) {
        switch (LevelID) {
            case "00":
                return 0;
            case "01":
                return 1;
            case "02":
                return 4;
            case "03":
                return 4;
            case "04":
                return 1;
            case "06":
                return 1;
            case "07":
                return -1;
            default:
                return 3;
                console.error("No music assigned to level", LevelID);
        }
    }
    
    playRandomSound(soundArray, rate) {
        let soundToPlay = this[soundArray][Math.floor(Math.random() * this[soundArray].length)];
        soundToPlay.rate(rate ? rate : rapidFloat() + 0.45);
        soundToPlay.play();
    }

    playSound(soundEffect, randomizeRate=true, randomizeRange=0.45) {
        let soundToPlay = this[soundEffect];
        if (randomizeRate) soundToPlay.rate(rapidFloat() + randomizeRange);
        soundToPlay.play();
    }

    setNPCSoundPlaying(soundEffect, bool) {
        if (bool == false) {
            this[soundEffect].stop();
            this.isPlayingNPCShootSound = bool;
        }
        else
        {
            if (this.isPlayingNPCShootSound == false) {
                console.log("Playing Npcshoot", this.isPlayingNPCShootSound);
                this[soundEffect].play();
                this.isPlayingNPCShootSound = bool;
            }
        }
    }

    setSoundPlaying(soundEffect, bool) {
        if (bool == false) {
            this[soundEffect].stop();
            this.isPlayingShootSound = bool;
        }
        else
        {
            if (this.isPlayingShootSound == false) {
                this[soundEffect].play();
                this.isPlayingShootSound = bool;
            }
        }
    }
}