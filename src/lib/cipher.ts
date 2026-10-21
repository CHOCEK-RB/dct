/**
 * Double columnar transposition.
 * Text and keys are used exactly as entered; no padding is added.
 */
export type IssueKind = 'error' | 'warning' | 'info';
export type Field = 'message' | 'key1' | 'key2';

export interface Issue {
	kind: IssueKind;
	code: string;
	message: string;
	field?: Field;
	details?: string[];
}

export interface MessageText {
	/** Exact text entered by the user. */
	value: string;
	/** Length in Unicode code points. */
	length: number;
}

export interface KeyText {
	/** Exact key entered by the user. */
	value: string;
	/** Length in Unicode code points. */
	length: number;
}

export interface Pass {
	/** Text that entered this pass. */
	input: string;
	/** Length in Unicode code points. */
	length: number;
	key: string;
	/** Key split into Unicode code points. */
	keyChars: string[];
	width: number;
	height: number;
	/** 1-based rank of each column, in original column order. */
	ranks: number[];
	/** Original column indices in reading order. */
	order: number[];
	rows: string[][];
	columns: string[];
	output: string;
}

export interface Validation {
	message: MessageText;
	key1: KeyText;
	key2: KeyText;
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

/** UI limits; the cipher only needs a non-empty key. */
export const MESSAGE_LIMIT = 400;
export const KEY_MIN = 2;
export const KEY_MAX = 16;

/** 1-based rank of each column; equal characters keep left-to-right order. */
export function keyRanks(key: string): number[] {
	const chars = Array.from(key);
	const ranks = new Array<number>(chars.length);
	keyOrder(key).forEach((index, rank) => {
		ranks[index] = rank + 1;
	});
	return ranks;
}

/** Column indices sorted by code point; equal characters keep left-to-right order. */
export function keyOrder(key: string): number[] {
	const chars = Array.from(key);
	return chars.map((_, index) => index).sort((a, b) => {
		const left = chars[a].codePointAt(0) ?? 0;
		const right = chars[b].codePointAt(0) ?? 0;
		return left === right ? a - b : left - right;
	});
}

/** Lay code points into rows, padding only the display-only final row. */
function rowsOf(chars: string[], width: number): string[][] {
	const rows: string[][] = [];
	for (let i = 0; i < chars.length; i += width) {
		const row = chars.slice(i, i + width);
		while (row.length < width) row.push('');
		rows.push(row);
	}
	return rows;
}

/**
 * One columnar pass: write row by row, read columns in key order.
 * The final row may be short; no filler characters are added.
 */
export function columnar(text: string, key: string): Pass {
	if (!key) throw new Error('La clave no puede estar vacía.');

	// Code points keep emoji and other surrogate pairs intact.
	const chars = Array.from(text);
	const keyChars = Array.from(key);
	const width = keyChars.length;
	const height = Math.ceil(chars.length / width);
	const rows = rowsOf(chars, width);
	const order = keyOrder(key);
	const ranks = keyRanks(key);
	// Build each column top-to-bottom.
	const columns = Array.from({ length: width }, (_, column) =>
		rows.map((row) => row[column]).join('')
	);
	// Reading order depends only on the key, never on the column position.
	const output = order.map((column) => columns[column]).join('');

	return {
		input: text,
		length: chars.length,
		key,
		keyChars,
		width,
		height,
		ranks,
		order,
		rows,
		columns,
		output
	};
}

/**
 * Undo one pass: slice the ciphertext back into columns in key order,
 * then read rows left to right.
 */
export function inverseColumnar(cipher: string, key: string): string {
	if (!key) throw new Error('La clave no puede estar vacía.');

	const chars = Array.from(cipher);
	const width = Array.from(key).length;
	const height = Math.ceil(chars.length / width);
	const base = Math.floor(chars.length / width);
	const extra = chars.length % width;
	const order = keyOrder(key);
	const columns = Array.from({ length: width }, () => [] as string[]);

	// Consume the ciphertext in the same key order used to write it.
	let cursor = 0;
	for (const column of order) {
		const length = base + (column < extra ? 1 : 0);
		columns[column] = chars.slice(cursor, cursor + length);
		cursor += length;
	}

	// Read rows left to right, skipping cells that never existed.
	let output = '';
	for (let row = 0; row < height; row++) {
		for (let column = 0; column < width; column++) {
			if (row < columns[column].length) output += columns[column][row];
		}
	}
	return output;
}

/** Undo the second pass, then the first. */
export function inverseDoubleColumnar(cipher: string, key1: string, key2: string): string {
	if (!cipher) return '';
	return inverseColumnar(inverseColumnar(cipher, key2), key1);
}

/** Split into visual blocks; the ciphertext itself is ungrouped. */
export function group(text: string, size = 5): string[] {
	if (!text) return [];
	const chars = Array.from(text);
	const groups: string[] = [];
	for (let i = 0; i < chars.length; i += size) {
		groups.push(chars.slice(i, i + size).join(''));
	}
	return groups;
}

/**
 * Validate input without changing it. Line breaks are rejected because each
 * field is read as one line; all other characters are preserved.
 */
export function validate(input: CipherInput): Validation {
	const message: MessageText = {
		value: input.message,
		length: Array.from(input.message).length
	};
	const key1: KeyText = {
		value: input.key1,
		length: Array.from(input.key1).length
	};
	const key2: KeyText = {
		value: input.key2,
		length: Array.from(input.key2).length
	};
	const issues: Issue[] = [];

	if (!message.value) {
		issues.push({
			kind: 'error',
			code: 'message-empty',
			field: 'message',
			message: 'Escribe un mensaje.'
		});
	} else if (/[\r\n]/.test(message.value)) {
		issues.push({
			kind: 'error',
			code: 'message-newline',
			field: 'message',
			message: 'El programa C++ lee una sola línea: quita los saltos de línea.'
		});
	} else if (message.length > MESSAGE_LIMIT) {
		issues.push({
			kind: 'error',
			code: 'message-too-long',
			field: 'message',
			message: `El mensaje tiene ${message.length} caracteres; el límite es ${MESSAGE_LIMIT}.`
		});
	}

	const keyChecks: Array<{ key: KeyText; field: Field; ordinal: string }> = [
		{ key: key1, field: 'key1', ordinal: 'primera' },
		{ key: key2, field: 'key2', ordinal: 'segunda' }
	];

	for (const { key, field, ordinal } of keyChecks) {
		if (!key.value) {
			issues.push({
				kind: 'error',
				code: `${field}-empty`,
				field,
				message: `Escribe la ${ordinal} clave.`
			});
			continue;
		}

		if (/[\r\n]/.test(key.value)) {
			issues.push({
				kind: 'error',
				code: `${field}-newline`,
				field,
				message: 'El programa C++ lee una sola línea: quita los saltos de línea.'
			});
			continue;
		}

		// Key length is a UI limit, not part of the cipher.
		if (key.length < KEY_MIN) {
			issues.push({
				kind: 'error',
				code: `${field}-min`,
				field,
				message: `La ${ordinal} clave necesita al menos ${KEY_MIN} caracteres.`
			});
		}
		if (key.length > KEY_MAX) {
			issues.push({
				kind: 'error',
				code: `${field}-max`,
				field,
				message: `La ${ordinal} clave supera el límite de ${KEY_MAX} caracteres.`
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

	if (key1.length > 1 && new Set(Array.from(key1.value)).size < key1.length) {
		issues.push({
			kind: 'info',
			code: 'key1-duplicate-letters',
			field: 'key1',
			message: 'La primera clave repite caracteres; el empate se resuelve de izquierda a derecha.'
		});
	}
	if (key2.length > 1 && new Set(Array.from(key2.value)).size < key2.length) {
		issues.push({
			kind: 'info',
			code: 'key2-duplicate-letters',
			field: 'key2',
			message: 'La segunda clave repite caracteres; el empate se resuelve de izquierda a derecha.'
		});
	}

	const canRun = !issues.some((issue) => issue.kind === 'error');

	return { message, key1, key2, issues, canRun };
}

/** Encrypt with two passes: key1 first, then key2. */
export function buildRun(input: CipherInput): CipherRun {
	const validation = validate(input);
	if (!validation.canRun) {
		throw new Error('No se puede cifrar: hay errores de validación.');
	}

	// Pass 1 uses the exact message; pass 2 uses pass 1's ciphertext.
	const pass1 = columnar(validation.message.value, validation.key1.value);
	const pass2 = columnar(pass1.output, validation.key2.value);

	return {
		...validation,
		pass1,
		pass2,
		// `final` is the real ciphertext; `groups` is only for presentation.
		final: pass2.output,
		groups: group(pass2.output)
	};
}
