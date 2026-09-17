/**
 * The Discogs cart page, copied and pasted (M34.3).
 *
 * Discogs' API has no cart (`/marketplace/cart` answers 404, docs/02), and
 * the page itself may not be fetched (CLAUDE.md rule 5). What somebody may
 * do is select their own cart page, copy it and paste it here — the same way
 * the seller's shipping text arrives. The page holds, per shop, the one thing
 * no endpoint names for more than one record: what Discogs will charge for
 * postage on *this* parcel. Alongside it, three sentences worth keeping:
 * "Add up to 42 more … at no additional shipping cost", "Free Shipping on
 * orders of €250.00 EUR or more" and "€12,12 EUR below the seller's minimum".
 *
 * Reconstructed from two real pages on 2026-09-17 (`tests/fixtures/cart-text.ts`).
 * The German interface keeps the headings German and those three sentences
 * English; the English interface is read by the same labels in English. The
 * parser reads by label and never by position: a copy that puts a table row
 * on one line with a tab, or on two lines, reads the same.
 *
 * Pure. No I/O, no request.
 */

export interface Money {
  value: number
  currency: string
}

export interface CartBlock {
  /** The seller's username, as the page writes it after "Bestellung bei". */
  dealer: string
  /** Records in this shop's parcel: one condition line each, above the sum. */
  records: number
  subtotal: Money | null
  /**
   * What Discogs charges for postage on this parcel. The summary row where
   * there is one; where a shop posts free the page drops the row and the
   * method line "Free Shipping - €0,00" is all that says so.
   */
  postage: Money | null
  total: Money | null
  /** "Standard - Deutsche Post / DHL", when the method line was there. */
  method: string | null
  /** "Add up to 42 more discs/tapes … at no additional shipping cost". */
  moreAtNoExtra: number | null
  /** "Free Shipping on orders of €250.00 EUR or more". */
  freeOver: Money | null
  /** "€12,12 EUR below the seller's minimum order requirement". */
  minOrderShort: Money | null
}

const BLOCK_START = /^\s*(?:Bestellung bei|Order from)\b:?\s*(\S+)?/i
const CONDITION = /^\s*(?:Tonträger|Media(?: Condition)?|Medium)\s*:/i
const SUBTOTAL = /^\s*(?:Zwischensumme|Subtotal)\b/i
const SHIPPING = /^\s*(?:Versand(?:kosten)?|Shipping)\b/i
const TOTAL = /^\s*(?:Gesamt(?:summe)?|Total)\b/i
const MORE = /(?:add up to|bis zu)\s+(\d+)\s+(?:more|weitere)/i
const FREE_OVER =
  /(?:free shipping on orders of|kostenlose[rn]? versand (?:ab|bei bestellungen ab))\s+(.+?)(?:\s+or more|\s+und mehr|[.!]|$)/i
const MIN_SHORT = /(.+?)\s+(?:below the seller'?s minimum|unter dem Mindestbestellwert)/i
const FREE_METHOD = /free shipping|kostenlos|gratis/i

const SYMBOLS: Record<string, string> = { '€': 'EUR', '£': 'GBP', $: 'USD' }

/**
 * A price out of a line: `€7,00 EUR`, `€72.00 EUR`, `€3,90`, `12.00 GBP`.
 *
 * A currency symbol or a three-letter code has to be there; a bare number is
 * a delivery time or a rating count. The code wins over the symbol, because
 * "$" is several currencies. Both decimal marks are read: the German page
 * writes the items with a comma and the sums with a dot, on the same screen.
 */
export function readMoney(text: string): Money | null {
  const marked = /([€£$])\s?(\d(?:[\d.,]*\d)?)(?:\s?([A-Z]{3})\b)?/.exec(text)
  if (marked) {
    const [, symbol, digits, code] = marked
    return money(digits!, code ?? SYMBOLS[symbol!])
  }
  const coded = /(?:^|[^\d.,])(\d(?:[\d.,]*\d)?)\s?([A-Z]{3})\b/.exec(text)
  return coded ? money(coded[1]!, coded[2]) : null
}

function money(digits: string, currency: string | undefined): Money | null {
  if (!currency) return null
  const value = readNumber(digits)
  return value === null ? null : { value, currency }
}

function readNumber(digits: string): number | null {
  const last = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','))
  if (last === -1) return Number(digits)
  const tail = digits.length - last - 1
  // The last mark is the decimal one when one or two digits follow it;
  // "1.234" and "7,681" are thousands.
  const decimal = tail === 1 || tail === 2
  const whole = (decimal ? digits.slice(0, last) : digits).replace(/[.,]/g, '')
  const fraction = decimal ? digits.slice(last + 1) : ''
  const value = Number(fraction ? `${whole}.${fraction}` : whole)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

