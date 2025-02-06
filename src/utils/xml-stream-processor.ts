type StreamHandler = (data: string) => void;
type FinalizeHandler = (result?: any) => void;

interface ToolHandler {
  stream: StreamHandler;
  finalize?: FinalizeHandler;
}

interface XMLStreamParserOptions {
  /**
   * A mapping from tool element names to a handler.
   * If a tool name appears in this mapping then its inner text will be
   * “streamed” to the handler.
   */
  streamHandlers: { [toolName: string]: ToolHandler };
  /**
   * Callback for non‐streaming tool elements.
   * When a tool element is “parsed” (i.e. not streamed), its parameters
   * are passed along.
   */
  onToolParsed: (toolName: string, params: { [paramName: string]: string }) => void;
}

/**
 * A simple XML streaming parser.
 *
 * The parser processes chunks of XML text (which may split tags) and supports
 * two modes:
 *
 * 1. Streaming mode: When a tool element’s name is found in options.streamHandlers,
 *    then everything inside that tool is immediately forwarded (in “chunks”)
 *    to the tool’s stream handler. (It “pauses” on encountering a `<` so that the
 *    closing tag isn’t accidentally sent.)
 *
 * 2. Parsing mode: For any other tool element, we expect one level of nested
 *    XML such as `<param1> … </param1>`. The contents of any parameter tag are
 *    treated as literal text (even if they look like XML) and are accumulated.
 *
 * In addition, the parser throws errors for things like text outside any tag,
 * unexpected or mismatched tags, and so on.
 */
export class XMLStreamParser {
  private buffer: string = "";
  private options: XMLStreamParserOptions;

  // Parser state:
  // mode is 'idle' when not inside a tool element.
  // When inside a tool element, we are either in streaming mode or parsing mode.
  private mode: "idle" | "streaming" | "parsing" = "idle";
  // Name of the current tool element (if any)
  private currentToolName: string | null = null;
  // When in streaming mode, a pointer to the tool’s handler
  private currentToolHandler: ToolHandler | null = null;
  // When in parsing mode, we accumulate parameters in an object.
  private currentParams: { [paramName: string]: string } = {};
  // When parsing inside a parameter (for example, <param1> ... </param1>),
  // we record its name and accumulate its text.
  private currentParamName: string | null = null;
  private currentParamText: string = "";

  constructor(options: XMLStreamParserOptions) {
    this.options = options;
  }

