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
   * If a tool name appears in this mapping then its inner text is
   * immediately forwarded (in chunks) to the tool’s stream handler.
   */
  streamHandlers: { [toolName: string]: ToolHandler };
  /**
   * Callback for non‐streaming tool elements.
   * When a tool element is closed, its parameters (or for streaming tools,
   * an object of shape { content: <streamed text> }) are passed along.
   */
  onToolParsed: (toolName: string, params: { [paramName: string]: string }) => void;
  
  onComplete?: () => void;
}

/**
 * A simple XML streaming parser.
 *
 * The parser processes chunks of XML text (which may split tags) and supports two modes:
 *
 * 1. **Streaming mode:** When a tool element’s name is found in options.streamHandlers,
 *    then everything inside that tool is immediately forwarded (in chunks) to the tool’s
 *    stream handler. (It “pauses” on encountering a `<` so that the closing tag isn’t accidentally sent.)
 *
 * 2. **Parsing mode:** For any other tool element, we expect one level of nested XML (e.g. `<param1> … </param1>`).
 *    The contents of any parameter tag are treated as literal text and accumulated.
 *
 * When the closing tag is encountered, the parser calls onToolParsed:
 * - For streaming mode, it calls onToolParsed with `{ content: <streamed text> }`.
 * - For parsing mode, it always passes the parameters object.
 */
export class XMLStreamParser {
  private buffer: string = "";
  private options: XMLStreamParserOptions;

  // Parser state:
  // - mode is 'idle' when not inside any element.
  // - When inside a tool element, we are either in streaming mode or parsing mode.
  private mode: "idle" | "streaming" | "parsing" = "idle";
  // Name of the current tool element (if any)
  private currentToolName: string | null = null;
  // When in streaming mode, pointer to the tool's handler
  private currentToolHandler: ToolHandler | null = null;
  // When in parsing mode, we accumulate parameters in an object.
  private currentParams: { [paramName: string]: string } = {};
  // When parsing inside a parameter (for example, <param1> ... </param1>),
  // we record its name and accumulate its text.
  private currentParamName: string | null = null;
  private currentParamText: string = "";

  // For streaming mode, accumulate the streamed text.
  private currentStreamContent: string = "";

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

