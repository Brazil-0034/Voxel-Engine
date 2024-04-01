import * as THREE from 'three';
import { setInteractionText } from './UIHandler.js'; // User Interface
import { USERSETTINGS } from './LevelHandler.js';

const chatBox = document.querySelector("#npc-text");
const speakerName = document.querySelector("#npc-speaker");
let chatIndex = 0;
let canIncrementChatIndex = true;
let chatTarget = "";
let chatTargetIndex = 0;
let levelID;
let LEVELHANDLER, INPUTHANDLER;

export const incrementChatIndex = function() {
    if (canIncrementChatIndex) {
        chatTargetIndex = 0;
        chatIndex++;
        canIncrementChatIndex = false;
        setTimeout(() => {
            canIncrementChatIndex = true;
        }, 250);
        LEVELHANDLER.SFXPlayer.playRandomSound("chatSounds", 1);
    }
}

export const resetChatIndex = () => { chatIndex = 0; chatTargetIndex = 0; chatBox.innerHTML = ""; chatTarget = ""; }

const playerIsNear = function(position, x, z) {
    return position.distanceTo(new THREE.Vector3(x, 30, z)) < 50
}

const npcChat = document.querySelector("#npc-chat");
const playChat = function(chat) {
    // chat.unshift(". . .");
    npcChat.style.display = "block";
    if (chat[chatIndex])
    {
        chatTarget = chat[chatIndex];
    }
    else {
        if (levelID == "phone_call") window.location.href = "../Base Game/cutscene.html?videoSrc=intro_video&nextLevelURL=00_INN_LOBBY";
        npcChat.style.display = "none";
        if (LEVELHANDLER.levelID == "00" && LEVELHANDLER.assistObj.hasBeenActivated == false) {
            LEVELHANDLER.assistObj.visible = true;
            let n;
            n = setInterval(() => {
                if (LEVELHANDLER.assistObj.position.y < 45) {
                    if (LEVELHANDLER.assistObj.material.opacity < 1) LEVELHANDLER.assistObj.material.opacity += 0.1;
                    LEVELHANDLER.assistObj.position.lerp(new THREE.Vector3(LEVELHANDLER.assistObj.position.x, 45, LEVELHANDLER.assistObj.position.z), 0.1);
                }
                else clearInterval(n);
            }, 5)
            LEVELHANDLER.assistObj.hasBeenActivated = true;
        }
    }
}

export const checkChat = function(ID, position) {
    levelID = ID;
    npcChat.style.display = "none";
    // end level condition
    if (LEVELHANDLER.isLevelComplete) {
        if (USERSETTINGS.useQuickReturn == true) {
            const nextLevelText = document.querySelector("#next-level-text");
            if (nextLevelText) {
                nextLevelText.innerHTML = "Hold [SPACE] to Continue";
                if (INPUTHANDLER.isKeyPressed(' ')) {
                    LEVELHANDLER.goToNextLevel();
                }
            }
        }
        else
        {
            const nextLevelText = document.querySelector("#next-level-text");
            if (nextLevelText) {
                nextLevelText.innerHTML = "Return to the Elevator";
                if (playerIsNear(position, 10000, 10000)) {
                    nextLevelText.innerHTML = "Hold [SPACE] to Continue";
                    if (INPUTHANDLER.isKeyPressed(' ')) {
                        LEVELHANDLER.goToNextLevel();
                    }
                }
            }
        }
    }
    switch (levelID) {
        default:
            break;
        case "00":
            if (playerIsNear(position, 10000, 9830)) {
                speakerName.innerHTML = "RECEPTIONIST";
                playChat([
                    "*ahem*",
                    "Welcome to the [EVIL CORP] headquarters.",
                    "We hope you enjoy your visit."
                ]);
            }
            break;
        case "05":
            if (playerIsNear(position, position.x, 9598)) {
                speakerName.innerHTML = "MANAGER";
                playChat([
                    // ". . .",
                    // "You've thrown a real wrench into our plans.",
                    // "Who sent you?",
                    // ". . .",
                    // "Very well.",
                    // "Do what you must."
                    ". . .",
                    "Impressive.",
                    "Nobody's ever gotten this far.",
                    ". . .",
                    "You've still got a long way to go.",
                    ". . .",
                    "But it doesn't matter.",
                    "Do what you must."
                ]);
            }
            break;
        case "06":
            if (playerIsNear(position, 10000, 9717)) {
                speakerName.innerHTML = "SCIENTIST";
                playChat([
                    "Welcome to the [EVIL CORP] department of Research and Science.",
                    "Sorry, but visitors are not allowed on this floor.",
                    "Please leave immediately.",
                    ". . .",
                    "I hate my job.",
                    ". . .",
                    "I'm so lonely."
                ]);
            }
            break;
        case "09":
            speakerName.innerHTML = "ALARMED SCIENTIST";
            if (playerIsNear(position, 10027, 9847)) {
                playChat([
                    ". . .",
                    "t - ",
                    "t - they've ...",
                    "THEY'VE ESCAPED!",
                    ". . . it's so over . . .",
                    "I'm so fired . . .",
                ])
            }
            break;
    }
}

export const startChatScan = function(LevelHandler, InputHandler) {
    LEVELHANDLER = LevelHandler;
    INPUTHANDLER = InputHandler;
    const boldOpen = `<b style="animation: funky-text 2.5s infinite">`;
    let n;
    n = setInterval(() => {
        if (LEVELHANDLER) {
            if (LEVELHANDLER.totalNPCs < LEVELHANDLER.NPCBank.length) {
                npcChat.style.opacity = 0;
            }
            else npcChat.style.opacity = 1;
        }
        else npcChat.style.opacity = 1;

        const finalChat = chatTarget.replace("[", boldOpen).replace("]", `</b>`);

        if (chatTargetIndex < chatTarget.length) {
            chatBox.innerHTML = "";
            for (let i = 0; i < chatTargetIndex; i++) {
                if (chatTarget[i] == "[") chatBox.innerHTML += boldOpen;
                else if (chatTarget[i] == "]") chatBox.innerHTML += `</b>`;
                else chatBox.innerHTML += chatTarget[i];
            }
            chatTargetIndex++;
        }
        else chatBox.innerHTML = finalChat;

    }, 15);
}