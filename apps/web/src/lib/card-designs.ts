// Card design registry — ordered most-specific first; first keyword match wins.
// To add a new card: insert an entry above the relevant institution catchall.
// Keywords are lowercase substrings matched against `${cardName} ${institutionName}`.

export type CardNetwork = 'visa' | 'mastercard' | 'amex' | 'discover';
export type CardShimmer = 'glossy' | 'brushed';

export interface CardDesign {
  gradient: string;
  network: CardNetwork | null;
  shimmer: CardShimmer;
  /** Use dark chip + text decorations for light-colored cards (e.g. Apple Card) */
  darkText?: boolean;
  /** Lowercase substrings matched against cardName + institutionName; any single hit triggers this design */
  keywords: string[];
}

// ─── American Express ────────────────────────────────────────────────────────

const AMEX: CardDesign[] = [
  {
    keywords: ['centurion card', 'platinum card', 'amex platinum', 'american express platinum'],
    gradient: 'linear-gradient(135deg, #9A9A9E 0%, #C8C8CC 28%, #E6E6EA 50%, #BEBEC2 72%, #9A9A9E 100%)',
    network: 'amex',
    shimmer: 'brushed',
  },
  {
    keywords: ['gold card', 'amex gold', 'american express gold'],
    gradient: 'linear-gradient(135deg, #A67C00 0%, #C9A227 28%, #EDD060 50%, #C9A227 72%, #A67C00 100%)',
    network: 'amex',
    shimmer: 'glossy',
  },
  {
    keywords: ['amex green', 'american express green', 'green card'],
    gradient: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #1B4332 100%)',
    network: 'amex',
    shimmer: 'glossy',
  },
  {
    keywords: ['delta reserve', 'skymiles reserve'],
    gradient: 'linear-gradient(135deg, #1A2A48 0%, #2E4070 50%, #1A2A48 100%)',
    network: 'amex',
    shimmer: 'brushed',
  },
  {
    keywords: ['delta platinum', 'skymiles platinum'],
    gradient: 'linear-gradient(135deg, #8B7350 0%, #C4A878 50%, #8B7350 100%)',
    network: 'amex',
    shimmer: 'glossy',
  },
  {
    keywords: ['delta gold', 'skymiles gold', 'delta skymiles'],
    gradient: 'linear-gradient(135deg, #7B5E2A 0%, #B8902A 50%, #7B5E2A 100%)',
    network: 'amex',
    shimmer: 'glossy',
  },
  {
    keywords: ['hilton aspire', 'hilton honors aspire'],
    gradient: 'linear-gradient(135deg, #1A1A2E 0%, #2A2A44 50%, #001A3A 100%)',
    network: 'amex',
    shimmer: 'brushed',
  },
  {
    keywords: ['hilton surpass'],
    gradient: 'linear-gradient(135deg, #002D6B 0%, #0048B0 50%, #002D6B 100%)',
    network: 'amex',
    shimmer: 'glossy',
  },
  {
    keywords: ['hilton honors', 'hilton'],
    gradient: 'linear-gradient(135deg, #003A8A 0%, #0055C8 50%, #003A8A 100%)',
    network: 'amex',
    shimmer: 'glossy',
  },
  {
    keywords: ['marriott bonvoy brilliant', 'bonvoy brilliant'],
    gradient: 'linear-gradient(135deg, #7A3E10 0%, #B86020 50%, #7A3E10 100%)',
    network: 'amex',
    shimmer: 'brushed',
  },
  {
    keywords: ['marriott bonvoy', 'bonvoy bevy', 'bonvoy'],
    gradient: 'linear-gradient(135deg, #5A2C14 0%, #8A4828 50%, #5A2C14 100%)',
    network: 'amex',
    shimmer: 'glossy',
  },
  {
    keywords: ['blue cash preferred'],
    gradient: 'linear-gradient(135deg, #003B8E 0%, #0056CC 50%, #003B8E 100%)',
    network: 'amex',
    shimmer: 'glossy',
  },
  {
    keywords: ['blue cash everyday', 'blue cash'],
    gradient: 'linear-gradient(135deg, #0054A4 0%, #0078E8 50%, #0054A4 100%)',
    network: 'amex',
    shimmer: 'glossy',
  },
  {
    keywords: ['blue business cash', 'blue business plus', 'blue business preferred'],
    gradient: 'linear-gradient(135deg, #002E78 0%, #004BB8 50%, #002E78 100%)',
    network: 'amex',
    shimmer: 'glossy',
  },
  {
    keywords: ['everyday preferred', 'everyday credit'],
    gradient: 'linear-gradient(135deg, #0056B8 0%, #007AE8 50%, #0056B8 100%)',
    network: 'amex',
    shimmer: 'glossy',
  },
  // Catchall — must be last in this block
  {
    keywords: ['amex', 'american express'],
    gradient: 'linear-gradient(135deg, #006FCF 0%, #0087E0 50%, #006FCF 100%)',
    network: 'amex',
    shimmer: 'glossy',
  },
];