    // Process complete tags and their content.
    while (pos < this.buffer.length) {
      // ─── CASE 1: Inside a parameter (e.g. within <param1> … </param1>)
      if (this.mode === "parsing" && this.currentParamName !== null) {
        const closingTag = `</${this.currentParamName}>`;
        const endIndex = this.buffer.indexOf(closingTag, pos);
        if (endIndex === -1) {
          // Instead of consuming the whole rest of the buffer,
          // look for a candidate where the tail might be the start of the closing tag.
          let candidateIndex = this.buffer.length;
          for (let i = pos; i < this.buffer.length; i++) {
            const fragment = this.buffer.slice(i);
            if (closingTag.startsWith(fragment)) {
              candidateIndex = i;
              break;
            }
          }
          // Accumulate text only up to the candidate position.
          this.currentParamText += this.buffer.slice(pos, candidateIndex);
          // Retain the candidate fragment for the next chunk.
          this.buffer = this.buffer.slice(candidateIndex);
          pos = 0;
          break;
        } else {
          // Found the closing tag; accumulate text up to it.
          this.currentParamText += this.buffer.slice(pos, endIndex);
          // Save the parameter value.
          this.currentParams[this.currentParamName] = this.currentParamText;
          // Reset the parameter state.
          this.currentParamName = null;
          this.currentParamText = "";
          pos = endIndex + closingTag.length;
          continue;
        }
      }

      // ─── CASE 2: Not inside a parameter.
      // Look for the next tag start.
      const nextTag = this.buffer.indexOf("<", pos);
      if (nextTag === -1) {
        // No '<' found.
        if (this.mode === "streaming") {
          // In streaming mode, flush the entire remaining buffer as text.
          const text = this.buffer.slice(pos);
          if (text.length > 0) {
            this.currentStreamContent += text;
            this.currentToolHandler!.stream(text, this.resolveFunction || undefined);
          }
          this.buffer = "";
          pos = 0;
        } else {
          // In parsing mode, wait for more data.
          break;
        }
      } else {
        // Process any text before the next tag.
        const textChunk = this.buffer.slice(pos, nextTag);
        if (this.mode === "streaming") {
          if (textChunk.length > 0) {
            // Accumulate the text for onToolParsed.
            this.currentStreamContent += textChunk;
            // In streaming mode, send all content up until a '<' character.
            this.currentToolHandler!.stream(textChunk, this.resolveFunction || undefined);
          }
        } else if (this.mode === "parsing" && this.currentParamName === null) {
          if (textChunk.trim().length > 0) {
            // In parsing mode, treat direct text as a "content" parameter.
            this.currentParams.content = (this.currentParams.content || "") + textChunk;
          }
        } else if (this.mode === "idle" && textChunk.trim().length > 0) {
          // Unexpected text outside any tool element.
          throw new Error(`Unexpected text outside of a tool element: "${textChunk.trim()}"`);
        }
        pos = nextTag;
      }

      // Look for the end of the tag.
      const endTag = this.buffer.indexOf(">", pos);
      if (endTag === -1) {
        // Incomplete tag; keep everything from pos onwards.
        this.buffer = this.buffer.slice(pos);
        pos = 0;
        break;
      }

      // Process the complete tag.
      const tagContent = this.buffer.slice(pos + 1, endTag).trim();
      const isClosing = tagContent.startsWith("/");
      const tagName = isClosing ? tagContent.slice(1).trim() : tagContent.split(/\s/)[0];

      if (!isClosing) {
        // ─── OPENING TAG
        if (this.mode === "idle") {
          this.currentToolName = tagName;
          if (this.options.streamHandlers[tagName]) {
            // Streaming mode.
            this.mode = "streaming";
            this.currentToolHandler = this.options.streamHandlers[tagName];
            // Reset the accumulator.
            this.currentStreamContent = "";
          } else {
            // Parsing mode.
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
          // Finalize the stream if needed.
          if (this.currentToolHandler?.finalize) {
            this.currentToolHandler.finalize(this.resolveFunction || undefined);
          }
          // Call onToolParsed with the streamed text wrapped as { content: ... }.
          this.options.onToolParsed(this.currentToolName!, { content: this.currentStreamContent });
          this.mode = "idle";
          this.currentToolName = null;
          this.currentToolHandler = null;
        } else if (this.mode === "parsing") {
          if (this.currentParamName !== null) {
            if (tagName !== this.currentParamName) {
              throw new Error(
                `Unexpected closing tag </${tagName}> inside parameter <${this.currentParamName}>.`
              );
            }
            this.currentParams[this.currentParamName] = this.currentParamText;
            this.currentParamName = null;
            this.currentParamText = "";
          } else {
            if (tagName !== this.currentToolName) {
              throw new Error(
                `Mismatched closing tag </${tagName}> for tool element <${this.currentToolName}>.`
              );
            }
            // Always call onToolParsed with the parameters object.
            this.options.onToolParsed(this.currentToolName!, this.currentParams);
            this.mode = "idle";
            this.currentToolName = null;
            this.currentParams = {};
          }
        }
      }
      pos = endTag + 1;
    }

    // Keep any unprocessed text in the buffer.
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
      // Process any complete tag in the buffer.
      this.write("");

      // If there is leftover text (that does not look like a tag), stream it.
      if (this.buffer && !this.buffer.trim().startsWith("<")) {
        this.currentStreamContent += this.buffer;
        this.currentToolHandler!.stream(this.buffer, this.resolveFunction || undefined);
      }

      // Finalize the streaming tool.
      if (this.currentToolHandler?.finalize) {
        this.currentToolHandler.finalize(this.resolveFunction || undefined);
      }
      // Call onToolParsed with the final streamed content wrapped in { content: ... }.
      this.options.onToolParsed(this.currentToolName!, { content: this.currentStreamContent });
      this.mode = "idle";
      this.currentToolName = null;
      this.currentToolHandler = null;
      this.buffer = "";
    } else if (this.mode !== "idle") {
      throw new Error("Stream ended while still inside an element");
    } else if (this.buffer.trim().length > 0) {
      throw new Error("Incomplete XML stream at end");
    }
    // Fire the onComplete callback if provided.
    this.options.onComplete?.();
  }
}
