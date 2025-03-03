const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: "esbuild-problem-matcher",

	setup(build) {
		build.onStart(() => {
			console.log("[watch] build started")
		})
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`)
				console.error(`    ${location.file}:${location.line}:${location.column}:`)
			})
			console.log("[watch] build finished")
		})
	},
}

const buildConfig = {
	bundle: true,
	minify: production,
	sourcemap: !production,
	logLevel: "silent",
	plugins: [esbuildProblemMatcherPlugin],
	entryPoints: ["src/cli.ts"],
	format: "cjs",
	sourcesContent: false,
	platform: "node",
	outdir: "dist",
	outExtension: { '.js': '.cjs' },
	external: [
		"web-tree-sitter", // Tree-sitter needs to be external
		"node:worker_threads", // Node worker threads need to be external
		"worker_threads", // Also mark without node: prefix
	],
}

async function main() {
	const ctx = await esbuild.context(buildConfig)
	if (watch) {
		await ctx.watch()
	} else {
		await ctx.rebuild()
		await ctx.dispose()
		// Add shebang and make executable after build
		const cliPath = path.join(__dirname, 'dist/cli.cjs')
		const content = fs.readFileSync(cliPath, 'utf8')
		// Remove any existing shebang line
		const contentWithoutShebang = content.replace(/^#!.*\n/, '');
		fs.writeFileSync(cliPath, `#!/usr/bin/env node\n${contentWithoutShebang}`);
		fs.chmodSync(cliPath, '755')
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
