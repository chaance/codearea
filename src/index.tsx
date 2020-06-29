import * as React from "react";
import { useId } from "@reach/auto-id";
import VisuallyHidden from "@reach/visually-hidden";

// TODO: Fix bug where the cursor goes to the wrong position on the last undo

const DA_SHELL = "data-codearea-shell";
const DA_FOCUS_LABEL = "data-codearea-focus-label";
const DA_FIELD = "data-codearea-field";
const DA_FORMATTED = "data-codearea-formatted";

const __DEV__ = process.env.NODE_ENV === "development";

const DEFAULT_SHELL_DESC = `Press the down arrow to edit`;
const DEFAULT_TEXTAREA_DESC = `Press Escape then Tab to exit the text editor`;
const NOTAB_TEXTAREA_DESC = `Press Tab to exit the text editor`;

const SPACES = "spaces";

// The max number of history (redo/undo) actions to store in the stack
const HISTORY_LIMIT = 100;
// The timeout length between keystrokes to determine a single history entry
const HISTORY_TIME_GAP = 3000;

const isWindows = "navigator" in global && /Win/i.test(navigator.platform);
const isMacLike =
	"navigator" in global && /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);

interface CodeAreaContextValue {
	value: string;
	textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
	highlight(value: string): string | React.ReactNode;
	indentOnTab: boolean;
	ariaDescription: string | null | undefined;
	shellHasFocus: boolean;
}

interface CodeAreaCallbackContextValue {
	handleChange(event: React.ChangeEvent<HTMLTextAreaElement>): void;
	handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void;
}

const CodeAreaContext = React.createContext({} as CodeAreaContextValue);
const CodeAreaCallbackContext = React.createContext(
	{} as CodeAreaCallbackContextValue
);

type CodeAreaShellDOMProps = Omit<
	React.ComponentPropsWithoutRef<"div">,
	"defaultValue" | "value"
>;
type CodeAreaShellOwnProps = {
	/**
	 * If null is passed, description will be excluded. User should explicitly
	 * set an aria description.
	 */
	ariaDescription?: string | null;
	defaultValue?: string;
	value?: string;
	onValueChange?(value: string): void;
	highlight?(value: string): string | React.ReactNode;
	tabSize?: number;
	indentStyle?: "tab" | "spaces";
	indentOnTab?: boolean;
};
type CodeAreaShellProps = CodeAreaShellDOMProps & CodeAreaShellOwnProps;
type CodeAreaShellRefValue = HTMLDivElement & SessionHandles;

const CodeAreaShell = React.forwardRef<
	CodeAreaShellRefValue,
	CodeAreaShellProps
