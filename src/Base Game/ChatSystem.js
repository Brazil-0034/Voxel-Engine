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
                    "Welcome to the [EVIL CORP] department of Research and Development.",
                    "Sorry, but visitors are not allowed on this floor.",
                    "Please leave immediately.",
                    ". . .",
                    "I hate my job.",
                    ". . .",
                    "I'm so lonely."
                ]);
            }
            break;
        case "phone_call":
            speakerName.innerHTML = "[ANONYMOUS CALLER]";
            playChat([
                "Hey, listen.",
                "I know that you've been out of the game for a while.",
                "But we both know that \"real, honest work\" isn't enough to pay the bills.",
                "And besides, dog food prices are through the roof!!",
                ". . .",
                "I've got a new job for you.",
                "Remember those [Bikers] from the east side?",
                "They're holed up in the [Beachside Inn].",
                "I need you to take care of the problem.",
                ". . .",
                "And as usual,",
                "Leave [NO WITNESSES].",
                
                // "Listen up, Agent.",
                // "We have a job for you.",
                // "There are reports of [RUSSIAN SPIES] nearby.",
                // "They are cooped up in the [BEACHSIDE INN].",
                // "We need you to clear the building.",
                // "And as usual,",
                // "Leave [NO WITNESSES].",
                // ". . .",
                // "Good luck, Agent."
            ]);
            break;
        case "05":
            // if (playerIsNear(position, 9929, 9840)) {
            //     const endScreen = `
            //     <div id="fade-control">
            //         <div id="widebar-carrier">
            //             <div id="level-stats" style="margin-top:50px;">
            //                 <b id="next-level-text">Press [E] to Access Computer</b>
            //             </div>
            //         </div>
            //     </div>`
            //     document.querySelector("#end-screen").innerHTML = endScreen;
            // }
            // setInteractionText("Hold [SPACE] to Go to Bed");
            if (playerIsNear(position, 9926, 9843)) {
                setInteractionText("Press [F] to Access Computer");
            }
            if (playerIsNear(position, 10068, 9875)) {
                setInteractionText("Hold [SPACE] to Go to Bed");
            }

            break;
        case "07":
            if (playerIsNear(position, 10000, 9660)) {
                playChat([
                    "welcome to 24/7 dru-",
                    "Whoa!!! Haven't seen you in awhile.",
                    "You look like SHIT!!",
                    "Listen.",
                    "If you want some [slurrp juice],",
                    "the dudes in the room behind me?",
                    "they tryna STEAL it!!",
                    "Fix the problem and the [slurrp juice] is yours.",
                ]);
            }
            break;
        case "09":
            if (playerIsNear(position, 10000, 9885)) {
                playChat([
                    "Welcome to BUSINESS CORP!!",
                    "We are soo happy to see you here!",
                    "Everyone knows that BUSINESS CORP is all about love and friendship!",
                    "We hope you enjoy your visit!"
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