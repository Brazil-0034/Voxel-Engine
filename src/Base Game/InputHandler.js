// ##########
// DOM INPUT HANDLING
// ##########

export class InputHandler {
    activeKeys
    isCapsLockPressed
    
    isRightClicking
    isLeftClicking

    constructor() {
        this.activeKeys = {};
        this.isCapsLockPressed = false;

        // Key Presses:
        document.addEventListener('keydown', (e) => {
            this.activeKeys[e.key.toLowerCase()] = true;
        });
        document.addEventListener('keyup', (e) => {
            this.activeKeys[e.key.toLowerCase()] = false;
            if (e.key.toLowerCase() === 'capslock') {
                isCapsLockPressed = !isCapsLockPressed;
            }
            if (e.key == 'KeyT') {
                let vizbox = document.querySelector("#vizbox");
                if (vizbox.style.display == "none") vizbox.style.display = "block";
                else vizbox.style.display = "none";
            }
        });

        // Mouse Buttons:
        this.isLeftClicking = false;
        document.addEventListener('mousedown', (e) => { if (e.button != 0) return; this.isLeftClicking = true; });
        document.addEventListener('mouseup', (e) => { if (e.button != 0) return; this.isLeftClicking = false; });
        this.isRightClicking = false;
        document.addEventListener('mousedown', (e) => { if (e.button != 2) return; this.isRightClicking = true; });
        document.addEventListener('mouseup', (e) => { if (e.button != 2) return; this.isRightClicking = false; });
    }

    isKeyPressed(key) {
        return this.activeKeys[key];
    }
    
}