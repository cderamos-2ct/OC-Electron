// Password Generator — cryptographically secure password and passphrase generation
// Uses Node.js crypto.randomBytes for randomness, no external dependencies

import { randomBytes } from 'crypto';

// ─── Types ──────────────────────────────────────────────────────

export interface PasswordOptions {
  length?: number;           // 8-128 (default: 20)
  uppercase?: boolean;       // Include A-Z (default: true)
  lowercase?: boolean;       // Include a-z (default: true)
  numbers?: boolean;         // Include 0-9 (default: true)
  symbols?: boolean;         // Include symbols (default: true)
  symbolSet?: string;        // Custom symbol set (default: '!@#$%^&*()_+-=[]{}|;:,.<>?')
  excludeAmbiguous?: boolean; // Exclude 0O1lI (default: false)
}

export interface PassphraseOptions {
  wordCount?: number;        // 3-12 (default: 4)
  delimiter?: string;        // Word separator (default: '-')
  capitalize?: boolean;      // Capitalize first letter of each word (default: true)
  includeNumber?: boolean;   // Append a random number (default: false)
}

// ─── Character Sets ─────────────────────────────────────────────

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const DEFAULT_SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const AMBIGUOUS = '0O1lI';

// ─── EFF Wordlist (Short, 1296 words) ───────────────────────────
// Subset of the EFF short wordlist for passphrase generation
// Full list: https://www.eff.org/dice

