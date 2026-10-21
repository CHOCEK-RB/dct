<script lang="ts">
	import '@fontsource-variable/fraunces/wght.css';
	import '@fontsource-variable/fraunces/wght-italic.css';
	import '@fontsource/courier-prime/400.css';
	import '@fontsource/courier-prime/700.css';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#F2EADB" />
</svelte:head>

{@render children()}
