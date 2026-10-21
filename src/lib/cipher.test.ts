import { describe, expect, test } from 'bun:test';
import {
	buildRun,
	columnar,
	group,
	inverseColumnar,
	inverseDoubleColumnar,
	keyOrder,
	keyRanks,
	validate
} from './cipher';

const PLAIN = 'ATACAREMOSALAMANECER';
const C1 = 'TRSMCAAOAEAEAAECMLNR';
const C2 = 'SOALTAACCEERRAEMMAAN';

// Same layout as the external decryption check.
function cppDecrypt(cipher: string, key: string): string {
	const chars = Array.from(cipher);
	const width = Array.from(key).length;
	const height = Math.ceil(chars.length / width);
	const extra = chars.length % width;
	const columns = Array.from({ length: width }, () => [] as string[]);
	let cursor = 0;

	for (const column of keyOrder(key)) {
		const length = height - (extra !== 0 && column >= extra ? 1 : 0);
		columns[column] = chars.slice(cursor, cursor + length);
		cursor += length;
	}

	let output = '';
	for (let row = 0; row < height; row++) {
		for (let column = 0; column < width; column++) {
			if (row < columns[column].length) output += columns[column][row];
		}
	}
	return output;
}

describe('claves', () => {
	test('PERU se ordena E P R U', () => {
		expect(keyRanks('PERU')).toEqual([2, 1, 3, 4]);
		expect(keyOrder('PERU')).toEqual([1, 0, 2, 3]);
	});

	test('CLAVE se ordena A C E L V', () => {
		expect(keyRanks('CLAVE')).toEqual([2, 4, 1, 5, 3]);
		expect(keyOrder('CLAVE')).toEqual([2, 0, 4, 1, 3]);
	});

	test('los caracteres repetidos conservan el orden izquierda-derecha', () => {
		expect(keyRanks('AAB')).toEqual([1, 2, 3]);
		expect(keyOrder('AAB')).toEqual([0, 1, 2]);
		expect(keyRanks('BAA')).toEqual([3, 1, 2]);
		expect(keyOrder('BAA')).toEqual([1, 2, 0]);
	});

	test('la clave conserva mayúsculas y minúsculas al ordenar', () => {
		expect(keyRanks('PeRu')).toEqual([1, 3, 2, 4]);
		expect(keyOrder('PeRu')).toEqual([0, 2, 1, 3]);
	});

	test('ordena por code point, como el UTF-8 del C++', () => {
		expect(keyOrder('áB')).toEqual([1, 0]);
		expect(keyOrder('🌳A')).toEqual([1, 0]);
	});
});

describe('vector de referencia', () => {
	test('primera transposición', () => {
		const pass = columnar(PLAIN, 'PERU');
		expect(pass.width).toBe(4);
		expect(pass.height).toBe(5);
		expect(pass.output).toBe(C1);
	});

	test('segunda transposición y agrupación', () => {
		const pass = columnar(C1, 'CLAVE');
		expect(pass.output).toBe(C2);
		expect(group(pass.output).join(' ')).toBe('SOALT AACCE ERRAE MMAAN');
	});

	test('el recorrido completo coincide con el documento', () => {
		const run = buildRun({
			message: PLAIN,
			key1: 'PERU',
			key2: 'CLAVE'
		});

		expect(run.message.value).toBe(PLAIN);
		expect(run.pass1.output).toBe(C1);
		expect(run.pass2.output).toBe(C2);
		expect(run.final).toBe(C2);
		expect(run.groups.join(' ')).toBe('SOALT AACCE ERRAE MMAAN');
	});
});

describe('inversa', () => {
	test('cada pasada se deshace con su clave', () => {
		expect(inverseColumnar(C2, 'CLAVE')).toBe(C1);
		expect(inverseColumnar(C1, 'PERU')).toBe(PLAIN);
	});

	test('la doble inversa recupera el texto original', () => {
		const run = buildRun({
			message: PLAIN,
			key1: 'PERU',
			key2: 'CLAVE'
		});
		expect(inverseDoubleColumnar(run.final, 'PERU', 'CLAVE')).toBe(PLAIN);
	});

	test('la última fila queda corta y la inversa la reconstruye', () => {
		const pass = columnar('HOLA', 'CLAVE');
		expect(pass.height).toBe(1);
		expect(pass.output).toBe('LHOA');
		expect(inverseColumnar(pass.output, 'CLAVE')).toBe('HOLA');

		const run = buildRun({ message: 'HOLA', key1: 'CLAVE', key2: 'PERU' });
		expect(run.pass1.output.length).toBe(4);
		expect(run.pass2.output.length).toBe(4);
		expect(inverseDoubleColumnar(run.final, 'CLAVE', 'PERU')).toBe('HOLA');
	});

	test('el descifrador C++ conserva espacios, mayúsculas, tildes, signos y emoji', () => {
		const message = '¡Hola, Mundo! 3 árboles 🌳';
		const run = buildRun({ message, key1: 'PERU', key2: 'CLAVE' });

		expect(run.message.value).toBe(message);
		expect(Array.from(run.final)).toHaveLength(run.message.length);
		expect(cppDecrypt(cppDecrypt(run.final, 'CLAVE'), 'PERU')).toBe(message);
	});
});