>(function CodeAreaShell(
	{
		ariaDescription,
		children,
		defaultValue,
		highlight,
		indentOnTab = true,
		indentStyle = SPACES,
		onBlur,
		onFocus,
		onKeyDown,
		onValueChange: onValueChangeProp,
		tabSize = 2,
		value: valueProp,
		...props
	},
	forwardedRef
) {
	let controlledRef = React.useRef(valueProp != null);
	let [valueState, setValue] = React.useState(
		controlledRef.current ? valueProp! : defaultValue || ""
	);
	let value = controlledRef.current ? valueProp! : valueState;

	function handleValueChange(newValue: string) {
		if (!controlledRef.current) {
			setValue(newValue);
		}
		onValueChangeProp && onValueChangeProp(newValue);
	}

	let handleValueChangeRef = useCallbackRef(handleValueChange);

	let _descriptionId = useId();
	let descriptionId = `codearea-shell-description-${
		props.id || _descriptionId
	}`;

	let includeAriaDescription = ariaDescription !== null;

	let [capture, setCapture] = React.useState(true);
	let textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
	let history = React.useRef<TypeHistory>({
		stack: [],
		offset: -1,
	});

	let recordChange = React.useCallback(function recordChange(
		record: TypeHistoryRecord,
		overwrite = false
	) {
		let { stack, offset } = history.current;

		if (stack.length && offset > -1) {
			// When something updates, drop the redo operations
			history.current.stack = stack.slice(0, offset + 1);

			// Limit the number of operations to 100
			let count = history.current.stack.length;

			if (count > HISTORY_LIMIT) {
				let extras = count - HISTORY_LIMIT;

				history.current.stack = stack.slice(extras, count);
				history.current.offset = Math.max(history.current.offset - extras, 0);
			}
		}

		let timestamp = Date.now();

		if (overwrite) {
			let last = history.current.stack[history.current.offset];

			if (last && timestamp - last.timestamp < HISTORY_TIME_GAP) {
				// A previous entry exists and was in short interval

				// Match the last word in the line
				let re = /[^a-z0-9]([a-z0-9]+)$/i;

				// Get the previous line
				let pl = getLines(last.value, last.selectionStart).pop();
				let previous = (pl && pl.match(re)) || undefined;

				// Get the current line
				let cl = getLines(record.value, record.selectionStart).pop();
				let current = (cl && cl.match(re)) || undefined;

				if (previous && current && current[1].startsWith(previous[1])) {
					// The last word of the previous line and current line match
					// Overwrite previous entry so that undo will remove whole word
					history.current.stack[history.current.offset] = {
						...record,
						timestamp,
					};

					return;
				}
			}
		}

		// Add the new operation to the stack
		history.current.stack.push({ ...record, timestamp });
		history.current.offset++;
	},
	[]);

	React.useEffect(() => {
		const { current: input } = textareaRef;

		if (!input) {
			return;
		}

		// Save current state of the input
		const { value: inputValue, selectionStart, selectionEnd } = input;

		recordChange({
			value: inputValue,
			selectionStart,
			selectionEnd,
		});
	}, [recordChange]);

	const textareaHandleKeyDown = React.useCallback(
		function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
			let { current: textareaRefElement } = textareaRef;
			let input = event.target as HTMLTextAreaElement;

			// When indenting with tabs, we always insert a single tab.
			// Visual tab size can be set with CSS.
			let tabCharSize = indentStyle === SPACES ? tabSize : 1;
			let tabCharacter = (indentStyle === SPACES ? " " : "\t").repeat(
				tabCharSize
			);

			if (event.key === "Escape") {
				// Instead of blurring the field and sending focus back to the body,
				// we re-focus the shell element on escape so the user can continue
				// tabbing from their current position on screen.
				ownRef.current?.focus();
			}

			let { value: inputValue = "", selectionStart, selectionEnd } = input;

			let lowerKey = event.key.toLowerCase();

			let isUndoing =
				(isMacLike
					? // Trigger undo with ⌘+Z on Mac
					  event.metaKey && lowerKey === "z"
					: // Trigger undo with Ctrl+Z on other platforms
					  event.ctrlKey && lowerKey === "z") &&
				!event.shiftKey &&
				!event.altKey;

			let isRedoing =
				(isMacLike
					? // Trigger redo with ⌘+Shift+Z on Mac
					  event.metaKey && lowerKey === "z" && event.shiftKey
					: isWindows
					? // Trigger redo with Ctrl+Y on Windows
					  event.ctrlKey && lowerKey === "y"
					: // Trigger redo with Ctrl+Shift+Z on other platforms
					  event.ctrlKey && lowerKey === "z" && event.shiftKey) &&
				!event.altKey;

			let isRequestingToLeaveFocus =
				lowerKey === "m" &&
				event.ctrlKey &&
				(isMacLike ? event.shiftKey : true);

			switch (event.key) {
				case "ArrowDown":
					event.stopPropagation();
					return;
				case "Tab": {
					if (!indentOnTab || !capture) {
						return;
					}

					// Prevent focus change
					event.preventDefault();

					if (event.shiftKey) {
						// Unindent selected lines
						let linesBeforeCaret = getLines(inputValue, selectionStart);
						let startLine = linesBeforeCaret.length - 1;
						let endLine = getLines(inputValue, selectionEnd).length - 1;
						let nextValue = inputValue
							.split("\n")
							.map((line, i) => {
								if (
									i >= startLine &&
									i <= endLine &&
									line.startsWith(tabCharacter)
								) {
									return line.substring(tabCharacter.length);
								}

								return line;
							})
							.join("\n");

						if (inputValue !== nextValue) {
							let startLineText = linesBeforeCaret[startLine];

							applyEdits({
								value: nextValue,
								// Move the start cursor if first line in selection was modified
								// It was modified only if it started with a tab
								selectionStart: startLineText.startsWith(tabCharacter)
									? selectionStart - tabCharacter.length
									: selectionStart,
								// Move the end cursor by total number of characters removed
								selectionEnd:
									selectionEnd - (inputValue.length - nextValue.length),
							});
						}
					} else if (selectionStart !== selectionEnd) {
						// Indent selected lines
						let linesBeforeCaret = getLines(inputValue, selectionStart);
						let startLine = linesBeforeCaret.length - 1;
						let endLine = getLines(inputValue, selectionEnd).length - 1;
						let startLineText = linesBeforeCaret[startLine];

						applyEdits({
							value: inputValue
								.split("\n")
								.map((line, i) => {
									if (i >= startLine && i <= endLine) {
										return tabCharacter + line;
									}

									return line;
								})
								.join("\n"),
							// Move the start cursor by number of characters added in first line of selection
							// Don't move it if it there was no text before cursor
							selectionStart: /\S/.test(startLineText)
								? selectionStart + tabCharacter.length
								: selectionStart,
							// Move the end cursor by total number of characters added
							selectionEnd:
								selectionEnd + tabCharacter.length * (endLine - startLine + 1),
						});
					} else {
						let updatedSelection = selectionStart + tabCharacter.length;

						applyEdits({
							// Insert tab character at caret
							value:
								inputValue.substring(0, selectionStart) +
								tabCharacter +
								inputValue.substring(selectionEnd),
							// Update caret position
							selectionStart: updatedSelection,
							selectionEnd: updatedSelection,
						});
					}
					return;
				}
				case "Backspace": {
					let hasSelection = selectionStart !== selectionEnd;
					let textBeforeCaret = inputValue.substring(0, selectionStart);

					if (textBeforeCaret.endsWith(tabCharacter) && !hasSelection) {
						// Prevent default delete behaviour
						event.preventDefault();

						let updatedSelection = selectionStart - tabCharacter.length;

						applyEdits({
							// Remove tab character at caret
							value:
								inputValue.substring(0, selectionStart - tabCharacter.length) +
								inputValue.substring(selectionEnd),
							// Update caret position
							selectionStart: updatedSelection,
							selectionEnd: updatedSelection,
						});
					}
					return;
				}
				case "Enter": {
					// Ignore selections
					if (selectionStart !== selectionEnd) {
						return;
					}

					// Get the current line to set indention level
					let line = getLines(inputValue, selectionStart).pop();
					let indent = "";
					let lineTrimmed = line && line.trim();

					// Increase indention if we're opening a block
					// TODO: Should bracketless syntax be supported? Could get pretty
					//       gnarly here if so.
					if (
						lineTrimmed &&
						["{", "[", "("].includes(lineTrimmed.charAt(lineTrimmed.length - 1))
					) {
						indent = tabCharacter;
					}

					// Find current level of indention
					let matches = line && line.match(/^\s+/);
					if (matches && matches[0]) {
						// Preserve indentation on inserting a new line
						indent += matches[0];
					}
					if (indent) {
						event.preventDefault();
						indent = "\n" + indent;
						let updatedSelection = selectionStart + indent.length;

						applyEdits({
							// Insert indentation character at caret
							value:
								inputValue.substring(0, selectionStart) +
								indent +
								inputValue.substring(selectionEnd),
							// Update caret position
							selectionStart: updatedSelection,
							selectionEnd: updatedSelection,
						});
					}
					return;
				}
				case "(":
				case "{":
				case "[":
				case "'":
				case '"':
				case "`": {
					// Only continue if text is selected
					if (selectionStart === selectionEnd) {
						return;
					}

					const pairs = {
						"(": ")",
						"{": "}",
						"[": "]",
						"'": "'",
						'"': '"',
						"`": "`",
					};

					let newValue = wrapText(
						event.key,
						pairs[event.key],
						inputValue,
						selectionStart,
						selectionEnd
					);

					// If text is selected, wrap them in the characters
					if (selectionStart !== selectionEnd && newValue) {
						event.preventDefault();
						applyEdits({
							value: newValue,
							// Update caret position
							selectionStart,
							selectionEnd: selectionEnd + 2,
						});
					}
					return;
				}
				default:
					break;
			}

			if (isUndoing) {
				event.preventDefault();
				undoEdit();
			} else if (isRedoing) {
				event.preventDefault();
				redoEdit();
			} else if (isRequestingToLeaveFocus) {
				event.preventDefault();
				setCapture((cap) => !cap);
			}

			function undoEdit() {
				let { stack, offset } = history.current;

				// Get the previous edit
				let record = stack[offset - 1];

				if (record) {
					// Apply the changes and update the offset
					updateInput(record);
					history.current.offset = Math.max(offset - 1, 0);
				}
			}

			function redoEdit() {
				const { stack, offset } = history.current;

				// Get the next edit
				const record = stack[offset + 1];

				if (record) {
					// Apply the changes and update the offset
					updateInput(record);
					history.current.offset = Math.min(offset + 1, stack.length - 1);
				}
			}

			function applyEdits(record: TypeHistoryRecord) {
				// Save last selection state
				const last = history.current.stack[history.current.offset];

				if (last && textareaRefElement) {
					history.current.stack[history.current.offset] = {
						...last,
						selectionStart: textareaRefElement.selectionStart,
						selectionEnd: textareaRefElement.selectionEnd,
					};
				}

				// Save the changes
				recordChange(record);
				updateInput(record);
			}

			function updateInput(record: TypeHistoryRecord) {
				if (!textareaRefElement) {
					return;
				}

				// Update values and selection state
				textareaRefElement.value = record.value;
				textareaRefElement.selectionStart = record.selectionStart!;
				textareaRefElement.selectionEnd = record.selectionEnd!;

				handleValueChangeRef.current &&
					handleValueChangeRef.current(record.value);
			}
		},
		[
			capture,
			handleValueChangeRef,
			indentOnTab,
			indentStyle,
			recordChange,
			tabSize,
		]
	);

	let textareaHandleChange = React.useCallback(
		function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
			const {
				value: inputValue,
				selectionStart,
				selectionEnd,
			} = event.target as HTMLTextAreaElement;

			recordChange(
				{
					value: inputValue,
					selectionStart,
					selectionEnd,
				},
				true
			);

			handleValueChangeRef.current && handleValueChangeRef.current(inputValue);
		},
		[handleValueChangeRef, recordChange]
	);

	function shellHandleKeyDown(event: React.KeyboardEvent) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			textareaRef.current && textareaRef.current.focus();
		}
	}

	const ownRef = React.useRef<HTMLDivElement | null>(null);
	React.useImperativeHandle(forwardedRef, () => ({
		...(ownRef.current || ({} as any)),
		getSession: () => history.current,
		setSession: (session: { history: TypeHistory }) => {
			if (!session || !session.history) {
				return;
			}
			history.current = session.history;
		},
	}));

	const [shellHasFocus, setShellHasFocus] = React.useState(false);
	const setFocusAfterRefPlacement = React.useCallback(
		function setFocusAfterRefPlacement(node: HTMLDivElement) {
			setShellHasFocus(node === document.activeElement);
		},
		[]
	);
	const ref = useComposedRefs(forwardedRef, ownRef, setFocusAfterRefPlacement);

	function handleFocus(event: React.FocusEvent) {
		if (event.target === ownRef.current) {
			setShellHasFocus(true);
		}
	}

	function handleBlur(event: React.FocusEvent) {
		if (event.relatedTarget !== ownRef.current) {
			setShellHasFocus(false);
		}
	}

	return (
		<CodeAreaCallbackContext.Provider
			value={{
				handleChange: textareaHandleChange,
				handleKeyDown: textareaHandleKeyDown,
			}}
		>
			<CodeAreaContext.Provider
				value={{
					value,
					textareaRef,
					highlight: highlight || ((v) => v),
					indentOnTab,
					ariaDescription,
					shellHasFocus,
				}}
			>
				{includeAriaDescription && (
					<VisuallyHidden id={descriptionId}>
						{ariaDescription || DEFAULT_SHELL_DESC}
					</VisuallyHidden>
				)}
				<div
					{...{ [`${DA_SHELL}`]: "" }}
					role="group"
					tabIndex={0}
					aria-label="Code editor"
					aria-describedby={includeAriaDescription ? descriptionId : undefined}
					ref={ref}
					onKeyDown={composeEvents(onKeyDown, shellHandleKeyDown)}
					onFocus={composeEvents(onFocus, handleFocus)}
					onBlur={composeEvents(onBlur, handleBlur)}
					{...props}
				>
					{children}
				</div>
			</CodeAreaContext.Provider>
		</CodeAreaCallbackContext.Provider>
	);
});

