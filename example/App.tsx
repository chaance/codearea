import * as React from "react";
import * as ReactDOM from "react-dom";
import {
	CodeAreaShell,
	CodeAreaField,
	CodeAreaFocusLabel,
	CodeAreaFormatted,
	styles,
} from "../src/index";
import styled from "styled-components";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-jsx";

// Uncomment if you want to use the generated stylesheet instead of styled
// components for base styles
// import "../dist/styles.css";

import "./styles.scss";

const App: React.FC = () => {
	const [code, setCode] = React.useState(() =>
		`
import React from "react";
import ReactDOM from "react-dom";
import { highlight } from "./utils";

function App() {
  let [code, setCode] = React.useState(\`
    let app = start();
  \`);
  return (
    <CodeArea
      highlight={highlight}
      value={code}
      setValue={setCode}
    />
  );
}

ReactDOM.render(
  <App />,
  document.getElementById("root")
);
`.trim()
	);
	return (
		<div className="app">
			{/* <header className="header"></header> */}
			<main className="main">
				<section className="main__content">
					<div className="main__content-header">
						<h1>
							<Tag which="open" />
							codearea
							<Tag which="close" />
						</h1>
						<p>A simple, composable, and accessible code editor component.</p>
					</div>
					<a
						className="button"
						href="https://github.com/chancestrickland/codearea"
					>
						GitHub
					</a>
					<div className="main__editor-wrapper">
						<StyledShell
							className="main__editor"
							value={code}
							onValueChange={(c) => setCode(c)}
							highlight={(c) => highlight(c, languages.jsx, "jsx")}
						>
							<StyledFocusLabel />
							<StyledField aria-label="Type some code" />
							<StyledFormatted />
						</StyledShell>
					</div>
				</section>
			</main>
			{/* <footer></footer> */}
		</div>
	);
};

function Tag({ which }: { which: "open" | "close" }) {
	return (
		<span style={{ fontWeight: 100, opacity: 0.5 }} aria-hidden>
			{which === "open" ? "<" : " />"}
		</span>
	);
}

const StyledShell = styled(CodeAreaShell)({
	...styles.shell,
});

const StyledFocusLabel = styled(CodeAreaFocusLabel)({
	...styles.focusLabel,
});

const StyledField = styled(CodeAreaField)({
	...styles.editor,
	...styles.field,
});

const StyledFormatted = styled(CodeAreaFormatted)({
	...styles.editor,
	...styles.formatted,
});

ReactDOM.render(<App />, document.getElementById("root"));
