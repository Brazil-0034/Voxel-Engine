import * as THREE from 'three';
import { setInteractionText } from './UIHandler.js'; // User Interface

const chatBox = document.querySelector("#npc-text");
let chatIndex = 0;
let canIncrementChatIndex = true;
let chatTarget = "";
let chatTargetIndex = 0;
let levelID;
let LEVELHANDLER;

export const incrementChatIndex = function() {
    if (canIncrementChatIndex) {
        chatTargetIndex = 0;
        chatIndex++;
        canIncrementChatIndex = false;
        setTimeout(() => {
            canIncrementChatIndex = true;
        }, 250);
    }
}

export const resetChatIndex = () => { chatIndex = 0; chatTargetIndex = 0; chatBox.innerHTML = ""; chatTarget = ""; }

const playerIsNear = function(position, x, z) {
    return position.distanceTo(new THREE.Vector3(x, 30, z)) < 50
}

const npcChat = document.querySelector("#npc-chat");
const playChat = function(chat) {
    npcChat.style.display = "block";
    if (chat[chatIndex])
    {
        chatTarget = chat[chatIndex];
    }
    else {
        if (levelID == "phone_call") window.location.href = "../Base Game/cutscene.html?videoSrc=intro_video&nextLevelURL=00_INN_LOBBY";
        npcChat.style.display = "none";
    }
}

export const checkChat = function(ID, position) {
    levelID = ID;
    npcChat.style.display = "none";
    switch (levelID) {
        default:
            break;
        case "TE":
            // front desk convo
            if (playerIsNear(position, 9887, 9617)) {
                playChat([
                    // at motel
                    "Thank you for visiting the [Uptown Motel]!",
                    "We have one room available.",
                    ". . .",
                    "Alright, you're all set.",
                    "You'll be in [Room 3].",
                    "Please enjoy your stay!"
                ]);
            }
            // cop convo
            if (playerIsNear(position, 10100, 9620)) {
                playChat([
                    ". . .",
                    "These break-ins are getting out of hand",
                    "If only the mayor would do something about it.",
                    ". . .",
                ]);
            }
            break;
        case "00":
            // if (playerIsNear(position, 9970, 9900)) {
            //     playChat([
            //         "Welcome to the Beachside Inn!",
            //         "Unfortunately, we have no vacancies at this time.",
            //         "Please do not disturb our guests.",
            //     ]);
            // }
            break;
        case "04":
            if (playerIsNear(position, 10000, 9598)) {
                playChat([
                    ". . .",
                    "You've thrown a real wrench into our plans.",
                    "Who sent you?",
                    ". . .",
                    "Very well.",
                    "Do what you must."
                ]);
            }
            break;
        case "phone_call":
            playChat([
                "Hey, listen.",
                "I know that you've been out of the game for a while.",
                "But we both know that \"real, honest work\" isn't enough to pay the bills.",
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

export const startChatScan = function(LevelHandler) {
    LEVELHANDLER = LevelHandler;
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