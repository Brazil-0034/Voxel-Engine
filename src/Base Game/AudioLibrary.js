import { rapidFloat } from './EngineMath.js';

// This stores all loaded sfx and music, and offers a convenient place to grab them randomly (for SFX)
export class SoundEffectPlayer {
    dropSounds
    bigDropSounds
    hitSound
    killSounds
    shootSound
    isPlayingShootSound

    USERSETTINGS

    constructor(USERSETTINGS) {
        this.USERSETTINGS = USERSETTINGS;

        this.dropSounds = [
            new Howl({
                src: ['../sfx/lego_drop.wav'],
                volume: USERSETTINGS.SFXVolume
            }),
            new Howl({
                src: ['../sfx/lego_drop_2.wav'],
                volume: USERSETTINGS.SFXVolume * 3
            }),
            new Howl({
                src: ['../sfx/lego_drop_3.wav'],
                volume: USERSETTINGS.SFXVolume
            }),
            new Howl({
                src: ['../sfx/lego_drop_4.wav'],
                volume: USERSETTINGS.SFXVolume
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
        this.killSounds = [
            new Howl({
                src: ['../sfx/kill_ding.wav'],
                volume: USERSETTINGS.SFXVolume * 15.5
            }),
            new Howl({
                src: ['../sfx/kill_ding_2.wav'],
                volume: USERSETTINGS.SFXVolume * 15.5
            }),
            new Howl({
                src: ['../sfx/kill_ding_3.wav'],
                volume: USERSETTINGS.SFXVolume * 15.5
            })
        ]

        this.shootSound = new Howl({
            src: ['../sfx/heavy_shoot.ogg'],
            volume: USERSETTINGS.SFXVolume * 2,
            loop: true
        });
        this.isPlayingShootSound = false;

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