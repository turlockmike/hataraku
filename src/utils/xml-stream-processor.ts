type StreamHandler = (data: string, resolve?: (value: any) => void) => void;
type FinalizeHandler = (resolve?: (value: any) => void) => void;

interface ToolHandler {
  stream: StreamHandler;
  finalize?: FinalizeHandler;
  resolveFunction?: (value: any) => void;
}

interface XMLStreamParserOptions {
  /**
   * A mapping from tool element names to a handler.
   * If a tool name appears in this mapping then its inner text will be
   * "streamed" to the handler.
   */
  streamHandlers: { [toolName: string]: ToolHandler };
  /**
   * Callback for non‐streaming tool elements.
   * When a tool element is "parsed" (i.e. not streamed), its parameters
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
 * 1. Streaming mode: When a tool element's name is found in options.streamHandlers,
 *    then everything inside that tool is immediately forwarded (in "chunks")
 *    to the tool's stream handler. (It "pauses" on encountering a `<` so that the
 *    closing tag isn't accidentally sent.)
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
  // When in streaming mode, a pointer to the tool's handler
  private currentToolHandler: ToolHandler | null = null;
  // When in parsing mode, we accumulate parameters in an object.
  private currentParams: { [paramName: string]: string } = {};
  // When parsing inside a parameter (for example, <param1> ... </param1>),
  // we record its name and accumulate its text.
  private currentParamName: string | null = null;
  private currentParamText: string = "";

  private resolveFunction: ((value: any) => void) | null = null;

  constructor(options: XMLStreamParserOptions, resolveFunction?: (value: any) => void) {
    this.options = options;
    this.resolveFunction = resolveFunction || null;
  }

  /**
   * Call this repeatedly as new chunks arrive.
   */
  public write(chunk: string) {
    // Append new data to our buffer.
    this.buffer += chunk;
    let pos = 0;

    // Process complete tags and their content
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
        // No '<' found, keep the remaining text in buffer for next chunk
        break;
      }

      // Process any text that comes before the next tag.
      const textChunk = this.buffer.slice(pos, nextTag);
      if (this.mode === "streaming") {
        if (textChunk.length > 0) {
          // In streaming mode, send all content up until any '<' character
          this.currentToolHandler!.stream(textChunk, this.resolveFunction || undefined);
        }
      } else if (this.mode === "parsing" && this.currentParamName === null) {
        if (textChunk.trim().length > 0) {
          // In parsing mode, treat direct text content as a "content" parameter
          this.currentParams.content = (this.currentParams.content || "") + textChunk;
        }
      } else if (this.mode === "idle" && textChunk.trim().length > 0) {
        // Only throw for unexpected text if we're idle and it's not whitespace
        throw new Error(`Unexpected text outside of a tool element: "${textChunk.trim()}"`);
      }
      pos = nextTag;

      // Look for the end of this tag
      const endTag = this.buffer.indexOf(">", pos);
      if (endTag === -1) {
        // Incomplete tag; keep everything from pos onwards in the buffer
        this.buffer = this.buffer.slice(pos);
        pos = 0
        break;
      }

      // Process the complete tag
      const tagContent = this.buffer.slice(pos + 1, endTag).trim();
      const isClosing = tagContent.startsWith("/");
      const tagName = isClosing ? tagContent.slice(1).trim() : tagContent.split(/\s/)[0];

      if (!isClosing) {
        // ─── OPENING TAG
        if (this.mode === "idle") {
          this.currentToolName = tagName;
          if (this.options.streamHandlers[tagName]) {
            this.mode = "streaming";
            this.currentToolHandler = this.options.streamHandlers[tagName];
          } else {
            this.mode = "parsing";
            this.currentParams = {};
          }
        } else if (this.mode === "parsing") {
          if (this.currentParamName !== null) {
            throw new Error(
              `Nested tags inside parameter "${this.currentParamName}" are not allowed.`
            );
          }
          this.currentParamName = tagName;
          this.currentParamText = "";
        } else if (this.mode === "streaming") {
          throw new Error(`Unexpected opening tag <${tagName}> in streaming mode.`);
        }
      } else {
        // ─── CLOSING TAG
        if (this.mode === "idle") {
          throw new Error(`Unexpected closing tag </${tagName}> when not inside any element.`);
        } else if (this.mode === "streaming") {
          if (tagName !== this.currentToolName) {
            throw new Error(
              `Mismatched closing tag </${tagName}> in streaming mode (expected </${this.currentToolName}>).`
            );
          }
          if (this.currentToolHandler?.finalize) {
            this.currentToolHandler.finalize(this.resolveFunction || undefined);
          }
          this.mode = "idle";
          this.currentToolName = null;
          this.currentToolHandler = null;
        } else if (this.mode === "parsing") {
          if (this.currentParamName !== null) {
            throw new Error(
              `Unexpected closing tag </${tagName}> inside parameter <${this.currentParamName}>.`
            );
          } else {
            if (tagName !== this.currentToolName) {
              throw new Error(
                `Mismatched closing tag </${tagName}> for tool element <${this.currentToolName}>.`
              );
            }
            this.options.onToolParsed(this.currentToolName!, this.currentParams);
            this.mode = "idle";
            this.currentToolName = null;
            this.currentParams = {};
          }
        }
      }
      pos = endTag + 1;
    }

    // Keep any unprocessed text in the buffer
    if (pos < this.buffer.length) {
      this.buffer = this.buffer.slice(pos);
    } else {
      this.buffer = "";
    }
  }

  /**
   * Call this when you are done sending data.
   */
  public end() {
    if (this.mode === "streaming") {
      // Force processing of any complete tag in the current buffer.
      // (Calling write("") will run through the while loop and process
      // any complete tag that might be waiting in the buffer.)
      this.write("");
  
      // Now, if there’s leftover text that does not look like the beginning of a tag,
      // stream it. (This prevents sending closing tag fragments as content.)
      if (this.buffer && !this.buffer.trim().startsWith("<")) {
        this.currentToolHandler!.stream(this.buffer, this.resolveFunction || undefined);
      }
  
      // Finalize the current streaming tool.
      if (this.currentToolHandler?.finalize) {
        this.currentToolHandler.finalize(this.resolveFunction || undefined);
      }
      this.mode = "idle";
      this.currentToolName = null;
      this.currentToolHandler = null;
      this.buffer = "";
    } else if (this.mode !== "idle") {
      throw new Error("Stream ended while still inside an element");
    } else if (this.buffer.trim().length > 0) {
      throw new Error("Incomplete XML stream at end");
    }
  }
  
  
}
