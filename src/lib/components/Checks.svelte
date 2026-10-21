<script lang="ts">
	import type { Issue } from '#lib/cipher.js';

	interface Props {
		issues: Issue[];
	}

	let { issues }: Props = $props();

	const errors = $derived(issues.filter((issue) => issue.kind === 'error'));
	const warnings = $derived(issues.filter((issue) => issue.kind === 'warning'));
	const status = $derived(
		errors.length ? 'rechazado' : warnings.length ? 'avisos' : 'validado'
	);
	const statusLabel = $derived(
		status === 'rechazado' ? 'RECHAZADO' : status === 'avisos' ? 'VALIDADO CON AVISOS' : 'VALIDADO'
	);
</script>

<section id="checks-panel" class="checks" aria-labelledby="checks-title" tabindex="-1">
	<header class="checks-head">
		<h3 id="checks-title">Requisitos</h3>
		<span class="status-stamp" class:is-rejected={status === 'rechazado'} class:is-valid={status === 'validado' || status === 'avisos'}>
			{statusLabel}
		</span>
	</header>

	<div class="checks-body" aria-live="polite">
		{#if issues.length}
			<ul class="check-list">
				{#each issues as issue (issue.code)}
					<li class="check check--{issue.kind}">
						<span class="check-mark" aria-hidden="true">
							{issue.kind === 'error' ? '×' : issue.kind === 'warning' ? '!' : 'i'}
						</span>
						<div class="check-copy">
							<span class="check-tag">
								{issue.kind === 'error' ? 'ERROR' : issue.kind === 'warning' ? 'AVISO' : 'INFO'}
							</span>
							<p>{issue.message}</p>
							{#if issue.details?.length}
								<ul class="check-details">
									{#each issue.details as detail}
										<li>{detail}</li>
									{/each}
								</ul>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>

<style>
	.checks {
		margin-top: 1.5rem;
		border-top: 2px solid var(--ink);
		border-bottom: 1px solid var(--ink);
		padding: 0.75rem 0 0.9rem;
	}

	.checks:focus-visible {
		outline: 3px solid var(--vermilion);
		outline-offset: 4px;
	}

	.checks-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.checks-head h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 600;
		line-height: 1;
		letter-spacing: -0.01em;
	}

	.status-stamp {
		display: inline-block;
		padding: 0.28rem 0.45rem;
		border: 1.5px solid var(--mustard);
		color: var(--ink);
		font-size: 0.58rem;
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: 0.12em;
		text-align: center;
		text-transform: uppercase;
		transform: rotate(-2deg);
	}

	.status-stamp.is-rejected {
		border-color: var(--vermilion-ink);
		color: var(--vermilion-ink);
	}

	.status-stamp.is-valid {
		border-color: var(--plum);
		color: var(--plum);
	}

	.check-list {
		list-style: none;
		margin: 0.65rem 0 0;
		padding: 0;
		border-top: 1px dotted var(--rule);
	}

	.check {
		display: grid;
		grid-template-columns: 1.35rem minmax(0, 1fr);
		gap: 0.6rem;
		padding: 0.7rem 0;
		border-bottom: 1px dotted var(--rule);
	}

	.check:last-child {
		border-bottom: 0;
		padding-bottom: 0.1rem;
	}

	.check-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid currentColor;
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 1;
	}

	.check--error .check-mark,
	.check--error .check-tag {
		color: var(--vermilion-ink);
	}

	.check--warning .check-mark,
	.check--warning .check-tag {
		color: var(--mustard-ink);
	}

	.check--info .check-mark,
	.check--info .check-tag {
		color: var(--plum);
	}

	.check-tag {
		display: block;
		margin-bottom: 0.18rem;
		font-size: 0.55rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.14em;
	}

	.check-copy p {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.45;
	}

	.check-details {
		margin: 0.35rem 0 0;
		padding: 0;
		list-style: none;
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--ink-soft);
	}

	.check-details li::before {
		content: '└ ';
		color: var(--ink-soft);
	}

	@media (max-width: 420px) {
		.checks-head {
			flex-direction: column;
			gap: 0.55rem;
		}
	}
</style>
