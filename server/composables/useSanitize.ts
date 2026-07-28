import DOMPurify from "isomorphic-dompurify";

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

    const allowedTargets = new Set(ALLOWED_TARGETS);

    const target = node.getAttribute("target");
    if (target !== null && !allowedTargets.has(target)) {
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

export const useSanitize = () => {
  registerHooks();

  const sanitize = (html?: string | null): string =>
    DOMPurify.sanitize(html ?? "", {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
    });

  return { sanitize };
};
