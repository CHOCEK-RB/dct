<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import {
		buildRun,
		validate,
		MESSAGE_LIMIT,
		KEY_MIN,
		KEY_MAX,
		type CipherRun,
		type Field,
		type Pass
	} from '#lib/cipher.js';
	import Checks from '#lib/components/Checks.svelte';
	import Matrix from '#lib/components/Matrix.svelte';
	import Result from '#lib/components/Result.svelte';

	const steps = [
		{ short: 'Preparar', title: 'Preparar el mensaje' },
		{ short: 'Matriz 1', title: 'Primera matriz' },
		{ short: 'Lectura 1', title: 'Primera lectura' },
		{ short: 'Matriz 2', title: 'Segunda matriz' },
		{ short: 'Lectura 2', title: 'Segunda lectura' },
		{ short: 'Salida', title: 'Criptograma' }
	];

	let message = $state('');
	let key1 = $state('PERU');
	let key2 = $state('CLAVE');

	let attempted = $state(false);
	let run = $state<CipherRun | null>(null);
	let step = $state(0);
	let visited = $state<boolean[]>([false, false, false, false, false, false, false]);
	let readCount = $state(0);
	let reducedMotion = $state(false);

	let messageEl = $state<HTMLTextAreaElement>();
	let key1El = $state<HTMLInputElement>();
	let key2El = $state<HTMLInputElement>();
	let stageEl = $state<HTMLElement>();

	let timers: ReturnType<typeof setTimeout>[] = [];

	const validation = $derived(validate({ message, key1, key2 }));
	const messageLength = $derived(validation.message.length);
	const currentPass = $derived(step === 3 ? run?.pass1 : step === 5 ? run?.pass2 : null);
	const readColumns = $derived(currentPass ? currentPass.order.slice(0, readCount) : []);
	const activeReadColumn = $derived(currentPass ? (currentPass.order[readCount] ?? null) : null);
	// Text revealed so far, read column by column in key order.
	const readText = $derived(
		currentPass
			? currentPass.order
					.slice(0, readCount)
					.map((column) => currentPass.columns[column])
					.join('')
			: ''
	);

	function clearTimers(): void {
		for (const timer of timers) clearTimeout(timer);
		timers = [];
	}

	function fieldError(field: Field): boolean {
		return attempted && validation.issues.some((issue) => issue.kind === 'error' && issue.field === field);
	}

	function markVisited(index: number): void {
		visited = visited.map((seen, position) => (position === index ? true : seen));
	}

	function invalidateRun(): void {
		if (!run) return;
		clearTimers();
		run = null;
		step = 0;
		readCount = 0;
		visited = [false, false, false, false, false, false, false];
	}

	function focusFirstError(): void {
		const issue = validation.issues.find((item) => item.kind === 'error');
		const element =
			issue?.field === 'message'
				? messageEl
				: issue?.field === 'key1'
					? key1El
					: issue?.field === 'key2'
						? key2El
						: null;
		element?.focus();
		if (!element) document.getElementById('checks-panel')?.focus();
	}

	async function scrollStage(): Promise<void> {
		await tick();
		if (!stageEl) return;
		if (window.matchMedia('(max-width: 1100px)').matches) {
			stageEl.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
		}
	}

	function beginRead(pass: Pass): void {
		// Animate the key-order read; reduced-motion users see the whole pass at once.
		readCount = 0;
		const total = pass.order.length;
		if (reducedMotion || total === 0) {
			readCount = total;
			return;
		}

		const delay = Math.max(90, Math.min(320, 1100 / total));
		for (let index = 0; index < total; index++) {
			timers.push(
				setTimeout(
					() => {
						readCount = index + 1;
					},
					180 + index * delay
				)
			);
		}
	}

	function startStage(index: number): void {
		if (!run) return;
		if (index === 3) beginRead(run.pass1);
		else if (index === 5) beginRead(run.pass2);
		else readCount = 0;
	}

	function execute(): void {
		attempted = true;
		if (!validation.canRun) {
			focusFirstError();
			return;
		}

		run = buildRun({ message, key1, key2 });
		clearTimers();
		visited = [false, false, false, false, false, false, false];
		readCount = 0;
		step = 1;
		markVisited(1);
		scrollStage();
	}

	function focusForm(): void {
		messageEl?.focus();
		if (window.matchMedia('(max-width: 1100px)').matches) {
			messageEl?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
		}
	}

	function nextStep(): void {
		if (!run || step >= 6) return;
		clearTimers();
		const next = step + 1;
		step = next;
		markVisited(next);
		readCount = 0;
		startStage(next);
		scrollStage();
	}

	function prevStep(): void {
		if (!run || step <= 1) return;
		clearTimers();
		const next = step - 1;
		step = next;
		readCount =
			next === 3 ? run.pass1.order.length : next === 5 ? run.pass2.order.length : 0;
		scrollStage();
	}

	function goToStep(index: number): void {
		if (!run || !visited[index] || index === step) return;
		clearTimers();
		step = index;
		readCount =
			index === 3 ? run.pass1.order.length : index === 5 ? run.pass2.order.length : 0;
		scrollStage();
	}

	async function loadExample(): Promise<void> {
		clearTimers();
		message =
			'¡Atención, compañía! El convoy llega al amanecer: 3 camiones, 12 cajas y víveres. ¿Están listos? ¡Nadie retrocede! Queda el 50% del camino.';
		key1 = 'PERU';
		key2 = 'CLAVE';
		attempted = false;
		run = null;
		step = 0;
		readCount = 0;
		visited = [false, false, false, false, false, false, false];
		await tick();
		execute();
	}

	function resetAll(): void {
		clearTimers();
		message = '';
		key1 = 'PERU';
		key2 = 'CLAVE';
		attempted = false;
		run = null;
		step = 0;
		readCount = 0;
		visited = [false, false, false, false, false, false, false];
		messageEl?.focus();
	}

	function handleSubmit(event: SubmitEvent): void {
		event.preventDefault();
		execute();
	}

	function handleMessageKeydown(event: KeyboardEvent): void {
		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			execute();
		}
	}

	onMount(() => {
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = query.matches;

		const onChange = (event: MediaQueryListEvent) => {
			reducedMotion = event.matches;
			if (event.matches && currentPass) {
				clearTimers();
				readCount = currentPass.order.length;
			}
		};

		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	});

	onDestroy(clearTimers);