type CodeAreaFocusLabelDOMProps = React.ComponentPropsWithoutRef<"span">;
type CodeAreaFocusLabelProps = CodeAreaFocusLabelDOMProps;

const CodeAreaFocusLabel = React.forwardRef<
	HTMLSpanElement,
	CodeAreaFocusLabelProps
>(function CodeAreaFocusLabel({ children, ...props }, forwardedRef) {
	const { ariaDescription, shellHasFocus } = React.useContext(CodeAreaContext);
	return (
		<span
			ref={forwardedRef}
			aria-hidden
			hidden={!shellHasFocus}
			{...{ [`${DA_FOCUS_LABEL}`]: "" }}
			{...props}
		>
			{children || ariaDescription || DEFAULT_SHELL_DESC}
		</span>
	);
});

CodeAreaFocusLabel.displayName = "CodeAreaFocusLabel";

type CodeAreaFieldDOMProps = Omit<
	React.ComponentPropsWithoutRef<"textarea">,
	"defaultValue" | "value" | "placeholder"
>;
type CodeAreaFieldOwnProps = {
	/**
	 * If null is passed, description will be excluded. User should explicitly
	 * set an aria description.
	 */
	ariaDescription?: string | null;
};
type CodeAreaFieldProps = CodeAreaFieldDOMProps & CodeAreaFieldOwnProps;

