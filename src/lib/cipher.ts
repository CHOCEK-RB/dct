export type IssueKind = 'error' | 'warning' | 'info';
export type Field = 'message' | 'key1' | 'key2';

export interface Issue {
	kind: IssueKind;
	code: string;
	message: string;
	field?: Field;
	details?: string[];
}

export interface CountedChar {
	char: string;
	count: number;
}

export interface NormalizedMessage {
	raw: string;
	value: string;
	dropped: CountedChar[];
	folded: CountedChar[];
	hadLowercase: boolean;
}

export interface NormalizedKey {
	raw: string;
	value: string;
	invalid: CountedChar[];
	folded: CountedChar[];
}

export interface Pass {
	/** Text that entered this pass, before padding. */
	input: string;
	key: string;
	width: number;
	height: number;
	/** 1-based rank of each column, in original column order. */
	ranks: number[];
	/** Original column indices in reading order. */
	order: number[];
	rows: string[][];
	columns: string[];
	padding: number;
	output: string;
}

export interface Validation {
	message: NormalizedMessage;
	key1: NormalizedKey;
	key2: NormalizedKey;
	issues: Issue[];
	canRun: boolean;
}

export interface CipherRun extends Validation {
	pass1: Pass;
	pass2: Pass;
	final: string;
	groups: string[];
}

export interface CipherInput {
	message: string;
	key1: string;
	key2: string;
}

export const MESSAGE_LIMIT = 400;
export const KEY_MIN = 2;
export const KEY_MAX = 16;
export const PAD_CHAR = 'X';

const A_Z = /^[A-Z]+$/;

