<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { CipherRun } from '#lib/cipher.js';

	interface Props {
		run: CipherRun;
		onReset: () => void;
		onBack: () => void;
	}

	let { run, onReset, onBack }: Props = $props();

	let copyState = $state<'idle' | 'copied' | 'error'>('idle');
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyCipher(): Promise<void> {
		// Copy the exact continuous ciphertext, not the visual five-character blocks.
		const text = run.final;
		try {
			if (!navigator.clipboard?.writeText) throw new Error('Clipboard no disponible');
			await navigator.clipboard.writeText(text);
			copyState = 'copied';
		} catch {
			copyState = 'error';
		}

		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => {
			copyState = 'idle';
		}, 1800);
	}

	onDestroy(() => clearTimeout(copyTimer));
</script>

<div class="result">
	<header class="result-head">
		<h2>Criptograma.</h2>
		<span class="seal" aria-hidden="true">Cifrado<br />completo</span>
	</header>

	<div class="cipher-ticket">
		<div class="ticket-head">
			<span class="micro">C2</span>
		</div>
		<p class="cipher-groups" aria-label="Criptograma agrupado en bloques de cinco">
			{#each run.groups as block, index (index)}
				<span class="cipher-group" style="--i: {index}">{block}</span>
			{/each}
		</p>
	</div>
	<p class="ticket-hint">
		Los bloques son solo visuales: se copia el texto continuo, con los espacios que forman parte
		del mensaje.
	</p>

	<div class="result-actions">
		<button type="button" class="btn btn-primary" onclick={copyCipher}>
			{copyState === 'copied' ? 'Copiado' : 'Copiar criptograma'}
		</button>
		<button type="button" class="btn btn-ghost" onclick={onBack}>Volver a la lectura</button>
		<button type="button" class="btn btn-ghost" onclick={onReset}>Cifrar otro mensaje</button>
	</div>
	<p class="copy-status" aria-live="polite">
		{#if copyState === 'copied'}
			El criptograma está en el portapapeles.
		{:else if copyState === 'error'}
			No se pudo copiar. Selecciona el texto y cópialo a mano.
		{/if}
	</p>

	<dl class="result-stats">
		<div>
			<dt>Caracteres</dt>
			<dd>{run.message.length}</dd>
		</div>
		<div>
			<dt>Claves</dt>
			<dd>{run.key1.value} / {run.key2.value}</dd>
		</div>
	</dl>
</div>

<style>
	.result {
		display: grid;
		gap: 1.35rem;
	}

	.result-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid var(--ink);
	}

	.result-head h2 {
		max-width: 24ch;
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 4.2vw, 3.4rem);
		font-weight: 600;
		line-height: 0.98;
		letter-spacing: -0.035em;
	}

	.seal {
		flex: none;
		padding: 0.45rem 0.6rem;
		border: 2px solid var(--vermilion);
		color: var(--vermilion-ink);
		font-size: 0.58rem;
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: 0.14em;
		text-align: center;
		text-transform: uppercase;
		transform: rotate(-6deg);
		animation: stamp-in 620ms cubic-bezier(0.2, 1.35, 0.4, 1) backwards;
		animation-delay: 320ms;
	}

	.cipher-ticket {
		border-top: 2px dashed var(--ink);
		border-bottom: 2px dashed var(--ink);
		background: var(--paper-deep);
		padding: 0.8rem 1rem 1rem;
	}

	.ticket-head {
		margin-bottom: 0.7rem;
		padding-bottom: 0.55rem;
		border-bottom: 1px solid var(--rule);
	}

	.cipher-groups {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem 0.7rem;
		margin: 0;
		font-family: var(--font-mono);
		font-size: clamp(1.25rem, 3.2vw, 2.35rem);
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: 0.1em;
	}

	.cipher-group {
		display: inline-block;
		padding-bottom: 0.15rem;
		border-bottom: 2px solid var(--ink);
		white-space: pre-wrap;
		animation: group-in 260ms both;
		animation-delay: calc(var(--i) * 60ms);
	}

	.ticket-hint {
		margin: -0.5rem 0 0;
		font-size: 0.68rem;
		line-height: 1.45;
		color: var(--ink-soft);
	}

	.result-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}

	.copy-status {
		min-height: 1.2rem;
		margin: -0.6rem 0 0;
		font-size: 0.72rem;
		color: var(--ink-soft);
	}

	.result-stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin: 0;
		border-top: 2px solid var(--ink);
		border-bottom: 1px solid var(--ink);
	}

	.result-stats div {
		padding: 0.7rem 0.7rem 0.7rem 0;
		border-right: 1px dotted var(--rule);
	}

	.result-stats div:last-child {
		border-right: 0;
		padding-left: 0.7rem;
	}

	.result-stats div:not(:first-child) {
		padding-left: 0.7rem;
	}

	.result-stats dt {
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.result-stats dd {
		margin: 0.25rem 0 0;
		font-family: var(--font-mono);
		font-size: 1.02rem;
		font-weight: 700;
		line-height: 1.2;
		white-space: pre-wrap;
	}
</style>