const CodeAreaFieldImpl = React.forwardRef<
	HTMLTextAreaElement,
	CodeAreaFieldProps
>(function CodeAreaField(
	{ onChange, onKeyDown, ariaDescription, ...props },
	forwardedRef
) {
	let { handleChange, handleKeyDown } = React.useContext(
		CodeAreaCallbackContext
	);
	let { textareaRef, value, indentOnTab } = React.useContext(CodeAreaContext);
	let ref = useComposedRefs(forwardedRef, textareaRef);

	let _descriptionId = useId();
	let descriptionId = `codearea-field-description-${
		props.id || _descriptionId
	}`;

	let includeAriaDescription = props["aria-describedby"] == null;

	return (
		<React.Fragment>
			{includeAriaDescription && (
				<VisuallyHidden id={descriptionId}>
					{indentOnTab ? DEFAULT_TEXTAREA_DESC : NOTAB_TEXTAREA_DESC}
				</VisuallyHidden>
			)}
			<textarea
				ref={ref}
				tabIndex={-1}
				{...{ [`${DA_FIELD}`]: "" }}
				aria-describedby={includeAriaDescription ? descriptionId : undefined}
				autoCapitalize="off"
				autoComplete="off"
				autoCorrect="off"
				spellCheck={false}
				{...props}
				value={value}
				onChange={composeEvents(onChange, handleChange)}
				onKeyDown={composeEvents(onKeyDown, handleKeyDown)}
			/>
		</React.Fragment>
	);
});

