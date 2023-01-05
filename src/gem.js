const CLASSES = {
  "###": "h3",
  "##": "h2",
  "#": "h1",
  "=>": "link",
  ">": "quote",
  "*": "li",
  "```": "pre"
};

const NBSP = "\xa0";

function parseLine(line) {
  let prefixes = Object.keys(CLASSES);

  for (let prefix of prefixes) {
    if (line.startsWith(prefix)) {
      let rest = line.slice(prefix.length);
      if (rest[0] === " " || rest[0] === NBSP) {
        return [prefix, rest.slice(1), true];
      } else {
        return [prefix, rest, false];
      }
    }
  }

  return ["", line, false];
}

function removeBr(textEl) {
  let text = textEl.innerHTML;
  let remove = "<br>";

  let i = text.indexOf(remove);
  if (i < 0) return;
  let newText = text.slice(0, i) + text.slice(i + remove.length);
  textEl.innerHTML = newText;
}

class GemLine {
  constructor(prev, prefix, text) {
    this.setPrefix(prefix, text);
    if (prev) {
      this.next = prev.next;
      if (this.next) this.next.prev = this;

      this.prev = prev;
      prev.next = this;
    } else {
      this.prev = null;
      this.next = null;
    }
  }

  getEl() {
    return this.el;
  }

  onfocus(ev) {
    if (this.prefix === "=>") {
      this.el.contentEditable = true;
      this.el.innerHTML = this.text;
      this.focusCaret();
    }
  }

  onblur(ev) {
    if (this.prefix === "=>" && this.text.trim() !== "") {
      this.el.contentEditable = false;
      let sp = this.text.indexOf(" ");
      let url = sp > 0 ? this.text.slice(0, sp) : this.text;
      let text = sp > 0 ? this.text.slice(sp + 1) : url;
      this.el.innerHTML = `<a href="${url}">${text}</a>`;
    }
  }

  focus() {
    if (this.el.isConnected) {
      this.el.focus();
    } else {
      this.onfocus();
    }
  }

  blur() {
    if (this.el.isConnected) {
      this.el.blur();
    } else {
      this.onblur();
    }
  }

  focusCaret(pos) {
    let selection = document.getSelection();
    if (this.el.firstChild) selection.collapse(this.el.firstChild, pos);
    else selection.collapse(this.el);
  }

  getCaret() {
    let selection = document.getSelection();
    if (!selection.isCollapsed || selection.focusNode !== this.el.firstChild)
      return -1;
    return selection.focusOffset;
  }

  isCaretAtStart() {
    let caret = this.getCaret();
    return caret === 0 || caret === -1;
  }

  isCaretAtEnd() {
    let caret = this.getCaret();

    return (
      caret === this.text.length ||
      caret === -1 ||
      (this.text.endsWith("\n") && caret === this.text.length - 1) // workaround for div contentEditable with whitespace pre
    );
  }

  focusPrev() {
    if (this.prev) this.prev.focus();
  }

  focusNext() {
    if (this.next) this.next.focus();
  }

  splitAtCursor() {
    let caret = this.getCaret();
    let text1 = this.text.slice(0, caret);
    let text2 = this.text.slice(caret);

    this.setText(text1);

    let newLine = new GemLine(this, "", text2);
    this.el.parentElement.insertBefore(newLine.getEl(), this.el.nextSibling);
    newLine.focus();
  }

  newLineAtCursor() {
    let caret = this.getCaret();
    let text1 = this.text.slice(0, caret);
    let text2 = this.text.slice(caret);

    this.setText(text1 + "\n" + text2);

    this.focusCaret(text1.length + 1);
  }

  mergeWithPrevious() {
    if (!this.prev) return;
    let prevLen = this.prev.text.length;
    this.prev.setText(this.prev.text + this.text);

    this.prev.next = this.next;
    if (this.next) this.next.prev = this.prev;

    this.el.remove();
    this.prev.focus();
    this.prev.focusCaret(prevLen);
  }

  setText(text) {
    this.text = text;
    this.el.innerHTML = text;
  }

