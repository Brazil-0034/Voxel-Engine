import { rapidFloat } from './EngineMath.js';

// This stores all loaded sfx and music, and offers a convenient place to grab them randomly (for SFX)
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

    USERSETTINGS

    constructor(USERSETTINGS) {
        this.USERSETTINGS = USERSETTINGS;

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
            new Howl({
                src: ['../music/ambient - ambient_waves.mp3'],
                volume: USERSETTINGS.musicVolume * 1,
                loop: true
            }),
            new Howl({
                src: ['../music/Baddon - Speed Sensor.ogg'],
                volume: USERSETTINGS.musicVolume * 1,
                loop: true
            }),
            new Howl({
                src: ['../music/Austin - Evil.ogg'],
                volume: USERSETTINGS.musicVolume * 1,
                loop: true
            })
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
        this.isPlayingShootSound = false;

    }

    startMusicPlayback(index) {
        if (index > -1) this.music[index].play();
    }

    SelectMusicID(LevelID) {
        switch (LevelID) {
            case "00":
                return 2;
            case "01":
                return 1;
            case "02":
                return 2;
            default:
                console.error("No music assigned to level", LevelID);
                return -1;
        }
    }
    
    playRandomSound(soundArray, rate) {
        let soundToPlay = this[soundArray][Math.floor(Math.random() * this[soundArray].length)];
        soundToPlay.rate(rate ? rate : rapidFloat() + 0.45);
        soundToPlay.play();
    }

    playSound(soundEffect, randomizeRate=true) {
        let soundToPlay = this[soundEffect];
        if (randomizeRate) soundToPlay.rate(rapidFloat() + 0.45);
        soundToPlay.play();
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