  /**
   * Call this repeatedly as new chunks arrive.
   */
  public write(chunk: string) {
    // Append new data to our buffer.
    this.buffer += chunk;
    let pos = 0;

    while (pos < this.buffer.length) {
      // ─── CASE 1: If we are _inside a parameter_ (e.g. within <param1>…</param1>)
      // In that case, we must _not_ break on every '<'—we want to treat inner
      // XML as literal text. Instead, look for the expected closing tag.
      if (this.mode === "parsing" && this.currentParamName !== null) {
        const closingTag = `</${this.currentParamName}>`;
        const endIndex = this.buffer.indexOf(closingTag, pos);
        if (endIndex === -1) {
          // No closing tag yet – accumulate all available text.
          this.currentParamText += this.buffer.slice(pos);
          pos = this.buffer.length;
          break;
        } else {
          // We found the closing tag; accumulate the text _up to_ it.
          this.currentParamText += this.buffer.slice(pos, endIndex);
          // Save the parameter value.
          this.currentParams[this.currentParamName] = this.currentParamText;
          // Reset the parameter state.
          this.currentParamName = null;
          this.currentParamText = "";
          pos = endIndex + closingTag.length;
          // Continue parsing from here.
          continue;
        }
      }

      // ─── CASE 2: Otherwise, we are not inside a parameter.
      // Look for the next tag start (<) from our current position.
      const nextTag = this.buffer.indexOf("<", pos);
      if (nextTag === -1) {
        // No '<' found.
        if (this.mode === "streaming") {
          // In streaming mode, send all text to the stream handler.
          const text = this.buffer.slice(pos);
          if (text.length > 0) {
            this.currentToolHandler!.stream(text);
          }
        } else if (this.mode === "parsing" && this.currentParamName === null) {
          // Outside a parameter inside a tool element,
          // any non‐whitespace text is an error.
          const text = this.buffer.slice(pos);
          if (text.trim().length > 0) {
            throw new Error(`Unexpected text outside parameter tags: "${text}"`);
          }
        } else if (this.mode === "idle") {
          // Text outside of any tool element is not allowed.
          const text = this.buffer.slice(pos);
          if (text.trim().length > 0) {
            throw new Error(`Unexpected text outside of a tool element: "${text}"`);
          }
        }
        // We’ve reached the end of the buffer.
        pos = this.buffer.length;
        break;
      }

      // Process any text that comes before the next tag.
      const textChunk = this.buffer.slice(pos, nextTag);
      if (this.mode === "streaming") {
        if (textChunk.length > 0) {
          this.currentToolHandler!.stream(textChunk);
        }
      } else if (this.mode === "parsing" && this.currentParamName === null) {
        if (textChunk.trim().length > 0) {
          // In parsing mode outside a parameter, non‐whitespace text is not allowed.
          throw new Error(`Unexpected text outside parameter tags: "${textChunk}"`);
        }
      }
      pos = nextTag; // Now pos is at the beginning of a tag.

      // ─── Now process a complete tag.
      const endTag = this.buffer.indexOf(">", pos);
      if (endTag === -1) {
        // Incomplete tag; wait for more data.
        break;
      }
      // Grab the tag “content” (between the '<' and '>')
      const tagContent = this.buffer.slice(pos + 1, endTag).trim();
      const isClosing = tagContent.startsWith("/");
      // Remove any leading '/' from closing tags.
      const tagName = isClosing ? tagContent.slice(1).trim() : tagContent.split(/\s/)[0];

      if (!isClosing) {
        // ─── OPENING TAG
        if (this.mode === "idle") {
          // We expect a tool element.
          this.currentToolName = tagName;
          // Check if this tool is to be streamed.
          if (this.options.streamHandlers[tagName]) {
            this.mode = "streaming";
            this.currentToolHandler = this.options.streamHandlers[tagName];
          } else {
            this.mode = "parsing";
            this.currentParams = {};
          }
        } else if (this.mode === "parsing") {
          if (this.currentParamName !== null) {
            // We are already inside a parameter. (Remember: inside a parameter, we ignore '<'
            // unless it is the expected closing tag. So getting here would be an error.)
            throw new Error(
              `Nested tags inside parameter "${this.currentParamName}" are not allowed.`
            );
          }
          // Otherwise, this is the start of a parameter tag.
          this.currentParamName = tagName;
          this.currentParamText = "";
        } else if (this.mode === "streaming") {
          // In streaming mode the only tag we expect is the closing tag of the tool element.
          // (We “pause” as soon as we see '<'.)
          throw new Error(`Unexpected opening tag <${tagName}> in streaming mode.`);
        }
      } else {
        // ─── CLOSING TAG
        if (this.mode === "idle") {
          throw new Error(`Unexpected closing tag </${tagName}> when not inside any element.`);
        } else if (this.mode === "streaming") {
          // In streaming mode, we expect only the closing tag for the tool element.
          if (tagName !== this.currentToolName) {
            throw new Error(
              `Mismatched closing tag </${tagName}> in streaming mode (expected </${this.currentToolName}>).`
            );
          }
          // End the streaming tool element.
          if (this.currentToolHandler && this.currentToolHandler.finalize) {
            this.currentToolHandler.finalize();
          }
          // Reset state.
          this.mode = "idle";
          this.currentToolName = null;
          this.currentToolHandler = null;
        } else if (this.mode === "parsing") {
          if (this.currentParamName !== null) {
            // We are inside a parameter but _did not_ detect the expected closing tag
            // using our “lookahead” method. That means we got a generic closing tag.
            // This is an error because we would have caught the expected one earlier.
            throw new Error(
              `Unexpected closing tag </${tagName}> inside parameter <${this.currentParamName}>.`
            );
          } else {
            // A closing tag here is assumed to be closing the tool element.
            if (tagName !== this.currentToolName) {
              throw new Error(
                `Mismatched closing tag </${tagName}> for tool element <${this.currentToolName}>.`
              );
            }
            // Emit the final parsed tool.
            this.options.onToolParsed(this.currentToolName!, this.currentParams);
            // Reset state.
            this.mode = "idle";
            this.currentToolName = null;
            this.currentParams = {};
          }
        }
      }
      // Advance past the processed tag.
      pos = endTag + 1;
    }
    // Remove what we’ve processed from the buffer.
    this.buffer = this.buffer.slice(pos);
  }

  /**
   * Call this when you are done sending data.
   */
  public end() {
    if (this.buffer.trim().length > 0) {
      throw new Error("Incomplete XML stream at end");
    }
    if (this.mode !== "idle") {
      throw new Error("Stream ended while still inside an element");
    }
  }
}
