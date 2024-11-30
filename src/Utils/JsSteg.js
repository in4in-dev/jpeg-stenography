const {loadImage, createCanvas} = require("canvas");
let JpegImage = require('./jsStegDecoder').JpegImage;
let JPEGEncoder = require('./jsStegEncoder').JPEGEncoder;

/**
 * jsSteg Javascript Library v1.0
 * https://github.com/owencm/js-steg
 * Copyright 2014, Owen Campbell-Moore and other contributors
 * Released under the MIT license
 *
 * Usage:
 * jsSteg provides two public functions, getCoefficients and reEncodeWithModifications.
 * Refer to their documentation below to understand their usage.
 *
 * Note:
 * This library depends on jsstegdecoder-1.0.js and jsstegencoder-1.0.js which have different
 * licences and must be included before this library.
 */
var jsSteg = (function() {
	/**
	 * Use the JPEG decoding library and pass on the coefficients to coeffReader
	 * - url: the blob URL from which to read the image
	 * - coeffReader: a function which will be called with the coefficients as an argument
	 */
	var getCoefficients = function(url, coeffReader) {
		var image;
		image = new JpegImage();
		image.onload = function(coefficients) {
			return coeffReader(coefficients);
		};
		return image.load(url, true);
	};

	/**
	 * Convert an image in any format to bmp data for encoding
	 * - url: the blob URL to convert to bmp
	 * - callback: called with the resulting data
	 */
	function blobToBuffer(blob) {
		return blob.arrayBuffer().then((arrayBuffer) => Buffer.from(arrayBuffer));
	}

	var getImageDataFromURL = function (url, callback) {

		blobToBuffer(url)
		.then((buffer) => loadImage(buffer))
		.then((img) => {
			const canvas = createCanvas(img.width, img.height);
			const ctx = canvas.getContext('2d');
			ctx.drawImage(img, 0, 0);

			const imageData = ctx.getImageData(0, 0, img.width, img.height);
			callback(imageData);
		})
		.catch((err) => {
			console.error('Ошибка обработки Blob изображения:', err);
		});
	};

	/**
	 * Decode the provided JPEG to raw data and then re-encode it with the JPEG encoding library,
	 * running coefficientModifier on the coefficients while encoding
	 * - url: the blob URL from which to 're-encode'
	 * - coefficientModifier: this will be called with the coefficients as an argument which it can
	 * modify before the encoding is completed
	 */
	var reEncodeWithModifications = function(url, coefficientModifier, callback) {
		getImageDataFromURL(url, function(data) {
			var encoder = new JPEGEncoder();
			var jpegURI = encoder.encodeAndModifyCoefficients(data, 75, coefficientModifier);
			callback(jpegURI);
		});
	}

	return {
		getCoefficients: getCoefficients,
		reEncodeWithModifications: reEncodeWithModifications
	};
})();

module.exports = jsSteg;