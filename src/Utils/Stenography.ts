import fs from 'node:fs';
import crypto from 'node:crypto';
import { gzipSync, gunzipSync } from 'zlib';

let jsSteg = require('./JsSteg');

export default class Stenography
{

	public blob : Blob;

	public constructor(blob : Blob) {
		this.blob = blob;
	}

	protected hashData(binaryData : Buffer) : Buffer
	{
		return crypto.createHash('sha256').update(binaryData).digest();
	}

	protected deriveAESKey(key : string) : Buffer
	{
		return crypto.createHash('sha256').update(key).digest();
	}

	protected canUseMatrixElement(j : number) : boolean
	{

		let x = (j % 8), y = Math.floor(j / 8);

		return (y <= 2 && x <= 3);

	}

	protected unmask(blocks : number[][]) : Buffer
	{

		let bytes = [];
		let dataBitIndex = 0;
		let currentByte = 0;

		for (let i = 0; i < blocks.length; i++) {
			for (let j = 0; j < 64; j++) {

				if(!this.canUseMatrixElement(j)){
					continue;
				}

				let bit = blocks[i][j] & 1;

				currentByte = (currentByte << 1) | bit;
				dataBitIndex++;

				if (dataBitIndex % 8 === 0) {
					bytes.push(currentByte);
					currentByte = 0;
				}

			}
		}

		return Buffer.from(bytes);

	}

	protected mask(blocks : number[][], data : Buffer) : void
	{

		//blocks //64 элемента матрицы DCT

		let bitIndex = 0;

		for (let i = 0; i < blocks.length; i++) {
			for (let j = 0; j < 64; j++) {

				//Берем только средние частоты
				if(!this.canUseMatrixElement(j)){
					continue;
				}

				let bit = (bitIndex < data.length * 8)
					? (data[Math.floor(bitIndex / 8)] >> (7 - (bitIndex % 8))) & 1
					: crypto.randomInt(2);

				//Меняем последний бит
				blocks[i][j] = (blocks[i][j] & ~1) | bit;

				bitIndex++;

			}
		}

		if(bitIndex < data.length * 8){
			throw new Error('Message too long');
		}

	}




	protected async readDCHData() : Promise<Buffer>
	{

		return new Promise((resolve, reject) => {

			jsSteg.getCoefficients(this.blob, (coefficients : number[][][]) => {

				let blocks = coefficients[1];

				if(blocks.length < 5){
					return reject('Cant decode this picture');
				}

				let meta = this.unmask(
					blocks.slice(0, 25)
				);

				let length = meta.readUInt32BE();
				let hash = meta.slice(4, 36);

				let data = this.unmask(
					blocks.slice(0, 20 + length)
				).slice(36, 36 + length);

				if(!this.hashData(data).equals(hash)){
					throw new Error('Cant decode this container');
				}

				resolve(data);

			});

		});


	}

	/**
	 * Открыть существующий файл
	 */
	public static async openJPEG(path : string) : Promise<Stenography>
	{

		let data = fs.readFileSync(path);
		const blob = new Blob([data]);

		return new Stenography(blob);

	}

	/**
	 * Раскодировать изображение
	 */
	public async decode(binary : boolean = false) : Promise<string | Buffer>
	{

		let data = await this.readDCHData();

		let unzippedData = gunzipSync(data);

		return binary
			? unzippedData
			: new TextDecoder().decode(
				unzippedData
			);

	}

	/**
	 * Закодировать изображение
	 */
	public async encode(data : string | Buffer) : Promise<Stenography>
	{

		let binaryData = typeof data === 'string'
			? Buffer.from(data, 'utf-8')
			: Buffer.from(data);

		/**
		 * Сжимаем для экономии места
		 */
		let compressedBinaryData = gzipSync(binaryData);

		/**
		 * Записываем длину данных
		 */
		let length = Buffer.alloc(4);
		length.writeUInt32BE(compressedBinaryData.length, 0);

		/**
		 * Записываем хэш данных
		 */
		let hash = this.hashData(compressedBinaryData);

		/**
		 * Собираем все вместе
		 */
		let serializedData = Buffer.concat([
			length,
			hash,
			compressedBinaryData
		]);

		return new Promise(resolve => {

			jsSteg.reEncodeWithModifications(this.blob, (cfs : number[][][]) => {

				this.mask(cfs[0], serializedData);

			}, (base64 : string) => {

				let binary = Buffer.from(base64.slice(23), 'base64');

				let blob = new Blob([binary]);

				resolve(
					new Stenography(blob)
				);

			});

		});

	}

	/**
	 * Сохранение картинки
	 */
	public async saveToFile(path : string) : Promise<void>
	{

		let buffer = await this.blob.arrayBuffer();

		fs.writeFileSync(path, Buffer.from(buffer));

	}

	/**
	 * Закодировать изображение с AES ключом
	 */
	public encodeWithKey(key : string, data : string | Buffer) : Promise<Stenography>
	{

		let cryptoKey = this.deriveAESKey(key);

		let binaryData = typeof data === 'string'
			? Buffer.from(data, 'utf-8')
			: Buffer.from(data);

		let iv = crypto.randomBytes(16);
		let cipher = crypto.createCipheriv('aes-256-cbc', cryptoKey, iv);
		let encryptedData = Buffer.concat([cipher.update(binaryData), cipher.final()]);

		let finalData = Buffer.concat([iv, encryptedData]);

		return this.encode(finalData);

	}

	/**
	 * Раскодировать изображение с AES ключом
	 */
	public async decodeWithKey(key : string, binary : boolean = false) : Promise<string | Buffer>
	{

		let cryptoKey = crypto.createHash('sha256').update(key).digest();

		let encodedData = <Buffer>(await this.decode(true));

		let iv = encodedData.slice(0, 16);
		let encryptedData = encodedData.slice(16);

		let decipher = crypto.createDecipheriv('aes-256-cbc', cryptoKey, iv);
		let decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

		// Возвращаем расшифрованные данные
		return binary ? decryptedData : new TextDecoder().decode(decryptedData);

	}

	/**
	 * Закодировать файл внутрь изображения
	 */
	public encodeFile(fromDataPath : string) : Promise<Stenography>
	{

		let dataBuffer = fs.readFileSync(fromDataPath);

		return this.encode(dataBuffer);

	}

	/**
	 * Раскодировать файл внутри изображения
	 */
	public async decodeFile(toDataPath : string) : Promise<void>
	{

		let decode = await this.decode(true);

		fs.writeFileSync(toDataPath, decode);

	}

	/**
	 * Закодировать файл внутрь изображения с AES ключом
	 */
	public encodeFileWithKey(key : string, fromDataPath : string) : Promise<Stenography>
	{

		let dataBuffer = fs.readFileSync(fromDataPath);

		return this.encodeWithKey(key, dataBuffer);

	}

	/**
	 * Раскодировать файл внутри изображения с AES ключем
	 */
	public async decodeFileWithKey(key : string, toDataPath : string) : Promise<void>
	{

		let decode = await this.decodeWithKey(key, true);

		fs.writeFileSync(toDataPath, decode);

	}

}