CodeAreaFieldImpl.displayName = "CodeAreaField";
const CodeAreaField = React.memo(CodeAreaFieldImpl);

type CodeAreaFormattedDOMProps = React.ComponentPropsWithoutRef<"pre">;
type CodeAreaFormattedProps = CodeAreaFormattedDOMProps;

const CodeAreaFormattedImpl = React.forwardRef<
	HTMLPreElement,
	CodeAreaFormattedProps
>(function CodeAreaFormatted({ children, ...props }, forwardedRef) {
	let { highlight, value } = React.useContext(CodeAreaContext);
	const highlighted = highlight(value);
	return (
		<pre
			ref={forwardedRef}
			{...{ [`${DA_FORMATTED}`]: "" }}
			aria-hidden
			{...props}
			{...(typeof highlighted === "string"
				? { dangerouslySetInnerHTML: { __html: highlighted + "<br />" } }
				: { children: highlighted })}
		/>
	);
});

CodeAreaFormattedImpl.displayName = "CodeAreaFormatted";
const CodeAreaFormatted = React.memo(CodeAreaFormattedImpl);

type CodeAreaDOMProps = Omit<
	React.ComponentPropsWithoutRef<"div">,
	| "onClick"
	| "onFocus"
	| "onBlur"
	| "onChange"
	| "onKeyUp"
	| "onKeyDown"
	| "placeholder"
	| "defaultValue"
	| "value"
