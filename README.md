# NodeJS JPEG Stenography

### Hide your message or file into JPEG picture!
Fork of https://github.com/owencm/js-steg/

This library uses embedding in the least significant bits of the DCT

## Hide text message into picture

```
npm i jpeg-stenography
```

```javascript
//Encode
let input = await Stenography.openJPEG('input.jpg');
await (await input.encode('My Message')).saveToFile('output.jpeg');
	
//Decode
let output = await Stenography.openJPEG('output.jpeg');
let message = await output.decode(); //My Message
```

## Hide encrypted message into picture

```javascript
let key = 'My AES Key';

//Encode
let input = await Stenography.openJPEG('input.jpg');
await (await input.encodeWithKey(key, 'My Message')).saveToFile('output.jpeg');
	
//Decode
let output = await Stenography.openJPEG('output.jpeg');
let message = await output.decodeWithKey(key); //My message
```

## Hide file into picture

```javascript
//Encode
let input = await Stenography.openJPEG('input.jpg');
await (await input.encodeFile('data.zip')).saveToFile('output.jpeg');
	
//Decode
let output = await Stenography.openJPEG('output.jpeg');
await output.decodeFile('result.zip');
```

## Hide encrypted file into picture

```javascript
let key = 'My AES Key';

//Encode
let input = await Stenography.openJPEG('input.jpg');
await (await input.encodeFileWithKey(key, 'data.zip')).saveToFile('output.jpeg');
	
//Decode
let output = await Stenography.openJPEG('output.jpeg');
await output.decodeFileWithKey(key, 'result.zip'); 
```