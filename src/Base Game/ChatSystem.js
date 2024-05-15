import * as THREE from 'three';
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
        if (LEVELHANDLER.SFXPlayer) LEVELHANDLER.SFXPlayer.playRandomSound("chatSounds", 1);
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
        if (levelID == "phone_call") window.location.href = "../Base Game/cutscene.html?videoSrc=intro_video&nextLevelURL=00_ROOM";
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
    if (levelID != "phone_call")
    {
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
    }
    switch (levelID) {
        default:
            break;
        case "phone_call":
            playChat([
                "*ahem*",
                "I heard you're back on the job market again.",
                "Sorry to hear that.",
                ". . .",
                "Bartender at a [night club] just called in.",
                "Seemed pretty nonchalant but,",
                "He told me the place was overrun with goons.",
                "If you want a quick buck tonight, I'll let you take care of this one.",
                "I'll send you the deets."
            ]);
            break;
        case "00":
            if (playerIsNear(position, 10000, 9852)) {
                // speakerName.innerHTML = "RECEPTIONIST";
                // playChat([
                //     "*ahem*",
                //     "Welcome to the [EVIL CORP] headquarters.",
                //     "You are currently in the department of business affairs.",
                //     "We hope you enjoy your visit."
                // ]);
                speakerName.innerHTML = "BARTENDER";
                playChat([
                    "*ahem*",
                    "I'm sorry. We're all out of drinks tonight.",
                    ". . .",
                    "Oh. You must be some kind of hired gun.",
                    "If you wanted a party, you should've arrived earlier.",
                    "There are many more of us than there are of you.",
                    "If you value your life,",
                    "I'm going to have to ask you to leave."
                ]);
            }
            break;
        case "07":
            if (playerIsNear(position, position.x, 9598)) {
                speakerName.innerHTML = "THUG LEADER";
                playChat([
                    ". . .",
                    "Impressive.",
                    "Who sent you?",
                    ". . .",
                    "Very well.",
                    "I suppose it doesn't matter now.",
                    "Do what you must."
                ]);
            }
            break;
        case "06":
            // if (playerIsNear(position, 9961, 9795)) {
            //     speakerName.innerHTML = "*DEVELOPER*";
            //     playChat([
            //         ". . .",
            //         "No, I'm not changing the animation for holding the revolver."
            //     ]);
            // }
            break;
        case "09":
            speakerName.innerHTML = "ALARMED SCIENTIST";
            if (playerIsNear(position, 10027, 9847)) {
                playChat([
                    ". . .",
                    "t - ",
                    "t - the aliens, they've ... ",
                    "THEY'VE ESCAPED CONTAINMENT!",
                    ". . . it's so over . . .",
                    "I'm so fired . . .",
                ])
            }
            break;
        case "10":
            speakerName.innerHTML = "<i style='color: lightgreen'>\"SCIENTIST\"</i>";
            if (playerIsNear(position, 10000, 9734)) {
                playChat([
                    "Gweeple Blork -",
                    "Squeeble beep borp -",
                    "I mean -",
                    "hello there, friend !!",
                    "Welcome to one of EVIL CORP's many [science labs] !!",
                    "We get lots of work done here, but it's mighty dangerous!",
                    "For this reason, I'm going to have to ask you to leave.",
                    " . . . ",
                    "Why am I so green, you ask?",
                    "Wha - how [DARE] you?!",
                    "ME, an [ALIEN]???",
                    "Now I REALLY need you to leave !!"
                ]);
            }

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

    }, 10);
}