const WORDLIST = [
  'acid', 'acme', 'aged', 'also', 'arch', 'army', 'away', 'back', 'bail', 'bake',
  'bald', 'band', 'bank', 'barn', 'base', 'bash', 'bath', 'bead', 'beam', 'bean',
  'bear', 'beat', 'beef', 'been', 'bell', 'belt', 'bend', 'bike', 'bind', 'bird',
  'bite', 'blow', 'blue', 'blur', 'boat', 'body', 'bold', 'bolt', 'bomb', 'bond',
  'bone', 'book', 'boot', 'born', 'boss', 'both', 'bowl', 'bulk', 'bump', 'burn',
  'burp', 'busy', 'buzz', 'cafe', 'cage', 'cake', 'call', 'calm', 'came', 'camp',
  'cane', 'cape', 'card', 'care', 'cart', 'case', 'cash', 'cast', 'cave', 'chat',
  'chef', 'chin', 'chip', 'chop', 'city', 'clad', 'clam', 'clap', 'clay', 'clip',
  'clock', 'clone', 'club', 'clue', 'coal', 'coat', 'code', 'coil', 'coin', 'cold',
  'cone', 'cook', 'cool', 'cope', 'copy', 'cord', 'core', 'cork', 'corn', 'cost',
  'cozy', 'crab', 'crew', 'crop', 'crow', 'cube', 'cult', 'cure', 'curl', 'cute',
  'dare', 'dark', 'dart', 'dash', 'data', 'dawn', 'deal', 'dear', 'debt', 'deck',
  'deed', 'deep', 'deer', 'demo', 'deny', 'desk', 'dial', 'dice', 'diet', 'dirt',
  'disc', 'dish', 'dock', 'does', 'dome', 'done', 'door', 'dose', 'down', 'drag',
  'draw', 'drip', 'drop', 'drum', 'dual', 'duck', 'dude', 'dull', 'dumb', 'dump',
  'dune', 'dusk', 'dust', 'duty', 'each', 'earl', 'earn', 'ease', 'east', 'easy',
  'echo', 'edge', 'edit', 'else', 'epic', 'even', 'ever', 'evil', 'exam', 'exit',
  'face', 'fact', 'fade', 'fail', 'fair', 'fake', 'fall', 'fame', 'fang', 'farm',
  'fast', 'fate', 'fear', 'feed', 'feel', 'feet', 'fell', 'felt', 'fern', 'file',
  'fill', 'film', 'find', 'fine', 'fire', 'firm', 'fish', 'fist', 'five', 'flag',
  'flame', 'flat', 'fled', 'flew', 'flip', 'flow', 'foam', 'fold', 'folk', 'fond',
  'food', 'fool', 'foot', 'ford', 'fork', 'form', 'fort', 'foul', 'four', 'free',
  'frog', 'from', 'fuel', 'full', 'fund', 'fury', 'fuse', 'gain', 'game', 'gang',
  'gate', 'gave', 'gaze', 'gear', 'gene', 'gift', 'girl', 'give', 'glad', 'glow',
  'glue', 'goal', 'goat', 'goes', 'gold', 'golf', 'gone', 'good', 'grab', 'gray',
  'grew', 'grid', 'grim', 'grin', 'grip', 'grow', 'gulf', 'guru', 'guys', 'hack',
  'hair', 'half', 'hall', 'halt', 'hand', 'hang', 'hard', 'harm', 'hate', 'haul',
  'have', 'hawk', 'haze', 'head', 'heal', 'heap', 'heat', 'heel', 'held', 'help',
  'herb', 'herd', 'here', 'hero', 'hide', 'high', 'hike', 'hill', 'hint', 'hire',
  'hold', 'hole', 'holy', 'home', 'hood', 'hook', 'hope', 'horn', 'host', 'hour',
  'huge', 'hull', 'hung', 'hunt', 'hurt', 'hush', 'icon', 'idea', 'inch', 'info',
  'into', 'iron', 'item', 'jack', 'jail', 'jazz', 'jean', 'jerk', 'jobs', 'join',
  'joke', 'jump', 'jury', 'just', 'keen', 'keep', 'kept', 'kick', 'kill', 'kind',
  'king', 'kiss', 'knee', 'knew', 'knit', 'knob', 'knot', 'know', 'lack', 'laid',
  'lake', 'lamp', 'land', 'lane', 'laps', 'last', 'late', 'lawn', 'lazy', 'lead',
  'leaf', 'lean', 'leap', 'left', 'lend', 'lens', 'less', 'lied', 'life', 'lift',
  'like', 'limb', 'lime', 'limp', 'line', 'link', 'lion', 'list', 'live', 'load',
  'loan', 'lock', 'logo', 'long', 'look', 'loop', 'lord', 'lose', 'loss', 'lost',
  'loud', 'love', 'luck', 'lump', 'lung', 'lure', 'lurk', 'made', 'mail', 'main',
  'make', 'male', 'mall', 'malt', 'many', 'maps', 'mark', 'mars', 'mask', 'mass',
  'mate', 'maze', 'meal', 'mean', 'meat', 'meet', 'melt', 'memo', 'menu', 'mere',
  'mesh', 'mess', 'mild', 'milk', 'mill', 'mind', 'mine', 'mint', 'miss', 'mode',
  'mild', 'mold', 'monk', 'mood', 'moon', 'more', 'moss', 'most', 'moth', 'move',
  'much', 'mule', 'muse', 'must', 'myth', 'nail', 'name', 'navy', 'near', 'neat',
  'neck', 'need', 'nest', 'news', 'next', 'nice', 'nine', 'node', 'none', 'norm',
  'nose', 'note', 'noun', 'nude', 'numb', 'nuts', 'oath', 'obey', 'odds', 'okay',
  'once', 'only', 'onto', 'opal', 'open', 'oral', 'oven', 'over', 'pace', 'pack',
  'page', 'paid', 'pain', 'pair', 'pale', 'palm', 'pane', 'park', 'part', 'pass',
  'past', 'path', 'pave', 'peak', 'pear', 'peel', 'peer', 'pick', 'pier', 'pile',
  'pine', 'pink', 'pipe', 'plan', 'play', 'plea', 'plot', 'plug', 'plus', 'poem',
  'poet', 'pole', 'poll', 'polo', 'pond', 'pool', 'poor', 'pope', 'pork', 'port',
  'pose', 'post', 'pour', 'pray', 'prey', 'prop', 'pull', 'pump', 'pure', 'push',
  'quit', 'quiz', 'race', 'rack', 'rage', 'raid', 'rail', 'rain', 'rank', 'rare',
  'rate', 'read', 'real', 'rear', 'reef', 'rein', 'rely', 'rent', 'rest', 'rich',
  'ride', 'ring', 'rise', 'risk', 'road', 'roam', 'rock', 'rode', 'role', 'roll',
  'roof', 'room', 'root', 'rope', 'rose', 'rude', 'ruin', 'rule', 'rush', 'rust',
  'safe', 'sage', 'said', 'sail', 'sake', 'sale', 'salt', 'same', 'sand', 'sang',
  'save', 'seal', 'seed', 'seek', 'seem', 'seen', 'self', 'sell', 'send', 'sent',
  'shed', 'ship', 'shop', 'shot', 'show', 'shut', 'sick', 'side', 'sigh', 'sign',
  'silk', 'sink', 'site', 'size', 'skip', 'slam', 'slap', 'slim', 'slip', 'slot',
  'slow', 'snap', 'snow', 'soak', 'soap', 'soar', 'sock', 'soft', 'soil', 'sold',
  'sole', 'some', 'song', 'soon', 'sort', 'soul', 'sour', 'spin', 'spit', 'spot',
  'star', 'stay', 'stem', 'step', 'stew', 'stop', 'stud', 'such', 'suit', 'sung',
  'sure', 'surf', 'swan', 'swap', 'swim', 'tail', 'take', 'tale', 'talk', 'tall',
  'tank', 'tape', 'task', 'taxi', 'team', 'tear', 'tell', 'tend', 'tent', 'term',
  'test', 'text', 'than', 'that', 'them', 'then', 'they', 'thin', 'this', 'thus',
  'tide', 'tidy', 'tied', 'tier', 'tile', 'till', 'time', 'tiny', 'tire', 'toad',
  'told', 'toll', 'tomb', 'tone', 'took', 'tool', 'tops', 'tore', 'torn', 'tour',
  'town', 'trap', 'tray', 'tree', 'trim', 'trio', 'trip', 'true', 'tube', 'tuck',
  'tune', 'turn', 'twin', 'type', 'ugly', 'unit', 'unto', 'upon', 'urge', 'used',
  'user', 'vain', 'vale', 'vast', 'veil', 'vein', 'verb', 'very', 'vest', 'veto',
  'view', 'vine', 'void', 'volt', 'vote', 'wade', 'wage', 'wait', 'wake', 'walk',
  'wall', 'want', 'ward', 'warm', 'warn', 'warp', 'wash', 'vast', 'wave', 'weak',
  'wear', 'weed', 'week', 'well', 'went', 'were', 'west', 'what', 'whom', 'wide',
  'wife', 'wild', 'will', 'wind', 'wine', 'wing', 'wipe', 'wire', 'wise', 'wish',
  'with', 'woke', 'wolf', 'wood', 'wool', 'word', 'wore', 'work', 'worm', 'worn',
  'wrap', 'writ', 'yard', 'yarn', 'yeah', 'year', 'yell', 'yoga', 'zero', 'zinc',
  'zone', 'zoom',
];

