// Sets the help text on the bottom center of the player's screen
export const setHelpText = (text) => { document.querySelector("#help-text").innerHTML = text }

// Sets the middle-screen text for when the player is interacting with something
export const getInteractionText = function() {
    return document.querySelector("#interaction-text").innerHTML;
}
export const setInteractionText = (text) => {
	const itext = document.querySelector("#interaction-text");
    itext.innerHTML = text;
	itext.style.opacity = 1;
}