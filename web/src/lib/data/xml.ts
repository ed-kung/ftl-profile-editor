/**
 * XML parsing for FTL's data files.
 *
 * FTL 1.6.3's own blueprint, achievement and text files are well-formed, so
 * DOMParser handles them directly. Mods are another matter: the game's own
 * loader is lenient, and Slipstream ships a whole scraper
 * (net.vhati.modmanager.core.SloppyXMLParser) for the malformed files that
 * result. Rather than port those 475 lines, this repairs the two breakages that
 * actually stop DOMParser -- bare ampersands and nested comments -- and retries.
 */

export class XmlParseError extends Error {
  constructor(
    readonly fileName: string,
    detail: string,
  ) {
    super(`Could not parse "${fileName}": ${detail}`)
    this.name = 'XmlParseError'
  }
}

/**
 * Parses one of FTL's data files into a Document.
 *
 * @param text the file's contents
 * @param fileName used only for error messages
 */
export function parseXml(text: string, fileName: string): Document {
  const direct = tryParse(text)
  if (direct.doc) return direct.doc

  const repaired = tryParse(repairSloppyXml(text))
  if (repaired.doc) return repaired.doc

  throw new XmlParseError(fileName, repaired.error ?? direct.error ?? 'unknown error')
}

function tryParse(text: string): { doc?: Document; error?: string } {
  const doc = new DOMParser().parseFromString(text, 'text/xml')
  const error = doc.querySelector('parsererror')
  if (error) {
    return { error: error.textContent?.trim().split('\n')[0] ?? 'malformed XML' }
  }
  return { doc }
}

/**
 * Patches the malformed XML that modded FTL data tends to contain.
 *
 * Deliberately narrow: it only touches constructs that are unambiguously
 * broken, so a file DOMParser already accepts is never altered.
 */
export function repairSloppyXml(text: string): string {
  let out = text

  // Nested comment openers. FTL tolerates "<!-- <!-- blah -->"; XML does not.
  out = out.replace(/<!--[\s\S]*?-->/g, (comment) => {
    const body = comment.slice(4, -3).replace(/<!--/g, '').replace(/--+/g, '-')
    return `<!--${body}-->`
  })

  // Bare ampersands, which FTL's own text files have been known to carry.
  out = out.replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')

  return out
}

/** Direct element children with the given tag name. */
export function childElements(parent: Element | Document, tagName: string): Element[] {
  const out: Element[] = []
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tagName) out.push(child)
  }
  return out
}

/** The first direct child with the given tag name, if any. */
export function childElement(parent: Element, tagName: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tagName) return child
  }
  return null
}
