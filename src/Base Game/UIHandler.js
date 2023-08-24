// Sets the help text on the bottom center of the player's screen
export const setHelpText = (text) => { document.querySelector("#help-text").innerHTML = text }

// Sets the middle-screen text for when the player is interacting with something
export const getInteractionText = function() {
    return document.querySelector("#interaction-text").innerHTML;
}
export const setInteractionText = (text) => {
    const interactionText = document.querySelector("#interaction-text");
	if (document.querySelector("#popup-window").style.display == "block") {
		interactionText.style.display = "none";
		setHelpText("Press [F] to Close")
	}
	else interactionText.style.display = "block";

	interactionText.innerHTML = "Press [F]: " + text;
	if (text == "") {
		interactionText.classList.remove("fade-in");
		interactionText.style.opacity = 0;
	}
	else {
		interactionText.classList.add("fade-in");
	}
}