describe('texto exacto', () => {
	test('el mensaje no se normaliza y la inversa lo devuelve igual', () => {
		const message = '¡Hola, Mundo! Árbol ñandú 123 🌳';
		const run = buildRun({ message, key1: 'PERU', key2: 'CLAVE' });

		expect(run.message.value).toBe(message);
		expect(run.pass1.input).toBe(message);
		expect(run.message.length).toBe(Array.from(message).length);
		expect(inverseDoubleColumnar(run.final, 'PERU', 'CLAVE')).toBe(message);
	});

	test('conserva espacios al inicio y al final', () => {
		const message = '  HOLA  ';
		const run = buildRun({ message, key1: 'PERU', key2: 'CLAVE' });

		expect(run.message.value).toBe(message);
		expect(inverseDoubleColumnar(run.final, 'PERU', 'CLAVE')).toBe(message);
	});

	test('cuenta y agrupa por code points, no por unidades UTF-16', () => {
		const result = validate({ message: '🌳', key1: 'PERU', key2: 'CLAVE' });
		expect(result.message.length).toBe(1);
		expect(group('🌳🌳🌳🌳🌳🌳')).toEqual(['🌳🌳🌳🌳🌳', '🌳']);
	});

	test('la clave no se normaliza y la inversa usa la misma', () => {
		const key1 = 'Pe Rú!';
		const key2 = 'clave 2';
		const message = 'Hola Mundo';
		const run = buildRun({ message, key1, key2 });

		expect(run.key1.value).toBe(key1);
		expect(run.key1.length).toBe(Array.from(key1).length);
		expect(run.key2.value).toBe(key2);
		expect(run.pass1.key).toBe(key1);
		expect(run.pass1.width).toBe(Array.from(key1).length);
		expect(inverseDoubleColumnar(run.final, key1, key2)).toBe(message);
		expect(cppDecrypt(cppDecrypt(run.final, key2), key1)).toBe(message);
	});
});

describe('validación', () => {
	test('bloquea mensaje vacío, con salto de línea o demasiado largo', () => {
		expect(validate({ message: '', key1: 'PERU', key2: 'CLAVE' }).canRun).toBe(false);
		expect(validate({ message: 'HOLA\nMUNDO', key1: 'PERU', key2: 'CLAVE' }).canRun).toBe(false);
		expect(validate({ message: 'A'.repeat(401), key1: 'PERU', key2: 'CLAVE' }).canRun).toBe(false);
		expect(validate({ message: '🌳'.repeat(401), key1: 'PERU', key2: 'CLAVE' }).canRun).toBe(
			false
		);
	});

	test('acepta signos y símbolos sin letras', () => {
		expect(validate({ message: '123 ¡!', key1: 'PERU', key2: 'CLAVE' }).canRun).toBe(true);
	});

	test('el límite se mide en caracteres, no en unidades UTF-16', () => {
		expect(validate({ message: '🌳'.repeat(400), key1: 'PERU', key2: 'CLAVE' }).canRun).toBe(
			true
		);
	});

	test('bloquea claves vacías, cortas, largas o con saltos de línea', () => {
		expect(validate({ message: 'HOLA', key1: '', key2: 'CLAVE' }).canRun).toBe(false);
		expect(validate({ message: 'HOLA', key1: 'P', key2: 'CLAVE' }).canRun).toBe(false);
		expect(validate({ message: 'HOLA', key1: 'A'.repeat(17), key2: 'CLAVE' }).canRun).toBe(false);
		expect(validate({ message: 'HOLA', key1: 'PE\nRU', key2: 'CLAVE' }).canRun).toBe(false);
	});

	test('acepta claves sin normalizar', () => {
		const result = validate({ message: 'HOLA', key1: 'Pe Rú!', key2: 'clave 2' });
		expect(result.canRun).toBe(true);
		expect(result.key1.value).toBe('Pe Rú!');
		expect(result.key1.length).toBe(6);
		expect(result.key2.value).toBe('clave 2');
		expect(result.issues).toHaveLength(0);
	});

	test('acepta claves solo de signos', () => {
		expect(validate({ message: 'HOLA', key1: '¡!', key2: '¿?' }).canRun).toBe(true);
	});

	test('avisa de claves iguales y de caracteres repetidos', () => {
		const same = validate({ message: 'HOLA', key1: 'PERU', key2: 'PERU' });
		expect(same.canRun).toBe(true);
		expect(same.issues.some((issue) => issue.code === 'same-key')).toBe(true);

		const repeated = validate({ message: 'HOLA', key1: 'AAB', key2: 'CLAVE' });
		expect(repeated.issues.some((issue) => issue.code === 'key1-duplicate-letters')).toBe(true);

		const cased = validate({ message: 'HOLA', key1: 'Aa', key2: 'CLAVE' });
		expect(cased.issues.some((issue) => issue.code === 'key1-duplicate-letters')).toBe(false);
	});

	test('una X final es parte del mensaje: no hay relleno ni ambigüedad', () => {
		const result = validate({ message: 'HOLAX', key1: 'CLAVE', key2: 'PERU' });
		expect(result.canRun).toBe(true);
		expect(result.message.value).toBe('HOLAX');
		expect(result.issues).toHaveLength(0);
	});

	test('el ejemplo de referencia no necesita relleno', () => {
		const result = validate({
			message: 'ATACAREMOS AL AMANECER',
			key1: 'PERU',
			key2: 'CLAVE'
		});
		expect(result.canRun).toBe(true);
		expect(result.issues).toHaveLength(0);
	});
});

describe('agrupación', () => {
	test('corta en bloques de cinco', () => {
		expect(group(C2)).toEqual(['SOALT', 'AACCE', 'ERRAE', 'MMAAN']);
		expect(group('')).toEqual([]);
	});
});
