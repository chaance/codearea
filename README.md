<div align="center">

# codearea

[![Latest Release](https://img.shields.io/npm/v/codearea.svg)](https://npm.im/codearea) [![gzip size](http://img.badgesize.io/https://unpkg.com/codearea@latest/dist/codearea.cjs.production.min.js?compression=gzip)](https://unpkg.com/codearea@latest/dist/codearea.cjs.production.min.js) [![license](https://badgen.now.sh/badge/license/MIT)](./LICENSE)

</div>

<h4 align="center">
  A simple, compound React component for editing code in a real field element.
</h4>

<br>

## Motivation

This project began as a fork of [`react-simple-code-editor`](https://github.com/satya164/react-simple-code-editor). Like that package, I wanted a simpler alternative to many of the existing options for in-browser code editor components. But I also love more open, composable APIs for my React components, and I had a few other ideas to improve the accessibility and usability. And that's where `codearea` comes from.

`codearea` is small, simple, and highly usable for simple code fields with syntax highlighting. You won't use it for a full-featured IDE any time soon, but it's great for small developer tools, form fields, or live-code blocks for documentation.

## Features

- Modular syntax highlighting with thir-party library
- Indent a line or selected text by pressing <kbd>Tab</kbd>, with customizable indentation props
- Automatic indent on new lines
- Wrap selected text in parens, brackets, or quotes
- Undo/redo entire words instead of letter-by-letter
- Nice accessibility features:
  - Use <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> (Mac) or <kbd>Ctrl</kbd> + <kbd>M</kbd> to toggle the capturing tab key
  - When tabbing to the field, the outer wrapper receives focus rather than the field itself. The sighted user gets a visual indicator, and screen reader users will get announced instructions for entering the text field with <kbd>ArrowDown</kbd>.
  - When editing, the <kbd>Tab</kbd> key works as normal for indention. The user can move focus back to the wrapper (and back to the normal page flow) by pressing <kbd>Escape</kbd>.

## Installation

```sh
$ npm install codearea
# or
$ yarn add codearea
```

## Usage

There are two APIs for a `codearea` block. The high-level closed API uses a single component to give you a configurable component with all of the nested components baked in.

```jsx
import React from "react";
import CodeArea from "codearea";
function MyCodeBlock() {
	return <CodeArea aria-label="Type some code" />;
}
```

The component supports both [controlled](https://reactjs.org/docs/forms.html#controlled-components) and [uncontrolled](https://reactjs.org/docs/uncontrolled-components.html) state. If you need access to the code content, switch to controlled state using the `value` and `onValueChange` props.

```jsx
import React from "react";
import CodeArea from "codearea";
function MyCodeBlock() {
	const [code, setCode] = React.useState("let start;");
	return (
		<CodeArea
			value={code}
			onValueChange={(newCode) => setCode(newCode)}
			aria-label="Type some code"
		/>
	);
}
```

To get syntax highlighting, you need to use the editor with a third party library which provides syntax highlighting. In this example, we'll use [`prismjs`](https://prismjs.com):

```js
import React from "react";
import CodeArea from "codearea";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-jsx";

function MyCodeBlock() {
	const [code, setCode] = React.useState("let start;");
	return (
		<CodeArea
			value={code}
			onValueChange={(newCode) => setCode(newCode)}
			highlight={(c) => highlight(c, languages.jsx, "jsx")}
			aria-label="Type some code"
		/>
	);
}
```

Note that depending on your syntax highlighter, you might have to include additional CSS for syntax highlighting to work.

Finally, if you want to customize or access individual sub-components or restrucure anything, you can drop down to the lower-level composed API. Values are passed to nested components from the `CodeAreaShell` via [React's context API](https://reactjs.org/docs/context.html).

```js
import React from "react";
import {
	CodeAreaShell,
	CodeAreaField,
	CodeAreaFocusLabel,
	CodeAreaFormatted,
} from "codearea";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-jsx";

function MyCodeBlock() {
	const [code, setCode] = React.useState("let start;");
	return (
		<CodeAreaShell
			value={code}
			onValueChange={(c) => setCode(c)}
			highlight={(c) => highlight(c, languages.jsx, "jsx")}
		>
			<CodeAreaFocusLabel />
			<CodeAreaField aria-label="Type some code" />
			<CodeAreaFormatted />
		</CodeAreaShell>
	);
}
```

## Styling

`codearea` provides some basic, unopinionated styles to make things function nicely and simplify customization. These styles are available as a plain CSS stylesheet or CSS-in-JS object you can consumer with your styling library of choice (we adhere to standard Styled Components JS object syntax here).

### With CSS

Import the stylesheet however you'd import any other styles in your project, and that's it! Make sure to add your customized styles later in the cascade for predictable results.

```js
import "codearea/styles.css";
```

### With JavaScript

Here's an example of composing the default styles with Styled Components using the low-level composable `codearea` components:

```jsx
import React from "react";
import { styled } from "styled-components";
import {
	CodeAreaShell,
	CodeAreaField,
	CodeAreaFocusLabel,
	CodeAreaFormatted,
	styles,
} from "codearea";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-jsx";

function MyCodeBlock() {
	const [code, setCode] = React.useState("let start;");
	return (
		<StyledShell
			value={code}
			onValueChange={(c) => setCode(c)}
			highlight={(c) => highlight(c, languages.jsx, "jsx")}
		>
			<StyledFocusLabel />
			<StyledField aria-label="Type some code" />
			<StyledFormatted />
		</StyledShell>
	);
}

const StyledShell = styled(CodeAreaShell)({
	...styles.shell,
	border: "1px solid var(--red)",
});

const StyledFocusLabel = styled(CodeAreaFocusLabel)({
	...styles.focusLabel,
	position: "absolute",
	top: 0,
	right: 0,
});

const StyledField = styled(CodeAreaField)({
	// much of the styling for the text field
	// and visible formatted component are shared
	// via the `editor` key. In customizing you want
	// to share some spacing styles with both components
	// for best results.
	...styles.editor,
	...styles.field,
	padding: 10,
});

const StyledFormatted = styled(CodeAreaFormatted)({
	...styles.editor,
	...styles.formatted,
	padding: 10,
	color: "#999",
});
```

Alternatively, you can ignore our base styles and do your own thing, though it should be easier if you don't!

## Props

The high-level single-component `CodeArea` accepts all the props accepted by `textarea` with a few exceptions. Functional props related to the field will be passed to the field itself, while other DOM props are passed to the wrapper `div`. We try to be intelligent about passing props where they are most likely needed, but if you need more control you can use the composed API to pass specific DOM props to the right element.

### `CodeArea` props

#### `defaultValue?: string`

Starting value of the text field. This must be used only in an [uncontrolled state](https://reactjs.org/docs/uncontrolled-components.html).

#### `value?: string`

Controlled value of the text field. This must be used only in an [controlled state](https://reactjs.org/docs/forms.html#controlled-components).

#### `onValueChange?(newValue: string): void`

Callback that fires when the value of the editor changes. For a controlled component, you'll need to update the `value` prop when this is called.

#### `highlight?(value: string): string | React.ReactNode`

Callback that receives the text value and returns with formatting applied. You'll need to return an HTML string or a React element with syntax highlighting using a library such as [`prismjs`](https://prismjs.com).

#### `tabSize?: number`

The number of characters to insert when pressing tab key. For example, for 4 space indentation, `tabSize` will be `4` and `insertSpaces` will be `true`. Defaults to `2`.

#### `indentStyle?: "spaces" | "tab"`

Whether to indent with spaces or a tab. Defaults to `"spaces"`. If set to `"tab"`, the `tabSize` prop will have no effect. Visual tab representation is best handled by styles.

#### `indentOnTab?: boolean`

Whether or not to auto-indent when the user presses <kbd>Enter</kbd> to move to a new line. Defaults to `true`.

Note that this only works predictably when entering into a new block with C-like languages that use brackets to denote block openings and closings. To keep the package relatively lean, I have no intention of expanding this feature beyond its current capabilities at the moment.

#### `id?: string`

Because IDs are typically needed on text fields to pair them with a label, we forward the `id` prop along to the underlying `textarea` element. If you need an `id` on the wrapper element, use the lower level composed API.

### `CodeAreaShell` props

The `CodeAreaShell` is a wrapper component that provides context to its children and renders a `div`. It accepts all of the custom props outlined for `CodeArea`, in addition to any `div` props and others listed here.

#### `ariaDescription?: string | null`

The `ariaDescription` prop is used to provide helpful intructions for both sighted users who navigate by keyboard or switch tools, or for screen reader users via an announcement when the element receives focus. By default, the description will read `Press the down arrow to edit` when focus lands on the outer element. You can override that with this prop, but be sure to include that information in some form if you do so that navigation is clear for all users.

Alternatively, you can pass `null` to exclude the description altogether. If you do, it is extremely important for you to [provide a description from eleswhere in the document via `aria-describedby`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-describedby_attribute).

### `CodeAreaFocusLabel` props

The `CodeAreaFocusLabel` renders the label that appears when focus lands on the wrapper. Its contents by default will mirror the `ariaDescription` in `CodeAreaShell`, though you can pass any other content you'd like directly as children. All other props come are forwarded on to the underlying `span`.

### `CodeAreaField` props

The `CodeAreaField` renders the visibly hidden `textarea` element. It forwards any props normally received by `textarea` except for:

- `defaultValue`
- `value`
- `placeholder`

`defaultValue` or `value` should always be passed to the top-level `CodeAreaShell` component since it is reponsible for managing state throughout the component tree. The `placeholder` prop makes no sense here since we hide the field's content anyway!

### `CodeAreaFormatted` props

The `CodeAreaFormatted` renders the formatted element that mirrors the value of the `CodeAreaField`. It is rendered as a `pre` element and forwards all of its DOM props along to it.

## Demo

TODO

## How it works

It works by overlaying a syntax highlighted `<pre>` block over a `<textarea>`. When you type, select, copy text, undo, or do anything else inside the field, you interact with the underlying `<textarea>` so the experience feels native. This is a very simple approach compared to other editors which re-implement the behaviour from scratch.

Syntax highlighting can be done by any third party library as long as it returns HTML and is fully controllable by the user.

The vanilla `<textarea>` doesn't support inserting tab characters for indentation, so we re-implement it by listening to `keydown` events and programmatically updating the text. One caveat with programmatically updating the text is that we lose the native undo stack, so we need to maintain our own. As a result, we can also implement improved undo behaviour such as undoing whole words similar to more feature-rich editors like VS Code.

## Limitations

Due to the way it works, it has certain limitations:

- The syntax highlighted code cannot have different font families, font weights, font styles or line heights for its content. Since the editor works by aligning the highlighted code over a `<textarea>`, changing anything that affects the layout can misalign the two elements which will result in a less than ideal user experience.
- The custom undo stack is incompatible with the undo/redo items in the browser's context menu. However, other full featured editors don't support browser's undo/redo menu items either, so this is a limitation we're stuck with unless browses provide an API for this.
- The editor is not optimized for performance, and large documents can affect the typing speed. More advanced editors may virtualize lines, but we optimize instead for simplicity and bundle size.
- We hide text in the `textarea` using `-webkit-text-fill-color: transparent`, which works in all modern browsers (even non-webkit ones such as Firefox and Edge). For IE, we use `color: transparent` which doesn't hide the cursor. Text may appear bolder in unsupported browsers, so if you need to support anything else you may want to consider detecting the browser and rendering a normal `textarea` where required.

## Contributing

While developing, you can run the example app to test your changes:

```sh
yarn example
```

<!-- badges -->

[build-badge]: https://img.shields.io/circleci/project/github/chancestrickland/codearea/master.svg?style=flat-square
[build]: https://circleci.com/gh/chancestrickland/codearea
[license-badge]: https://img.shields.io/npm/l/codearea.svg?style=flat-square
[license]: https://opensource.org/licenses/MIT
[version-badge]: https://img.shields.io/npm/v/codearea.svg?style=flat-square
[package]: https://www.npmjs.com/package/codearea
[bundle-size-badge]: https://img.shields.io/bundlephobia/minzip/codearea.svg?style=flat-square
[bundle-size]: https://bundlephobia.com/result?p=codearea
