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
        if (levelID == "phone_call") window.location.href = "../Base Game/cutscene.html?videoSrc=ezsleep&nextLevelURL=09_BUSINESS_CORP";
        npcChat.style.display = "none";
    }
}

export const checkChat = function(ID, position) {
    levelID = ID;
    npcChat.style.display = "none";
    switch (levelID) {
        default:
            break;
        case "XX":
            if (playerIsNear(position, 9999, 9972)) {
                playChat([
                    "Why did you kill those people?"
                ])
            }
            break;
        case "00":
            if (playerIsNear(position, 9970, 9900)) {
                playChat([
                    "Welcome to the Beachside Inn!",
                    "Unfortunately, we have no vacancies at this time.",
                    "Please do not disturb our guests.",
                ]);
            }
            break;
        case "13":
            if (playerIsNear(position, 10000, 9598)) {
                playChat([
                    "Impressive work.",
                    "I'm surprised you even made it this far.",
                    ".          .          .          ",
                    "I suppose this is where it ends for me",
                    ".          .          .          ",
                    "Do what you will."
                ]);
            }
            break;
        case "phone_call":
            playChat([
                "Excellent work at the [Beachside Inn].",
                "We are very proud of how far you have come.",
                "Listen. We've got one more big job for you.",
                "Perform well, and your training will be complete.",
                "That's right.",
                "You will become a special agent at the [CIA].",
                "Tonight's job will be at the [Business Corporation].",
                "We believe there are [Russian Agents] hiding there.",
                "You know what to do.",
                "Tonight."
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
            setInteractionText("Hold [SPACE] to Go to Bed");
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
                console.log(LEVELHANDLER.totalNPCs, LEVELHANDLER.NPCBank.length);
            }
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
        else if (chatBox.innerHTML != finalChat) chatBox.innerHTML = finalChat;

    }, 15);
}