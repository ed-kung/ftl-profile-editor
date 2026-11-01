import { parseXml } from './xml'

/**
 * FTL 1.6.1+ moved display strings out of the files that reference them.
 *
 * A blueprint now carries an empty tag with an "id" attribute, and the string
 * itself lives in one of the central "text_*.xml" files as
 * <text name="ID">value</text>. Earlier versions inlined the text, so a tag
 * may legitimately have content and no id.
 *
 * @see net.blerf.ftl.parser.DefaultDataManager's textLookupMap
 * @see net.blerf.ftl.xml.DefaultDeferredText
 */

/** The files that hold central string lookups, oldest convention first. */
export const TEXT_LOOKUP_FILE_NAMES = [
  // FTL 1.5.4-1.5.13.
  'misc.xml',
  // FTL 1.6.1.
  'text_achievements.xml',
  'text_blueprints.xml',
  'text_events.xml',
  'text_misc.xml',
  'text_sectorname.xml',
  'text_tooltips.xml',
  'text_tutorial.xml',
]

export type TextLookup = Map<string, string>

/** Collects <text name="..."> entries from one lookup file into `into`. */
export function addTextLookups(
  into: TextLookup,
  xmlText: string,
  fileName: string,
): void {
  const doc = parseXml(xmlText, fileName)

  for (const el of Array.from(doc.getElementsByTagName('text'))) {
    const name = el.getAttribute('name')
    if (!name) continue

    // FTL stores hard line breaks as a literal backslash-n.
    into.set(name, (el.textContent ?? '').replace(/\\n/g, '\n'))
  }
}

/**
 * Resolves a possibly-deferred text element.
 *
 * Returns the element's own content when it has some, otherwise the central
 * lookup for its "id". Falls back to the raw id so an unresolved string shows
 * up as something identifiable rather than blank.
 */
export function resolveText(
  el: Element | null,
  lookup: TextLookup,
): string | null {
  if (!el) return null

  const inline = el.textContent ?? ''
  if (inline.length > 0) return inline

  const id = el.getAttribute('id')
  if (!id) return null

  return lookup.get(id) ?? id
}
