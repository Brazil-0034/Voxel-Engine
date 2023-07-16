const getPixelsFromImage = function(image) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', {
        willReadfrequently: true
    });
    const pixels = [];
    
    canvas.width = image.width;
    canvas.height = image.height;
    context.drawImage(image, 0, 0);
    for (let x = 0; x < canvas.width; x++) {
        pixels[x] = [];
        for (let y = 0; y < canvas.height; y++) {
            pixels[x][y] = context.getImageData(x, y, 1, 1).data;
        }
    }
    return pixels;
}