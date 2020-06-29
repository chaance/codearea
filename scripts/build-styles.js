const path = require("path");
const fs = require("fs").promises;
const postcss = require("postcss");
const postcssJs = require("postcss-js");
const { cwd } = require("process");
const { stylesWithSelectors } = require("../dist/index.js");
const {
	createProgressEstimator,
} = require("tsdx/dist/createProgressEstimator");

async function buildStyles() {
	let logger = await createProgressEstimator();

	let compilingStyles = postcss([
		require("postcss-nested"),
		require("cssnano")({
			preset: "default",
		}),
	]).process(stylesWithSelectors, {
		parser: postcssJs,
		from: undefined,
	});

	logger(compilingStyles, "Compiling styles");

	const { css } = await compilingStyles;
	const writingStyleSheet = fs.writeFile(
		path.resolve(cwd(), "dist/styles.css"),
		css
	);

	logger(writingStyleSheet, "Writing styles");

	await writingStyleSheet;
}

buildStyles();
