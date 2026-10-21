import { describe, expect, test } from 'bun:test';
import {
	buildRun,
	columnar,
	group,
	inverseColumnar,
	inverseDoubleColumnar,
	keyOrder,
	keyRanks,
	normalizeKey,
	normalizeMessage,
	validate
} from './cipher';

const PLAIN = 'ATACAREMOSALAMANECER';
const C1 = 'TRSMCAAOAEAEAAECMLNR';
const C2 = 'SOALTAACCEERRAEMMAAN';

describe('claves', () => {
	test('PERU se ordena E P R U', () => {
		expect(keyRanks('PERU')).toEqual([2, 1, 3, 4]);
		expect(keyOrder('PERU')).toEqual([1, 0, 2, 3]);
	});

	test('CLAVE se ordena A C E L V', () => {
		expect(keyRanks('CLAVE')).toEqual([2, 4, 1, 5, 3]);
		expect(keyOrder('CLAVE')).toEqual([2, 0, 4, 1, 3]);
	});

	test('las letras repetidas conservan el orden izquierda-derecha', () => {
		expect(keyRanks('AAB')).toEqual([1, 2, 3]);
		expect(keyOrder('AAB')).toEqual([0, 1, 2]);
		expect(keyRanks('BAA')).toEqual([3, 1, 2]);
		expect(keyOrder('BAA')).toEqual([1, 2, 0]);
	});
});

describe('vector de referencia', () => {
	test('primera transposición', () => {
		const pass = columnar(PLAIN, 'PERU');
		expect(pass.width).toBe(4);
		expect(pass.height).toBe(5);
		expect(pass.padding).toBe(0);
		expect(pass.output).toBe(C1);
	});

	test('segunda transposición y agrupación', () => {
		const pass = columnar(C1, 'CLAVE');
		expect(pass.output).toBe(C2);
		expect(group(pass.output).join(' ')).toBe('SOALT AACCE ERRAE MMAAN');
	});

	test('el recorrido completo coincide con el documento', () => {
		const run = buildRun({
			message: 'ATACAREMOS AL AMANECER',
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
			message: 'ATACAREMOS AL AMANECER',
			key1: 'PERU',
			key2: 'CLAVE'
		});
		expect(inverseDoubleColumnar(run.final, 'PERU', 'CLAVE', run.message.value.length)).toBe(PLAIN);
	});

	test('el relleno se conserva en una pasada y se recorta en la doble inversa', () => {
		const pass = columnar('HOLA', 'CLAVE');
		expect(pass.padding).toBe(1);
		expect(pass.output).toBe('LHXOA');
		expect(inverseColumnar(pass.output, 'CLAVE')).toBe('HOLAX');

		const run = buildRun({ message: 'HOLA', key1: 'CLAVE', key2: 'PERU' });
		expect(run.pass1.padding).toBe(1);
		expect(run.pass2.padding).toBe(3);
		expect(inverseDoubleColumnar(run.final, 'CLAVE', 'PERU', 4)).toBe('HOLA');
	});
});

describe('normalización', () => {
	test('el mensaje conserva solo A-Z y pliega tildes y eñes', () => {
		const normalized = normalizeMessage('¡Hola, mundo! Árbol ñandú 123');
		expect(normalized.value).toBe('HOLAMUNDOARBOLNANDU');
		expect(normalized.dropped.some((item) => item.char === ' ')).toBe(true);
		expect(normalized.folded.some((item) => item.char === 'Á→A')).toBe(true);
		expect(normalized.folded.some((item) => item.char === 'ñ→N')).toBe(true);
	});

	test('las claves pliegan tildes pero rechazan espacios internos y signos', () => {
		expect(normalizeKey(' Perú ').value).toBe('PERU');
		expect(normalizeKey(' Perú ').folded).toEqual([{ char: 'ú→U', count: 1 }]);
		expect(normalizeKey('CLAVE 2').value).toBe('CLAVE');
		expect(normalizeKey('CLAVE 2').invalid.map((item) => item.char)).toEqual([' ', '2']);
	});
});

describe('validación', () => {
	test('bloquea mensaje vacío, largo o sin letras', () => {
		expect(validate({ message: '', key1: 'PERU', key2: 'CLAVE' }).canRun).toBe(false);
		expect(validate({ message: '123', key1: 'PERU', key2: 'CLAVE' }).canRun).toBe(false);
		expect(validate({ message: 'A'.repeat(401), key1: 'PERU', key2: 'CLAVE' }).canRun).toBe(false);
	});

	test('bloquea claves vacías, cortas, largas o con caracteres inválidos', () => {
		expect(validate({ message: 'HOLA', key1: '', key2: 'CLAVE' }).canRun).toBe(false);
		expect(validate({ message: 'HOLA', key1: 'P', key2: 'CLAVE' }).canRun).toBe(false);
		expect(validate({ message: 'HOLA', key1: 'A'.repeat(17), key2: 'CLAVE' }).canRun).toBe(false);
		expect(validate({ message: 'HOLA', key1: 'PE RU', key2: 'CLAVE' }).canRun).toBe(false);
	});

	test('avisa de claves iguales y de letras repetidas', () => {
		const same = validate({ message: 'HOLA', key1: 'PERU', key2: 'PERU' });
		expect(same.canRun).toBe(true);
		expect(same.issues.some((issue) => issue.code === 'same-key')).toBe(true);

		const repeated = validate({ message: 'HOLA', key1: 'AAB', key2: 'CLAVE' });
		expect(repeated.issues.some((issue) => issue.code === 'key1-duplicate-letters')).toBe(true);
	});

	test('pronostica relleno y advierte de una X final ambigua', () => {
		const padding = validate({ message: 'HOLA', key1: 'CLAVE', key2: 'PERU' });
		expect(padding.canRun).toBe(true);
		expect(padding.issues.some((issue) => issue.code === 'padding')).toBe(true);

		const ambiguous = validate({ message: 'HOLAX', key1: 'CLAVE', key2: 'PERU' });
		expect(ambiguous.issues.some((issue) => issue.code === 'trailing-pad-ambiguity')).toBe(true);
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
