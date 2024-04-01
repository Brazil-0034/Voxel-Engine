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
        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.isLeftClicking = true;
            } else if (e.button === 2) {
                this.isRightClicking = true;
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.isLeftClicking = false;
            } else if (e.button === 2) {
                this.isRightClicking = false;
            }
        });
    }

    isKeyPressed(key) {
        return this.activeKeys[key.toLowerCase()];
    }
    
}