export function parseCartText(input: string): CartBlock[] {
  const lines = input.split(/\r?\n/)
  const starts: { at: number; dealer: string }[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const match = BLOCK_START.exec(lines[i]!)
    if (!match) continue
    let dealer = match[1] ?? ''
    if (!dealer) {
      // The icon between the label and the name sometimes breaks the line.
      const next = lines.slice(i + 1, i + 3).find((line) => line.trim() !== '')
      dealer = next?.trim().split(/\s+/)[0] ?? ''
    }
    dealer = dealer.replace(/[:,.]+$/, '')
    if (dealer) starts.push({ at: i, dealer })
  }

  return starts.map(({ at, dealer }, index) => {
    const end = starts[index + 1]?.at ?? lines.length
    return readBlock(dealer, lines.slice(at + 1, end))
  })
}

/**
 * The figure that belongs to a label: on the same line after it, or on the
 * next line that is not blank. Nothing further away, so a label with no
 * figure does not borrow one from the row below.
 */
function figureAt(lines: string[], index: number): Money | null {
  const same = readMoney(
    lines[index]!.replace(SUBTOTAL, '').replace(SHIPPING, '').replace(TOTAL, ''),
  )
  if (same) return same
  const next = lines.slice(index + 1, index + 3).find((line) => line.trim() !== '')
  return next ? readMoney(next) : null
}

function readBlock(dealer: string, lines: string[]): CartBlock {
  const subtotalAt = lines.findIndex((line) => SUBTOTAL.test(line))
  const above = subtotalAt === -1 ? lines : lines.slice(0, subtotalAt)
  const below = subtotalAt === -1 ? [] : lines.slice(subtotalAt)

  const records = above.filter((line) => CONDITION.test(line)).length
  const subtotal = subtotalAt === -1 ? null : figureAt(lines, subtotalAt)

  const shippingAt = below.findIndex((line, i) => i > 0 && SHIPPING.test(line))
  const totalAt = below.findIndex((line, i) => i > 0 && TOTAL.test(line))
  let postage = shippingAt === -1 ? null : figureAt(below, shippingAt)
  const total = totalAt === -1 ? null : figureAt(below, totalAt)

  // The method line sits under the "Versand" heading, above the sum:
  // "Standard - Deutsche Post / DHL - €6,00", "Free Shipping - €0,00".
  let method: string | null = null
  const headingAt = above.findIndex((line) => SHIPPING.test(line) && readMoney(line) === null)
  if (headingAt !== -1) {
    const line = above
      .slice(headingAt + 1, headingAt + 4)
      .find((l) => /\s-\s/.test(l) && readMoney(l))
    if (line) {
      const cut = line.lastIndexOf(' - ')
      method = line.slice(0, cut).trim()
      const price = readMoney(line.slice(cut + 3))
      if (!postage && price && (price.value === 0 || FREE_METHOD.test(method))) {
        postage = { value: 0, currency: subtotal?.currency ?? price.currency }
      }
    }
  }

  let moreAtNoExtra: number | null = null
  let freeOver: Money | null = null
  let minOrderShort: Money | null = null
  for (const line of lines) {
    const more = MORE.exec(line)
    if (more) moreAtNoExtra = Number(more[1])
    const free = FREE_OVER.exec(line)
    if (free) freeOver = readMoney(free[1]!)
    const short = MIN_SHORT.exec(line)
    if (short) minOrderShort = readMoney(short[1]!)
  }

  return {
    dealer,
    records,
    subtotal,
    postage,
    total,
    method,
    moreAtNoExtra,
    freeOver,
    minOrderShort,
  }
}
