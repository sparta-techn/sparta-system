import { describe, expect, it } from "vitest";

import { isEmptyHtml, sanitizeEmailHtml } from "./sanitize-html";

describe("sanitizeEmailHtml", () => {
  it("keeps the allowed formatting tags", () => {
    expect(sanitizeEmailHtml("<p>Hello <strong>team</strong></p>")).toBe(
      "<p>Hello <strong>team</strong></p>",
    );
    expect(sanitizeEmailHtml("<ul><li>One</li><li>Two</li></ul>")).toBe(
      "<ul><li>One</li><li>Two</li></ul>",
    );
    expect(sanitizeEmailHtml("Line<br>Break")).toBe("Line<br />Break");
  });

  it("drops a disallowed tag but keeps its text", () => {
    expect(sanitizeEmailHtml("<div>Kept</div>")).toBe("Kept");
    expect(sanitizeEmailHtml('<font color="red">Pasted</font>')).toBe("Pasted");
  });

  it("strips attributes from allowed tags", () => {
    expect(sanitizeEmailHtml('<p style="color:red" onclick="alert(1)">Hi</p>')).toBe("<p>Hi</p>");
  });

  // The body is stored, previewed and mailed — script content must not survive
  // in ANY form, not even as escaped text.
  it("discards script and style content entirely", () => {
    expect(sanitizeEmailHtml("<script>alert(1)</script>")).toBe("");
    expect(sanitizeEmailHtml("<style>body{display:none}</style>")).toBe("");
    expect(sanitizeEmailHtml("A<script>alert(1)</script>B")).toBe("AB");
    expect(sanitizeEmailHtml("<iframe src='evil'>x</iframe>")).toBe("");
  });

  it("escapes stray angle brackets so text cannot reopen a tag", () => {
    expect(sanitizeEmailHtml("5 < 10 & 10 > 5")).toBe("5 &lt; 10 &amp; 10 &gt; 5");
  });

  it("keeps safe links and forces rel", () => {
    expect(sanitizeEmailHtml('<a href="https://example.com">Docs</a>')).toBe(
      '<a href="https://example.com" rel="noopener noreferrer">Docs</a>',
    );
    expect(sanitizeEmailHtml('<a href="mailto:hr@spartaflow.com">Mail</a>')).toContain(
      'href="mailto:hr@spartaflow.com"',
    );
  });

  it("degrades an unsafe link to plain text rather than a live link", () => {
    const result = sanitizeEmailHtml(`<a href="javascript:alert(1)">Click</a>`);
    expect(result).toBe("Click");
    expect(result).not.toContain("<a");
    expect(result).not.toContain("javascript:");
  });

  it("blocks the control-character javascript obfuscation", () => {
    const result = sanitizeEmailHtml(`<a href="java\tscript:alert(1)">Click</a>`);
    expect(result).not.toContain("<a");
  });

  it("closes tags the author left open", () => {
    expect(sanitizeEmailHtml("<p>Unclosed")).toBe("<p>Unclosed</p>");
    expect(sanitizeEmailHtml("<ul><li>One")).toBe("<ul><li>One</li></ul>");
  });

  // A stray `</div>` from a paste must not escape into the surrounding email
  // shell and break the layout for every recipient.
  it("drops a closing tag with no matching open", () => {
    expect(sanitizeEmailHtml("Text</p></div>")).toBe("Text");
  });

  it("removes comments, which can hide conditional markup", () => {
    expect(sanitizeEmailHtml("A<!-- [if IE]><script>x</script><![endif] -->B")).toBe("AB");
  });

  it("is idempotent — sanitizing already-clean output changes nothing", () => {
    const once = sanitizeEmailHtml('<p>Hi <a href="https://x.com">link</a> &amp; bye</p>');
    expect(sanitizeEmailHtml(once)).toBe(once);
  });

  it("handles an empty or whitespace-only body", () => {
    expect(sanitizeEmailHtml("")).toBe("");
    expect(sanitizeEmailHtml("   ")).toBe("");
  });
});

describe("isEmptyHtml", () => {
  it("treats markup-only bodies as empty", () => {
    expect(isEmptyHtml("<p></p>")).toBe(true);
    expect(isEmptyHtml("<p>&nbsp;</p>")).toBe(true);
    expect(isEmptyHtml("<br />")).toBe(true);
  });

  it("treats any visible text as non-empty", () => {
    expect(isEmptyHtml("<p>Hi</p>")).toBe(false);
  });
});