</script>

<svelte:head>
	<title>Transposición columnar doble</title>
	<meta
		name="description"
		content="Cifrado de transposición columnar doble, paso a paso."
	/>
</svelte:head>

<a class="skip-link" href="#formulario">Saltar al formulario</a>

<div class="page">
	<header class="masthead">
		<h1 class="title">
			<span class="title-line">TRANSPOSICIÓN</span>
			<span class="title-line">COLUMNAR <em class="title-accent">DOBLE</em></span>
		</h1>
		<div class="masthead-foot">
			<p class="lede">
				El mensaje se escribe en una matriz, se lee por columnas y el resultado vuelve a
				entrar. Dos claves, dos pasadas, un criptograma.
			</p>
			<dl class="masthead-specs">
				<div><dt>Entrada</dt><dd>{MESSAGE_LIMIT} caracteres</dd></div>
				<div><dt>Claves</dt><dd>{KEY_MIN}–{KEY_MAX}</dd></div>
				<div><dt>Pasadas</dt><dd>02</dd></div>
			</dl>
		</div>
	</header>

	<main class="desk">
		<section id="formulario" class="form-panel" aria-labelledby="form-title">
			<header class="form-head">
				<p class="micro">Entrada</p>
				<h2 id="form-title">Preparar el mensaje</h2>
			</header>

			<form class="cipher-form" onsubmit={handleSubmit} novalidate>
				<div class="field">
					<div class="field-head">
						<label for="message">Mensaje claro</label>
						<span class="counter" class:is-over={messageLength > MESSAGE_LIMIT}>
							{messageLength}/{MESSAGE_LIMIT}
						</span>
					</div>
					<textarea
						id="message"
						bind:this={messageEl}
						bind:value={message}
						oninput={invalidateRun}
						onkeydown={handleMessageKeydown}
						rows="4"
						autocomplete="off"
						spellcheck="false"
						placeholder="¡Atención, compañía! El convoy llega al amanecer: 3 camiones, 12 cajas y víveres. ¿Están listos? ¡Nadie retrocede! Queda el 50% del camino."
						aria-invalid={fieldError('message')}
						aria-describedby="message-hint"
					></textarea>
					<p id="message-hint" class="field-hint">
						Se conservan mayúsculas, espacios, tildes y signos. Sin saltos de línea.
					</p>
					{#if fieldError('message')}<span class="field-flag">Revisar</span>{/if}
				</div>

				<div class="key-grid">
					<div class="field">
						<div class="field-head">
							<label for="key1">Clave 01</label>
						</div>
						<input
							id="key1"
							bind:this={key1El}
							bind:value={key1}
							oninput={invalidateRun}
							type="text"
							autocomplete="off"
							spellcheck="false"
							placeholder="PERU"
							autocapitalize="none"
							aria-invalid={fieldError('key1')}
							aria-describedby="key1-hint"
						/>
						<p id="key1-hint" class="field-hint">{KEY_MIN}–{KEY_MAX} caracteres.</p>
						{#if fieldError('key1')}<span class="field-flag">Revisar</span>{/if}
					</div>

					<div class="field">
						<div class="field-head">
							<label for="key2">Clave 02</label>
						</div>
						<input
							id="key2"
							bind:this={key2El}
							bind:value={key2}
							oninput={invalidateRun}
							type="text"
							autocomplete="off"
							spellcheck="false"
							placeholder="CLAVE"
							autocapitalize="none"
							aria-invalid={fieldError('key2')}
							aria-describedby="key2-hint"
						/>
						<p id="key2-hint" class="field-hint">{KEY_MIN}–{KEY_MAX} caracteres.</p>
						{#if fieldError('key2')}<span class="field-flag">Revisar</span>{/if}
					</div>
				</div>

				<div class="form-actions">
					<button type="submit" class="btn btn-primary">
						{run ? 'Recalcular' : 'Ejecutar cifrado'}
					</button>
				</div>
				<p class="kbd-hint">Ctrl + Enter para ejecutar</p>
			</form>

			{#if attempted}
				<Checks issues={validation.issues} />
			{/if}
		</section>

		<section class="stage-panel" bind:this={stageEl} aria-label="Mesa de cifrado">
			<div class="stage-top">
				<nav aria-label="Estaciones del cifrado">
					<ol class="step-rail">
						{#each steps as item, index}
							{@const number = index + 1}
							<li>
								<button
									type="button"
									class="step-tab"
									class:is-active={step === number}
									class:is-visited={visited[number]}
									disabled={!run || !visited[number]}
									aria-current={step === number ? 'step' : undefined}
									onclick={() => goToStep(number)}
								>
									<span class="step-number">{String(number).padStart(2, '0')}</span>
									<span class="step-label">{item.short}</span>
								</button>
							</li>
						{/each}
					</ol>
				</nav>
				<div class="rail-progress" aria-hidden="true">
					{#each steps as _, index}
						<span
							class:is-done={step > index + 1}
							class:is-current={step === index + 1}
						></span>
					{/each}
				</div>
			</div>

			<p class="sr-only" aria-live="polite">
				{#if run && step > 0}
					Estación {step} de 6: {steps[step - 1].title}.
				{:else}
					Sin expediente abierto.
				{/if}
			</p>

			{#if !run}
				<div class="empty-stage">
					<div class="empty-copy">
						<p class="micro">Mesa de cifrado</p>
						<h2>La mesa está vacía.</h2>
						<p class="empty-lede">
							Escribe un mensaje o carga el ejemplo. Verás cada matriz y cada lectura,
							columna a columna.
						</p>
						<button type="button" class="btn btn-ghost" onclick={loadExample}>
							Cargar el ejemplo
						</button>
					</div>

					<div class="ghost" aria-hidden="true">
						<p class="ghost-caption">
							<span>Vista previa</span>
							<span>lectura por columnas</span>
						</p>
						<div class="ghost-grid">
							{#each ['P', 'E', 'R', 'U'] as letter, column}
								<span class="ghost-key" style="--col: {column}">{letter}</span>
							{/each}
							{#each 'ATENCIONCOMPANIAELCO'.split('') as letter, index}
								<span
									class="ghost-cell"
									style="--i: {index}; --col: {index % 4}; --row: {Math.floor(index / 4)}"
									>{letter}</span
								>
							{/each}
						</div>
						<p class="ghost-foot">La columna marcada se copia de arriba abajo.</p>
					</div>
				</div>
			{:else}
				{#key step}
					<div class="stage-body" in:fly={{ y: 12, duration: 240 }} out:fade={{ duration: 90 }}>
						<p class="stage-kicker">
							<span>Estación {String(step).padStart(2, '0')}</span>
							<span aria-hidden="true">/ 06</span>
						</p>
						{#if step === 1}
							<header class="stage-heading">
								<h2>El mensaje, en limpio.</h2>
							</header>

							<div class="prep-grid">
								<article class="paper-block">
									<p class="micro">Texto original</p>
									<p class="normalized-text">{run.message.value}</p>
									<div class="prep-stats">
										<span>{run.message.length} caracteres</span>
									</div>
								</article>

								<article class="paper-block">
									<p class="micro">Ficha de claves</p>
									<dl class="key-readout">
										<div class="key-row">
											<dt>K1</dt>
											<dd>
												<span class="key-token">{run.key1.value}</span>
												<span class="key-meta">
													rangos {run.pass1.ranks.join(' · ')} ·
													<span class="key-order"
														>lectura
														{run.pass1.order.map((index) => run!.pass1.keyChars[index]).join(' · ')}</span
													>
												</span>
											</dd>
										</div>
										<div class="key-row">
											<dt>K2</dt>
											<dd>
												<span class="key-token">{run.key2.value}</span>
												<span class="key-meta">
													rangos {run.pass2.ranks.join(' · ')} ·
													<span class="key-order"
														>lectura
														{run.pass2.order.map((index) => run!.pass2.keyChars[index]).join(' · ')}</span
													>
												</span>
											</dd>
										</div>
									</dl>
								</article>
							</div>

						{:else if step === 2}
							<header class="stage-heading">
								<h2>El texto entra por filas.</h2>
							</header>

							<Matrix
								pass={run.pass1}
								label="Matriz 01"
								mode="fill"
							/>

							<div class="formula-strip">
								<span>n = {run.pass1.width}</span>
								<span>m = ⌈{run.message.length} / {run.pass1.width}⌉ = {run.pass1.height}</span>
								<span>resto = {run.pass1.length % run.pass1.width}</span>
							</div>
						{:else if step === 3}
							<header class="stage-heading">
								<h2>Se leen las columnas.</h2>
							</header>

							<div class="read-layout">
								<Matrix
									pass={run.pass1}
									label="Matriz 01"
									mode="read"
									activeColumn={activeReadColumn}
									readColumns={readColumns}
								/>

								<aside class="readout" aria-labelledby="readout-title-1">
									<div class="readout-head">
										<div>
											<p class="micro">Salida intermedia</p>
											<h3 id="readout-title-1">C1</h3>
										</div>
										<span class="readout-count">{readCount}/{run.pass1.order.length}</span>
									</div>

									<div class="readout-chunks">
										{#each run.pass1.order.slice(0, readCount) as column, position (column)}
											<div class="chunk" in:fly={{ y: 8, duration: 180 }}>
												<span class="chunk-label">#{position + 1} · {run.pass1.key[column]}</span>
												<code>{run.pass1.columns[column]}</code>
											</div>
										{/each}
										{#if readCount < run.pass1.order.length}
											<div class="chunk chunk--pending" aria-hidden="true">
												<span class="chunk-label">···</span>
												<code>·····</code>
											</div>
										{/if}
									</div>

									<div class="readout-total">
										<span class="micro">C1 parcial</span>
										<code class="tape">{readText}{#if readCount < run.pass1.order.length}<span class="tape-cursor">▌</span>{/if}</code>
									</div>
								</aside>
							</div>
						{:else if step === 4}
							<header class="stage-heading">
								<h2>El texto intermedio vuelve a entrar.</h2>
							</header>

							<div class="source-strip">
								<span class="micro">Entrada C1 · {run.pass1.length} caracteres</span>
								<code>{run.pass1.output}</code>
							</div>

							<Matrix
								pass={run.pass2}
								label="Matriz 02"
								mode="fill"
							/>

							<div class="formula-strip">
								<span>n = {run.pass2.width}</span>
								<span>m = ⌈{run.pass1.length} / {run.pass2.width}⌉ = {run.pass2.height}</span>
								<span>resto = {run.pass2.length % run.pass2.width}</span>
							</div>
						{:else if step === 5}
							<header class="stage-heading">
								<h2>Se repite la lectura.</h2>
							</header>

							<div class="read-layout">
								<Matrix
									pass={run.pass2}
									label="Matriz 02"
									mode="read"
									activeColumn={activeReadColumn}
									readColumns={readColumns}
								/>

								<aside class="readout" aria-labelledby="readout-title-2">
									<div class="readout-head">
										<div>
											<p class="micro">Criptograma</p>
											<h3 id="readout-title-2">C2</h3>
										</div>
										<span class="readout-count">{readCount}/{run.pass2.order.length}</span>
									</div>

									<div class="readout-chunks">
										{#each run.pass2.order.slice(0, readCount) as column, position (column)}
											<div class="chunk" in:fly={{ y: 8, duration: 180 }}>
												<span class="chunk-label">#{position + 1} · {run.pass2.key[column]}</span>
												<code>{run.pass2.columns[column]}</code>
											</div>
										{/each}
										{#if readCount < run.pass2.order.length}
											<div class="chunk chunk--pending" aria-hidden="true">
												<span class="chunk-label">···</span>
												<code>·····</code>
											</div>
										{/if}
									</div>

									<div class="readout-total">
										<span class="micro">C2 parcial</span>
										<code class="tape">{readText}{#if readCount < run.pass2.order.length}<span class="tape-cursor">▌</span>{/if}</code>
									</div>
								</aside>
							</div>
						{:else if step === 6}
							<Result run={run} onReset={resetAll} onBack={prevStep} />
						{/if}

						{#if step > 0 && step < 6}
							<nav class="stage-nav" aria-label="Navegación entre estaciones">
								{#if step === 1}
									<button type="button" class="btn btn-ghost" onclick={focusForm}>
										← Editar entrada
									</button>
								{:else}
									<button type="button" class="btn btn-ghost" onclick={prevStep}>
										← Anterior
									</button>
								{/if}
								<button type="button" class="btn btn-primary" onclick={nextStep}>
									Siguiente: {steps[step]?.short ?? 'Salida'} →
								</button>
							</nav>
						{/if}
					</div>
				{/key}
			{/if}
		</section>
	</main>

	<footer class="footer">
		<p>Demo local · el cifrado no sale de tu navegador.</p>
	</footer>
</div>

<style>
	.page {
		position: relative;
		z-index: 1;
		width: min(100% - 2 * var(--gutter), var(--page-max));
		margin: 0 auto;
		padding: 1rem 0 2rem;
	}

	.masthead {
		padding: clamp(1rem, 2.4vw, 1.6rem) 0 clamp(1.4rem, 3vw, 2.2rem);
		border-top: 2px solid var(--ink);
	}

	.title {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 7.2vw, 4.4rem);
		font-weight: 700;
		line-height: 0.88;
		letter-spacing: -0.05em;
		text-transform: uppercase;
	}

	.title-line {
		display: block;
	}

	.title-accent {
		font-style: italic;
		font-weight: 500;
		color: var(--vermilion-ink);
	}

	.masthead-foot {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: clamp(1.5rem, 4vw, 4rem);
		margin-top: clamp(1.2rem, 2.6vw, 2rem);
		padding-top: 0.9rem;
		border-top: 1px solid var(--rule-strong);
	}

	.lede {
		max-width: 52ch;
		font-family: var(--font-display);
		font-size: clamp(0.98rem, 1.35vw, 1.22rem);
		line-height: 1.4;
		color: var(--ink-soft);
	}

	.masthead-specs {
		display: flex;
		flex: none;
		gap: clamp(1rem, 2.4vw, 2.2rem);
		margin: 0;
	}

	.masthead-specs dt {
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.masthead-specs dd {
		margin: 0.15rem 0 0;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.desk {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 8fr);
		gap: clamp(1.5rem, 3.2vw, 3rem);
		align-items: start;
		margin-top: clamp(1.6rem, 4vw, 2.8rem);
	}

	.form-panel {
		min-width: 0;
		padding-top: 1rem;
		border-top: 3px solid var(--ink);
	}

	.form-head .micro {
		color: var(--vermilion-ink);
	}

	.form-head h2 {
		margin: 0.2rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.9rem, 3.2vw, 2.8rem);
		font-weight: 600;
		line-height: 0.98;
		letter-spacing: -0.035em;
	}

	.cipher-form {
		display: grid;
		gap: 1.1rem;
		margin-top: 1.35rem;
	}

	.field {
		position: relative;
		display: grid;
		gap: 0.35rem;
	}

	.field-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.field label {
		font-size: 0.78rem;
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: 0.01em;
	}

	.field input,
	.field textarea {
		width: 100%;
		border: 1.5px solid var(--ink);
		background: var(--paper);
		padding: 0.7rem 0.8rem;
		font-family: var(--font-mono);
		font-size: 1rem;
		line-height: 1.45;
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease;
	}

	.field textarea {
		min-height: 8rem;
		resize: vertical;
	}

	.key-grid input {
		font-weight: 700;
		letter-spacing: 0.1em;
	}

	.field input::placeholder,
	.field textarea::placeholder {
		color: var(--ink-soft);
		opacity: 0.55;
	}

	.field input:focus,
	.field textarea:focus {
		border-color: var(--vermilion);
		box-shadow: 3px 3px 0 var(--vermilion);
		outline: none;
	}

	.field input[aria-invalid='true'],
	.field textarea[aria-invalid='true'] {
		border-color: var(--vermilion-ink);
	}

	.field-hint {
		font-size: 0.68rem;
		line-height: 1.45;
		color: var(--ink-soft);
	}

	.counter {
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: var(--ink-soft);
	}

	.counter.is-over {
		color: var(--vermilion-ink);
	}

	.field-flag {
		position: absolute;
		right: 0;
		bottom: -1.1rem;
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--vermilion-ink);
	}

	.key-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.form-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-top: 0.25rem;
	}

	.form-actions .btn-primary {
		flex: 1 1 auto;
	}

	.kbd-hint {
		margin-top: -0.55rem;
		font-size: 0.6rem;
		letter-spacing: 0.04em;
		color: var(--ink-soft);
	}

	.stage-panel {
		min-width: 0;
		scroll-margin-top: 1rem;
		border: 1.5px solid var(--ink);
		background: var(--paper);
		box-shadow: var(--shadow);
		padding: clamp(0.9rem, 1.6vw, 1.3rem);
	}

	.stage-top {
		padding-bottom: 0.8rem;
		border-bottom: 2px solid var(--ink);
	}

	.step-rail {
		display: flex;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
		overflow-x: auto;
		scrollbar-width: thin;
	}

	.step-rail li {
		flex: 1 0 auto;
	}

	.step-tab {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
		width: 100%;
		min-height: 3rem;
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--rule);
		background: transparent;
		color: var(--ink-soft);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 700;
		line-height: 1.15;
		text-align: left;
		transition:
			background-color 140ms ease,
			color 140ms ease,
			border-color 140ms ease,
			transform 140ms ease;
	}

	.step-tab:disabled {
		opacity: 0.38;
	}

	.step-tab:not(:disabled):hover {
		border-color: var(--ink);
		color: var(--ink);
		transform: translateY(-1px);
	}

	.step-tab.is-visited:not(.is-active) {
		background: var(--paper-deep);
		border-bottom: 2px solid var(--plum);
		color: var(--ink);
	}

	.step-tab.is-active {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
		transform: translateY(-1px);
	}

	.step-number {
		font-size: 0.55rem;
		letter-spacing: 0.05em;
		color: currentColor;
		opacity: 0.7;
	}

	.step-tab.is-active .step-number {
		color: var(--mustard);
		opacity: 1;
	}

	.step-label {
		white-space: nowrap;
	}

	.rail-progress {
		display: flex;
		gap: 3px;
		height: 3px;
		margin-top: 0.4rem;
	}

	.rail-progress span {
		flex: 1;
		height: 100%;
		background: var(--paper-deep);
		transition: background-color 220ms ease;
	}

	.rail-progress span.is-done {
		background: var(--vermilion);
	}

	.rail-progress span.is-current {
		background: var(--mustard);
	}

	.stage-body {
		display: grid;
		gap: 1.35rem;
		padding-top: 1.15rem;
	}

	.stage-kicker {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-size: 0.58rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.stage-kicker span:first-child {
		color: var(--vermilion-ink);
	}

	.stage-heading h2 {
		max-width: 25ch;
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.9rem, 3.6vw, 2.9rem);
		font-weight: 600;
		line-height: 0.98;
		letter-spacing: -0.035em;
	}

	.empty-stage {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(17rem, 0.95fr);
		gap: clamp(1.5rem, 3vw, 2.5rem);
		align-items: center;
		min-height: 27rem;
		padding: clamp(1.5rem, 4vw, 3rem) 0.5rem;
	}

	.empty-copy .micro {
		color: var(--vermilion-ink);
	}

	.empty-copy h2 {
		max-width: 12ch;
		margin: 0.35rem 0 0.8rem;
		font-family: var(--font-display);
		font-size: clamp(2.2rem, 4.4vw, 3.7rem);
		font-weight: 600;
		line-height: 0.92;
		letter-spacing: -0.04em;
	}

	.empty-lede {
		max-width: 34ch;
		margin-bottom: 1.15rem;
		font-size: 0.84rem;
		line-height: 1.55;
		color: var(--ink-soft);
	}

	.ghost {
		border: 1px solid var(--rule);
		padding: 0.85rem;
		background-image: var(--dots);
		background-size: 18px 18px;
		box-shadow: 4px 4px 0 var(--ink);
	}

	.ghost-caption {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.55rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--rule);
		font-size: 0.52rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.ghost-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 3px;
	}

	.ghost-key {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 2.3rem;
		background: var(--paper-deep);
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 700;
		animation: ghost-key-read 6.5s ease-in-out infinite;
		animation-delay: calc(0.9s + var(--col) * 0.55s);
	}

	.ghost-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 2.3rem;
		background: color-mix(in srgb, var(--paper) 72%, transparent);
		border: 1px solid var(--rule);
		font-family: var(--font-mono);
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--ink-soft);
		animation:
			cell-in 400ms both,
			ghost-read 6.5s ease-in-out infinite;
		animation-delay:
			calc(var(--i) * 16ms),
			calc(0.9s + var(--col) * 0.55s + var(--row) * 0.07s);
	}

	.ghost-foot {
		margin-top: 0.55rem;
		font-size: 0.55rem;
		line-height: 1.45;
		letter-spacing: 0.03em;
		color: var(--ink-soft);
	}

	@keyframes ghost-read {
		0%,
		8%,
		100% {
			background: color-mix(in srgb, var(--paper) 72%, transparent);
			border-color: var(--rule);
			color: var(--ink-soft);
		}
		11%,
		17% {
			background: var(--ink);
			border-color: var(--ink);
			color: var(--paper);
		}
	}

	@keyframes ghost-key-read {
		0%,
		8%,
		100% {
			background: var(--paper-deep);
			color: var(--ink);
		}
		11%,
		17% {
			background: var(--ink);
			color: var(--paper);
		}
	}

	.prep-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
		gap: 1.5rem;
	}

	.paper-block {
		min-width: 0;
		padding: 0.8rem 0;
		border-top: 2px solid var(--ink);
		border-bottom: 1px solid var(--ink);
	}

	.normalized-text {
		margin-top: 0.55rem;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
		font-family: var(--font-mono);
		font-size: clamp(1rem, 2vw, 1.35rem);
		font-weight: 700;
		line-height: 1.55;
		letter-spacing: 0.06em;
	}

	.prep-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.8rem;
		margin-top: 0.8rem;
		font-size: 0.68rem;
		letter-spacing: 0.04em;
		color: var(--ink-soft);
	}

	.key-readout {
		display: grid;
		gap: 0.75rem;
		margin: 0.55rem 0 0;
	}

	.key-row {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr);
		gap: 0.5rem;
		align-items: baseline;
		padding-top: 0.6rem;
		border-top: 1px dotted var(--rule);
	}

	.key-row:first-child {
		padding-top: 0;
		border-top: 0;
	}

	.key-row dt {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--ink-soft);
	}

	.key-row dd {
		margin: 0;
	}

	.key-token {
		display: block;
		font-family: var(--font-mono);
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		white-space: pre-wrap;
	}

	.key-meta {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.66rem;
		line-height: 1.5;
		color: var(--ink-soft);
	}

	.key-order {
		white-space: pre-wrap;
	}

	.formula-strip,
	.source-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 1.2rem;
		align-items: baseline;
		padding: 0.55rem 0;
		border-top: 1px dotted var(--rule);
		border-bottom: 1px dotted var(--rule);
		font-size: 0.74rem;
		line-height: 1.5;
		color: var(--ink-soft);
	}

	.formula-strip span {
		white-space: nowrap;
	}

	.source-strip {
		display: grid;
		gap: 0.3rem;
		padding: 0.65rem 0.7rem;
		border: 1px solid var(--rule);
		background: var(--paper-deep);
	}

	.source-strip code {
		overflow-wrap: anywhere;
		white-space: pre-wrap;
		font-size: 0.76rem;
		line-height: 1.5;
		color: var(--ink);
	}

	.read-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr);
		gap: 1.2rem;
		align-items: start;
	}

	.readout {
		border-top: 2px solid var(--ink);
		border-bottom: 1px solid var(--ink);
		padding: 0.7rem 0;
	}

	.readout-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 0.6rem;
		border-bottom: 1px dotted var(--rule);
	}

	.readout-head h3 {
		margin: 0.15rem 0 0;
		font-family: var(--font-display);
		font-size: 1.8rem;
		font-weight: 600;
		line-height: 1;
	}

	.readout-count {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--ink-soft);
	}

	.readout-chunks {
		display: grid;
		gap: 0.2rem;
		padding: 0.55rem 0;
	}

	.chunk {
		display: grid;
		grid-template-columns: 4.2rem minmax(0, 1fr);
		gap: 0.45rem;
		align-items: baseline;
		padding: 0.35rem 0;
		border-bottom: 1px dotted var(--rule);
	}

	.chunk-label {
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--ink-soft);
		text-transform: uppercase;
	}

	.chunk code {
		overflow-wrap: anywhere;
		white-space: pre-wrap;
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1.4;
	}

	.chunk--pending {
		opacity: 0.45;
	}

	.chunk--pending code {
		letter-spacing: 0.18em;
	}

	.readout-total {
		padding-top: 0.6rem;
		border-top: 2px solid var(--ink);
	}

	.tape {
		display: block;
		min-height: 2.6rem;
		margin-top: 0.35rem;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
		font-size: 0.85rem;
		font-weight: 700;
		line-height: 1.55;
		letter-spacing: 0.05em;
	}

	.tape-cursor {
		display: inline-block;
		margin-left: 0.1rem;
		color: var(--vermilion-ink);
		animation: cursor-blink 900ms steps(1, end) infinite;
	}

	.stage-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
		padding-top: 0.9rem;
		border-top: 2px solid var(--ink);
	}

	.footer {
		margin-top: clamp(2.5rem, 6vw, 5rem);
		padding-top: 0.7rem;
		border-top: 2px solid var(--ink);
		font-size: 0.6rem;
		line-height: 1.5;
		letter-spacing: 0.03em;
		color: var(--ink-soft);
	}

	@media (min-width: 1101px) {
		.form-panel {
			position: sticky;
			top: 1.2rem;
		}
	}

	@media (max-width: 1100px) {
		.desk {
			grid-template-columns: minmax(0, 1fr);
		}

		.form-panel {
			position: static;
		}

		.stage-panel {
			margin-top: 0.5rem;
		}

		.read-layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 900px) {
		.empty-stage {
			grid-template-columns: minmax(0, 1fr);
			min-height: 0;
		}

		.ghost {
			max-width: 24rem;
		}
	}

	@media (max-width: 700px) {
		.page {
			padding-top: 0.7rem;
		}

		.title {
			font-size: clamp(1.6rem, 8.2vw, 2.6rem);
			line-height: 0.92;
		}

		.key-grid,
		.prep-grid {
			grid-template-columns: minmax(0, 1fr);
		}

		.stage-panel {
			padding: 0.75rem;
			box-shadow: 4px 4px 0 var(--ink);
		}

		.step-rail {
			flex-wrap: wrap;
			overflow-x: visible;
		}

		.step-rail li {
			flex: 1 1 calc(33.333% - 0.25rem);
		}

		.step-tab {
			min-height: 2.35rem;
			padding: 0.35rem 0.4rem;
			font-size: 0.58rem;
		}

		.step-number {
			font-size: 0.48rem;
		}

		.stage-nav {
			flex-direction: column-reverse;
			align-items: stretch;
		}

		.stage-nav .btn {
			width: 100%;
		}

		.form-actions {
			flex-direction: column;
		}

		.form-actions .btn {
			width: 100%;
		}

		.masthead-foot {
			flex-direction: column;
			align-items: flex-start;
		}

		.masthead-specs {
			flex-wrap: wrap;
		}
	}

	@media (max-width: 420px) {
		.chunk {
			grid-template-columns: 1fr;
			gap: 0.15rem;
		}
	}
</style>