// ─── Chase ───────────────────────────────────────────────────────────────────

const CHASE: CardDesign[] = [
  {
    keywords: ['sapphire reserve'],
    gradient: 'linear-gradient(135deg, #0A1525 0%, #142240 50%, #0A1525 100%)',
    network: 'visa',
    shimmer: 'brushed',
  },
  {
    keywords: ['sapphire preferred'],
    gradient: 'linear-gradient(135deg, #0C2156 0%, #1A3A8F 50%, #0C2156 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['freedom unlimited'],
    gradient: 'linear-gradient(135deg, #0048B8 0%, #1A6ADE 50%, #0048B8 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['freedom flex'],
    gradient: 'linear-gradient(135deg, #00287A 0%, #0040B8 50%, #00287A 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['freedom rise', 'freedom student'],
    gradient: 'linear-gradient(135deg, #003A9E 0%, #005ACC 50%, #003A9E 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['freedom'],
    gradient: 'linear-gradient(135deg, #002880 0%, #004AC0 50%, #002880 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['ink business preferred', 'ink preferred'],
    gradient: 'linear-gradient(135deg, #001A50 0%, #002A80 50%, #001A50 100%)',
    network: 'visa',
    shimmer: 'brushed',
  },
  {
    keywords: ['ink business cash', 'ink business unlimited', 'ink cash', 'ink unlimited', 'ink business'],
    gradient: 'linear-gradient(135deg, #002858 0%, #004090 50%, #002858 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['amazon prime visa', 'prime rewards visa', 'prime visa'],
    gradient: 'linear-gradient(135deg, #0F1923 0%, #1C2E3E 50%, #0F1923 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['united explorer', 'united quest', 'united club infinite', 'united club', 'united gateway', 'united business'],
    gradient: 'linear-gradient(135deg, #002040 0%, #003A78 50%, #002040 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['southwest rapid rewards', 'southwest priority', 'southwest performance'],
    gradient: 'linear-gradient(135deg, #2A44AA 0%, #C42032 60%, #E8B020 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['world of hyatt', 'hyatt'],
    gradient: 'linear-gradient(135deg, #222228 0%, #3A3A42 50%, #222228 100%)',
    network: 'visa',
    shimmer: 'brushed',
  },
  {
    keywords: ['marriott bonvoy boundless', 'marriott bonvoy bold', 'bonvoy boundless'],
    gradient: 'linear-gradient(135deg, #1A1412 0%, #302820 50%, #1A1412 100%)',
    network: 'visa',
    shimmer: 'brushed',
  },
  {
    keywords: ['ihg one rewards premier', 'ihg premier', 'ihg one', 'ihg rewards'],
    gradient: 'linear-gradient(135deg, #003558 0%, #00558C 50%, #003558 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['disney'],
    gradient: 'linear-gradient(135deg, #001565 0%, #0D2FA8 50%, #001565 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['british airways', 'avios'],
    gradient: 'linear-gradient(135deg, #1A0A2A 0%, #3A1A5A 50%, #1A0A2A 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['aeroplan'],
    gradient: 'linear-gradient(135deg, #1A0028 0%, #3A0A58 50%, #1A0028 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  // Catchall
  {
    keywords: ['chase'],
    gradient: 'linear-gradient(135deg, #004AC0 0%, #0064DA 50%, #004AC0 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
];

// ─── Citi ────────────────────────────────────────────────────────────────────

const CITI: CardDesign[] = [
  {
    keywords: ['citi prestige'],
    gradient: 'linear-gradient(135deg, #080810 0%, #181828 50%, #080810 100%)',
    network: 'mastercard',
    shimmer: 'brushed',
  },
  {
    keywords: ['citi premier', 'thankyou premier', 'citi strata premier'],
    gradient: 'linear-gradient(135deg, #001952 0%, #002E99 50%, #001952 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['citi double cash', 'double cash'],
    gradient: 'linear-gradient(135deg, #182B3A 0%, #2C4A62 50%, #182B3A 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['citi custom cash', 'custom cash'],
    gradient: 'linear-gradient(135deg, #2D1B69 0%, #4A2EA0 50%, #2D1B69 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['citi rewards+', 'citi thankyou', 'thankyou preferred'],
    gradient: 'linear-gradient(135deg, #002A80 0%, #0044BB 50%, #002A80 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['citi diamond preferred', 'diamond preferred'],
    gradient: 'linear-gradient(135deg, #1A1A28 0%, #2A2A40 50%, #1A1A28 100%)',
    network: 'mastercard',
    shimmer: 'brushed',
  },
  {
    keywords: ['citi simplicity', 'simplicity card'],
    gradient: 'linear-gradient(135deg, #0A1428 0%, #182440 50%, #0A1428 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['costco anywhere visa', 'costco citi'],
    gradient: 'linear-gradient(135deg, #004A90 0%, #0066C8 50%, #004A90 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['best buy credit card', 'best buy citi'],
    gradient: 'linear-gradient(135deg, #002E8A 0%, #0048BB 50%, #002E8A 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['at&t points plus'],
    gradient: 'linear-gradient(135deg, #00396C 0%, #0055A0 50%, #00396C 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  // Catchall
  {
    keywords: ['citi', 'citibank', 'citicard'],
    gradient: 'linear-gradient(135deg, #003EA9 0%, #0058DC 50%, #003EA9 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
];

// ─── Capital One ─────────────────────────────────────────────────────────────

const CAPITAL_ONE: CardDesign[] = [
  {
    keywords: ['venture x rewards', 'venture x'],
    gradient: 'linear-gradient(135deg, #0C0C1E 0%, #1C1C36 45%, #262642 100%)',
    network: 'visa',
    shimmer: 'brushed',
  },
  {
    keywords: ['venture one', 'ventureone'],
    gradient: 'linear-gradient(135deg, #00327A 0%, #004EB8 50%, #00327A 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['venture rewards', 'venture'],
    gradient: 'linear-gradient(135deg, #00297A 0%, #0044B8 50%, #00297A 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['quicksilver one', 'quicksilverone'],
    gradient: 'linear-gradient(135deg, #484848 0%, #686868 50%, #484848 100%)',
    network: 'mastercard',
    shimmer: 'brushed',
  },
  {
    keywords: ['quicksilver'],
    gradient: 'linear-gradient(135deg, #3A3A3A 0%, #5C5C5C 50%, #3A3A3A 100%)',
    network: 'mastercard',
    shimmer: 'brushed',
  },
  {
    keywords: ['savor one', 'savorone'],
    gradient: 'linear-gradient(135deg, #5C1A1A 0%, #8C2828 50%, #5C1A1A 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['savor cash', 'savor rewards', 'savor'],
    gradient: 'linear-gradient(135deg, #481010 0%, #721818 50%, #481010 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['spark cash plus', 'spark cash select', 'spark cash'],
    gradient: 'linear-gradient(135deg, #001838 0%, #002A60 50%, #001838 100%)',
    network: 'mastercard',
    shimmer: 'brushed',
  },
  {
    keywords: ['spark miles select', 'spark miles'],
    gradient: 'linear-gradient(135deg, #002A78 0%, #0044B8 50%, #002A78 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['spark classic', 'spark business'],
    gradient: 'linear-gradient(135deg, #1A2840 0%, #2A3C58 50%, #1A2840 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['secured mastercard', 'capital one secured', 'platinum secured'],
    gradient: 'linear-gradient(135deg, #1A2838 0%, #2A3E54 50%, #1A2838 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  // Catchall
  {
    keywords: ['capital one'],
    gradient: 'linear-gradient(135deg, #8B0000 0%, #C00000 50%, #8B0000 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
];

// ─── Bank of America ──────────────────────────────────────────────────────────

const BANK_OF_AMERICA: CardDesign[] = [
  {
    keywords: ['premium rewards elite'],
    gradient: 'linear-gradient(135deg, #8A6010 0%, #C89030 28%, #E8B850 50%, #C89030 72%, #8A6010 100%)',
    network: 'visa',
    shimmer: 'brushed',
  },
  {
    keywords: ['premium rewards'],
    gradient: 'linear-gradient(135deg, #7A5010 0%, #B07828 50%, #7A5010 100%)',
    network: 'visa',
    shimmer: 'brushed',
  },
  {
    keywords: ['alaska airlines visa signature', 'alaska airlines'],
    gradient: 'linear-gradient(135deg, #00305A 0%, #005490 50%, #00305A 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['travel rewards'],
    gradient: 'linear-gradient(135deg, #003E9A 0%, #0060D0 50%, #003E9A 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['unlimited cash rewards', 'customized cash rewards', 'cash rewards'],
    gradient: 'linear-gradient(135deg, #8B0000 0%, #B80000 50%, #8B0000 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  // Catchall
  {
    keywords: ['bank of america', 'bofa', 'bankamerica'],
    gradient: 'linear-gradient(135deg, #8A0000 0%, #C00000 50%, #8A0000 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
];

// ─── Wells Fargo ──────────────────────────────────────────────────────────────

const WELLS_FARGO: CardDesign[] = [
  {
    keywords: ['autograph journey'],
    gradient: 'linear-gradient(135deg, #7A0000 0%, #B00000 40%, #D42A00 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['autograph'],
    gradient: 'linear-gradient(135deg, #8B0000 0%, #C40000 50%, #8B0000 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['active cash'],
    gradient: 'linear-gradient(135deg, #780000 0%, #AA0000 50%, #780000 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['reflect'],
    gradient: 'linear-gradient(135deg, #580000 0%, #860000 50%, #580000 100%)',
    network: 'visa',
    shimmer: 'brushed',
  },
  // Catchall
  {
    keywords: ['wells fargo'],
    gradient: 'linear-gradient(135deg, #B8060A 0%, #D71E28 50%, #B8060A 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
];

// ─── Discover ─────────────────────────────────────────────────────────────────

const DISCOVER: CardDesign[] = [
  {
    keywords: ['discover it cash back', 'discover it'],
    gradient: 'linear-gradient(135deg, #B84000 0%, #F06010 45%, #F5A020 100%)',
    network: 'discover',
    shimmer: 'glossy',
  },
  {
    keywords: ['discover it miles', 'discover miles'],
    gradient: 'linear-gradient(135deg, #1A3560 0%, #284E90 50%, #1A3560 100%)',
    network: 'discover',
    shimmer: 'glossy',
  },
  {
    keywords: ['discover it chrome', 'discover chrome'],
    gradient: 'linear-gradient(135deg, #282828 0%, #484848 50%, #282828 100%)',
    network: 'discover',
    shimmer: 'brushed',
  },
  {
    keywords: ['discover it student', 'discover student'],
    gradient: 'linear-gradient(135deg, #C04800 0%, #E86818 50%, #C04800 100%)',
    network: 'discover',
    shimmer: 'glossy',
  },
  {
    keywords: ['discover it secured', 'discover secured'],
    gradient: 'linear-gradient(135deg, #A84000 0%, #D06010 50%, #A84000 100%)',
    network: 'discover',
    shimmer: 'glossy',
  },
  // Catchall
  {
    keywords: ['discover'],
    gradient: 'linear-gradient(135deg, #B84800 0%, #E06818 50%, #B84800 100%)',
    network: 'discover',
    shimmer: 'glossy',
  },
];

// ─── US Bank ──────────────────────────────────────────────────────────────────

const US_BANK: CardDesign[] = [
  {
    keywords: ['altitude reserve'],
    gradient: 'linear-gradient(135deg, #180A2C 0%, #2A1448 50%, #180A2C 100%)',
    network: 'visa',
    shimmer: 'brushed',
  },
  {
    keywords: ['altitude go'],
    gradient: 'linear-gradient(135deg, #18183A 0%, #2A2A5A 50%, #18183A 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['altitude connect'],
    gradient: 'linear-gradient(135deg, #0A1A3A 0%, #183060 50%, #0A1A3A 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['cash+ visa', 'us bank cash+', 'cash plus visa'],
    gradient: 'linear-gradient(135deg, #580A1A 0%, #881530 50%, #580A1A 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['shopper cash rewards'],
    gradient: 'linear-gradient(135deg, #4A0A20 0%, #781530 50%, #4A0A20 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  // Catchall
  {
    keywords: ['u.s. bank', 'us bank', 'usbank'],
    gradient: 'linear-gradient(135deg, #680A24 0%, #8A1538 50%, #680A24 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
];

// ─── PNC ─────────────────────────────────────────────────────────────────────

const PNC: CardDesign[] = [
  {
    keywords: ['pnc cash rewards', 'pnc points', 'pnc travel rewards', 'pnc core visa'],
    gradient: 'linear-gradient(135deg, #C04000 0%, #E86010 50%, #C04000 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['pnc'],
    gradient: 'linear-gradient(135deg, #D04000 0%, #F07018 50%, #D04000 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
];

// ─── TD Bank ──────────────────────────────────────────────────────────────────

const TD_BANK: CardDesign[] = [
  {
    keywords: ['td cash credit', 'td first class', 'td double up', 'td bank'],
    gradient: 'linear-gradient(135deg, #1E6B20 0%, #2C8A30 50%, #1E6B20 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
];

// ─── Truist ───────────────────────────────────────────────────────────────────

const TRUIST: CardDesign[] = [
  {
    keywords: ['truist travel', 'truist cash', 'truist future', 'truist'],
    gradient: 'linear-gradient(135deg, #3A1E5A 0%, #5A3080 50%, #3A1E5A 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
];

// ─── Military / Credit Unions ─────────────────────────────────────────────────

const MILITARY: CardDesign[] = [
  {
    keywords: ['navy federal cashrewards', 'navy federal more rewards', 'navy federal platinum', 'navy federal go rewards'],
    gradient: 'linear-gradient(135deg, #002050 0%, #003680 50%, #002050 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['navy federal'],
    gradient: 'linear-gradient(135deg, #001E48 0%, #003070 50%, #001E48 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['usaa cashback', 'usaa rewards', 'usaa rate advantage'],
    gradient: 'linear-gradient(135deg, #001E60 0%, #003090 50%, #001E60 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['usaa'],
    gradient: 'linear-gradient(135deg, #001C58 0%, #002A80 50%, #001C58 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['penfed', 'pentagon federal'],
    gradient: 'linear-gradient(135deg, #003060 0%, #005090 50%, #003060 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
];

// ─── Co-branded & Retail ──────────────────────────────────────────────────────

const COBRANDED: CardDesign[] = [
  // Bilt — issued by Wells Fargo but branded as Bilt; Plaid returns "Bilt Mastercard"
  {
    keywords: ['bilt mastercard', 'bilt rewards', 'bilt world elite', 'bilt'],
    gradient: 'linear-gradient(135deg, #0A0A0A 0%, #1C1C1C 50%, #0A0A0A 100%)',
    network: 'mastercard',
    shimmer: 'brushed',
  },
  {
    keywords: ['apple card'],
    gradient: 'linear-gradient(135deg, #E4E4E4 0%, #F4F4F6 50%, #E0E0E0 100%)',
    network: 'mastercard',
    shimmer: 'brushed',
    darkText: true,
  },
  {
    keywords: ['amazon prime rewards visa', 'amazon prime visa', 'prime rewards visa'],
    gradient: 'linear-gradient(135deg, #0F1923 0%, #1C2E3E 50%, #0F1923 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['amazon store card', 'amazon secured card'],
    gradient: 'linear-gradient(135deg, #0F1520 0%, #1A2535 50%, #0F1520 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['target redcard', 'target red card', 'target circle card'],
    gradient: 'linear-gradient(135deg, #C00000 0%, #E00000 50%, #C00000 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['costco anywhere visa', 'costco visa'],
    gradient: 'linear-gradient(135deg, #004A90 0%, #0066C8 50%, #004A90 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['walmart rewards', 'walmart capital one'],
    gradient: 'linear-gradient(135deg, #0060B0 0%, #0080E0 50%, #0060B0 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['kroger rewards', 'kroger 1-2-3 rewards'],
    gradient: 'linear-gradient(135deg, #00459A 0%, #006ACC 50%, #00459A 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['paypal cashback', 'paypal credit', 'paypal mastercard'],
    gradient: 'linear-gradient(135deg, #00246B 0%, #003AA8 50%, #00246B 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['x1 card', 'x1 credit'],
    gradient: 'linear-gradient(135deg, #0A0A0A 0%, #1C1C1C 50%, #0A0A0A 100%)',
    network: 'visa',
    shimmer: 'brushed',
  },
  {
    keywords: ['robinhood gold card', 'robinhood credit'],
    gradient: 'linear-gradient(135deg, #003800 0%, #005A00 50%, #003800 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['petal 2', 'petal 1', 'petal visa'],
    gradient: 'linear-gradient(135deg, #2A4A3A 0%, #3E6652 50%, #2A4A3A 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
  {
    keywords: ['secured credit card', 'secured mastercard', 'secured visa'],
    gradient: 'linear-gradient(135deg, #1A3040 0%, #2A4860 50%, #1A3040 100%)',
    network: null,
    shimmer: 'glossy',
  },
];

// ─── Fintech ──────────────────────────────────────────────────────────────────

const FINTECH: CardDesign[] = [
  {
    keywords: ['ally unlimited cash back', 'ally everyday cash', 'ally credit'],
    gradient: 'linear-gradient(135deg, #5A20C0 0%, #8040E8 50%, #5A20C0 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['sofi credit card', 'sofi unlimited'],
    gradient: 'linear-gradient(135deg, #4820A8 0%, #6A38D0 50%, #4820A8 100%)',
    network: 'mastercard',
    shimmer: 'glossy',
  },
  {
    keywords: ['chime credit builder', 'chime secured'],
    gradient: 'linear-gradient(135deg, #3A8878 0%, #50A896 50%, #3A8878 100%)',
    network: 'visa',
    shimmer: 'glossy',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Assembled registry — order matters: more-specific entries before catchalls
// ─────────────────────────────────────────────────────────────────────────────

export const CARD_REGISTRY: CardDesign[] = [
  ...AMEX,
  ...CHASE,
  ...CITI,
  ...CAPITAL_ONE,
  ...BANK_OF_AMERICA,
  ...WELLS_FARGO,
  ...DISCOVER,
  ...US_BANK,
  ...PNC,
  ...TD_BANK,
  ...TRUIST,
  ...MILITARY,
  ...COBRANDED,
  ...FINTECH,
];

/**
 * Returns the best matching CardDesign for the given card/institution names,
 * or null if no keyword matches (caller falls back to brand-color chip).
 */
export function resolveCardDesign(
  cardName: string,
  institutionName?: string,
): CardDesign | null {
  const haystack = `${cardName} ${institutionName ?? ''}`.toLowerCase();
  for (const design of CARD_REGISTRY) {
    if (design.keywords.some(kw => haystack.includes(kw))) return design;
  }
  return null;
}
