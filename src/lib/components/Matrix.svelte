<script lang="ts">
	import type { Pass } from '#lib/cipher.js';

	interface Props {
		pass: Pass;
		label: string;
		mode?: 'fill' | 'read';
		activeColumn?: number | null;
		readColumns?: number[];
	}

	let {
		pass,
		label,
		mode = 'fill',
		activeColumn = null,
		readColumns = []
	}: Props = $props();

	function isPadding(index: number): boolean {
		return index >= pass.input.length;
	}

	function cellDelay(index: number): number {
		return Math.min(index, 48) * 14;
	}
</script>

<section
	class="matrix"
	class:is-fill={mode === 'fill'}
	class:is-read={mode === 'read'}
	style="--cols: {pass.width}"
>
	<header class="matrix-head">
		<h3>{label}</h3>
		<p class="matrix-meta">
			{pass.width} columnas · {pass.height} filas
			{#if pass.padding > 0}
				<br />
				<span class="pad-count">{pass.padding} de relleno</span>
			{/if}
		</p>
	</header>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex (scroll region needed for keyboard users) -->
	<div class="matrix-scroll" role="region" aria-label={`${label}, desplazable horizontalmente`} tabindex="0">
		<table>
			<caption class="sr-only">
				{label}. {pass.height} filas por {pass.width} columnas. Clave {pass.key}. Los rangos de
				columna son {pass.ranks.join(', ')}.
			</caption>
			<thead>
				<tr>
					<th class="corner" scope="col"><span>F</span><span>C</span></th>
					{#each pass.key as letter, column (column)}
						<th
							scope="col"
							class:is-active={activeColumn === column}
							class:is-read={readColumns.includes(column)}
						>
							<span class="key-letter">{letter}</span>
							<span class="rank" style="--d: {column * 45}ms">{pass.ranks[column]}</span>
							{#if activeColumn === column}
								<span class="sr-only">Columna en lectura</span>
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each pass.rows as row, rowIndex (rowIndex)}
					<tr>
						<th scope="row">{String(rowIndex + 1).padStart(2, '0')}</th>
						{#each row as char, column (column)}
							{@const index = rowIndex * pass.width + column}
							<td
								class:is-active={activeColumn === column}
								class:is-read={readColumns.includes(column)}
								class:is-pad={isPadding(index)}
								style="--delay: {cellDelay(index)}ms"
							>
								{#if isPadding(index)}<span class="sr-only">relleno </span>{/if}{char}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<footer class="matrix-foot">
		<span class="micro">Orden de lectura</span>
		<div class="order-list">
			{#each pass.order as column, position (column)}
				<span
					class="order-chip"
					class:is-active={activeColumn === column}
					class:is-read={readColumns.includes(column)}
				>
					<b>{position + 1}</b>{pass.key[column]}
				</span>
			{/each}
		</div>
	</footer>
</section>

<style>
	.matrix {
		border: 1.5px solid var(--ink);
		background: var(--paper);
		box-shadow: var(--shadow);
		padding: 1rem 1rem 0.85rem;
	}

	.matrix-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
		padding-bottom: 0.85rem;
		border-bottom: 2px solid var(--ink);
	}

	.matrix-head h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.25rem, 2.4vw, 1.65rem);
		font-weight: 600;
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	.matrix-meta {
		margin: 0;
		font-size: 0.7rem;
		line-height: 1.5;
		text-align: right;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-soft);
	}

	.pad-count {
		color: var(--vermilion-ink);
		font-weight: 700;
	}

	.matrix-scroll {
		overflow-x: auto;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--rule);
		background-image: var(--dots);
		background-size: 18px 18px;
		scrollbar-color: var(--ink) var(--paper-deep);
	}

	.matrix-scroll:focus-visible {
		outline: 3px solid var(--vermilion);
		outline-offset: 2px;
	}

	table {
		--cell-min: 2.15rem;
		width: 100%;
		min-width: calc(var(--cols) * var(--cell-min) + 2.8rem);
		max-width: calc(var(--cols) * 3.9rem + 3rem);
		table-layout: fixed;
		border-collapse: collapse;
		margin: 0 auto;
		background: var(--paper);
	}

	th,
	td {
		height: clamp(2.5rem, 4vw, 3.3rem);
		padding: 0;
		text-align: center;
		font-family: var(--font-mono);
		font-size: clamp(0.86rem, 1.1vw, 1.02rem);
		line-height: 1;
		border: 1px solid var(--rule);
		transition:
			background-color 140ms ease,
			color 140ms ease,
			opacity 160ms ease;
	}

	thead th {
		height: auto;
		padding: 0.4rem 0 0.35rem;
		background: var(--paper-deep);
		vertical-align: top;
	}

	thead th.is-active {
		background: var(--ink);
		color: var(--paper);
	}

	thead th.is-read:not(.is-active) {
		box-shadow: inset 0 -3px 0 var(--plum);
	}

	.corner {
		width: 2.6rem;
		min-width: 2.6rem;
		background: var(--ink);
		color: var(--paper);
		font-size: 0.55rem;
		letter-spacing: 0.08em;
		line-height: 1.1;
	}

	.corner span {
		display: block;
	}

	.key-letter {
		display: block;
		font-family: var(--font-display);
		font-size: clamp(1rem, 1.8vw, 1.25rem);
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.rank {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.45em;
		height: 1.45em;
		margin-top: 0.25rem;
		border: 1px solid currentColor;
		font-size: 0.62rem;
		font-weight: 700;
		line-height: 1;
	}

	.is-fill .rank {
		animation: stamp-in 360ms cubic-bezier(0.2, 1.35, 0.4, 1) both;
		animation-delay: calc(100ms + var(--d));
	}

	thead th.is-active .rank {
		background: var(--paper);
		color: var(--ink);
		border-color: var(--paper);
	}

	tbody th {
		width: 2.6rem;
		min-width: 2.6rem;
		background: var(--paper);
		color: var(--ink-soft);
		font-size: 0.6rem;
		letter-spacing: 0.04em;
	}

	tbody td {
		background: var(--paper);
		font-weight: 700;
	}

	tbody td.is-pad {
		color: var(--vermilion-ink);
		text-decoration: underline dotted currentColor;
		text-underline-offset: 3px;
	}

	tbody td.is-read:not(.is-active) {
		background: color-mix(in srgb, var(--paper-deep) 70%, var(--paper));
		color: var(--ink-soft);
	}

	tbody td.is-active {
		background: var(--ink);
		color: var(--paper);
		font-weight: 700;
	}

	tbody td.is-active.is-pad {
		color: var(--mustard);
	}

	.is-fill tbody td {
		animation: cell-in 280ms both;
		animation-delay: var(--delay);
	}

	.matrix-foot {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		padding-top: 0.75rem;
	}

	.order-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.order-chip {
		display: inline-flex;
		align-items: baseline;
		gap: 0.3rem;
		padding: 0.22rem 0.45rem;
		border: 1px solid var(--rule);
		font-size: 0.76rem;
		line-height: 1;
		text-transform: uppercase;
		transition:
			background-color 140ms ease,
			color 140ms ease,
			border-color 140ms ease;
	}

	.order-chip b {
		font-size: 0.62rem;
		color: var(--ink-soft);
	}

	.order-chip.is-read {
		border-bottom: 2px solid var(--plum);
	}

	.order-chip.is-active {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	.order-chip.is-active b {
		color: var(--mustard);
	}

	@media (max-width: 600px) {
		.matrix {
			padding: 0.85rem 0.75rem 0.7rem;
		}

		.matrix-head {
			gap: 0.75rem;
		}

		.matrix-meta {
			font-size: 0.6rem;
		}

		.matrix-scroll {
			padding: 0.6rem 0;
		}
	}
</style>
