import DOMPurify from "isomorphic-dompurify";

// Security: HTML tags/attributes allowed in user-generated content.
// img: permitted for Markdown image syntax. Note: external images can track
// users via src URLs. Mitigate with CSP `img-src` directive or image proxy.
// script, style, iframe, form, input, object, embed: intentionally excluded
// to prevent XSS, script injection, and UI redressing.
// class, id: permitted for component styling; content sanitized by DOMPurify.
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "a",
  "ul",
  "ol",
  "li",
  "code",
  "pre",
  "img",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "del",
  "ins",
  "sub",
  "sup",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "span",
  "div",
];

const ALLOWED_ATTR = [
  // Security: href/src allow navigation and image display.
  // on* event handlers and style attribute are excluded to prevent XSS.
  "href",
  "src",
  "alt",
  "title",
  "target",
  "rel",
  "class",
  "id",
];

const ALLOWED_TARGETS = ["_blank", "_self", "_parent", "_top"];
const ALLOWED_TARGETS_SET = new Set(ALLOWED_TARGETS);

// Register DOMPurify hooks once (safe for multiple useSanitize() calls).
// Enforces: target value whitelist, rel="noopener noreferrer" on _blank links.
let hooksRegistered = false;

function registerHooks(): void {
  if (hooksRegistered) {
    return;
  }
  hooksRegistered = true;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!("tagName" in node) || node.tagName !== "A") {
      return;
    }

    const target = node.getAttribute("target");
    if (target !== null && !ALLOWED_TARGETS_SET.has(target)) {
      node.removeAttribute("target");
    }

    if (target === "_blank") {
      const existingRel = node.getAttribute("rel") ?? "";
      const relParts = new Set(
        existingRel
          .split(/\s+/)
          .map((p) => p.trim())
          .filter(Boolean),
      );

      relParts.add("noopener");
      relParts.add("noreferrer");

      node.setAttribute("rel", Array.from(relParts).join(" "));
    }
  });
}

// Reset hook registration state for test isolation or HMR.
// DOMPurify hooks are additive — this allows re-registration on next useSanitize().
function resetHooks(): void {
  hooksRegistered = false;
}

export const useSanitize = () => {
  registerHooks();

  const sanitize = (html?: string | null): string =>
    DOMPurify.sanitize(html ?? "", {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp|mailto):|\/)/i,
    });

  return { sanitize };
};
