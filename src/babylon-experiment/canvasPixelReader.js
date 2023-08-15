/**
 * The CanvasPixelReader class is a simple utility to load images into arrays of pixels without relying on native web image API's.
 * NOTE: After switching to Babylon.js, there are many internal API's that can accomplish this (such as Texture#readPixelData()). However, the structuring for this generator is already completely functional for babylon (originally from THREE.js which had no such functionality) and is not worth refactoring for these new API's. In addition, load times are not significantly faster with the Babylon API's and I would rather just not fix something that isn't broken. Especially because this data is just dumped after the initial voxel construction anyway. dont @ me.
 * @param {string} imageURL - The URL of the image to be load.
 */

const getPixelsFromImage = async function(imageURL) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', {
        willReadfrequently: true
    });
    const pixels = [];

    const image = new Image();
    image.src = imageURL;

    
    return new Promise((resolve) => {
        const listener = () => {
            image.removeEventListener("load", listener)
            canvas.width = image.width;
            canvas.height = image.height;
            context.drawImage(image, 0, 0);
            for (let x = 0; x < canvas.width; x++) {
                pixels[x] = [];
                for (let y = 0; y < canvas.height; y++) {
                    pixels[x][y] = context.getImageData(x, y, 1, 1).data;
                }
            }
            resolve(pixels);
        }
        image.addEventListener("load", listener)
    })
}