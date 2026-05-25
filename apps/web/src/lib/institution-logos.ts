// Maps institution name substrings (all lowercase) → [domain, brandColor]. First match wins.
const INSTITUTION_MAP: [string[], [string, string]][] = [
  // ── Banks ────────────────────────────────────────────────────────────────
  [['jpmorgan', 'j.p. morgan', 'chase'],          ['chase.com',            '#117ACA']],
  [['bank of america', 'bofa', 'boa'],             ['bankofamerica.com',    '#E31837']],
  [['wells fargo'],                                ['wellsfargo.com',       '#D71E28']],
  [['citibank', 'citicard', 'citi'],               ['citi.com',             '#003EA9']],
  [['us bank', 'u.s. bank', 'usbank'],             ['usbank.com',           '#8A1538']],
  [['td bank', 'td ameritrade'],                   ['td.com',               '#34A853']],
  [['pnc bank', 'pnc'],                            ['pnc.com',              '#F58220']],
  [['truist', 'suntrust', 'bb&t'],                 ['truist.com',           '#4B286D']],
  [['fifth third', '5/3 bank'],                    ['53.com',               '#00B140']],
  [['citizens bank', 'citizens'],                  ['citizensbank.com',     '#004990']],
  [['regions bank', 'regions'],                    ['regions.com',          '#005288']],
  [['huntington'],                                 ['huntington.com',       '#006F3C']],
  [['keybank', 'key bank'],                        ['key.com',              '#CC0000']],
  [['m&t bank', 'm&t'],                            ['mtb.com',              '#003087']],
  [['ally bank', 'ally'],                          ['ally.com',             '#853BE3']],
  [['marcus', 'goldman sachs'],                    ['marcus.com',           '#1B74CE']],
  [['synchrony'],                                  ['synchrony.com',        '#FC5600']],
  [['navy federal'],                               ['navyfederal.org',      '#003B72']],
  [['usaa'],                                       ['usaa.com',             '#003087']],
  [['chime'],                                      ['chime.com',            '#57BDA7']],
  [['sofi'],                                       ['sofi.com',             '#6536CC']],
  [['discover bank', 'discover card', 'discover'], ['discover.com',         '#F76B1C']],
  [['hsbc'],                                       ['hsbc.com',             '#DB0011']],
  [['barclays'],                                   ['barclaycardus.com',    '#00AEEF']],
  [['santander'],                                  ['santanderbank.com',    '#EC0000']],
  [['lendingclub', 'lending club'],                ['lendingclub.com',      '#6CB33F']],
  [['bread financial'],                            ['breadfinancial.com',   '#FF4A00']],

  // ── Credit Cards ─────────────────────────────────────────────────────────
  [['american express', 'amex'],                   ['americanexpress.com',  '#007BC1']],
  [['capital one'],                                ['capitalone.com',       '#CC0000']],
  [['apple card'],                                 ['apple.com',            '#555555']],
  [['venmo'],                                      ['venmo.com',            '#3D95CE']],
  [['paypal'],                                     ['paypal.com',           '#003087']],

  // ── Brokerages & Investment ──────────────────────────────────────────────
  [['fidelity'],                                   ['fidelity.com',         '#00A651']],
  [['vanguard'],                                   ['vanguard.com',         '#960A2C']],
  [['charles schwab', 'schwab'],                   ['schwab.com',           '#00A4B4']],
  [['robinhood'],                                  ['robinhood.com',        '#00C805']],
  [['e*trade', 'etrade'],                          ['etrade.com',           '#621B7E']],
  [['merrill lynch', 'merrill edge', 'merrill'],   ['ml.com',               '#B90000']],
  [['edward jones'],                               ['edwardjones.com',      '#00508F']],
  [['raymond james'],                              ['raymondjames.com',     '#002855']],
  [['betterment'],                                 ['betterment.com',       '#0D2137']],
  [['wealthfront'],                                ['wealthfront.com',      '#3E9E4C']],
  [['acorns'],                                     ['acorns.com',           '#4E8642']],
  [['stash invest', 'stash'],                      ['stash.com',            '#2FBD7A']],
  [['webull'],                                     ['webull.com',           '#D43725']],
  [['m1 finance', 'm1finance'],                    ['m1finance.com',        '#00D4C0']],
  [['coinbase'],                                   ['coinbase.com',         '#0052FF']],
  [['kraken'],                                     ['kraken.com',           '#5741D9']],

  // ── Student / Personal Loans ─────────────────────────────────────────────
  [['sallie mae', 'salliemae'],                    ['salliemae.com',        '#001952']],
  [['navient'],                                    ['navient.com',          '#003865']],
  [['great lakes'],                                ['mygreatlakes.org',     '#003A63']],
  [['nelnet'],                                     ['nelnet.com',           '#3A7DC9']],
  [['mohela'],                                     ['mohela.com',           '#005288']],

  // ── Mortgage ─────────────────────────────────────────────────────────────
  [['quicken loans', 'rocket mortgage'],           ['rocketmortgage.com',   '#F15A22']],
  [['loandepot', 'loan depot'],                    ['loandepot.com',        '#E8252A']],
  [['mr. cooper', 'mr cooper', 'nationstar'],      ['mrcooper.com',         '#0080BE']],
  [['pennymac'],                                   ['pennymac.com',         '#00436B']],
  [['freedom mortgage'],                           ['freedommortgage.com',  '#003087']],

  // ── Auto Loans ───────────────────────────────────────────────────────────
  [['toyota financial', 'toyota motor credit'],    ['toyota.com',           '#EB0A1E']],
  [['ford motor credit', 'ford credit'],           ['ford.com',             '#003476']],
  [['gm financial', 'general motors financial'],   ['gmfinancial.com',      '#009CDE']],
  [['honda financial', 'honda auto finance'],      ['honda.com',            '#CC0000']],
  [['bmw financial', 'bmwfs'],                     ['bmwusa.com',           '#1C69D4']],
  [['mercedes-benz financial', 'mbfs'],            ['mbusa.com',            '#333333']],
  [['hyundai motor finance', 'hyundai finance'],   ['hyundai.com',          '#002C5F']],
  [['kia motors finance', 'kia finance'],          ['kia.com',              '#05141F']],
  [['volkswagen credit', 'vw credit'],             ['vw.com',               '#001E50']],
  [['nissan motor acceptance', 'nmac'],            ['nissanusa.com',        '#C3002F']],
  [['westlake financial'],                         ['westlakefinancial.com','#003087']],
];

function resolve(name: string): [string, string] | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const [keywords, entry] of INSTITUTION_MAP) {
    if (keywords.some(k => lower.includes(k))) return entry;
  }
  return null;
}

export function getInstitutionDomain(name: string): string | null {
  return resolve(name)?.[0] ?? null;
}

export function getInstitutionBrandColor(name: string): string | null {
  return resolve(name)?.[1] ?? null;
}

// Returns a logo.dev URL, or null if VITE_LOGO_DEV_TOKEN is not configured.
// Sign up at logo.dev, create a project, and paste the pk_... token into VITE_LOGO_DEV_TOKEN.
export function logoUrl(domain: string): string | null {
  const token = import.meta.env.VITE_LOGO_DEV_TOKEN;
  if (!token) return null;
  return `https://img.logo.dev/${domain}?token=${token}&format=png&size=128`;
}
