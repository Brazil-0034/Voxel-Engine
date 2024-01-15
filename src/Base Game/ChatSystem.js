import * as THREE from 'three';

const chatBox = document.querySelector("#npc-text");
let chatIndex = 0;
let canIncrementChatIndex = true;
let chatTarget = "";
let chatTargetIndex = 0;
let levelID;

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
        if (levelID == "phone_call") window.location.href = "index.html?mapName=05_BEDROOM";
        npcChat.style.display = "none";
    }
}

export const checkChat = function(ID, position) {
    levelID = ID;
    npcChat.style.display = "none";
    switch (levelID) {
        default:
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
        case "phone_call":
            playChat([
                "Listen. We got another job for you.",
                "I know it's been awhile.",
                "This one's easy. Be at the Beachside Inn.",
                "You know what to do.",
                "Tonight."
            ]);
            break;
        case "05":
            if (playerIsNear(position, 9929, 9840)) {
                const endScreen = `
                <div id="fade-control">
                    <div id="widebar-carrier">
                        <div id="level-stats" style="margin-top:50px;">
                            <b id="next-level-text">Press [E] to Access Computer</b>
                        </div>
                    </div>
                </div>`
                document.querySelector("#end-screen").innerHTML = endScreen;
            }
            else {
                const endScreen = `
                <div id="fade-control">
                    <div id="widebar-carrier">
                        <div id="level-stats" style="margin-top:50px;">
                            <b id="next-level-text">Hold [SPACE] to Go to Bed</b>
                        </div>
                    </div>
                </div>`
                document.querySelector("#end-screen").innerHTML = endScreen;
            }
            break;
        case "08":
            if (playerIsNear(position, 10000, 9660)) {
                playChat([
                    "welcome to foodmans-",
                    "Whoa!!! Haven't seen you in awhile.",
                    "You look like SHIT!!",
                    "Listen. If you want the [slurrp juice],",
                    "There's dudes in the room behind me tryna steal my shit.",
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

export const startChatScan = function() {
    const boldOpen = `<b style="animation: funky-text 2.5s infinite">`;
    let n;
    n = setInterval(() => {
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