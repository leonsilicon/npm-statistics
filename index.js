const path = require("path");
const fs = require("fs");
const _ = require("lodash");
const table = require("markdown-table");
const markdownMagic = require("markdown-magic");
const npmtotal = require("npmtotal");
const pkg = require("./package.json");
const badgeStats = require("./stats.json");

const key = pkg["npm-stats"];

if (!key) {
	throw new Error("Please add `npm-stats` to your package.json"); // eslint-disable-line
}

const include = [
	"@types/console-clear",
	"@types/is-file-esm",
	"@types/style-inject",
	"@types/typedarray-to-buffer",
	"@types/ansi-align",
	"@types/get-size",
	"@types/is-async-function",
	"@types/markdown-it-footnote",
];

const exclude = []

function numberWithCommas(x) {
	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function generateMarkdownTable(tableRows, sum, totalNumPackages) {
	const total = numberWithCommas(sum);
	const config = {
		transforms: {
			PACKAGES() {
				return table([
					["Name", "Downloads"],
					["**Total**", `**${total}**`],
					...tableRows,
					["**Total**", `**${total}**`],
					["**Total # of Packages**", `**${totalNumPackages}**`],
				]);
			},
		},
	};

	markdownMagic(path.join(__dirname, "README.md"), config, (d) => {
		console.log(`Updated total downloads ${sum}`);
	});
}

(async () => {
	console.log(`Running npmtotal(${key}), This can take some time`);
	const stats = await npmtotal(key, {
		exclude: exclude,
	});

	let packageStats =
		include.length === 0
			? {
					stats: [],
					sum: 0,
				}
			: await npmtotal(include);

	const totalNumPackages = stats.stats.length + packageStats.stats.length;

	const sortedStats = _.reverse(
		_.sortBy(
			[...stats.stats, ...packageStats.stats],
			[
				function (o) {
					return o[1];
				},
			]
		)
	)
		.filter((d) => {
			const [name, count] = d;
			if (count === 0) {
				return false;
			}
			if (name.match(/^@middy/)) {
				return false;
			}
			return true;
		})
		.map((d) => {
			const [name, count] = d;
			return [
				`[${name}](https://www.npmjs.com/package/${name})`,
				numberWithCommas(count),
			];
		});
	// '@serverless', '@netlify', 'netlify-', '@middy'

	const sum = stats.sum + packageStats.sum;
	badgeStats.message = `${numberWithCommas(sum)} Downloads`;

	await fs.writeFileSync("./stats.json", JSON.stringify(badgeStats, null, 2));

	generateMarkdownTable(sortedStats, sum, totalNumPackages);
})();