function fold(raw: string): string {
	return raw.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function bump(map: Map<string, number>, key: string): void {
	map.set(key, (map.get(key) ?? 0) + 1);
}

function counts(map: Map<string, number>): CountedChar[] {
	return Array.from(map, ([char, count]) => ({ char, count }));
}

function label(char: string): string {
	if (char === ' ') return 'espacio';
	if (char === '\n') return 'salto de línea';
	if (char === '\t') return 'tabulador';
	return `«${char}»`;
}

export function describeCounts(items: CountedChar[]): string {
	return items
		.map(({ char, count }) => (count > 1 ? `${label(char)} ×${count}` : label(char)))
		.join(' · ');
}

/**
 * Uppercase, fold diacritics and keep only A-Z.
 * Dropped characters and folded glyphs are reported for the UI.
 */
export function normalizeMessage(raw: string): NormalizedMessage {
	const dropped = new Map<string, number>();
	const folded = new Map<string, number>();
	let value = '';
	let hadLowercase = false;

	for (const char of Array.from(raw)) {
		const upper = char.toUpperCase();
		if (char !== upper) hadLowercase = true;

		const clean = fold(char);
		if (A_Z.test(clean)) {
			value += clean;
			if (upper !== clean && char !== clean) bump(folded, `${char}→${clean}`);
		} else {
			bump(dropped, char);
		}
	}

	return { raw, value, dropped: counts(dropped), folded: counts(folded), hadLowercase };
}

/**
 * Keys fold diacritics too, but unlike the message they reject anything
 * that is not A-Z (including inner spaces). Outer whitespace is trimmed.
 */
export function normalizeKey(raw: string): NormalizedKey {
	const invalid = new Map<string, number>();
	const folded = new Map<string, number>();
	let value = '';

	for (const char of Array.from(raw.trim())) {
		const upper = char.toUpperCase();
		const clean = fold(char);

		if (A_Z.test(clean)) {
			value += clean;
			if (upper !== clean) bump(folded, `${char}→${clean}`);
		} else {
			bump(invalid, char);
		}
	}

	return { raw, value, invalid: counts(invalid), folded: counts(folded) };
}

/** 1-based alphabetical rank of every column. Ties keep left-to-right order. */
export function keyRanks(key: string): number[] {
	const ranks = new Array<number>(key.length);
	keyOrder(key).forEach((index, rank) => {
		ranks[index] = rank + 1;
	});
	return ranks;
}

/** Original column indices sorted by key letter. Ties keep left-to-right order. */
export function keyOrder(key: string): number[] {
	return Array.from(key, (_, index) => index).sort((a, b) => {
		const left = key.charAt(a);
		const right = key.charAt(b);
		return left === right ? a - b : left < right ? -1 : 1;
	});
}

function rowsOf(text: string, width: number): string[][] {
	const rows: string[][] = [];
	for (let i = 0; i < text.length; i += width) {
		rows.push(Array.from(text.slice(i, i + width)));
	}
	return rows;
}

/** One columnar transposition, always padding the last row with X. */
export function columnar(text: string, key: string): Pass {
	if (!key) throw new Error('La clave no puede estar vacía.');

	const width = key.length;
	const height = Math.ceil(text.length / width);
	const padding = height * width - text.length;
	const padded = text + PAD_CHAR.repeat(padding);
	const rows = rowsOf(padded, width);
	const order = keyOrder(key);
	const ranks = keyRanks(key);
	const columns = Array.from({ length: width }, (_, column) =>
		rows.map((row) => row[column] ?? '').join('')
	);
	const output = order.map((column) => columns[column]).join('');

	return { input: text, key, width, height, ranks, order, rows, columns, padding, output };
}

/** Undo one columnar pass. Returns the pass input including any X padding. */
export function inverseColumnar(cipher: string, key: string): string {
	if (!key) throw new Error('La clave no puede estar vacía.');

	const width = key.length;
	const height = Math.ceil(cipher.length / width);
	const base = Math.floor(cipher.length / width);
	const extra = cipher.length % width;
	const order = keyOrder(key);
	const columns = new Array<string>(width).fill('');

	let cursor = 0;
	for (const column of order) {
		const length = base + (column < extra ? 1 : 0);
		columns[column] = cipher.slice(cursor, cursor + length);
		cursor += length;
	}

	let output = '';
	for (let row = 0; row < height; row++) {
		for (let column = 0; column < width; column++) {
			if (row < columns[column].length) output += columns[column].charAt(row);
		}
	}
	return output;
}

/**
 * Undo both passes. The receiver must know the original length: the X padding
 * is not self-describing, so the intermediate length cannot be inferred from
 * the final ciphertext alone.
 */
export function inverseDoubleColumnar(
	cipher: string,
	key1: string,
	key2: string,
	originalLength: number
): string {
	if (originalLength <= 0) return '';
	const intermediateLength = Math.ceil(originalLength / key1.length) * key1.length;
	const paddedIntermediate = inverseColumnar(cipher, key2);
	const intermediate = paddedIntermediate.slice(0, intermediateLength);
	return inverseColumnar(intermediate, key1).slice(0, originalLength);
}

export function group(text: string, size = 5): string[] {
	if (!text) return [];
	const groups: string[] = [];
	for (let i = 0; i < text.length; i += size) groups.push(text.slice(i, i + size));
	return groups;
}

export function validate(input: CipherInput): Validation {
	const message = normalizeMessage(input.message);
	const key1 = normalizeKey(input.key1);
	const key2 = normalizeKey(input.key2);
	const issues: Issue[] = [];

	const rawMessage = input.message.trim();
	if (!rawMessage) {
		issues.push({
			kind: 'error',
			code: 'message-empty',
			field: 'message',
			message: 'Escribe un mensaje.'
		});
	} else if (!message.value) {
		issues.push({
			kind: 'error',
			code: 'message-no-letters',
			field: 'message',
			message: 'El mensaje no contiene A–Z.',
			details: message.dropped.length ? [describeCounts(message.dropped)] : undefined
		});
	} else if (message.value.length > MESSAGE_LIMIT) {
		issues.push({
			kind: 'error',
			code: 'message-too-long',
			field: 'message',
			message: `El mensaje tiene ${message.value.length} letras; el límite es ${MESSAGE_LIMIT}.`
		});
	}

	const keyChecks: Array<{ key: NormalizedKey; field: Field; ordinal: string }> = [
		{ key: key1, field: 'key1', ordinal: 'primera' },
		{ key: key2, field: 'key2', ordinal: 'segunda' }
	];

	for (const { key, field, ordinal } of keyChecks) {
		if (!key.raw.trim()) {
			issues.push({
				kind: 'error',
				code: `${field}-empty`,
				field,
				message: `Escribe la ${ordinal} clave.`
			});
			continue;
		}

		if (!key.value) {
			issues.push({
				kind: 'error',
				code: `${field}-no-letters`,
				field,
				message: `La ${ordinal} clave no contiene A–Z.`,
				details: key.invalid.length ? [describeCounts(key.invalid)] : undefined
			});
			continue;
		}

		if (key.value.length < KEY_MIN) {
			issues.push({
				kind: 'error',
				code: `${field}-min`,
				field,
				message: `La ${ordinal} clave necesita al menos ${KEY_MIN} letras.`
			});
		}
		if (key.value.length > KEY_MAX) {
			issues.push({
				kind: 'error',
				code: `${field}-max`,
				field,
				message: `La ${ordinal} clave supera el límite de ${KEY_MAX} letras.`
			});
		}
		if (key.invalid.length) {
			issues.push({
				kind: 'error',
				code: `${field}-invalid`,
				field,
				message: `La ${ordinal} clave solo admite A–Z.`,
				details: [describeCounts(key.invalid)]
			});
		}
		if (key.folded.length) {
			issues.push({
				kind: 'info',
				code: `${field}-folded`,
				field,
				message: `La ${ordinal} clave se normalizó.`,
				details: [describeCounts(key.folded)]
			});
		}
	}

	const hasKeyError = issues.some(
		(issue) => issue.kind === 'error' && (issue.field === 'key1' || issue.field === 'key2')
	);

	if (key1.value && key2.value && key1.value === key2.value && !hasKeyError) {
		issues.push({
			kind: 'warning',
			code: 'same-key',
			message: 'Las dos claves son iguales; la segunda pasada aporta menos difusión.'
		});
	}

	if (key1.value.length > 1 && new Set(key1.value).size < key1.value.length) {
		issues.push({
			kind: 'info',
			code: 'key1-duplicate-letters',
			field: 'key1',
			message: 'La primera clave repite letras; el empate se resuelve de izquierda a derecha.'
		});
	}
	if (key2.value.length > 1 && new Set(key2.value).size < key2.value.length) {
		issues.push({
			kind: 'info',
			code: 'key2-duplicate-letters',
			field: 'key2',
			message: 'La segunda clave repite letras; el empate se resuelve de izquierda a derecha.'
		});
	}

	const canRun = !issues.some((issue) => issue.kind === 'error');

	if (canRun) {
		const p1 = (key1.value.length - (message.value.length % key1.value.length)) % key1.value.length;
		const c1Length = message.value.length + p1;
		const p2 = (key2.value.length - (c1Length % key2.value.length)) % key2.value.length;

		if (p1 + p2 > 0) {
			issues.push({
				kind: 'info',
				code: 'padding',
				message: `Relleno: primera ${p1} X · segunda ${p2} X.`
			});
		}

		if (message.value.endsWith(PAD_CHAR) && p1 + p2 > 0) {
			issues.push({
				kind: 'warning',
				code: 'trailing-pad-ambiguity',
				message: 'El mensaje termina en X y habrá relleno: al descifrar no se distingue.'
			});
		}
	}

	return { message, key1, key2, issues, canRun };
}

export function buildRun(input: CipherInput): CipherRun {
	const validation = validate(input);
	if (!validation.canRun) {
		throw new Error('No se puede cifrar: hay errores de validación.');
	}

	const pass1 = columnar(validation.message.value, validation.key1.value);
	const pass2 = columnar(pass1.output, validation.key2.value);

	return {
		...validation,
		pass1,
		pass2,
		final: pass2.output,
		groups: group(pass2.output)
	};
}