> &
	Pick<
		React.ComponentPropsWithoutRef<"textarea">,
		| "autoFocus"
		| "disabled"
		| "form"
		| "maxLength"
		| "minLength"
		| "name"
		| "readOnly"
		| "required"
		| "onClick"
		| "onFocus"
		| "onBlur"
		| "onChange"
		| "onKeyUp"
		| "onKeyDown"
	>;

type CodeAreaOwnProps = Pick<
	CodeAreaShellOwnProps,
	| "defaultValue"
	| "highlight"
	| "indentOnTab"
	| "indentStyle"
	| "onValueChange"
	| "tabSize"
	| "value"
>;

type CodeAreaProps = CodeAreaDOMProps & CodeAreaOwnProps;

const CodeArea = React.forwardRef<HTMLTextAreaElement, CodeAreaProps>(
	function CodeArea(
		{
			// Props that forward to the textarea
			"aria-label": ariaLabel,
			autoFocus,
			disabled,
			form,
			id,
			maxLength,
			minLength,
			name,
			onBlur,
			onChange,
			onClick,
			onFocus,
			onKeyDown,
			onKeyUp,
			readOnly,
			required,

			// Outer props
			tabSize = 2,
			indentStyle = SPACES,
			indentOnTab = true,
			...props
		},
		forwardedRef
	) {
		return (
			<CodeAreaShell
				indentStyle={indentStyle}
				indentOnTab={indentOnTab}
				tabSize={tabSize}
				{...props}
			>
				<CodeAreaFocusLabel />
				<CodeAreaField
					ref={forwardedRef}
					aria-label={ariaLabel}
					id={id}
					onBlur={onBlur}
					onClick={onClick}
					onFocus={onFocus}
					onKeyUp={onKeyUp}
					onChange={onChange}
					onKeyDown={onKeyDown}
					disabled={disabled}
					form={form}
					maxLength={maxLength}
					minLength={minLength}
					name={name}
					readOnly={readOnly}
					required={required}
					autoFocus={autoFocus}
				/>
				<CodeAreaFormatted />
			</CodeAreaShell>
		);
	}
);

CodeArea.displayName = "CodeArea";

const styles: any = {
	shell: {
		position: "relative",
		textAlign: "left",
		boxSizing: "border-box",
	},
	focusLabel: {
		display: "block",
		[`&[hidden]`]: {
			display: "none",
		},
	},
	field: {
		position: "absolute",
		top: 0,
		left: 0,
		border: 0,
		outline: 0,
		boxShadow: "none",
		height: "100%",
		width: "100%",
		resize: "none",
		color: "inherit",
		overflow: "hidden",
		// @ts-ignore
		MozOsxFontSmoothing: "grayscale",
		WebkitFontSmoothing: "antialiased",
		WebkitTextFillColor: "transparent",

		// Reset the text fill color so that placeholder is visible
		"&:empty": {
			WebkitTextFillColor: `inherit !important`,
		},

		"@media all and (-ms-high-contrast: none), (-ms-high-contrast: active)": {
			// IE doesn't support '-webkit-text-fill-color'
			// So we use 'color: transparent' to make the text transparent on IE
			// Unlike other browsers, it doesn't affect caret color in IE
			color: "transparent !important",

			"&::selection": {
				backgroundColor: "#accef7 !important",
				color: "transparent !important",
			},
		},
	},
	formatted: {
		position: "relative",
		pointerEvents: "none",
	},
	// Editor styles are shared by the formatted pre element and the field
	editor: {
		margin: 0,
		border: 0,
		background: "none",
		boxSizing: "inherit",
		display: "inherit",
		fontFamily: "inherit",
		fontSize: "inherit",
		fontStyle: "inherit",
		fontVariantLigatures: "inherit",
		fontWeight: "inherit",
		letterSpacing: "inherit",
		lineHeight: "inherit",
		tabSize: "inherit",
		textIndent: "inherit",
		textRendering: "inherit",
		textTransform: "inherit",
		whiteSpace: "pre-wrap",
		wordBreak: "keep-all",
		overflowWrap: "break-word",
	},
};

const stylesWithSelectors: any = {
	[`[${DA_SHELL}]`]: styles.shell,
	[`[${DA_FOCUS_LABEL}]`]: styles.focusLabel,
	[`[${DA_FIELD}]`]: styles.field,
	[`[${DA_FORMATTED}]`]: styles.formatted,
	[`[${DA_FIELD}], [${DA_FORMATTED}]`]: styles.editor,
};