  setPrefix(prefix, text) {
    if (this.prefix === prefix) return;

    this.prefix = prefix;
    this.text = text;

    let el = document.createElement("div");
    el.classList.add("gemline");
    el.classList.add(CLASSES[prefix]);
    el.contentEditable = true;
    el.innerHTML = text;

    if (this.el) this.el.replaceWith(el);

    this.el = el;
    this.blur();

    el.addEventListener("input", (ev) => {
      removeBr(el);
      let text = el.textContent;
      this.text = text;

      if (this.prefix === "```" && this.text.indexOf("\n") > -1) {
        return;
      }

      let [newPrefix, newText, hadSpace] = parseLine(text);

      if (hadSpace && newPrefix !== this.prefix) {
        this.setPrefix(newPrefix, newText);
        this.focusCaret();
      }
    });

    el.addEventListener("keydown", (ev) => {
      if (
        !ev.shiftKey &&
        (ev.key === "ArrowUp" || ev.key === "ArrowLeft") &&
        this.isCaretAtStart()
      ) {
        ev.preventDefault();
        this.focusPrev();
      } else if (
        !ev.shiftKey &&
        ((ev.key === "ArrowDown" && (this.isCaretAtEnd() || ev.ctrlKey)) ||
          (ev.key === "ArrowRight" && this.isCaretAtEnd() && !ev.ctrlKey))
      ) {
        ev.preventDefault();
        this.focusNext();
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        if (this.prefix !== "```") {
          this.splitAtCursor();
        } else {
          this.newLineAtCursor();
        }
      } else if (ev.key === "Backspace" && this.isCaretAtStart()) {
        if (this.prefix === "" || (this.prefix === "```" && this.text === "")) {
          this.mergeWithPrevious();
          ev.preventDefault();
        } else if (!(this.prefix === "```" && this.text.indexOf("\n") > -1)) {
          this.setPrefix("", this.text);
          this.focusCaret();
        }
      }
    });

    el.addEventListener("focus", (ev) => this.onfocus(ev));
    el.addEventListener("blur", (ev) => this.onblur(ev));
    el.tabIndex = 0;
  }
}

let editor = document.getElementById("gemedit");
editor.innerHTML = "";

let gemtext = `
# Gemtext cheatsheet

Here's the basics of how text works in Gemtext:

* Long lines get wrapped by the client to fit the screen
* Short lines *don't* get joined together
* Write paragraphs as single long lines
* Blank lines are rendered verbatim

You get three levels of heading:

\`\`\`
# Heading

## Sub-heading

### Sub-subheading
\`\`\`

You get one kind of list and you can't nest them:

\`\`\`
* Mercury
* Gemini
* Apollo
\`\`\`

Here's a quote from Maciej Cegłowski:

\`\`\`
> I contend that text-based websites should not exceed in size the major works of Russian literature.
\`\`\`

Lines which start with \`\`\` will cause clients to toggle in and out of ordinary rendering mode and preformatted mode. In preformatted mode, Gemtext syntax is ignored so links etc. will not be rendered, and text will appear in a monospace font.

> This is a quote - farseen
> This is another quote
> - some dude

=> http://www.google.com Google
=> http://www.yahoo.com

`;
gemtext = gemtext.trim();

let gemlines = gemtext.split("\n");

let prev = null;
let root = null;
let preformatted = null;
for (let i = 0; i < gemlines.length; i++) {
  let line = gemlines[i];

  if (preformatted != null && !line.startsWith("```")) {
    preformatted.push(line);
    continue;
  }

  if (preformatted == null && line.startsWith("```")) {
    preformatted = [];
    continue;
  }

  let prefix, text;
  if (line.startsWith("```")) {
    prefix = "```";
    text = preformatted.join("\n");
    preformatted = null;
  } else {
    [prefix, text] = parseLine(line);
  }

  let gem = new GemLine(prev, prefix, text);
  if (!root) root = gem;

  editor.appendChild(gem.getEl());

  prev = gem;
}
