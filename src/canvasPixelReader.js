const getPixelsFromImage = function(imageURL, x, y) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const pixels = [];
    const image = new Image();
    image.src = imageURL;
    image.onload = function() {
        canvas.width = image.width;
        canvas.height = image.height;
        context.drawImage(image, 0, 0);
        for (let x = 0; x < canvas.width; x++) {
            pixels[x] = [];
            for (let y = 0; y < canvas.height; y++) {
                pixels[x][y] = context.getImageData(x, y, 1, 1).data;
            }
        }
    }
}