function getLines(text: string, position: number | null | undefined) {
	return text.substring(0, position || 0).split("\n");
}

/**
 * Wraps a lib-defined event handler and a user-defined event handler, returning
 * a single handler that allows a user to prevent lib-defined handlers from
 * firing.
 *
 * @param theirHandler User-supplied event handler
 * @param ourHandler Library-supplied event handler
 */
function composeEvents<EventType extends React.SyntheticEvent | Event>(
	theirHandler: ((event: EventType) => any) | undefined,
	ourHandler: (event: EventType) => any
): (event: EventType) => any {
	return (event) => {
		theirHandler && theirHandler(event);
		if (!event.defaultPrevented) {
			return ourHandler(event);
		}
	};
}

/**
 * Passes or assigns a value to multiple refs (typically a DOM node). Useful for
 * dealing with components that need an explicit ref for DOM calculations but
 * also forwards refs assigned by an app.
 *
 * @param refs Refs to fork
 */
function useComposedRefs<RefValueType = any>(
	...refs: (AssignableRef<RefValueType> | null | undefined)[]
) {
	return React.useMemo(() => {
		if (refs.every((ref) => ref == null)) {
			return null;
		}
		return (node: any) => {
			refs.forEach((ref) => {
				assignRef(ref, node);
			});
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [...refs]);
}

/**
 * Passes or assigns an arbitrary value to a ref function or object.
 *
 * @param ref
 * @param value
 */
function assignRef<RefValueType = any>(
	ref: AssignableRef<RefValueType> | null | undefined,
	value: any
) {
	if (ref == null) return;
	if (isFunction(ref)) {
		ref(value);
	} else {
		try {
			ref.current = value;
		} catch (error) {
			if (__DEV__) {
				throw new Error(`Cannot assign value "${value}" to ref "${ref}"`);
			}
		}
	}
}

function isFunction(value: any): value is Function {
	return !!(value && {}.toString.call(value) == "[object Function]");
}

function wrapText(
	start: string,
	end: string,
	content: string,
	startPos: number,
	endPos: number
) {
	let chars = [start, end];
	return (
		content.substring(0, startPos) +
		chars[0] +
		content.substring(startPos, endPos) +
		chars[1] +
		content.substring(endPos)
	);
}

function useCallbackRef<T extends Function>(
	callback: T,
	effect = React.useEffect
) {
	let { current: firstEffect } = React.useRef(effect);
	if (firstEffect !== effect) {
		if (__DEV__) {
			console.warn(
				"The second argument to `useCallbackRef` changed between renders. Using `React.useEffect`."
			);
		}
		effect = React.useEffect;
	}
	if (!(effect === React.useEffect || effect === React.useLayoutEffect)) {
		if (__DEV__) {
			console.warn(
				"The second argument to `useCallbackRef` must be either `React.useEffect` or `React.useLayoutEffect`. Use a proper side effect hook or omit the argument."
			);
		}
		effect = React.useEffect;
	}

	let callbackRef = React.useRef(callback);
	effect(() => {
		callbackRef.current = callback;
	});
	return callbackRef;
}

type AssignableRef<ValueType> =
	| {
			bivarianceHack(instance: ValueType | null): void;
	  }["bivarianceHack"]
	| React.MutableRefObject<ValueType | null>;

type TypeHistoryRecord = {
	value: string;
	selectionStart: number | null;
	selectionEnd: number | null;
};

type TypeHistory = {
	stack: (TypeHistoryRecord & { timestamp: number })[];
	offset: number;
};

interface SessionHandles {
	getSession(): TypeHistory;
	setSession(session: { history: TypeHistory }): void;
}

export {
	CodeArea,
	CodeAreaField,
	CodeAreaFocusLabel,
	CodeAreaFormatted,
	CodeAreaShell,
	styles,
	stylesWithSelectors,
	// Types
	CodeAreaFieldProps,
	CodeAreaFocusLabelProps,
	CodeAreaFormattedProps,
	CodeAreaProps,
	CodeAreaShellProps,
	CodeAreaShellRefValue,
	TypeHistory,
};

export default CodeArea;