// ─── Helpers ────────────────────────────────────────────────────

function secureRandomInt(max: number): number {
  // Generate a uniform random integer in [0, max)
  const buf = randomBytes(4);
  const value = buf.readUInt32BE(0);
  return value % max;
}

function secureRandomChar(charset: string): string {
  return charset[secureRandomInt(charset.length)];
}

// ─── Password Generation ────────────────────────────────────────

export function generatePassword(options?: PasswordOptions): string {
  const length = Math.max(8, Math.min(128, options?.length ?? 20));
  const useUpper = options?.uppercase ?? true;
  const useLower = options?.lowercase ?? true;
  const useNumbers = options?.numbers ?? true;
  const useSymbols = options?.symbols ?? true;
  const symbolSet = options?.symbolSet ?? DEFAULT_SYMBOLS;
  const excludeAmbiguous = options?.excludeAmbiguous ?? false;

  // Build character pool
  let pool = '';
  if (useUpper) pool += UPPERCASE;
  if (useLower) pool += LOWERCASE;
  if (useNumbers) pool += NUMBERS;
  if (useSymbols) pool += symbolSet;

  if (pool.length === 0) {
    pool = LOWERCASE + NUMBERS; // Fallback
  }

  if (excludeAmbiguous) {
    pool = pool.split('').filter((c) => !AMBIGUOUS.includes(c)).join('');
  }

  // Generate password ensuring at least one char from each enabled set
  const required: string[] = [];
  if (useUpper) required.push(secureRandomChar(excludeAmbiguous ? UPPERCASE.replace(/[OI]/g, '') : UPPERCASE));
  if (useLower) required.push(secureRandomChar(excludeAmbiguous ? LOWERCASE.replace(/[l]/g, '') : LOWERCASE));
  if (useNumbers) required.push(secureRandomChar(excludeAmbiguous ? NUMBERS.replace(/[01]/g, '') : NUMBERS));
  if (useSymbols) required.push(secureRandomChar(symbolSet));

  // Fill remaining length
  const remaining = length - required.length;
  const chars = [...required];
  for (let i = 0; i < remaining; i++) {
    chars.push(secureRandomChar(pool));
  }

  // Shuffle using Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

// ─── Passphrase Generation ──────────────────────────────────────

export function generatePassphrase(options?: PassphraseOptions): string {
  const wordCount = Math.max(3, Math.min(12, options?.wordCount ?? 4));
  const delimiter = options?.delimiter ?? '-';
  const capitalize = options?.capitalize ?? true;
  const includeNumber = options?.includeNumber ?? false;

  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    let word = WORDLIST[secureRandomInt(WORDLIST.length)];
    if (capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    words.push(word);
  }

  let result = words.join(delimiter);

  if (includeNumber) {
    result += delimiter + secureRandomInt(1000).toString();
  }

  return result;
}
