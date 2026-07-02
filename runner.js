'use strict';

// ─────────────────────────────────────────────────────────────
// Audio Engine
// ─────────────────────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  resume: () => { if (audioCtx.state === 'suspended') audioCtx.resume(); },
  playTone: (freq, type, dur, vol = 0.1, detune = 0) => {
    try {
      Sfx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (detune) osc.detune.setValueAtTime(detune, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  },
  jump:    () => { Sfx.playTone(320, 'square', 0.12, 0.06); Sfx.playTone(480, 'square', 0.08, 0.04); },
  land:    () => Sfx.playTone(120, 'triangle', 0.08, 0.08),
  coin:    () => { Sfx.playTone(880, 'sine', 0.08, 0.08); setTimeout(() => Sfx.playTone(1320, 'sine', 0.12, 0.08), 60); },
  stomp:   () => { Sfx.playTone(160, 'triangle', 0.18, 0.12); Sfx.playTone(80, 'sawtooth', 0.1, 0.08); },
  correct: () => { [600, 750, 950].forEach((f, i) => setTimeout(() => Sfx.playTone(f, 'sine', 0.18, 0.1), i * 90)); },
  wrong:   () => { Sfx.playTone(200, 'sawtooth', 0.3, 0.12); Sfx.playTone(150, 'sawtooth', 0.3, 0.08); },
  hurt:    () => { Sfx.playTone(180, 'sawtooth', 0.25, 0.1); setTimeout(() => Sfx.playTone(140, 'sawtooth', 0.2, 0.08), 80); },
  win:     () => { [400, 500, 600, 800].forEach((f, i) => setTimeout(() => Sfx.playTone(f, 'sine', 0.25, 0.1), i * 120)); },
  powerup: () => { [600, 700, 800, 1000].forEach((f, i) => setTimeout(() => Sfx.playTone(f, 'sine', 0.15, 0.1), i * 60)); },
  hit:     () => { Sfx.playTone(300, 'square', 0.1, 0.07); }
};

// ─────────────────────────────────────────────────────────────
// Question Bank
// ─────────────────────────────────────────────────────────────
const PROMPTS = {
  Easy: [
    { q: "5 + 4 = ?",           a: "9",      w: ["8", "10"] },
    { q: "10 − 3 = ?",          a: "7",      w: ["6", "8"] },
    { q: "8 + 8 = ?",           a: "16",     w: ["15", "14"] },
    { q: "12 − 5 = ?",          a: "7",      w: ["6", "8"] },
    { q: "20 + 5 = ?",          a: "25",     w: ["15", "30"] },
    { q: "3 + 7 = ?",           a: "10",     w: ["9", "11"] },
    { q: "15 − 8 = ?",          a: "7",      w: ["6", "5"] },
    { q: "6 + 9 = ?",           a: "15",     w: ["14", "16"] },
    { q: "Plural of 'cat'",     a: "cats",   w: ["cates", "cat"] },
    { q: "Plural of 'box'",     a: "boxes",  w: ["boxs", "booxes"] },
    { q: "Rhymes with 'bat'",   a: "cat",    w: ["dog", "bird"] },
    { q: "Rhymes with 'hop'",   a: "pop",    w: ["step", "jump"] },
    { q: "Rhymes with 'run'",   a: "sun",    w: ["rain", "walk"] },
    { q: "Rhymes with 'day'",   a: "play",   w: ["night", "sing"] },
    { q: "Opposite of 'hot'",   a: "cold",   w: ["warm", "cool"] },
    { q: "Opposite of 'big'",   a: "small",  w: ["tall", "wide"] },
    { q: "4 × 2 = ?",           a: "8",      w: ["6", "10"] },
    { q: "3 × 3 = ?",           a: "9",      w: ["6", "12"] },
    { q: "10 ÷ 2 = ?",          a: "5",      w: ["4", "6"] },
    { q: "Plural of 'bus'",     a: "buses",  w: ["buss", "busi"] },
    { q: "Plural of 'child'",   a: "children", w: ["childs", "childen"] },
    { q: "Past tense: 'jump'",  a: "jumped", w: ["jumpt", "jumping"] },
    { q: "Past tense: 'walk'",  a: "walked", w: ["walkt", "walking"] },
    { q: "2 × 5 = ?",           a: "10",     w: ["8", "12"] },
    { q: "14 − 6 = ?",          a: "8",      w: ["7", "9"] }
  ],
  Medium: [
    { q: "6 × 4 = ?",                    a: "24",      w: ["20", "28"] },
    { q: "8 × 7 = ?",                    a: "56",      w: ["54", "64"] },
    { q: "36 ÷ 6 = ?",                   a: "6",       w: ["4", "8"] },
    { q: "9 × 9 = ?",                    a: "81",      w: ["72", "90"] },
    { q: "7 × 8 = ?",                    a: "56",      w: ["48", "63"] },
    { q: "48 ÷ 8 = ?",                   a: "6",       w: ["5", "7"] },
    { q: "12 × 4 = ?",                   a: "48",      w: ["42", "56"] },
    { q: "63 ÷ 7 = ?",                   a: "9",       w: ["7", "8"] },
    { q: "Synonym for 'huge'",           a: "giant",   w: ["tiny", "flat"] },
    { q: "Synonym for 'rapid'",          a: "fast",    w: ["slow", "heavy"] },
    { q: "Antonym for 'always'",         a: "never",   w: ["often", "rarely"] },
    { q: "Antonym for 'create'",         a: "destroy", w: ["build", "make"] },
    { q: "Past tense of 'run'",          a: "ran",     w: ["runned", "running"] },
    { q: "Past tense of 'eat'",          a: "ate",     w: ["eated", "eaten"] },
    { q: "Past tense of 'swim'",         a: "swam",    w: ["swimmed", "swum"] },
    { q: "Synonym for 'angry'",          a: "furious", w: ["happy", "afraid"] },
    { q: "11 × 11 = ?",                  a: "121",     w: ["111", "131"] },
    { q: "144 ÷ 12 = ?",                 a: "12",      w: ["11", "13"] },
    { q: "Antonym for 'ancient'",        a: "modern",  w: ["old", "broken"] },
    { q: "Synonym for 'begin'",          a: "start",   w: ["end", "pause"] },
    { q: "Plural of 'leaf'",             a: "leaves",  w: ["leafs", "leavies"] },
    { q: "Plural of 'tooth'",            a: "teeth",   w: ["tooths", "toothes"] },
    { q: "'Their' means…",               a: "belongs to them", w: ["a place", "they are"] },
    { q: "Synonym for 'smart'",          a: "clever",  w: ["loud", "strong"] },
    { q: "5² = ?",                        a: "25",      w: ["10", "50"] }
  ],
  Hard: [
    { q: "4x = 32, x = ?",              a: "8",        w: ["6", "7"] },
    { q: "3x + 2 = 17, x = ?",          a: "5",        w: ["4", "6"] },
    { q: "5(2 + 3) = ?",               a: "25",       w: ["10", "15"] },
    { q: "2x − 4 = 10, x = ?",          a: "7",        w: ["6", "8"] },
    { q: "x² = 64, x = ?",             a: "8",        w: ["6", "9"] },
    { q: "Prefix 'anti-' means…",       a: "against",  w: ["before", "with"] },
    { q: "Prefix 'pre-' means…",        a: "before",   w: ["after", "against"] },
    { q: "Which is a noun?",            a: "courage",  w: ["brave", "quickly"] },
    { q: "Which is a verb?",            a: "sprint",   w: ["fast", "runner"] },
    { q: "Which is an adjective?",      a: "shiny",    w: ["shine", "glowing"] },
    { q: "Plural of 'mouse'",           a: "mice",     w: ["mouses", "meece"] },
    { q: "Suffix '-tion' makes a…",     a: "noun",     w: ["verb", "adjective"] },
    { q: "Homophone of 'their'",        a: "there",    w: ["they're", "here"] },
    { q: "Homophone of 'bare'",         a: "bear",     w: ["pear", "beer"] },
    { q: "Meaning of 'benevolent'",     a: "kind",     w: ["evil", "careless"] },
    { q: "Antonym for 'verbose'",       a: "brief",    w: ["wordy", "loud"] },
    { q: "LCD of 3 and 4?",             a: "12",       w: ["6", "7"] },
    { q: "√144 = ?",                    a: "12",       w: ["11", "14"] },
    { q: "Meaning of 'tenacious'",      a: "persistent", w: ["lazy", "gentle"] },
    { q: "12x = 144, x = ?",            a: "12",       w: ["11", "13"] },
    { q: "Prefix 'mis-' means…",        a: "wrongly",  w: ["again", "not"] },
    { q: "Synonym for 'ephemeral'",     a: "fleeting", w: ["eternal", "heavy"] },
    { q: "3x² = 75, x = ?",             a: "5",        w: ["3", "7"] },
    { q: "Root word of 'transportation'", a: "port",   w: ["trans", "tion"] },
    { q: "Suffix '-ology' means…",      a: "study of", w: ["fear of", "love of"] }
  ]
};

// Expand Question Pool
[
  { q: "4 + 4 = ?", a: "8", w: ["7", "9"] },
  { q: "10 − 5 = ?", a: "5", w: ["6", "4"] },
  { q: "Rhymes with 'star'", a: "car", w: ["moon", "sky"] },
  { q: "Rhymes with 'play'", a: "day", w: ["fun", "game"] },
  { q: "Opposite of 'fast'", a: "slow", w: ["quick", "run"] },
  { q: "Plural of 'dog'", a: "dogs", w: ["doges", "dog"] },
  { q: "Synonym for 'happy'", a: "glad", w: ["sad", "mad"] },
  { q: "Rhymes with 'light'", a: "night", w: ["dark", "day"] },
  { q: "Opposite of 'up'", a: "down", w: ["high", "low"] },
  { q: "15 + 5 = ?", a: "20", w: ["10", "25"] }
].forEach(p => PROMPTS.Easy.push(p));

[
  { q: "7 × 6 = ?", a: "42", w: ["40", "44"] },
  { q: "81 ÷ 9 = ?", a: "9", w: ["8", "7"] },
  { q: "Synonym for 'scared'", a: "afraid", w: ["brave", "bold"] },
  { q: "Antonym for 'arrive'", a: "depart", w: ["come", "stay"] },
  { q: "Past tense of 'go'", a: "went", w: ["goed", "gone"] },
  { q: "Plural of 'city'", a: "cities", w: ["citys", "cites"] },
  { q: "Synonym for 'center'", a: "middle", w: ["edge", "side"] },
  { q: "Antonym for 'expand'", a: "shrink", w: ["grow", "stretch"] },
  { q: "12 × 5 = ?", a: "60", w: ["55", "65"] },
  { q: "Plural of 'knife'", a: "knives", w: ["knifes", "knive"] }
].forEach(p => PROMPTS.Medium.push(p));

[
  { q: "5x − 10 = 20, x = ?", a: "6", w: ["5", "7"] },
  { q: "x² = 100, x = ?", a: "10", w: ["9", "11"] },
  { q: "Synonym for 'obsolete'", a: "outdated", w: ["new", "fresh"] },
  { q: "Antonym for 'generous'", a: "selfish", w: ["kind", "giving"] },
  { q: "Prefix 'sub-' means...", a: "under", w: ["over", "with"] },
  { q: "Suffix '-less' means...", a: "without", w: ["full of", "like"] },
  { q: "Which is a pronoun?", a: "they", w: ["quickly", "run"] },
  { q: "Homophone for 'piece'", a: "peace", w: ["peas", "peice"] },
  { q: "Meaning of 'meticulous'", a: "careful", w: ["messy", "fast"] },
  { q: "8x = 72, x = ?", a: "9", w: ["8", "7"] },
  { q: "Antonym for 'benevolent'", a: "cruel", w: ["kind", "good"] },
  { q: "Synonym for 'lucid'", a: "clear", w: ["dark", "murky"] }
].forEach(p => PROMPTS.Hard.push(p));

const ACADEMIC_TRACKS = {
  Mixed:    { label: 'Mixed',    short: 'All subjects' },
  Math:     { label: 'Math',     short: 'Numbers' },
  Language: { label: 'Language', short: 'Words' },
  Science:  { label: 'Science',  short: 'Nature' },
  World:    { label: 'World',    short: 'Maps & history' }
};

const GAMEPLAY_DIFFICULTIES = {
  Explorer: {
    label: 'Explorer',
    short: 'Forgiving',
    lives: 4,
    enemyMultiplier: 0.7,
    hazardMultiplier: 0.55,
    speedMultiplier: 0.85,
    scoreMultiplier: 0.85,
    wrongPenalty: 20,
    gateDelta: -1,
    heartBonus: 0.18,
    bossHealthDelta: -1
  },
  Adventure: {
    label: 'Adventure',
    short: 'Balanced',
    lives: 3,
    enemyMultiplier: 1,
    hazardMultiplier: 1,
    speedMultiplier: 1,
    scoreMultiplier: 1,
    wrongPenalty: 30,
    gateDelta: 0,
    heartBonus: 0,
    bossHealthDelta: 0
  },
  Master: {
    label: 'Master',
    short: 'Sharper hazards',
    lives: 2,
    enemyMultiplier: 1.35,
    hazardMultiplier: 1.25,
    speedMultiplier: 1.18,
    scoreMultiplier: 1.25,
    wrongPenalty: 50,
    gateDelta: 1,
    heartBonus: -0.08,
    bossHealthDelta: 1
  }
};

const CAMPAIGN_LEVELS = [
  { id: 1,  name: 'Meadow Warmup',      biome: 'grass',   tier: 0, gates: 4, tracks: ['Math', 'Language'], skills: ['Addition', 'Spelling'], focus: 'addition and spelling' },
  { id: 2,  name: 'Rhyme Ravine',       biome: 'grass',   tier: 0, gates: 5, tracks: ['Language', 'Math'], skills: ['Rhyming', 'Subtraction'], focus: 'rhymes and subtraction' },
  { id: 3,  name: 'Grammar Grove',      biome: 'jungle',  tier: 1, gates: 5, tracks: ['Language', 'World'], skills: ['Grammar', 'Geography'], focus: 'grammar and map facts' },
  { id: 4,  name: 'Times Table Trail',  biome: 'jungle',  tier: 1, gates: 6, tracks: ['Math', 'Language'], skills: ['Multiplication', 'Vocabulary'], focus: 'times tables and vocabulary' },
  { id: 5,  name: 'Ember Review',       biome: 'volcano', tier: 1, gates: 4, tracks: ['Math', 'Language', 'Science'], skills: ['Review'], focus: 'first review boss', boss: true, bossHealth: 3 },
  { id: 6,  name: 'Crystal Cave',       biome: 'cave',    tier: 2, gates: 6, tracks: ['Math', 'Science'], skills: ['Division', 'Earth Science'], focus: 'division and earth science' },
  { id: 7,  name: 'Fraction Falls',     biome: 'cave',    tier: 2, gates: 7, tracks: ['Math', 'Language'], skills: ['Fractions', 'Grammar'], focus: 'fractions and sentence work' },
  { id: 8,  name: 'Science Skyway',     biome: 'sky',     tier: 2, gates: 7, tracks: ['Science', 'Math'], skills: ['Life Science', 'Measurement'], focus: 'science facts and measurement' },
  { id: 9,  name: 'Mapmaker Mesa',      biome: 'grass',   tier: 3, gates: 7, tracks: ['World', 'Language'], skills: ['Geography', 'Vocabulary'], focus: 'geography and word meanings' },
  { id: 10, name: 'Storm Review',       biome: 'sky',     tier: 3, gates: 5, tracks: ['Math', 'Language', 'Science', 'World'], skills: ['Review'], focus: 'second review boss', boss: true, bossHealth: 4 },
  { id: 11, name: 'Algebra Outpost',    biome: 'cave',    tier: 3, gates: 7, tracks: ['Math', 'Science'], skills: ['Algebra', 'Physical Science'], focus: 'algebra and physical science' },
  { id: 12, name: 'Reading Ridge',      biome: 'jungle',  tier: 3, gates: 8, tracks: ['Language', 'World'], skills: ['Comprehension', 'History'], focus: 'reading and history clues' },
  { id: 13, name: 'Energy Lab',         biome: 'sky',     tier: 4, gates: 8, tracks: ['Science', 'Math'], skills: ['Energy', 'Algebra'], focus: 'energy and advanced math' },
  { id: 14, name: 'History Heights',    biome: 'jungle',  tier: 4, gates: 8, tracks: ['World', 'Language'], skills: ['History', 'Root Words'], focus: 'history and word roots' },
  { id: 15, name: 'Final Archive',      biome: 'volcano', tier: 4, gates: 6, tracks: ['Math', 'Language', 'Science', 'World'], skills: ['Mastery'], focus: 'full academic mastery', boss: true, bossHealth: 5 }
];

const MAX_LEVEL = CAMPAIGN_LEVELS.length;

const ACADEMIC_PROMPTS = [
  P('Math', 'Easy', 'Addition', '8 + 5 = ?', '13', ['12', '14'], '8 + 5 combines to make 13.'),
  P('Math', 'Easy', 'Addition', '9 + 6 = ?', '15', ['14', '16'], '9 + 6 is 15.'),
  P('Math', 'Easy', 'Addition', '7 + 8 = ?', '15', ['13', '16'], '7 + 8 is another way to make 15.'),
  P('Math', 'Easy', 'Subtraction', '18 - 9 = ?', '9', ['8', '10'], 'Subtracting 9 from 18 leaves 9.'),
  P('Math', 'Easy', 'Subtraction', '16 - 7 = ?', '9', ['8', '11'], '16 minus 7 equals 9.'),
  P('Math', 'Easy', 'Place Value', '4 tens + 3 ones = ?', '43', ['34', '47'], 'Four tens and three ones make 43.'),
  P('Math', 'Easy', 'Money', 'A quarter is worth...', '25 cents', ['10 cents', '50 cents'], 'A quarter has a value of 25 cents.'),
  P('Math', 'Easy', 'Time', '60 minutes = ?', '1 hour', ['1 day', '30 minutes'], 'One hour is 60 minutes.'),
  P('Math', 'Medium', 'Multiplication', '7 x 6 = ?', '42', ['40', '48'], '7 groups of 6 make 42.'),
  P('Math', 'Medium', 'Multiplication', '9 x 8 = ?', '72', ['64', '81'], '9 times 8 equals 72.'),
  P('Math', 'Medium', 'Division', '63 / 9 = ?', '7', ['6', '8'], '63 split into 9 equal groups gives 7.'),
  P('Math', 'Medium', 'Division', '96 / 12 = ?', '8', ['6', '9'], '12 times 8 equals 96, so 96 / 12 is 8.'),
  P('Math', 'Medium', 'Fractions', '1/2 of 18 = ?', '9', ['8', '10'], 'Half of 18 is 9.'),
  P('Math', 'Medium', 'Fractions', 'Which is larger?', '3/4', ['1/4', '1/2'], 'Three fourths is more than one half or one fourth.'),
  P('Math', 'Medium', 'Measurement', '1 yard = ?', '3 feet', ['2 feet', '12 feet'], 'One yard is three feet.'),
  P('Math', 'Medium', 'Decimals', '0.5 equals...', '1/2', ['1/5', '5'], '0.5 is one half.'),
  P('Math', 'Hard', 'Algebra', '4x + 8 = 28, x = ?', '5', ['4', '6'], 'Subtract 8 to get 4x = 20, then divide by 4.'),
  P('Math', 'Hard', 'Algebra', '3x - 6 = 21, x = ?', '9', ['7', '8'], 'Add 6 to get 3x = 27, then divide by 3.'),
  P('Math', 'Hard', 'Algebra', '2(x + 4) = 18, x = ?', '5', ['4', '7'], 'Divide by 2 to get x + 4 = 9, so x is 5.'),
  P('Math', 'Hard', 'Exponents', '6 squared = ?', '36', ['12', '30'], '6 squared means 6 x 6, which is 36.'),
  P('Math', 'Hard', 'Fractions', '3/5 + 1/5 = ?', '4/5', ['4/10', '3/10'], 'Same denominators: add the numerators to get 4/5.'),
  P('Math', 'Hard', 'Percents', '25% of 80 = ?', '20', ['25', '40'], '25% is one fourth, and one fourth of 80 is 20.'),

  P('Language', 'Easy', 'Spelling', 'Choose the correct spelling.', 'because', ['becuz', 'becaus'], 'Because is spelled b-e-c-a-u-s-e.'),
  P('Language', 'Easy', 'Spelling', 'Choose the correct spelling.', 'friend', ['freind', 'frend'], 'Friend has i before e in this word.'),
  P('Language', 'Easy', 'Rhyming', 'Rhymes with cake.', 'lake', ['look', 'cook'], 'Cake and lake share the long a sound.'),
  P('Language', 'Easy', 'Rhyming', 'Rhymes with bright.', 'night', ['brave', 'brown'], 'Bright and night end with the same sound.'),
  P('Language', 'Easy', 'Nouns', 'Which word is a person?', 'teacher', ['quickly', 'blue'], 'A teacher is a person, so it is a noun.'),
  P('Language', 'Easy', 'Verbs', 'Which word is an action?', 'climb', ['green', 'desk'], 'Climb is something a person can do.'),
  P('Language', 'Medium', 'Grammar', 'Choose the complete sentence.', 'The dog barked.', ['Because the dog', 'Running fast'], 'A complete sentence has a subject and a predicate.'),
  P('Language', 'Medium', 'Grammar', 'Best word: They ___ ready.', 'are', ['is', 'am'], 'They is plural, so use are.'),
  P('Language', 'Medium', 'Vocabulary', 'Synonym for careful.', 'cautious', ['careless', 'noisy'], 'Cautious means careful.'),
  P('Language', 'Medium', 'Vocabulary', 'Antonym for fragile.', 'sturdy', ['breakable', 'delicate'], 'Sturdy means strong, the opposite of fragile.'),
  P('Language', 'Medium', 'Punctuation', 'Which sentence is a question?', 'Where is it?', ['It is here.', 'Run fast!'], 'A question asks something and ends with a question mark.'),
  P('Language', 'Medium', 'Parts of Speech', 'Which word is an adverb?', 'quickly', ['quick', 'runner'], 'Quickly tells how an action happens.'),
  P('Language', 'Hard', 'Root Words', 'Root of portable.', 'port', ['able', 'table'], 'Port means carry. Portable means able to be carried.'),
  P('Language', 'Hard', 'Root Words', 'Prefix inter- means...', 'between', ['before', 'under'], 'Inter- means between or among.'),
  P('Language', 'Hard', 'Vocabulary', 'Meaning of resilient.', 'able to recover', ['easy to break', 'very loud'], 'Resilient means able to recover after trouble.'),
  P('Language', 'Hard', 'Vocabulary', 'Antonym for scarce.', 'plentiful', ['rare', 'limited'], 'Scarce means not enough; plentiful means a lot.'),
  P('Language', 'Hard', 'Comprehension', 'A clue that hints later events is...', 'foreshadowing', ['setting', 'rhyme'], 'Foreshadowing gives hints about later events.'),
  P('Language', 'Hard', 'Grammar', 'Best revision: She dont know.', "She doesn't know.", ["She don't knows.", "Her doesn't know."], "Doesn't agrees with she in standard English."),

  P('Science', 'Easy', 'Life Science', 'Plants need sunlight, air, and...', 'water', ['sand', 'plastic'], 'Most plants need water, sunlight, and air to grow.'),
  P('Science', 'Easy', 'Life Science', 'A baby frog is a...', 'tadpole', ['calf', 'cub'], 'A tadpole is the young stage of a frog.'),
  P('Science', 'Easy', 'Earth Science', 'Rain, snow, and sleet are...', 'precipitation', ['evaporation', 'rotation'], 'Precipitation is water falling from clouds.'),
  P('Science', 'Easy', 'Space', 'Earth gets light from the...', 'Sun', ['Moon', 'Mars'], 'The Sun gives Earth light and heat.'),
  P('Science', 'Medium', 'Life Science', 'Animals with backbones are...', 'vertebrates', ['insects', 'minerals'], 'Vertebrates have backbones.'),
  P('Science', 'Medium', 'Earth Science', 'Rock changed by heat and pressure is...', 'metamorphic', ['igneous', 'sediment'], 'Metamorphic rock forms through heat and pressure.'),
  P('Science', 'Medium', 'Physical Science', 'A push or pull is a...', 'force', ['shadow', 'cycle'], 'A force is a push or a pull.'),
  P('Science', 'Medium', 'Energy', 'Energy from motion is...', 'kinetic', ['thermal', 'stored'], 'Kinetic energy is energy of motion.'),
  P('Science', 'Hard', 'Cells', 'Cells get energy in the...', 'mitochondria', ['nucleus', 'ribosome'], 'Mitochondria help release energy for cells.'),
  P('Science', 'Hard', 'Chemistry', 'Water is made of hydrogen and...', 'oxygen', ['carbon', 'nitrogen'], 'Water is H2O: hydrogen and oxygen.'),
  P('Science', 'Hard', 'Space', 'Gravity keeps planets in...', 'orbit', ['photosynthesis', 'erosion'], 'Gravity helps keep planets moving in orbit.'),
  P('Science', 'Hard', 'Scientific Method', 'A testable prediction is a...', 'hypothesis', ['conclusion', 'variable'], 'A hypothesis is a testable prediction.'),

  P('World', 'Easy', 'Geography', 'A map key explains...', 'symbols', ['weather', 'height'], 'A map key tells what map symbols mean.'),
  P('World', 'Easy', 'Geography', 'The largest ocean is the...', 'Pacific', ['Atlantic', 'Arctic'], 'The Pacific is the largest ocean.'),
  P('World', 'Easy', 'Civics', 'A community rule is a...', 'law', ['planet', 'river'], 'Laws are rules for a community.'),
  P('World', 'Easy', 'History', 'The past is studied in...', 'history', ['biology', 'geometry'], 'History is the study of the past.'),
  P('World', 'Medium', 'Geography', 'The equator divides Earth into...', 'hemispheres', ['continents', 'states'], 'The equator separates the Northern and Southern Hemispheres.'),
  P('World', 'Medium', 'Geography', 'A peninsula has water on...', 'three sides', ['one side', 'no sides'], 'A peninsula is land with water on three sides.'),
  P('World', 'Medium', 'Civics', 'Citizens vote in an...', 'election', ['erosion', 'equation'], 'An election is when citizens choose leaders or decide issues.'),
  P('World', 'Medium', 'Economics', 'Money paid for work is...', 'income', ['weather', 'latitude'], 'Income is money earned from work or business.'),
  P('World', 'Hard', 'Geography', 'Lines measuring north/south are...', 'latitude', ['longitude', 'altitude'], 'Latitude lines measure distance north or south of the equator.'),
  P('World', 'Hard', 'History', 'A primary source is from...', 'the time studied', ['a future guess', 'a map key'], 'Primary sources come from the time being studied.'),
  P('World', 'Hard', 'Civics', 'The U.S. Constitution sets up...', 'government', ['weather', 'multiplication'], 'The Constitution describes the structure of U.S. government.'),
  P('World', 'Hard', 'Economics', 'Scarcity means resources are...', 'limited', ['endless', 'invisible'], 'Scarcity means there is not enough to satisfy every want.')
];

function P(track, band, skill, q, a, w, explanation) {
  return { track, band, skill, q, a, w, explanation };
}

function uniqueOptions(answer, wrongs) {
  const seen = new Set([String(answer)]);
  const out = [];
  for (const wrong of wrongs || []) {
    const text = String(wrong);
    if (!seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  }
  const n = Number(answer);
  const numeric = Number.isFinite(n);
  while (out.length < 2) {
    const fallback = numeric ? String(n + out.length + 1) : `${answer}${out.length + 1}`;
    if (!seen.has(fallback)) {
      seen.add(fallback);
      out.push(fallback);
    }
  }
  return out.slice(0, 2);
}

function shuffleList(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function legacyTrackForPrompt(prompt) {
  return /[0-9xÃ—Ã·+Â²âˆš=]/.test(prompt.q) ? 'Math' : 'Language';
}

function legacySkillForPrompt(prompt) {
  if (/[Ã—x]/.test(prompt.q)) return 'Multiplication';
  if (/[Ã·/]/.test(prompt.q)) return 'Division';
  if (/[+\-âˆ’]/.test(prompt.q)) return 'Addition';
  if (/synonym|antonym|meaning/i.test(prompt.q)) return 'Vocabulary';
  if (/plural|tense|noun|verb|adjective|prefix|suffix|root/i.test(prompt.q)) return 'Grammar';
  if (/rhyme/i.test(prompt.q)) return 'Rhyming';
  return 'Review';
}

const LEGACY_PROMPTS = Object.entries(PROMPTS).flatMap(([band, prompts]) =>
  prompts.map(prompt => ({
    ...prompt,
    band,
    track: legacyTrackForPrompt(prompt),
    skill: legacySkillForPrompt(prompt),
    explanation: `Review the ${legacySkillForPrompt(prompt).toLowerCase()} clue, then try the matching answer.`
  }))
);

// ─────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────
ACADEMIC_PROMPTS.push(
  P('Science', 'Easy', 'Weather', 'Clouds are made of tiny water...', 'droplets', ['rocks', 'leaves'], 'Clouds are made of tiny water droplets or ice crystals.'),
  P('Science', 'Easy', 'Animals', 'A mammal feeds its babies...', 'milk', ['sand', 'sunlight'], 'Mammals feed their babies milk.'),
  P('Science', 'Easy', 'Matter', 'Ice is water as a...', 'solid', ['gas', 'shadow'], 'Ice is the solid form of water.'),
  P('Science', 'Easy', 'Space', 'The Moon moves around...', 'Earth', ['the Sun only', 'Jupiter'], 'The Moon orbits Earth.'),
  P('Science', 'Medium', 'Ecosystems', 'A food chain starts with a...', 'producer', ['consumer', 'predator'], 'Producers, like plants, make food energy for ecosystems.'),
  P('Science', 'Medium', 'Matter', 'Evaporation changes liquid to...', 'gas', ['solid', 'metal'], 'Evaporation changes a liquid into a gas.'),
  P('Science', 'Medium', 'Forces', 'Friction usually slows objects...', 'down', ['up', 'into light'], 'Friction resists motion and often slows objects down.'),
  P('Science', 'Medium', 'Earth Science', 'Soil is made from rock, air, water, and...', 'organic matter', ['plastic', 'electricity'], 'Soil includes broken rock plus organic matter from living things.'),
  P('Science', 'Hard', 'Energy', 'Stored energy is called...', 'potential', ['kinetic', 'transparent'], 'Potential energy is stored energy.'),
  P('Science', 'Hard', 'Genetics', 'Inherited traits are passed by...', 'genes', ['weather', 'gravity'], 'Genes carry inherited trait information.'),
  P('Science', 'Hard', 'Chemistry', 'The pH scale measures...', 'acidity', ['speed', 'mass only'], 'The pH scale describes how acidic or basic something is.'),
  P('Science', 'Hard', 'Earth Science', 'Weathering breaks rock into...', 'sediment', ['orbit', 'light'], 'Weathering breaks rock into smaller sediment.'),
  P('World', 'Easy', 'Geography', 'A continent is a large body of...', 'land', ['water', 'cloud'], 'A continent is a very large land area.'),
  P('World', 'Easy', 'Geography', 'North, south, east, and west are...', 'directions', ['seasons', 'taxes'], 'Cardinal directions help us describe location.'),
  P('World', 'Easy', 'History', 'A timeline shows events in...', 'order', ['color', 'volume'], 'Timelines place events in chronological order.'),
  P('World', 'Easy', 'Economics', 'A need is something people must...', 'have', ['decorate', 'forget'], 'Needs are things people must have to live safely.'),
  P('World', 'Medium', 'Geography', 'Longitude lines measure east and...', 'west', ['north', 'inside'], 'Longitude measures east or west of the prime meridian.'),
  P('World', 'Medium', 'History', 'An artifact is an object made or used by...', 'people', ['weather', 'fractions'], 'Artifacts are human-made or human-used objects from the past.'),
  P('World', 'Medium', 'Civics', 'The branch that makes laws is...', 'legislative', ['judicial', 'executive'], 'The legislative branch makes laws.'),
  P('World', 'Medium', 'Economics', 'Supply is how much is...', 'available', ['forgotten', 'illegal'], 'Supply is the amount of a good or service available.'),
  P('World', 'Hard', 'Geography', 'A region is an area with shared...', 'features', ['spelling', 'gravity'], 'Regions group places by shared physical or human features.'),
  P('World', 'Hard', 'History', 'Cause and effect explains why events...', 'happen', ['rhyme', 'evaporate'], 'Cause and effect connects events with reasons and results.'),
  P('World', 'Hard', 'Civics', 'Checks and balances limit...', 'power', ['rainfall', 'fractions'], 'Checks and balances keep one branch from gaining too much power.'),
  P('World', 'Hard', 'Economics', 'Opportunity cost is the next best...', 'choice given up', ['ocean current', 'map symbol'], 'Opportunity cost is what you give up when choosing something else.')
);

function intersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function lerpColor(c1, c2, t) {
  // c1/c2 as [r,g,b], t 0..1
  return `rgb(${Math.round(c1[0]+(c2[0]-c1[0])*t)},${Math.round(c1[1]+(c2[1]-c1[1])*t)},${Math.round(c1[2]+(c2[2]-c1[2])*t)})`;
}

function rr(ctx, x, y, w, h, r) {
  // Polyfill for roundRect
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const CW = 1200;
const CH = 600;
const GRAVITY = 1600;
const JUMP_FORCE = -780;
const DOUBLE_JUMP_FORCE = -700;
const MAX_SPEED = 360;
const ROPE_CLIMB_SPEED = 175;
const ROPE_GRAB_RANGE = 26;

// ─────────────────────────────────────────────────────────────
// Main Game Class
// ─────────────────────────────────────────────────────────────
class WordRunner {
  constructor() {
    this.canvas = document.getElementById('runnerCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.keys = {};
    this._prevKeys = {};
    window.addEventListener('keydown', e => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
      if (e.key === 'Enter' && this.state === 'end') {
        e.preventDefault();
        document.getElementById('playAgainBtn')?.click();
        return;
      }
      this.keys[e.key] = true;
    });
    window.addEventListener('keyup', e => {
      this.keys[e.key] = false;
    });

    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const syncFullscreenUi = () => {
      const isFullscreen = Boolean(document.fullscreenElement);
      document.body.classList.toggle('fs-mode', isFullscreen);
      if (fullscreenBtn) {
        fullscreenBtn.textContent = isFullscreen ? "\u2715 Exit Fullscreen" : "\u26F6 Fullscreen";
      }
    };

    fullscreenBtn?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
    document.addEventListener?.('fullscreenchange', syncFullscreenUi);
    syncFullscreenUi();

    // Radio button UI handling
    document.querySelectorAll('.diff-opt input').forEach(inp => {
      inp.addEventListener('change', () => {
        const group = inp.closest('.diff-options');
        group.querySelectorAll('.diff-opt').forEach(el => el.classList.remove('selected'));
        inp.closest('.diff-opt').classList.add('selected');
      });
    });

    document.getElementById('startMissionBtn').addEventListener('click', () => {
      const diffEl = document.querySelector('input[name="diff"]:checked');
      const trackEl = document.querySelector('input[name="track"]:checked');
      const gameplayEl = document.querySelector('input[name="gameplay"]:checked');
      const modeEl = document.querySelector('input[name="mode"]:checked');
      this.currentDifficulty = diffEl ? diffEl.value : 'Medium';
      this.currentTrack = trackEl ? trackEl.value : 'Mixed';
      this.gameplayDifficulty = gameplayEl ? gameplayEl.value : 'Adventure';
      this.playerCount = modeEl ? parseInt(modeEl.value) : 1;
      document.getElementById('gameSetup').style.display = 'none';
      Sfx.resume();
      this.startGame(1);
    });

    document.getElementById('playAgainBtn').addEventListener('click', () => {
      document.getElementById('gameEnd').style.display = 'none';
      this.startGame((this.gameIsOver || this.currentLevel >= MAX_LEVEL) ? 1 : this.currentLevel + 1);
    });

    document.getElementById('retryBtn').addEventListener('click', () => {
      document.getElementById('gameEnd').style.display = 'none';
      this.startGame(this.currentLevel);
    });

    this.state = 'setup';
    this.currentLevel = 1;
    this.gameIsOver = false;
    this.currentDifficulty = 'Medium';
    this.currentTrack = 'Mixed';
    this.gameplayDifficulty = 'Adventure';
    this.playerCount = 1;
    this.score = 0;
    this.combo = 0;
    this.reviewPrompts = [];
    this.campaignStats = this._newStats();
    this.levelStats = this._newStats();
    this.shakeTimer = 0;
    this.shakeAmt = 0;
    this.flashTimer = 0;
    this.flashColor = '#fff';
    this.bgStars = this._genStars(80);
    this.bgClouds = this._genClouds(12);

    // Init empty arrays
    this._clearWorld();

    requestAnimationFrame((ts) => this._loop(ts));
  }

  _newStats() {
    return { answered: 0, correct: 0, missed: [], skills: {} };
  }

  _getStage(level = this.currentLevel) {
    return CAMPAIGN_LEVELS[Math.max(0, Math.min(MAX_LEVEL - 1, level - 1))] || CAMPAIGN_LEVELS[0];
  }

  _getGameConfig() {
    return GAMEPLAY_DIFFICULTIES[this.gameplayDifficulty] || GAMEPLAY_DIFFICULTIES.Adventure;
  }

  _getPrompt(difficulty = this.currentDifficulty) {
    if (!this.availablePrompts) this.availablePrompts = {};
    const stage = this._getStage();
    const key = `${this.currentTrack}:${difficulty}:${stage.id}`;

    if (this.reviewPrompts.length && Math.random() < 0.35) {
      return this._normalizePrompt(this.reviewPrompts.shift());
    }

    if (!this.availablePrompts[key] || this.availablePrompts[key].length === 0) {
      this.availablePrompts[key] = this._buildPromptPool(difficulty, stage);
    }
    return this._normalizePrompt(this.availablePrompts[key].pop());
  }

  _buildPromptPool(difficulty, stage) {
    const selectedTrack = this.currentTrack || 'Mixed';
    const stageTracks = stage.tracks || ['Math', 'Language'];
    const allowedTracks = selectedTrack === 'Mixed' ? stageTracks : [selectedTrack];
    const allPrompts = [...ACADEMIC_PROMPTS, ...LEGACY_PROMPTS];

    let pool = allPrompts.filter(p => p.band === difficulty && allowedTracks.includes(p.track));
    if (pool.length === 0) {
      pool = allPrompts.filter(p => p.band === difficulty);
    }
    if (selectedTrack === 'Mixed' && pool.length < 12) {
      pool = pool.concat(allPrompts.filter(p => p.band === difficulty && !pool.includes(p)));
    }
    while (pool.length > 0 && pool.length < 12) {
      pool = pool.concat(pool);
    }

    const focused = pool.filter(p => (stage.skills || []).includes(p.skill));
    const generated = this._generatedPrompts(allowedTracks, difficulty, stage, 12);
    return shuffleList([...focused, ...pool, ...generated]).map(p => this._normalizePrompt(p));
  }

  _generatedPrompts(tracks, difficulty, stage, count) {
    const prompts = [];
    for (let i = 0; i < count; i++) {
      const track = tracks[i % tracks.length];
      if (track === 'Math') prompts.push(this._generatedMathPrompt(difficulty, stage));
    }
    return prompts.filter(Boolean);
  }

  _generatedMathPrompt(difficulty, stage) {
    const tier = stage.tier || 0;
    if (difficulty === 'Easy') {
      const a = 4 + Math.floor(Math.random() * (8 + tier * 2));
      const b = 2 + Math.floor(Math.random() * (7 + tier));
      if (Math.random() < 0.5) {
        const answer = a + b;
        return P('Math', 'Easy', 'Addition', `${a} + ${b} = ?`, String(answer), [String(answer - 1), String(answer + 1)], `${a} plus ${b} equals ${answer}.`);
      }
      const top = a + b;
      return P('Math', 'Easy', 'Subtraction', `${top} - ${b} = ?`, String(a), [String(a - 1), String(a + 2)], `${top} minus ${b} leaves ${a}.`);
    }
    if (difficulty === 'Medium') {
      const a = 3 + Math.floor(Math.random() * (7 + tier));
      const b = 3 + Math.floor(Math.random() * 7);
      if (Math.random() < 0.65) {
        const answer = a * b;
        return P('Math', 'Medium', 'Multiplication', `${a} x ${b} = ?`, String(answer), [String(answer - b), String(answer + a)], `${a} groups of ${b} make ${answer}.`);
      }
      const answer = a;
      const dividend = a * b;
      return P('Math', 'Medium', 'Division', `${dividend} / ${b} = ?`, String(answer), [String(answer - 1), String(answer + 1)], `${b} times ${answer} equals ${dividend}.`);
    }
    const x = 3 + Math.floor(Math.random() * (7 + tier));
    const m = 2 + Math.floor(Math.random() * 5);
    const c = 3 + Math.floor(Math.random() * 10);
    const total = m * x + c;
    return P('Math', 'Hard', 'Algebra', `${m}x + ${c} = ${total}, x = ?`, String(x), [String(x - 1), String(x + 1)], `Subtract ${c}, then divide by ${m} to solve for x.`);
  }

  _normalizePrompt(prompt) {
    const fallback = PROMPTS[this.currentDifficulty]?.[0] || ACADEMIC_PROMPTS[0];
    const p = prompt || fallback;
    return {
      track: p.track || legacyTrackForPrompt(p),
      band: p.band || this.currentDifficulty,
      skill: p.skill || legacySkillForPrompt(p),
      q: String(p.q),
      a: String(p.a),
      w: uniqueOptions(p.a, p.w),
      explanation: p.explanation || 'Use the clue in the question to choose the best answer.'
    };
  }

  // ─── World State ───
  _clearWorld() {
    this.platforms   = [];
    this.coins       = [];
    this.enemies     = [];
    this.gates       = [];
    this.sparks      = [];
    this.players     = [];
    this.projectiles = [];
    this.hearts      = [];
    this.spikes      = [];
    this.powerups    = [];
    this.ropes       = [];
    this.springs     = [];
    this.windZones   = [];
    this.timedHazards = [];
    this.floatTexts  = [];
    this.levelTime   = 0;
    this.bossPhase   = false;
    this.cameraX     = 0;
    this.cameraY     = 0;
    this.bossEntity  = null;
    this.bossGate    = null;
    this.bossHealth  = 0;
    this.goalFlag    = null;
    this.levelEndTimer = -1;
  }

  // ─── Background Generation ───
  _genStars(n) {
    const stars = [];
    for (let i = 0; i < n; i++) {
      stars.push({ x: Math.random() * 9999, y: Math.random() * CH * 0.85, r: Math.random() * 1.5 + 0.3, blink: Math.random() * Math.PI * 2 });
    }
    return stars;
  }

  _genClouds(n) {
    const clouds = [];
    for (let i = 0; i < n; i++) {
      clouds.push({ x: Math.random() * 8000, y: 40 + Math.random() * 200, s: 0.5 + Math.random() * 1.2, speed: 8 + Math.random() * 10 });
    }
    return clouds;
  }

  // ─── Start / Level ───
  startGame(level = 1) {
    this.currentLevel = level;
    this.currentStage = this._getStage(level);
    const gameCfg = this._getGameConfig();
    this.state = 'playing';
    this.gameIsOver = false;
    if (level === 1) {
      this.score = 0;
      this.reviewPrompts = [];
      this.campaignStats = this._newStats();
    }
    this.levelStats = this._newStats();
    this.combo = 0;
    this.shakeTimer = 0;
    this.flashTimer = 0;
    this.stageBannerTimer = 3.2;
    this.lessonToast = null;

    this._clearWorld();
    document.getElementById('levelBadge').textContent = `LVL ${level}/${MAX_LEVEL}`;

    this.players = [];
    const configs = [
      { id: 1, color: '#38bdf8', glow: 'rgba(56,189,248,0.4)', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', x: 60 },
      { id: 2, color: '#22c55e', glow: 'rgba(34,197,94,0.4)', up: 'w', down: 's', left: 'a', right: 'd', x: 100 }
    ];
    for (let i = 0; i < this.playerCount; i++) {
      const c = configs[i];
      this.players.push({
        id: c.id, lives: gameCfg.lives, coinsCollected: 0,
        x: c.x, y: 300, w: 32, h: 48,
        vx: 0, vy: 0,
        color: c.color, glow: c.glow,
        grounded: false, up: c.up, down: c.down, left: c.left, right: c.right,
        dead: false, jumpCount: 0,
        invincibleTimer: 0, bootTimer: 0,
        animTime: 0, squash: 1, squashVel: 0,
        rope: null, ropeOffset: 0, ropeNudge: 0, ropeCooldown: 0,
        jumpReleased: true, wasGrounded: false,
        facingRight: true,
        trailFrames: []
      });
    }

    this._updateHUD();
    this._generateLevel();
  }

  _challengeTypeForSection(stage, sectionIndex) {
    const level = stage?.id || this.currentLevel || 1;
    if (level <= 1) return sectionIndex % 3 === 2 ? 'spring' : 'moving';
    if (level <= 2) return ['moving', 'spring', 'crumble'][sectionIndex % 3];
    if (level <= 4) return ['moving', 'spring', 'crumble', 'timed'][sectionIndex % 4];
    if (level <= 5) return ['timed', 'crumble', 'spring'][sectionIndex % 3];
    if (level <= 8) return ['rope', 'crumble', 'spring', 'tilt'][sectionIndex % 4];
    if (level <= 10) return ['tilt', 'wind', 'timed', 'moving', 'rope'][sectionIndex % 5];
    if (level <= 14) return ['rope', 'tilt', 'crumble', 'wind', 'timed', 'spring'][sectionIndex % 6];
    return ['rope', 'tilt', 'crumble', 'wind', 'timed', 'spring', 'moving'][sectionIndex % 7];
  }

  // ─── Level Generation ───
  _generateLevel() {
    const stage = this._getStage();
    const gameCfg = this._getGameConfig();
    const diff = Math.max(0, Math.min(4, stage.tier || 0));
    const gateCount = Math.max(3, (stage.gates || 4) + gameCfg.gateDelta);
    let px = 0;

    // Starting platform
    this.platforms.push({ x: -300, y: 500, w: 700, h: 120, active: true, type: 'grass' });
    px += 400;

    for (let i = 0; i < gateCount; i++) {
      const challengeType = this._challengeTypeForSection(stage, i);
      // ── 1. Navigation gap ──
      const gap = 150 + Math.random() * 40 + diff * 10;
      const platW = Math.max(280, 650 - diff * 120);

      // Moving island in gap
      const islandSpeed = (70 + diff * 25) * gameCfg.speedMultiplier;
      this.platforms.push({
        x: px + gap / 2 - 40, y: 460, w: 90, h: 26,
        active: true, type: 'moving',
        moveY: true, speed: islandSpeed,
        startY: 460, endY: 290,
        startX: px + gap / 2 - 40, endX: px + gap / 2 - 40,
        vx: 0, vy: -islandSpeed
      });

      // Main landing platform
      const landX = px + gap;
      this.platforms.push({ x: landX, y: 500, w: platW, h: 120, active: true, type: 'grass' });

      if (challengeType === 'timed' && diff >= 1) {
        this.timedHazards.push({
          type: 'firejet',
          x: landX + Math.max(130, platW * 0.58),
          y: 422,
          w: 34,
          h: 78,
          period: Math.max(1.55, 2.3 - diff * 0.12),
          onTime: Math.min(1.05, 0.72 + diff * 0.07),
          phase: i * 0.37,
          active: false
        });
      }

      if (challengeType === 'wind' && diff >= 3) {
        const dir = i % 2 === 0 ? 1 : -1;
        this.windZones.push({
          x: landX + 80,
          y: 160,
          w: Math.max(260, platW - 160),
          h: 300,
          forceX: dir * (260 + diff * 55) * gameCfg.speedMultiplier,
          forceY: -80,
          phase: i * 0.9
        });
      }

      // Coins cluster
      for (let j = 0; j < 3; j++) {
        this.coins.push({ x: landX + platW * 0.3 + j * 50, y: 380, w: 18, h: 18, collected: false });
      }
      // Heart pickup (random)
      if (Math.random() < 0.28 + gameCfg.heartBonus) {
        this.hearts.push({ x: landX + platW * 0.6, y: 340, w: 22, h: 22, collected: false });
      }
      // Powerup
      if (Math.random() < 0.18 + Math.max(0, gameCfg.heartBonus * 0.4)) {
        const type = Math.random() < 0.5 ? 'star' : 'boots';
        this.powerups.push({ type, x: landX + platW * 0.7, y: 340, w: 26, h: 26, active: true, bob: 0 });
      }

      // Enemies (scaled by level)
      const eCap = Math.max(1, Math.round((1 + Math.min(3, diff)) * gameCfg.enemyMultiplier));
      for (let j = 0; j < eCap; j++) {
        const r = Math.random();
        const ex = landX + 80 + j * 110;
        if (diff >= 1 && r < 0.18) {
          this.enemies.push({ type: 'shooter', x: landX + platW - 120 - j * 50, y: 450, w: 38, h: 50, shootTimer: Math.random() * 2, dead: false, anim: 0 });
        } else if (diff >= 1 && r < 0.35) {
          this.enemies.push({ type: 'flyer', x: ex, y: 300, w: 38, h: 30, vx: -90 * gameCfg.speedMultiplier, startX: landX + 50, endX: landX + platW - 50, startY: 300, flyOffset: Math.random() * 10, dead: false, anim: 0 });
        } else if (diff >= 1 && r < 0.52) {
          this.enemies.push({ type: 'chaser', x: landX + platW / 2 + j * 80, y: 460, w: 38, h: 40, vx: 0, dead: false, anim: 0 });
        } else if (diff >= 2 && r < 0.70) {
          this.enemies.push({ type: 'pacer', x: ex, y: 160, w: 38, h: 38, vy: 110 * gameCfg.speedMultiplier, startY: 160, endY: 420, dead: false, anim: 0 });
        } else {
          this.enemies.push({ type: 'walker', x: landX + platW / 2 + j * 90, y: 460, w: 38, h: 40, vx: (-50 - diff * 20) * gameCfg.speedMultiplier, startX: landX + 40, endX: landX + platW - 40, dead: false, anim: 0 });
        }
      }

      px = landX + platW;

      // ── 2. Step section ──
      const stepGap = 90 + diff * 12;
      const stepW   = Math.max(80, 130 - diff * 18);
      this.platforms.push({ x: px + stepGap, y: 410, w: stepW, h: 210, active: true, type: 'stone' });
      if (challengeType === 'spring') {
        this.springs.push({
          x: px + stepGap + Math.max(8, stepW * 0.24),
          y: 392,
          w: Math.min(52, Math.max(38, stepW * 0.55)),
          h: 18,
          force: 930 + diff * 55,
          cooldown: 0
        });
      }
      if (diff >= 1 && Math.random() < 0.5 * gameCfg.hazardMultiplier) {
        // Only cover the right half of the step to leave a safe landing zone
        const spikeW = stepW / 2;
        this.spikes.push({ x: px + stepGap + (stepW - spikeW), y: 395, w: spikeW, h: 15 });
      }
      const step2x = px + stepGap + stepW + 70 + diff * 18;
      this.platforms.push({ x: step2x, y: 310, w: stepW, h: 310, active: true, type: 'stone' });
      if (challengeType === 'timed' && diff >= 2) {
        this.timedHazards.push({
          type: 'firejet',
          x: step2x + stepW / 2 - 16,
          y: 250,
          w: 32,
          h: 60,
          period: Math.max(1.45, 2.0 - diff * 0.1),
          onTime: 0.62 + diff * 0.06,
          phase: 0.65 + i * 0.41,
          active: false
        });
      }
      for (let j = 0; j < 2; j++) {
        this.coins.push({ x: px + stepGap + stepW + j * 45, y: 210, w: 18, h: 18, collected: false });
      }
      if (diff >= 1 && Math.random() < 0.5) {
        this.enemies.push({ type: 'shooter', x: step2x + stepW / 2 - 19, y: 260, w: 38, h: 50, shootTimer: 0, dead: false, anim: 0 });
      }
      px += stepGap + stepW * 2 + 70 + diff * 18;

      // ── 3. Approach islands ──
      const numIslands = 1 + diff;
      const iSpeed = (85 + diff * 28) * gameCfg.speedMultiplier;
      const iSpacing = 155 + diff * 8;
      for (let k = 0; k < numIslands; k++) {
        const iX = px + 100 + k * iSpacing;
        const iY = 430 - k * 25;
        let island = {
          x: iX, y: iY, w: 110, h: 28,
          active: true, type: 'moving',
          moveY: true, speed: iSpeed,
          startY: iY, endY: iY - 190,
          startX: iX, endX: iX,
          vx: 0, vy: -iSpeed
        };
        if (challengeType === 'tilt' && diff >= 2 && k % 2 === 0) {
          island = {
            x: iX - 10, y: iY, w: 132, h: 26,
            active: true, type: 'tilt',
            tiltAngle: 0, tiltTarget: 0, tiltLoad: 0, tiltLoadCount: 0
          };
        } else if (challengeType === 'crumble' && k % 2 === 0) {
          island = {
            x: iX, y: iY, w: 108, h: 26,
            active: true, type: 'crumble',
            crumbleDelay: Math.max(0.82, 1.35 - diff * 0.12),
            crumbleTimer: null,
            respawnTimer: 0,
            shake: 0
          };
        } else if (challengeType === 'moving' && diff >= 3 && k % 2 === 0) {
          island.moveY = false;
          island.y = iY - 35;
          island.startY = island.y;
          island.endY = island.y;
          island.startX = iX - 60;
          island.endX = iX + 105;
          island.x = island.startX;
          island.vx = iSpeed * 0.85;
          island.vy = 0;
        }
        this.platforms.push(island);

        if (challengeType === 'rope' && diff >= 2 && k === 0) {
          this.ropes.push({
            x: iX + iSpacing * 0.78,
            y: 138,
            length: 292,
            swingAmp: 34 + diff * 5,
            swingSpeed: 1.08 + diff * 0.12,
            phase: i * 0.8 + k,
            vx: 0,
            startX: iX + iSpacing * 0.78,
            endX: iX + iSpacing * 0.78,
            moveX: false
          });
        }

        if (challengeType === 'wind' && diff >= 3 && k === Math.max(0, numIslands - 1)) {
          const dir = i % 2 === 0 ? -1 : 1;
          this.windZones.push({
            x: iX - 40,
            y: 120,
            w: 200,
            h: 310,
            forceX: dir * (330 + diff * 45) * gameCfg.speedMultiplier,
            forceY: -110,
            phase: i * 0.6 + 1.3
          });
        }

        if (Math.random() < 0.4) {
          this.coins.push({ x: iX + 40, y: iY - 30, w: 18, h: 18, collected: false });
          this.coins.push({ x: iX + 65, y: iY - 30, w: 18, h: 18, collected: false });
        } else if (diff >= 1 && Math.random() < 0.5) {
          this.enemies.push({ type: 'chaser', x: iX + 35, y: iY - 40, w: 38, h: 40, vx: 0, dead: false, anim: 0 });
        }
      }

      // Safety pad + gate
      const safeX = px + 80 + numIslands * iSpacing;
      const safeY = 460;
      const prompt = this._getPrompt(this.currentDifficulty);
      const answers = [prompt.a, prompt.w[0], prompt.w[1]].sort(() => Math.random() - 0.5);
      const gateWallX = safeX + 720;

      const gateWall = { x: gateWallX, y: 0, w: 36, h: 470, active: true, isGate: true };
      this.platforms.push(gateWall);
      this.platforms.push({ x: safeX, y: safeY, w: 890, h: 160, active: true, type: 'grass' });

      if (challengeType === 'rope' && diff >= 2) {
        this.ropes.push({
          x: safeX - 78,
          y: 130,
          length: 330,
          swingAmp: 38 + diff * 5,
          swingSpeed: 1.18 + diff * 0.1,
          phase: 1.7 + i * 0.6,
          vx: 0,
          startX: safeX - 78,
          endX: safeX - 78,
          moveX: false
        });
        this.coins.push({ x: safeX - 95, y: 240, w: 18, h: 18, collected: false });
        this.coins.push({ x: safeX - 56, y: 204, w: 18, h: 18, collected: false });
      }

      if (challengeType === 'timed' && diff >= 1) {
        this.timedHazards.push({
          type: 'firejet',
          x: safeX + 620,
          y: safeY - 76,
          w: 36,
          h: 76,
          period: Math.max(1.5, 2.2 - diff * 0.12),
          onTime: Math.min(1.0, 0.68 + diff * 0.07),
          phase: 0.25 + i * 0.55,
          active: false
        });
      }

      if (challengeType === 'spring') {
        this.springs.push({
          x: safeX + 40,
          y: safeY - 18,
          w: 54,
          h: 18,
          force: 900 + diff * 45,
          cooldown: 0
        });
      }

      this.gates.push({
        prompt: prompt.q,
        promptData: prompt,
        blocks: [
          { x: safeX + 100, y: 300, w: 150, h: 54, text: answers[0], isCorrect: answers[0] === prompt.a, hit: false, bob: Math.random() * Math.PI * 2 },
          { x: safeX + 310, y: 300, w: 150, h: 54, text: answers[1], isCorrect: answers[1] === prompt.a, hit: false, bob: Math.random() * Math.PI * 2 + 1 },
          { x: safeX + 520, y: 300, w: 150, h: 54, text: answers[2], isCorrect: answers[2] === prompt.a, hit: false, bob: Math.random() * Math.PI * 2 + 2 }
        ],
        wall: gateWall,
        cleared: false
      });

      px = safeX + 890;
    }

    // ── 4. End zone / Boss ──
    const landPad = px + 160;
    this.platforms.push({ x: landPad, y: 500, w: 1400, h: 120, active: true, type: 'grass' });

    if (stage.boss) {
      this.bossPhase = true;
      this.bossHealth = Math.max(2, (stage.bossHealth || 4) + gameCfg.bossHealthDelta);
      this.bossMaxHealth = this.bossHealth;
      this.bossEntity = {
        x: landPad + 1100, y: 240, w: 160, h: 160,
        active: true, shootTimer: 0,
        walkX: landPad + 900, walkDir: -1, walkSpeed: 60 * gameCfg.speedMultiplier,
        anim: 0
      };
      const bp = this._getPrompt(this.currentDifficulty);
      const ba = [bp.a, bp.w[0], bp.w[1]].sort(() => Math.random() - 0.5);
      this.bossGate = {
        prompt: bp.q,
        promptData: bp,
        blocks: [
          { x: landPad + 250, y: 290, w: 150, h: 60, text: ba[0], isCorrect: ba[0] === bp.a, hit: false, bob: 0 },
          { x: landPad + 480, y: 290, w: 150, h: 60, text: ba[1], isCorrect: ba[1] === bp.a, hit: false, bob: 1 },
          { x: landPad + 710, y: 290, w: 150, h: 60, text: ba[2], isCorrect: ba[2] === bp.a, hit: false, bob: 2 }
        ]
      };
      this.goalFlag = null;
    } else {
      this.goalFlag = { x: landPad + 700, y: 130, w: 18, h: 380, wave: 0 };
    }
  }

  // ─── Events ───
  _hitBlock(gate, block, player) {
    if (block.hit) return;
    block.hit = true;
    this._recordAnswer(gate.promptData, block.isCorrect, block.text);
    if (block.isCorrect) {
      Sfx.correct();
      gate.cleared = true;
      gate.wall.active = false;
      this.combo++;
      const bonus = Math.round(100 * this.currentLevel * Math.min(this.combo, 5) * this._getGameConfig().scoreMultiplier);
      this.score += bonus;
      this._floatText(`+${bonus}`, block.x + block.w / 2, block.y - 10, '#34d399');
      if (this.combo > 1) this._floatText(`×${Math.min(this.combo,5)} COMBO!`, block.x + block.w / 2, block.y - 40, '#fbbf24');
      this._spawnBurst(block.x + block.w / 2, block.y + block.h / 2, '#34d399', 20);
      this._showLessonToast(gate.promptData, true);
      this._flashScreen('rgba(52,211,153,0.12)');
      // Revive dead teammates
      for (const p of this.players) {
        if (p.dead) {
          p.dead = false; p.lives = 1;
          p.x = this.cameraX + 200; p.y = -60;
          p.vx = 0; p.vy = 0;
          this._floatText('REVIVED!', p.x, p.y, '#38bdf8');
          Sfx.powerup();
        }
      }
    } else {
      Sfx.wrong();
      this.combo = 0;
      this._showLessonToast(gate.promptData, false);
      this._killPlayer(player);
      this._spawnBurst(block.x + block.w / 2, block.y + block.h / 2, '#f87171', 10);
      this._shakeScreen(8, 0.5);
    }
    this._updateHUD();
  }

  _hitBossBlock(block, player) {
    if (block.hit) return;
    block.hit = true;
    this._recordAnswer(this.bossGate.promptData, block.isCorrect, block.text);
    if (block.isCorrect) {
      Sfx.correct();
      this.bossHealth--;
      this.score += Math.round(600 * this._getGameConfig().scoreMultiplier);
      this._updateHUD();
      this._showLessonToast(this.bossGate.promptData, true);
      this._spawnBurst(this.bossEntity.x + 80, this.bossEntity.y + 80, '#fbbf24', 25);
      this._floatText(`-1 HP!`, this.bossEntity.x + 80, this.bossEntity.y - 10, '#fbbf24');
      this._shakeScreen(12, 0.4);
      if (this.bossHealth <= 0) {
        this.bossEntity.active = false;
        Sfx.win();
        this._floatText('BOSS DEFEATED!', CW / 2 + this.cameraX, 200, '#fbbf24');
        this._spawnBurst(this.bossEntity.x + 80, this.bossEntity.y + 80, '#fbbf24', 50);
        this.goalFlag = { x: this.bossEntity.x + 60, y: 130, w: 18, h: 380, wave: 0 };
      } else {
        // New question
        const bp = this._getPrompt(this.currentDifficulty);
        const ba = [bp.a, bp.w[0], bp.w[1]].sort(() => Math.random() - 0.5);
        this.bossGate.prompt = bp.q;
        this.bossGate.promptData = bp;
        for (let i = 0; i < 3; i++) {
          this.bossGate.blocks[i].text = ba[i];
          this.bossGate.blocks[i].isCorrect = ba[i] === bp.a;
          this.bossGate.blocks[i].hit = false;
        }
      }
    } else {
      Sfx.wrong();
      this.combo = 0;
      this._showLessonToast(this.bossGate.promptData, false);
      this._killPlayer(player);
      this._shakeScreen(8, 0.5);
    }
  }

  _recordAnswer(promptData, correct, chosenText) {
    const prompt = this._normalizePrompt(promptData);
    const apply = (stats) => {
      stats.answered++;
      if (correct) stats.correct++;
      if (!stats.skills[prompt.skill]) stats.skills[prompt.skill] = { answered: 0, correct: 0 };
      stats.skills[prompt.skill].answered++;
      if (correct) stats.skills[prompt.skill].correct++;
      if (!correct) {
        stats.missed.push({
          q: prompt.q,
          answer: prompt.a,
          chosen: chosenText,
          skill: prompt.skill,
          explanation: prompt.explanation
        });
      }
    };
    apply(this.levelStats);
    apply(this.campaignStats);
    if (!correct) this.reviewPrompts.push(prompt);
  }

  _showLessonToast(promptData, correct) {
    const prompt = this._normalizePrompt(promptData);
    this.lessonToast = {
      text: correct ? prompt.explanation : `Review: ${prompt.explanation}`,
      skill: prompt.skill,
      correct,
      timer: correct ? 3.2 : 4.2
    };
  }

  _killPlayer(p) {
    if (p.dead) return;
    if (p.invincibleTimer > 0) return; // invincible
    p.invincibleTimer = 1.8; // brief iframes
    p.lives--;
    p.rope = null;
    p.ropeCooldown = 0.3;
    Sfx.hurt();
    const penalty = this._getGameConfig().wrongPenalty;
    this.score = Math.max(0, this.score - penalty);
    this._updateHUD();
    this._floatText(`-${penalty}`, p.x + p.w / 2, p.y, '#f87171');

    if (p.lives <= 0) {
      p.dead = true;
      if (this.players.every(pl => pl.dead)) {
        this._endGame(false);
      }
    } else {
      // Safe respawn
      const safePlat = this.platforms.find(pl =>
        pl.active && !pl.moveY && !pl.isGate && pl.type !== 'gate' &&
        pl.type !== 'crumble' && pl.type !== 'tilt' &&
        pl.x + pl.w > this.cameraX + 60 && pl.w > 100
      );
      p.x = safePlat ? Math.max(this.cameraX + 60, safePlat.x + 60) : this.cameraX + 200;
      p.y = -100;
      p.vx = 0; p.vy = 0;
    }
  }

  _endGame(won) {
    this.state = 'end';
    this.gameIsOver = !won;
    const stage = this._getStage();
    const gameCfg = this._getGameConfig();
    const baseTimeBonus = (stage.gates || 4) * 1400 + (stage.boss ? 3200 : 0);
    const timeBonus = won ? Math.round(Math.max(0, baseTimeBonus - Math.floor(this.levelTime * 65)) * gameCfg.scoreMultiplier) : 0;
    if (won) this.score += timeBonus;
    this._updateHUD();

    const icon = document.getElementById('endIcon');
    const title = document.getElementById('endTitle');
    const msg = document.getElementById('endMessage');
    const stats = document.getElementById('endStats');
    const nextBtn = document.getElementById('playAgainBtn');

    if (won) {
      Sfx.win();
      if (this.currentLevel >= MAX_LEVEL) {
        icon.textContent = '🏆';
        title.textContent = 'Game Clear!';
        nextBtn.textContent = '▶ Play Again';
      } else {
        icon.textContent = '🎉';
        title.textContent = `${stage.name} Clear!`;
        nextBtn.textContent = `▶ Start Level ${this.currentLevel + 1}`;
      }
      msg.textContent = `Focus: ${stage.focus}.`;
      stats.innerHTML = this._renderEndStats(timeBonus);
    } else {
      Sfx.wrong();
      icon.textContent = '💀';
      title.textContent = 'Game Over';
      msg.textContent = `Level ${this.currentLevel}: ${stage.name}.`;
      stats.innerHTML = this._renderEndStats(0);
      nextBtn.textContent = '▶ Restart Game';
    }
    document.getElementById('gameEnd').style.display = 'flex';
  }

  // ─── HUD ───
  _renderEndStats(timeBonus) {
    const accuracy = this._accuracy(this.levelStats);
    const mastery = accuracy >= 90 ? 'Gold' : accuracy >= 75 ? 'Silver' : accuracy >= 60 ? 'Bronze' : 'Practice';
    const skillRows = this._skillRows(this.levelStats);
    const missedRows = this.levelStats.missed.slice(-3).map(m => `
      <div class="missed-line">
        <span>${this._escapeHtml(m.skill)}: ${this._escapeHtml(m.q)}</span>
        <strong>${this._escapeHtml(m.answer)}</strong>
      </div>
    `).join('');

    return `
      <div class="stat-line"><span>Score</span><span class="stat-val">${this.score}</span></div>
      <div class="stat-line"><span>Accuracy</span><span class="stat-val">${accuracy}%</span></div>
      <div class="stat-line"><span>Mastery</span><span class="stat-val">${mastery}</span></div>
      <div class="stat-line"><span>Time Bonus</span><span class="stat-val">+${timeBonus}</span></div>
      <div class="stat-line"><span>Time</span><span class="stat-val">${this.levelTime.toFixed(1)}s</span></div>
      ${skillRows ? `<div class="skill-report">${skillRows}</div>` : ''}
      ${missedRows ? `<div class="missed-report"><div class="report-title">Review Next</div>${missedRows}</div>` : ''}
    `;
  }

  _accuracy(stats) {
    return stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 100;
  }

  _skillRows(stats) {
    return Object.entries(stats.skills)
      .sort((a, b) => b[1].answered - a[1].answered)
      .slice(0, 3)
      .map(([skill, s]) => {
        const pct = s.answered ? Math.round((s.correct / s.answered) * 100) : 100;
        return `<div class="skill-line"><span>${this._escapeHtml(skill)}</span><span>${s.correct}/${s.answered} (${pct}%)</span></div>`;
      }).join('');
  }

  _escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  _updateHUD() {
    document.getElementById('scoreDisplay').textContent = this.score.toString().padStart(5, '0');
    const p1 = this.players[0];
    const p2 = this.players[1];
    document.getElementById('p1HeartsHud').textContent = p1 ? (p1.dead ? '💀' : '♥'.repeat(Math.max(0, p1.lives))) : '—';
    document.getElementById('p2HeartsHud').textContent = p2 ? (p2.dead ? '💀' : '♥'.repeat(Math.max(0, p2.lives))) : '—';
  }

  // ─── Feedback Helpers ───
  _shakeScreen(amt, dur) { this.shakeAmt = amt; this.shakeTimer = dur; }
  _flashScreen(col) { this.flashTimer = 0.18; this.flashColor = col; }

  _floatText(text, x, y, color) {
    this.floatTexts.push({ text, x, y, color, life: 1.2, vy: -90 });
  }

  _spawnBurst(x, y, col, n) {
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 / n) * i + Math.random() * 0.4;
      const speed = 80 + Math.random() * 180;
      this.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60, col, life: 0.8 + Math.random() * 0.5, r: 2 + Math.random() * 3 });
    }
  }

  // ─── Update ───
  _ropeX(rope, offset = rope.length, nudge = 0) {
    const t = performance.now() / 1000;
    const ratio = Math.max(0, Math.min(1, offset / Math.max(1, rope.length)));
    return rope.x + Math.sin(t * rope.swingSpeed + rope.phase) * rope.swingAmp * ratio + nudge * 34;
  }

  _ropeSwingVelocity(rope, offset = rope.length, nudge = 0) {
    const t = performance.now() / 1000;
    const ratio = Math.max(0, Math.min(1, offset / Math.max(1, rope.length)));
    return Math.cos(t * rope.swingSpeed + rope.phase) * rope.swingAmp * rope.swingSpeed * ratio + nudge * 240;
  }

  _tryGrabRope(p) {
    if (p.rope || p.ropeCooldown > 0) return;
    const centerX = p.x + p.w / 2;
    const centerY = p.y + p.h / 2;
    for (const rope of this.ropes) {
      const offset = centerY - rope.y;
      if (offset < 22 || offset > rope.length - 10) continue;
      const ropeX = this._ropeX(rope, offset, 0);
      if (Math.abs(centerX - ropeX) > ROPE_GRAB_RANGE) continue;
      p.rope = rope;
      p.ropeOffset = offset;
      p.ropeNudge = 0;
      p.vx = 0;
      p.vy = 0;
      p.grounded = false;
      p.jumpCount = 0;
      p.jumpReleased = false;
      Sfx.hit();
      return;
    }
  }

  _releaseRope(p, leapVy = -520) {
    if (!p.rope) return;
    const rope = p.rope;
    const swingV = this._ropeSwingVelocity(rope, p.ropeOffset, p.ropeNudge);
    p.vx = (rope.vx || 0) + swingV;
    p.vy = leapVy;
    p.rope = null;
    p.ropeCooldown = 0.28;
    p.jumpReleased = false;
    p.jumpCount = 1;
    Sfx.jump();
  }

  _updatePlayerOnRope(p, dt) {
    const rope = p.rope;
    if (!rope) return;
    p.grounded = false;
    p.vx = 0;
    p.vy = 0;
    p.jumpCount = 0;

    if (this.keys[p.left])  { p.ropeNudge -= dt * 2.4; p.facingRight = false; }
    if (this.keys[p.right]) { p.ropeNudge += dt * 2.4; p.facingRight = true; }
    if (!this.keys[p.left] && !this.keys[p.right]) p.ropeNudge *= Math.pow(0.08, dt);
    p.ropeNudge = Math.max(-1, Math.min(1, p.ropeNudge));

    if (this.keys[p.up]) {
      p.ropeOffset -= ROPE_CLIMB_SPEED * dt;
      p.animTime += dt * 2;
    }

    if (this.keys[p.down]) {
      if (p.jumpReleased) {
        this._releaseRope(p, 130);
        return;
      }
    } else {
      p.jumpReleased = true;
    }

    p.ropeOffset = Math.max(20, Math.min(rope.length - 18, p.ropeOffset));
    const ropeX = this._ropeX(rope, p.ropeOffset, p.ropeNudge);
    p.x = ropeX - p.w / 2;
    p.y = rope.y + p.ropeOffset - p.h / 2;
    p.squash += (1 - p.squash) * dt * 10;
  }

  _update(dt) {
    if (this.state !== 'playing') return;

    this.levelTime += dt;

    // Screen effects
    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - dt);
    if (this.stageBannerTimer > 0) this.stageBannerTimer = Math.max(0, this.stageBannerTimer - dt);
    if (this.lessonToast && this.lessonToast.timer > 0) {
      this.lessonToast.timer = Math.max(0, this.lessonToast.timer - dt);
      if (this.lessonToast.timer <= 0) this.lessonToast = null;
    }

    // Platform bobbing for boss blocks
    const t = performance.now() / 1000;

    for (const hazard of this.timedHazards) {
      const phaseTime = (t + hazard.phase) % hazard.period;
      hazard.active = phaseTime < hazard.onTime;
      hazard.warning = !hazard.active && phaseTime > hazard.period - 0.35;
    }

    for (const spring of this.springs) {
      if (spring.cooldown > 0) spring.cooldown = Math.max(0, spring.cooldown - dt);
    }

    for (const rope of this.ropes) {
      if (!rope.moveX || !rope.vx) continue;
      rope.x += rope.vx * dt;
      if (rope.x < rope.startX) { rope.x = rope.startX; rope.vx = Math.abs(rope.vx); }
      else if (rope.x > rope.endX) { rope.x = rope.endX; rope.vx = -Math.abs(rope.vx); }
    }

    for (const plat of this.platforms) {
      if (plat.type === 'tilt') {
        plat.tiltLoad = 0;
        plat.tiltLoadCount = 0;
      }
      if (plat.type !== 'crumble') continue;
      if (!plat.active) {
        plat.respawnTimer = Math.max(0, (plat.respawnTimer || 0) - dt);
        if (plat.respawnTimer <= 0) {
          plat.active = true;
          plat.crumbleTimer = null;
          plat.shake = 0;
        }
      } else if (plat.crumbleTimer !== null) {
        plat.crumbleTimer -= dt;
        plat.shake = Math.max(0, plat.crumbleTimer / Math.max(0.1, plat.crumbleDelay));
        if (plat.crumbleTimer <= 0) {
          plat.active = false;
          plat.respawnTimer = 2.2;
          plat.crumbleTimer = null;
          this._spawnBurst(plat.x + plat.w / 2, plat.y + 10, '#f59e0b', 12);
          Sfx.hit();
        }
      }
    }

    // Sparks
    this.sparks = this.sparks.filter(s => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 500 * dt;
      s.life -= dt;
      return s.life > 0;
    });

    // Float texts
    this.floatTexts = this.floatTexts.filter(ft => {
      ft.y += ft.vy * dt;
      ft.life -= dt;
      return ft.life > 0;
    });

    // Camera — smoothly track furthest alive player
    let targetX = this.cameraX;
    let aliveCount = 0;
    for (const p of this.players) {
      if (!p.dead) { targetX = Math.max(targetX, p.x - 380); aliveCount++; }
    }
    if (aliveCount > 0) this.cameraX += (targetX - this.cameraX) * Math.min(1, dt * 8);

    // Moving platforms
    for (const plat of this.platforms) {
      if (!plat.active || (!plat.vx && !plat.vy)) continue;
      const pxPrev = plat.x, pyPrev = plat.y;
      if (plat.moveY) {
        plat.y += plat.vy * dt;
        if (plat.y < plat.endY) { plat.y = plat.endY; plat.vy = Math.abs(plat.vy); }
        else if (plat.y > plat.startY) { plat.y = plat.startY; plat.vy = -Math.abs(plat.vy); }
      } else {
        plat.x += plat.vx * dt;
        if (plat.x < plat.startX) { plat.x = plat.startX; plat.vx = Math.abs(plat.vx); }
        else if (plat.x > plat.endX) { plat.x = plat.endX; plat.vx = -Math.abs(plat.vx); }
      }
      const dx = plat.x - pxPrev, dy = plat.y - pyPrev;
      for (const p of this.players) {
        if (!p.dead && Math.abs((p.y + p.h) - pyPrev) < 3 &&
            p.x + p.w > plat.x && p.x < plat.x + plat.w) {
          p.x += dx; p.y += dy;
        }
      }
    }

    // Projectiles
    this.projectiles = this.projectiles.filter(proj => {
      proj.x += proj.vx * dt;
      proj.y += (proj.vy || 0) * dt;
      for (const p of this.players) {
        if (!p.dead && p.invincibleTimer <= 0 && intersect(p, proj)) {
          this._killPlayer(p);
          return false;
        }
      }
      return proj.x > this.cameraX - 200 && proj.x < this.cameraX + CW + 200;
    });

    // Powerup bobbing
    for (const pu of this.powerups) { if (pu.active) pu.bob = (pu.bob || 0) + dt; }

    // Players
    for (const p of this.players) {
      if (p.dead) continue;
      p.wasGrounded = p.grounded;
      p.groundedPlatform = null;
      if (p.ropeCooldown > 0) p.ropeCooldown = Math.max(0, p.ropeCooldown - dt);

      if (p.rope) {
        this._updatePlayerOnRope(p, dt);
      } else {
      // Input
      const accel = 1300;
      const friction = 0.80;
      if (this.keys[p.left])  p.vx -= accel * dt;
      if (this.keys[p.right]) p.vx += accel * dt;
      if (!this.keys[p.left] && !this.keys[p.right]) p.vx *= friction;
      for (const zone of this.windZones) {
        if (intersect(p, zone)) {
          p.vx += zone.forceX * dt;
          p.vy += zone.forceY * dt;
        }
      }
      p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx));
      if (Math.abs(p.vx) > 5) p.facingRight = p.vx > 0;

      // Trail
      if (p.invincibleTimer > 0) {
        p.trailFrames.push({ x: p.x, y: p.y, alpha: 0.4 });
        if (p.trailFrames.length > 8) p.trailFrames.shift();
      } else {
        p.trailFrames = [];
      }

      // X move
      p.x += p.vx * dt;
      p.animTime += Math.abs(p.vx) > 15 ? dt : 0;

      // Squash & stretch
      if (!p.grounded) {
        p.squash += (0.75 - p.squash) * dt * 8;
      } else {
        p.squash += (1.0 - p.squash) * dt * 14;
      }

      // Camera bound
      if (p.x < this.cameraX) { p.x = this.cameraX; p.vx = 0; }

      // X collision with platforms
      for (const plat of this.platforms) {
        if (!plat.active) continue;
        if (intersect(p, plat)) {
          if (p.vx > 0) p.x = plat.x - p.w;
          else           p.x = plat.x + plat.w;
          p.vx = 0;
        }
      }

      // Y (gravity + collision)
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      p.grounded = false;

      for (const plat of this.platforms) {
        if (!plat.active) continue;
        if (intersect(p, plat)) {
          if (p.vy > 0) {
            p.y = plat.y - p.h;
            if (!p.wasGrounded) Sfx.land();
            p.vy = 0;
            p.grounded = true;
            p.groundedPlatform = plat;
            if (plat.type === 'tilt') {
              const rel = ((p.x + p.w / 2) - (plat.x + plat.w / 2)) / Math.max(1, plat.w / 2);
              plat.tiltLoad += Math.max(-1, Math.min(1, rel));
              plat.tiltLoadCount++;
              p.vx += (plat.tiltAngle || 0) * 720 * dt;
            }
            if (plat.type === 'crumble' && plat.crumbleTimer === null) {
              plat.crumbleTimer = plat.crumbleDelay;
              plat.shake = 1;
              Sfx.hit();
            }
          } else {
            p.y = plat.y + plat.h;
            p.vy = 0;
          }
        }
      }

      for (const spring of this.springs) {
        if (spring.cooldown <= 0 && intersect(p, spring)) {
          p.y = spring.y - p.h;
          p.vy = -spring.force;
          p.grounded = false;
          p.jumpCount = 1;
          p.squash = 0.58;
          spring.cooldown = 0.35;
          Sfx.jump();
          this._spawnBurst(spring.x + spring.w / 2, spring.y, '#22d3ee', 10);
        }
      }

      // Jump
      if (p.grounded) p.jumpCount = 0;
      this._tryGrabRope(p);
      if (!p.rope && this.keys[p.up]) {
        if (p.jumpReleased) {
          if (p.grounded) {
            p.vy = JUMP_FORCE;
            p.grounded = false;
            p.jumpCount = 1;
            p.squash = 0.65;
            Sfx.jump();
          } else if (p.bootTimer > 0 && p.jumpCount === 1) {
            p.vy = DOUBLE_JUMP_FORCE;
            p.jumpCount = 2;
            Sfx.jump();
            this._spawnBurst(p.x + p.w / 2, p.y + p.h, '#a78bfa', 8);
          }
          p.jumpReleased = false;
        }
      } else if (!p.rope) {
        p.jumpReleased = true;
      }
      }

      // Gate block collisions
      for (const gate of this.gates) {
        if (gate.cleared) continue;
        for (const b of gate.blocks) {
          if (b.hit && !b.isCorrect) continue;
          if (intersect(p, b)) {
            if (p.vy > 0 && p.y + p.h - p.vy * dt <= b.y + 8) {
              p.y = b.y - p.h; p.vy = 0; p.grounded = true;
            } else if (p.vy < 0 && p.y - p.vy * dt >= b.y + b.h - 8) {
              p.y = b.y + b.h; p.vy = 0;
              this._hitBlock(gate, b, p);
            } else {
              if (p.vx > 0) p.x = b.x - p.w; else p.x = b.x + b.w;
              p.vx = 0;
            }
          }
        }
      }

      // Boss gate
      if (this.bossPhase && this.bossHealth > 0) {
        for (const b of this.bossGate.blocks) {
          if (b.hit && !b.isCorrect) continue;
          if (intersect(p, b)) {
            if (p.vy > 0 && p.y + p.h - p.vy * dt <= b.y + 8) {
              p.y = b.y - p.h; p.vy = 0; p.grounded = true;
            } else if (p.vy < 0 && p.y - p.vy * dt >= b.y + b.h - 8) {
              p.y = b.y + b.h; p.vy = 0;
              this._hitBossBlock(b, p);
            } else {
              if (p.vx > 0) p.x = b.x - p.w; else p.x = b.x + b.w;
              p.vx = 0;
            }
          }
        }
      }

      // Death plane
      if (p.y > CH + 150) this._killPlayer(p);

      // Spikes
      for (const s of this.spikes) {
        if (p.invincibleTimer <= 0 && intersect(p, s)) this._killPlayer(p);
      }

      for (const hazard of this.timedHazards) {
        if (hazard.active && p.invincibleTimer <= 0 && intersect(p, hazard)) this._killPlayer(p);
      }

      // Coins
      for (const c of this.coins) {
        if (!c.collected && intersect(p, c)) {
          c.collected = true;
          this.score += 10;
          p.coinsCollected++;
          this._updateHUD();
          if (p.coinsCollected >= 20) {
            p.coinsCollected -= 20;
            p.lives++;
            Sfx.powerup();
            this._floatText('1-UP!', p.x + p.w / 2, p.y - 20, '#fbbf24');
          } else {
            Sfx.coin();
          }
        }
      }

      // Hearts
      for (const h of this.hearts) {
        if (!h.collected && intersect(p, h)) {
          h.collected = true;
          p.lives = Math.min(p.lives + 1, 9);
          Sfx.powerup();
          this._floatText('+1 ♥', p.x + p.w / 2, p.y - 20, '#fb7185');
          this._updateHUD();
        }
      }

      // Goal
      if (!p.dead && this.goalFlag && Math.abs(p.x - this.goalFlag.x) < 40) {
        if (this.state === 'playing') this._endGame(true);
      }

      // Powerup timers
      if (p.invincibleTimer > 0) p.invincibleTimer = Math.max(0, p.invincibleTimer - dt);
      if (p.bootTimer > 0) p.bootTimer = Math.max(0, p.bootTimer - dt);

      // Powerup pickup
      for (const pu of this.powerups) {
        if (pu.active && intersect(p, pu)) {
          pu.active = false;
          if (pu.type === 'star') {
            p.invincibleTimer = 8;
            Sfx.powerup();
            this._floatText('STAR POWER!', p.x + p.w / 2, p.y - 20, '#fbbf24');
          }
          if (pu.type === 'boots') {
            p.bootTimer = 12;
            Sfx.powerup();
            this._floatText('DOUBLE JUMP!', p.x + p.w / 2, p.y - 20, '#a78bfa');
          }
        }
      }
    }

    for (const plat of this.platforms) {
      if (plat.type !== 'tilt' || !plat.active) continue;
      const avgLoad = plat.tiltLoadCount ? plat.tiltLoad / plat.tiltLoadCount : 0;
      const target = plat.tiltLoadCount ? Math.max(-0.42, Math.min(0.42, avgLoad * 0.42)) : 0;
      plat.tiltAngle += (target - (plat.tiltAngle || 0)) * Math.min(1, dt * (plat.tiltLoadCount ? 4.8 : 2.5));
      plat.tiltTarget = target;
    }

    // Enemies
    const gameCfg = this._getGameConfig();
    const stageTier = this._getStage().tier || 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.anim = (e.anim || 0) + dt;

      if (e.type === 'shooter') {
        e.shootTimer += dt;
        const rate = Math.max(1.1, (2.8 - stageTier * 0.28) / gameCfg.speedMultiplier);
        if (e.shootTimer > rate && e.x < this.cameraX + CW + 100) {
          e.shootTimer = 0;
          this.projectiles.push({ x: e.x - 8, y: e.y + e.h / 2 - 6, w: 14, h: 14, vx: -260, vy: 0 });
        }
      } else if (e.type === 'flyer') {
        e.flyOffset += dt * 3.5;
        e.y = e.startY + Math.sin(e.flyOffset) * 55;
        e.x += e.vx * dt;
        if (e.x < e.startX || e.x > e.endX) e.vx *= -1;
      } else if (e.type === 'pacer') {
        e.y += e.vy * dt;
        if (e.y < e.startY || e.y > e.endY) e.vy *= -1;
      } else if (e.type === 'chaser') {
        let closest = null, minDist = 400;
        for (const p of this.players) {
          if (p.dead) continue;
          const d = Math.abs(p.x - e.x);
          if (d < minDist) { minDist = d; closest = p; }
        }
        e.vx = closest ? (closest.x < e.x ? -120 : 120) * gameCfg.speedMultiplier : e.vx * 0.5;
        e.x += e.vx * dt;
      } else { // walker
        e.x += e.vx * dt;
        if (e.x < e.startX || e.x > e.endX) e.vx *= -1;
      }

      // Enemy vs player
      for (const p of this.players) {
        if (p.dead) continue;
        if (!intersect(p, e)) continue;
        if (p.invincibleTimer > 0) {
          e.dead = true;
          this.score += 60;
          this._updateHUD();
          Sfx.stomp();
          this._spawnBurst(e.x + e.w / 2, e.y + e.h / 2, '#fbbf24', 12);
          this._floatText('+60', e.x + e.w / 2, e.y, '#fbbf24');
        } else if (p.vy > 0 && p.y + p.h - p.vy * dt <= e.y + 14) {
          e.dead = true;
          p.vy = -600;
          this.score += 50;
          this._updateHUD();
          Sfx.stomp();
          this._spawnBurst(e.x + e.w / 2, e.y + e.h / 2, '#fbbf24', 10);
          this._floatText('+50', e.x + e.w / 2, e.y - 10, '#fbbf24');
          p.squash = 0.6;
        } else {
          this._killPlayer(p);
        }
      }
    }

    // Boss actions
    if (this.bossPhase && this.bossEntity && this.bossEntity.active && this.bossHealth > 0) {
      const be = this.bossEntity;
      be.anim = (be.anim || 0) + dt;
      be.shootTimer += dt;
      be.x += be.walkDir * be.walkSpeed * dt;
      if (be.x < be.walkX - 150 || be.x > be.walkX + 50) be.walkDir *= -1;

      if (be.shootTimer > 1.8 && be.x < this.cameraX + CW + 200) {
        be.shootTimer = 0;
        const speed = (280 + Math.random() * 120) * gameCfg.speedMultiplier;
        this.projectiles.push({ x: be.x, y: be.y + 80, w: 18, h: 18, vx: -speed, vy: (Math.random() - 0.5) * 120 });
        if (this.bossHealth <= 2) {
          // Enraged: shoot 3
          setTimeout(() => {
            this.projectiles.push({ x: be.x, y: be.y + 80, w: 18, h: 18, vx: -speed * 0.8, vy: 80 });
            this.projectiles.push({ x: be.x, y: be.y + 80, w: 18, h: 18, vx: -speed * 0.8, vy: -80 });
          }, 200);
        }
      }
    }
  }

  // ─── Draw ───
  _draw() {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    const biome = this._getStage().biome || 'grass';
    ctx.save();

    // Screen shake
    let sx = 0, sy = 0;
    if (this.shakeTimer > 0) {
      const intensity = this.shakeAmt * (this.shakeTimer / 0.5);
      sx = (Math.random() - 0.5) * intensity;
      sy = (Math.random() - 0.5) * intensity;
      ctx.translate(sx, sy);
    }

    // ── Sky gradient ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CH);
    if (biome === 'grass') {
      skyGrad.addColorStop(0, '#0f1f4a');
      skyGrad.addColorStop(0.6, '#1a3a6e');
      skyGrad.addColorStop(1, '#0d1b38');
    } else if (biome === 'cave') {
      skyGrad.addColorStop(0, '#1a0a2e');
      skyGrad.addColorStop(0.5, '#2d1059');
      skyGrad.addColorStop(1, '#0e0520');
    } else if (biome === 'jungle') {
      skyGrad.addColorStop(0, '#051b0f');
      skyGrad.addColorStop(0.5, '#0a3a20');
      skyGrad.addColorStop(1, '#031008');
    } else if (biome === 'sky') {
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(0.5, '#7dd3fc');
      skyGrad.addColorStop(1, '#e0f2fe');
    } else {
      skyGrad.addColorStop(0, '#200010');
      skyGrad.addColorStop(0.5, '#430018');
      skyGrad.addColorStop(1, '#0a0005');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CW, CH);

    // Flash overlay
    if (this.flashTimer > 0) {
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = this.flashTimer / 0.18;
      ctx.fillRect(0, 0, CW, CH);
      ctx.globalAlpha = 1;
    }

    // ── Stars ──
    if (biome !== 'sky') {
      ctx.save();
      for (const star of this.bgStars) {
        const blink = 0.6 + 0.4 * Math.sin(t * 1.5 + star.blink);
        ctx.globalAlpha = blink * 0.8;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        const sx2 = ((star.x - this.cameraX * 0.05) % (CW + 200) + CW + 200) % (CW + 200) - 100;
        ctx.arc(sx2, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Camera translate for world
    ctx.save();
    ctx.translate(-this.cameraX, 0);

    // ── Parallax clouds ──
    ctx.save();
    for (const cloud of this.bgClouds) {
      const cx = ((cloud.x - this.cameraX * 0.25) % (CW * 4 + 800) + CW * 4 + 800) % (CW * 4 + 800);
      this._drawCloud(ctx, cx, cloud.y, cloud.s);
    }
    ctx.restore();

    // ── Goal flag ──
    if (this.goalFlag) {
      this.goalFlag.wave = (this.goalFlag.wave || 0) + 0.05;
      const gf = this.goalFlag;
      // Pole
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(gf.x, gf.y, gf.w, gf.h);
      // Waving flag cloth
      ctx.beginPath();
      ctx.moveTo(gf.x + gf.w, gf.y + 5);
      for (let i = 0; i <= 10; i++) {
        const fx = gf.x + gf.w + (i / 10) * 70;
        const fy = gf.y + 5 + Math.sin(t * 4 + i * 0.8) * 8 + i * 4;
        ctx.lineTo(fx, fy);
      }
      ctx.lineTo(gf.x + gf.w + 70, gf.y + 60);
      for (let i = 10; i >= 0; i--) {
        const fx = gf.x + gf.w + (i / 10) * 70;
        const fy = gf.y + 60 + Math.sin(t * 4 + i * 0.8) * 8;
        ctx.lineTo(fx, fy);
      }
      ctx.closePath();
      ctx.fillStyle = '#34d399';
      ctx.fill();
      // Glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#34d399';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // ── Wind zones ──
    for (const zone of this.windZones) {
      const pulse = 0.35 + Math.sin(t * 3 + zone.phase) * 0.12;
      ctx.save();
      ctx.globalAlpha = 0.22 + pulse * 0.25;
      const windGrad = ctx.createLinearGradient(zone.x, zone.y, zone.x + zone.w, zone.y);
      windGrad.addColorStop(0, 'rgba(125,211,252,0.05)');
      windGrad.addColorStop(0.5, 'rgba(34,211,238,0.28)');
      windGrad.addColorStop(1, 'rgba(125,211,252,0.05)');
      ctx.fillStyle = windGrad;
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      ctx.strokeStyle = 'rgba(186,230,253,0.32)';
      ctx.lineWidth = 2;
      for (let wy = zone.y + 32; wy < zone.y + zone.h; wy += 44) {
        for (let wx = zone.x + 24; wx < zone.x + zone.w; wx += 82) {
          const dir = zone.forceX >= 0 ? 1 : -1;
          const offset = Math.sin(t * 4 + wx * 0.01 + wy * 0.03) * 12;
          ctx.beginPath();
          ctx.moveTo(wx - dir * 20 + offset, wy);
          ctx.lineTo(wx + dir * 24 + offset, wy);
          ctx.lineTo(wx + dir * 14 + offset, wy - 8);
          ctx.moveTo(wx + dir * 24 + offset, wy);
          ctx.lineTo(wx + dir * 14 + offset, wy + 8);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // ── Platforms ──
    for (const plat of this.platforms) {
      if (!plat.active) {
        if (plat.type === 'crumble' && plat.respawnTimer > 0) {
          ctx.save();
          ctx.globalAlpha = 0.22 + Math.sin(t * 8) * 0.06;
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 8]);
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
          ctx.restore();
        }
        continue;
      }
      if (plat.isGate) {
        // Gate wall
        const gGrad = ctx.createLinearGradient(plat.x, 0, plat.x + plat.w, 0);
        gGrad.addColorStop(0, '#7c3aed');
        gGrad.addColorStop(1, '#c084fc');
        ctx.fillStyle = gGrad;
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        // Bars
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let y = plat.y; y < plat.y + plat.h; y += 24) {
          ctx.fillRect(plat.x, y, plat.w, 10);
        }
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#c084fc';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        ctx.shadowBlur = 0;
      } else if (plat.moveY || plat.vx) {
        // Moving platform — glowing orange
        ctx.fillStyle = '#78350f';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        const mpGrad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
        mpGrad.addColorStop(0, '#f59e0b');
        mpGrad.addColorStop(0.3, '#d97706');
        mpGrad.addColorStop(1, '#92400e');
        ctx.fillStyle = mpGrad;
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h - 4);
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#f59e0b';
        ctx.fillStyle = '#fdba74';
        ctx.fillRect(plat.x, plat.y, plat.w, 5);
        ctx.shadowBlur = 0;
      } else if (plat.type === 'tilt') {
        ctx.save();
        ctx.translate(plat.x + plat.w / 2, plat.y + plat.h / 2);
        ctx.rotate(plat.tiltAngle || 0);
        const boardGrad = ctx.createLinearGradient(0, -plat.h / 2, 0, plat.h / 2);
        boardGrad.addColorStop(0, '#38bdf8');
        boardGrad.addColorStop(0.55, '#0ea5e9');
        boardGrad.addColorStop(1, '#075985');
        ctx.fillStyle = '#082f49';
        ctx.fillRect(-plat.w / 2 - 3, -plat.h / 2 + 4, plat.w + 6, plat.h);
        ctx.fillStyle = boardGrad;
        ctx.beginPath();
        rr(ctx, -plat.w / 2, -plat.h / 2, plat.w, plat.h, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(-plat.w / 2 + 8, -plat.h / 2 + 4, plat.w - 16, 4);
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (plat.type === 'crumble') {
        const jitter = plat.crumbleTimer !== null ? (Math.random() - 0.5) * 5 * (plat.shake || 1) : 0;
        ctx.save();
        ctx.translate(jitter, 0);
        const cGrad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
        cGrad.addColorStop(0, '#facc15');
        cGrad.addColorStop(0.45, '#d97706');
        cGrad.addColorStop(1, '#78350f');
        ctx.fillStyle = '#451a03';
        ctx.fillRect(plat.x, plat.y + 4, plat.w, plat.h);
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        rr(ctx, plat.x, plat.y, plat.w, plat.h, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(69,26,3,0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(plat.x + plat.w * 0.25, plat.y + 4);
        ctx.lineTo(plat.x + plat.w * 0.38, plat.y + plat.h - 5);
        ctx.moveTo(plat.x + plat.w * 0.58, plat.y + 3);
        ctx.lineTo(plat.x + plat.w * 0.5, plat.y + plat.h - 4);
        ctx.moveTo(plat.x + plat.w * 0.74, plat.y + 5);
        ctx.lineTo(plat.x + plat.w * 0.86, plat.y + plat.h - 6);
        ctx.stroke();
        if (plat.crumbleTimer !== null) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(plat.x, plat.y, plat.w * Math.max(0, plat.crumbleTimer / plat.crumbleDelay), 4);
        }
        ctx.restore();
      } else if (plat.type === 'stone') {
        // Stone step
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.fillStyle = '#334155';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h - 4);
        // Brick lines
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        for (let y = plat.y; y < plat.y + plat.h; y += 22) ctx.strokeRect(plat.x, y, plat.w, 22);
        ctx.fillStyle = '#475569';
        ctx.fillRect(plat.x, plat.y, plat.w, 6);
      } else if (biome === 'sky') {
        // Cloud platform
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        rr(ctx, plat.x, plat.y, plat.w, plat.h, 20); // very rounded
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        rr(ctx, plat.x, plat.y, plat.w, Math.min(plat.h, 20), 20);
        ctx.fill();
      } else if (biome === 'volcano') {
        // Volcano platform
        ctx.fillStyle = '#3a0c0c';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.fillStyle = '#1a0000';
        ctx.fillRect(plat.x, plat.y + 16, plat.w, plat.h - 16);
        ctx.fillStyle = '#ef4444'; // lava top
        ctx.fillRect(plat.x, plat.y, plat.w, 16);
        ctx.fillStyle = 'rgba(239,68,68,0.3)';
        ctx.fillRect(plat.x, plat.y, plat.w, 4);
      } else if (biome === 'jungle') {
        // Jungle platform
        ctx.fillStyle = '#3f260f';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.fillStyle = '#271404';
        ctx.fillRect(plat.x, plat.y + 16, plat.w, plat.h - 16);
        ctx.fillStyle = '#16a34a'; // jungle rich green top
        ctx.fillRect(plat.x, plat.y, plat.w, 16);
        ctx.fillStyle = 'rgba(134,239,172,0.3)';
        ctx.fillRect(plat.x, plat.y, plat.w, 5);
        // Vines hanging down
        ctx.fillStyle = '#15803d';
        for (let bx = plat.x + 10; bx < plat.x + plat.w - 10; bx += 30) {
          ctx.fillRect(bx, plat.y + 16, 4, 15 + ((bx % 7) * 2));
        }
      } else if (biome === 'cave') {
        ctx.fillStyle = '#24133f';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.fillStyle = '#130a24';
        ctx.fillRect(plat.x, plat.y + 16, plat.w, plat.h - 16);
        ctx.fillStyle = '#8b5cf6';
        ctx.fillRect(plat.x, plat.y, plat.w, 16);
        ctx.fillStyle = 'rgba(216,180,254,0.28)';
        ctx.fillRect(plat.x, plat.y, plat.w, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        for (let bx = plat.x + 14; bx < plat.x + plat.w - 10; bx += 38) {
          ctx.fillRect(bx, plat.y + 24, 16, 4);
        }
      } else {
        // Normal Grass platform (Level 1 & 2)
        ctx.fillStyle = '#1e3a2e';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.fillStyle = '#2d4a3e';
        ctx.fillRect(plat.x, plat.y + 16, plat.w, plat.h - 16);
        // Grass top
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(plat.x, plat.y, plat.w, 16);
        // Highlight
        ctx.fillStyle = 'rgba(134,239,172,0.3)';
        ctx.fillRect(plat.x, plat.y, plat.w, 5);
        // Grass blades
        ctx.fillStyle = '#4ade80';
        for (let bx = plat.x + 10; bx < plat.x + plat.w - 5; bx += 22) {
          ctx.fillRect(bx, plat.y - 6, 3, 8);
          ctx.fillRect(bx + 8, plat.y - 4, 2, 6);
        }
      }
    }

    // ── Timed hazards ──
    for (const hazard of this.timedHazards) {
      ctx.save();
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      rr(ctx, hazard.x - 4, hazard.y + hazard.h - 12, hazard.w + 8, 16, 5);
      ctx.fill();
      ctx.fillStyle = hazard.warning ? '#facc15' : '#7f1d1d';
      ctx.fillRect(hazard.x + 4, hazard.y + hazard.h - 17, hazard.w - 8, 7);
      if (hazard.active) {
        const flame = ctx.createLinearGradient(hazard.x, hazard.y, hazard.x, hazard.y + hazard.h);
        flame.addColorStop(0, 'rgba(254,240,138,0.95)');
        flame.addColorStop(0.45, 'rgba(249,115,22,0.92)');
        flame.addColorStop(1, 'rgba(220,38,38,0.1)');
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#f97316';
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.moveTo(hazard.x + hazard.w * 0.5, hazard.y + Math.sin(t * 16 + hazard.phase) * 7);
        ctx.bezierCurveTo(hazard.x - 12, hazard.y + hazard.h * 0.36, hazard.x + 6, hazard.y + hazard.h * 0.78, hazard.x + hazard.w * 0.16, hazard.y + hazard.h);
        ctx.bezierCurveTo(hazard.x + hazard.w * 0.42, hazard.y + hazard.h * 0.82, hazard.x + hazard.w * 0.66, hazard.y + hazard.h * 0.72, hazard.x + hazard.w * 0.84, hazard.y + hazard.h);
        ctx.bezierCurveTo(hazard.x + hazard.w + 10, hazard.y + hazard.h * 0.58, hazard.x + hazard.w + 7, hazard.y + hazard.h * 0.26, hazard.x + hazard.w * 0.5, hazard.y);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // ── Springs ──
    for (const spring of this.springs) {
      const squish = spring.cooldown > 0 ? 5 : 0;
      ctx.save();
      ctx.fillStyle = '#0e7490';
      ctx.beginPath();
      rr(ctx, spring.x, spring.y + squish, spring.w, spring.h - squish, 5);
      ctx.fill();
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(spring.x + 5, spring.y + 3 + squish, spring.w - 10, 4);
      ctx.strokeStyle = '#cffafe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let sx = spring.x + 8; sx < spring.x + spring.w - 6; sx += 10) {
        ctx.moveTo(sx, spring.y + spring.h);
        ctx.lineTo(sx + 7, spring.y + 6 + squish);
      }
      ctx.stroke();
      ctx.restore();
    }

    // ── Ropes ──
    for (const rope of this.ropes) {
      ctx.save();
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rope.x, rope.y);
      for (let r = 1; r <= 12; r++) {
        const offset = (rope.length / 12) * r;
        ctx.lineTo(this._ropeX(rope, offset, 0), rope.y + offset);
      }
      ctx.stroke();
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(rope.x, rope.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      for (let r = 3; r <= 11; r += 3) {
        const offset = (rope.length / 12) * r;
        ctx.beginPath();
        ctx.arc(this._ropeX(rope, offset, 0), rope.y + offset, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── Spikes ──
    ctx.fillStyle = '#dc2626';
    for (const s of this.spikes) {
      for (let sx2 = s.x; sx2 < s.x + s.w; sx2 += 14) {
        ctx.beginPath();
        ctx.moveTo(sx2, s.y + s.h);
        ctx.lineTo(sx2 + 7, s.y);
        ctx.lineTo(Math.min(sx2 + 14, s.x + s.w), s.y + s.h);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,100,100,0.4)';
        ctx.fill();
        ctx.fillStyle = '#dc2626';
      }
    }

    // ── Coins ──
    for (const c of this.coins) {
      if (c.collected) continue;
      const cy2 = c.y + c.h / 2 + Math.sin(t * 4 + c.x * 0.01) * 4;
      ctx.save();
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, cy2, c.w / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#fbbf24';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, cy2, c.w / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Hearts ──
    for (const h of this.hearts) {
      if (h.collected) continue;
      const hy2 = h.y + Math.sin(t * 3 + h.x * 0.01) * 5;
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#fb7185';
      this._drawHeart(ctx, h.x + h.w / 2, hy2 + h.h / 2, h.w / 2, '#fb7185');
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Powerups ──
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      const puy = pu.y + Math.sin((pu.bob || 0) * 3) * 6;
      ctx.save();
      if (pu.type === 'star') {
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#fbbf24';
        this._drawStar(ctx, pu.x + pu.w / 2, puy + pu.h / 2, pu.w / 2, t);
        ctx.shadowBlur = 0;
      } else {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#a78bfa';
        ctx.fillStyle = '#7c3aed';
        ctx.beginPath();
        rr(ctx, pu.x, puy, pu.w, pu.h, 6);
        ctx.fill();
        ctx.fillStyle = '#e9d5ff';
        ctx.font = '700 14px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('2×', pu.x + pu.w / 2, puy + pu.h - 6);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // ── Projectiles ──
    for (const proj of this.projectiles) {
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#fbbf24';
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath();
      ctx.arc(proj.x + proj.w / 2, proj.y + proj.h / 2, proj.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Gate blocks / prompts ──
    ctx.textAlign = 'center';
    for (const gate of this.gates) {
      if (gate.cleared) continue;
      // Prompt bubble
      const bx = gate.blocks[1].x + gate.blocks[1].w / 2;
      this._drawPromptCard(ctx, bx, 136, 470, gate.promptData || { q: gate.prompt, skill: 'Review' }, '#7c3aed', '#1a1035', '#e9d5ff');

      // Answer blocks
      for (const b of gate.blocks) {
        if (b.hit && !b.isCorrect) continue;
        const bobY = b.y + Math.sin(t * 2.5 + (b.bob || 0)) * 5;
        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = b.hit ? '#34d399' : '#fbbf24';
        // Block body
        const bGrad = ctx.createLinearGradient(b.x, bobY, b.x, bobY + b.h);
        if (b.hit) {
          bGrad.addColorStop(0, '#34d399'); bGrad.addColorStop(1, '#059669');
        } else {
          bGrad.addColorStop(0, '#fde68a'); bGrad.addColorStop(1, '#f59e0b');
        }
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        rr(ctx, b.x, bobY, b.w, b.h, 10);
        ctx.fill();
        // Bump on top
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(b.x + 6, bobY + 4, b.w - 12, 6);
        // Bottom shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(b.x + 2, bobY + b.h - 8, b.w - 4, 8);
        ctx.shadowBlur = 0;
        // Text
        ctx.fillStyle = '#1a0f00';
        this._drawFittedText(ctx, b.text, b.x + b.w / 2, bobY + b.h / 2 + 7, b.w - 16, 17, 10, '800');
        ctx.restore();
      }
    }

    // ── Boss ──
    if (this.bossPhase && this.bossEntity && this.bossEntity.active && this.bossHealth > 0) {
      const be = this.bossEntity;
      const bAnim = t * 3;
      ctx.save();
      // Body shadow
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#dc2626';
      // Pulsing outline
      const pulse = 1 + Math.sin(bAnim) * 0.03;
      const bW = be.w * pulse, bH = be.h * pulse;
      const bX = be.x - (bW - be.w) / 2, bY = be.y - (bH - be.h) / 2;
      // Body
      const bosGrad = ctx.createRadialGradient(bX + bW / 2, bY + bH / 2, 10, bX + bW / 2, bY + bH / 2, bW / 2);
      bosGrad.addColorStop(0, '#ef4444');
      bosGrad.addColorStop(0.6, '#991b1b');
      bosGrad.addColorStop(1, '#450a0a');
      ctx.fillStyle = bosGrad;
      ctx.beginPath();
      rr(ctx, bX, bY, bW, bH, 20);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Eyes
      const eyeX = bX + bW * 0.28, eyeX2 = bX + bW * 0.68;
      const eyeY = bY + bH * 0.3;
      const eyeR = 14;
      [eyeX, eyeX2].forEach(ex => {
        ctx.fillStyle = '#fff1f2';
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.arc(ex + Math.sin(bAnim * 0.5) * 4, eyeY + 2, eyeR * 0.55, 0, Math.PI * 2);
        ctx.fill();
      });
      // Teeth
      ctx.fillStyle = '#fff';
      const mouthY = bY + bH * 0.65;
      for (let tx = bX + 20; tx < bX + bW - 10; tx += 22) {
        ctx.beginPath();
        ctx.moveTo(tx, mouthY);
        ctx.lineTo(tx + 11, mouthY + 20);
        ctx.lineTo(Math.min(tx + 22, bX + bW - 10), mouthY);
        ctx.fill();
      }
      // Health bar
      const barW = bW + 20;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); rr(ctx, bX - 10, bY - 28, barW, 16, 4); ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath(); rr(ctx, bX - 10, bY - 28, barW * (this.bossHealth / this.bossMaxHealth), 16, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(bX - 10, bY - 28, barW, 7);
      ctx.restore();

      // Boss gate blocks
      ctx.save();
      const bcx = this.bossGate.blocks[1].x + this.bossGate.blocks[1].w / 2;
      this._drawPromptCard(ctx, bcx, 136, 540, this.bossGate.promptData || { q: this.bossGate.prompt, skill: 'Review' }, '#dc2626', '#1a0505', '#fecaca');
      ctx.restore();

      for (const b of this.bossGate.blocks) {
        if (b.hit && !b.isCorrect) continue;
        const bobY = b.y + Math.sin(t * 2.5 + (b.bob || 0)) * 5;
        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = b.hit ? '#34d399' : '#ef4444';
        const bGrad = ctx.createLinearGradient(b.x, bobY, b.x, bobY + b.h);
        if (b.hit) {
          bGrad.addColorStop(0, '#34d399'); bGrad.addColorStop(1, '#059669');
        } else {
          bGrad.addColorStop(0, '#fca5a5'); bGrad.addColorStop(1, '#dc2626');
        }
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        rr(ctx, b.x, bobY, b.w, b.h, 10);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = b.hit ? '#052e16' : '#fff1f2';
        ctx.textAlign = 'center';
        this._drawFittedText(ctx, b.text, b.x + b.w / 2, bobY + b.h / 2 + 8, b.w - 16, 18, 10, '800');
        ctx.restore();
      }
    }

    // ── Enemies ──
    for (const e of this.enemies) {
      if (e.dead) continue;
      ctx.save();
      let col = '#ef4444';
      if (e.type === 'shooter') col = '#7c3aed';
      else if (e.type === 'flyer') col = '#ea580c';
      else if (e.type === 'chaser') col = '#65a30d';
      else if (e.type === 'pacer') col = '#0d9488';

      ctx.shadowBlur = 8;
      ctx.shadowColor = col;
      ctx.fillStyle = col;
      ctx.beginPath();
      rr(ctx, e.x, e.y, e.w, e.h, 8);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      rr(ctx, e.x + 2, e.y + 2, e.w - 4, 10, 6);
      ctx.fill();

      // Eyes
      const fl = e.vx === undefined ? true : e.vx >= 0;
      const ex1 = fl ? e.x + e.w * 0.55 : e.x + e.w * 0.3;
      const ex2 = fl ? e.x + e.w * 0.75 : e.x + e.w * 0.5;
      const ey = e.y + e.h * 0.3;
      if (e.type === 'flyer') {
        [e.x + 6, e.x + e.w - 14].forEach(ex => {
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex + 1, ey + 1, 2, 0, Math.PI * 2); ctx.fill();
        });
      } else if (e.type === 'shooter') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + e.h * 0.35, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath(); ctx.arc(e.x + e.w / 2 - 3, e.y + e.h * 0.35, 4, 0, Math.PI * 2); ctx.fill();
      } else {
        [ex1, ex2].forEach(ex => {
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex + (fl ? 1 : -1), ey + 1, 2, 0, Math.PI * 2); ctx.fill();
        });
      }
      ctx.restore();
    }

    // ── Sparks ──
    for (const s of this.sparks) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, s.life * 1.5);
      ctx.fillStyle = s.col;
      ctx.shadowBlur = 6;
      ctx.shadowColor = s.col;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r || 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Players ──
    for (const p of this.players) {
      if (p.dead) continue;

      // Invincible trail
      for (let i = 0; i < p.trailFrames.length; i++) {
        const tf = p.trailFrames[i];
        const alpha = (i / p.trailFrames.length) * 0.35;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(tf.x, tf.y, p.w, p.h);
        ctx.restore();
      }

      ctx.save();

      // Blinking when recently hit
      if (p.invincibleTimer > 0 && p.invincibleTimer < 1.5) {
        // Blink logic: hide every other 0.1s
        if (Math.floor(p.invincibleTimer * 10) % 2 === 0) { ctx.restore(); continue; }
      }

      // Glow (star power)
      if (p.invincibleTimer > 1.5) {
        ctx.shadowBlur = 24;
        ctx.shadowColor = p.glow;
      }

      // Squash/stretch around foot pivot
      ctx.translate(p.x + p.w / 2, p.y + p.h);
      const scaleX = p.squash < 1 ? 1 / p.squash : p.squash;
      const scaleY = p.squash;
      ctx.scale(scaleX, scaleY);

      // Tilt
      const tilt = Math.max(-0.12, Math.min(0.12, p.vx * 0.00035));
      ctx.rotate(tilt);

      const legSwing = p.grounded && Math.abs(p.vx) > 20 ? Math.sin(p.animTime * 14) * 9 : 0;
      const shoeCol = p.bootTimer > 0 ? '#7c3aed' : '#1e293b';
      this._drawRunnerCharacter(ctx, p, legSwing, shoeCol);

      ctx.restore();
      ctx.shadowBlur = 0;
    }

    // ── Float texts ──
    ctx.save();
    ctx.textAlign = 'center';
    for (const ft of this.floatTexts) {
      const alpha = Math.min(1, ft.life * 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.font = '900 20px Outfit';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.restore(); // end camera translate

    // ── HUD overlays (fixed to canvas) ──
    if (this.state === 'playing') {
      // Timer
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '700 22px Outfit';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(CW / 2 - 60, 10, 120, 32);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`⏱ ${this.levelTime.toFixed(1)}s`, CW / 2, 32);
      ctx.restore();

      // Combo indicator
      if (this.combo > 1) {
        ctx.save();
        ctx.textAlign = 'right';
        ctx.font = `900 ${18 + this.combo * 3}px Outfit`;
        ctx.fillStyle = `hsl(${40 + this.combo * 15}, 95%, 60%)`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fbbf24';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 3;
        ctx.strokeText(`×${this.combo} COMBO`, CW - 20, 50);
        ctx.fillText(`×${this.combo} COMBO`, CW - 20, 50);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // In-canvas lives HUD (compact)
      ctx.save();
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        const startX = 16;
        const startY = 16 + i * 52;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        rr(ctx, startX, startY, 130, 44, 8);
        ctx.fill();
        
        ctx.fillStyle = p.color;
        ctx.font = '800 14px Outfit';
        ctx.textAlign = 'left';
        ctx.fillText(`P${p.id}`, startX + 10, startY + 18);
        
        // Coin icon directly drawn
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.arc(startX + 46, startY + 13, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(startX + 46, startY + 13, 2.5, 0, Math.PI * 2); ctx.fill();
        
        // Coin text
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`${p.coinsCollected}/20`, startX + 54, startY + 18);
        
        // Lives
        for (let j = 0; j < Math.min(5, p.lives); j++) {
            this._drawHeart(ctx, startX + 16 + j * 16, startY + 32, 6, '#fb7185');
        }
        if (p.lives > 5) {
            ctx.fillStyle = '#fb7185';
            ctx.font = '700 12px Outfit';
            ctx.fillText(`+${p.lives - 5}`, startX + 16 + 5 * 16, startY + 36);
        }

        // Boots / star icon
        if (p.bootTimer > 0) { ctx.fillStyle = '#a78bfa'; ctx.font = '700 12px Outfit'; ctx.fillText('2×↑', startX + 90, startY + 36); }
        if (p.invincibleTimer > 1.5) { ctx.fillStyle = '#fbbf24'; ctx.font = '700 14px Outfit'; ctx.fillText('★', startX + 115, startY + 36); }
      }
      ctx.restore();
      this._drawLessonToast(ctx);
      this._drawStageBanner(ctx);
    }
  }

  // ─── Draw Helpers ───
  _drawStageBanner(ctx) {
    if (!this.stageBannerTimer || this.stageBannerTimer <= 0) return;
    const stage = this._getStage();
    const alpha = Math.min(1, this.stageBannerTimer / 0.8);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(5,8,20,0.78)';
    ctx.beginPath();
    rr(ctx, CW / 2 - 250, 74, 500, 84, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 26px Outfit';
    ctx.fillText(`Level ${stage.id}: ${stage.name}`, CW / 2, 108);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 14px Outfit';
    ctx.fillText(`${ACADEMIC_TRACKS[this.currentTrack]?.label || 'Mixed'} - ${this.currentDifficulty} - ${stage.focus}`, CW / 2, 135);
    ctx.restore();
  }

  _drawLessonToast(ctx) {
    if (!this.lessonToast) return;
    const toast = this.lessonToast;
    const alpha = Math.min(1, toast.timer / 0.45);
    const lines = this._wrapText(ctx, toast.text, 560, '700 15px Outfit').slice(0, 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = toast.correct ? 'rgba(5,46,22,0.9)' : 'rgba(69,10,10,0.92)';
    ctx.beginPath();
    rr(ctx, CW / 2 - 315, CH - 92, 630, 70, 12);
    ctx.fill();
    ctx.strokeStyle = toast.correct ? '#34d399' : '#f87171';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = toast.correct ? '#bbf7d0' : '#fecaca';
    ctx.font = '800 12px Outfit';
    ctx.fillText(`${toast.correct ? 'Correct' : 'Review'} - ${toast.skill}`, CW / 2, CH - 66);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 15px Outfit';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], CW / 2, CH - 43 + i * 18);
    }
    ctx.restore();
  }

  _drawPromptCard(ctx, cx, y, w, promptData, borderColor, fillColor, textColor) {
    const prompt = this._normalizePrompt(promptData);
    const lines = this._wrapText(ctx, prompt.q, w - 34, '700 18px Outfit');
    const h = Math.max(66, 42 + lines.length * 20);
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = `${borderColor}88`;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    rr(ctx, cx - w / 2, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    ctx.fillStyle = borderColor;
    ctx.font = '800 11px Outfit';
    ctx.fillText(`${prompt.track || 'Skill'} - ${prompt.skill || 'Review'}`, cx, y + 17);

    ctx.fillStyle = textColor;
    ctx.font = '700 18px Outfit';
    const firstY = y + 40;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, firstY + i * 20);
    }
    ctx.restore();
  }

  _wrapText(ctx, text, maxWidth, font) {
    ctx.save();
    ctx.font = font;
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    ctx.restore();
    return lines.slice(0, 3);
  }

  _drawFittedText(ctx, text, cx, cy, maxWidth, startSize, minSize, weight = '800') {
    let size = startSize;
    const content = String(text);
    do {
      ctx.font = `${weight} ${size}px Outfit`;
      if (ctx.measureText(content).width <= maxWidth) break;
      size--;
    } while (size > minSize);
    ctx.textAlign = 'center';
    ctx.fillText(content, cx, cy);
  }

  _drawRunnerCharacter(ctx, p, legSwing, shoeCol) {
    const dir = p.facingRight ? 1 : -1;
    const skin = '#f4c28b';
    const skinShadow = '#d8915f';
    const cheek = '#f8d0a5';
    const hair = '#3f2416';
    const outfit = p.id === 1
      ? { cap: '#ef4444', capDark: '#b91c1c', shirt: '#ef4444', overalls: '#2563eb', trim: '#bfdbfe', badge: '#facc15' }
      : { cap: '#22c55e', capDark: '#15803d', shirt: '#22c55e', overalls: '#166534', trim: '#bbf7d0', badge: '#dcfce7' };
    const armSwing = p.grounded && Math.abs(p.vx) > 20 ? Math.sin(p.animTime * 14 + Math.PI) * 5 : 1;
    const kneeA = legSwing * 0.22;
    const kneeB = -legSwing * 0.22;

    ctx.save();
    ctx.scale(dir, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Back arm and sleeve
    ctx.strokeStyle = outfit.shirt;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-9, -29);
    ctx.lineTo(-14 - armSwing * 0.18, -21 + armSwing * 0.16);
    ctx.stroke();
    ctx.strokeStyle = skinShadow;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-14 - armSwing * 0.18, -21 + armSwing * 0.16);
    ctx.lineTo(-16 - armSwing * 0.24, -12 + armSwing * 0.22);
    ctx.stroke();

    // Legs and shoes
    ctx.fillStyle = outfit.overalls;
    ctx.beginPath();
    rr(ctx, -9 + kneeA, -17, 8, 17, 3);
    ctx.fill();
    ctx.beginPath();
    rr(ctx, 2 + kneeB, -17, 8, 17, 3);
    ctx.fill();
    ctx.fillStyle = shoeCol;
    ctx.beginPath();
    rr(ctx, -13 + kneeA, -5, 15, 7, 3);
    ctx.fill();
    ctx.beginPath();
    rr(ctx, -1 + kneeB, -5, 15, 7, 3);
    ctx.fill();

    // Shirt and overalls
    ctx.fillStyle = outfit.shirt;
    ctx.beginPath();
    rr(ctx, -14, -33, 28, 18, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    rr(ctx, -9, -31, 18, 5, 3);
    ctx.fill();
    ctx.fillStyle = outfit.overalls;
    ctx.beginPath();
    rr(ctx, -10, -28, 20, 22, 5);
    ctx.fill();
    ctx.strokeStyle = outfit.trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7, -28);
    ctx.lineTo(-2, -17);
    ctx.moveTo(7, -28);
    ctx.lineTo(2, -17);
    ctx.stroke();
    ctx.fillStyle = outfit.badge;
    ctx.beginPath();
    ctx.arc(-4, -19, 2, 0, Math.PI * 2);
    ctx.arc(4, -19, 2, 0, Math.PI * 2);
    ctx.fill();

    // Front arm and sleeve
    ctx.strokeStyle = outfit.shirt;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(10, -29);
    ctx.lineTo(15 + armSwing * 0.2, -21 - armSwing * 0.16);
    ctx.stroke();
    ctx.strokeStyle = skin;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(15 + armSwing * 0.2, -21 - armSwing * 0.16);
    ctx.lineTo(17 + armSwing * 0.26, -12 - armSwing * 0.22);
    ctx.stroke();

    // Neck, ears, and larger front-readable head
    ctx.fillStyle = skinShadow;
    ctx.fillRect(-4, -36, 8, 6);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(-8, -41, 3.2, 0, Math.PI * 2);
    ctx.arc(8, -41, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -42, 10.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cheek;
    ctx.beginPath();
    ctx.arc(0, -40, 7.7, 0, Math.PI * 2);
    ctx.fill();

    // Hair and cap read from the front, with a small brim pointing forward.
    ctx.fillStyle = hair;
    ctx.beginPath();
    rr(ctx, -9, -49, 18, 9, 5);
    ctx.fill();
    ctx.fillStyle = outfit.capDark;
    ctx.beginPath();
    rr(ctx, -11, -52, 22, 7, 5);
    ctx.fill();
    ctx.fillStyle = outfit.cap;
    ctx.beginPath();
    rr(ctx, -12, -50, 24, 8, 5);
    ctx.fill();
    ctx.beginPath();
    rr(ctx, 1, -47, 14, 5, 3);
    ctx.fill();
    ctx.fillStyle = outfit.badge;
    ctx.beginPath();
    ctx.arc(0, -47, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Face details
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(-3.5, -42, 1.5, 0, Math.PI * 2);
    ctx.arc(4.5, -42, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skinShadow;
    ctx.beginPath();
    ctx.arc(1.5, -39, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0.5, -37, 4, 0.1 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();

    // Tiny chest badge for local co-op readability.
    ctx.save();
    ctx.scale(dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(0, -18, 5.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '800 6px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(`P${p.id}`, 0, -16);
    ctx.restore();

    ctx.restore();
  }

  _drawHeart(ctx, cx, cy, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx - r * 0.45, cy - r * 0.2, r * 0.45, Math.PI, 0);
    ctx.arc(cx + r * 0.45, cy - r * 0.2, r * 0.45, Math.PI, 0);
    ctx.lineTo(cx, cy + r * 0.9);
    ctx.fill();
  }

  _drawStar(ctx, cx, cy, r, t) {
    const rot = t * 1.2;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = rot + (i * Math.PI) / 5;
      const rr2 = i % 2 === 0 ? r : r * 0.42;
      if (i === 0) ctx.moveTo(cx + Math.cos(angle) * rr2, cy + Math.sin(angle) * rr2);
      else ctx.lineTo(cx + Math.cos(angle) * rr2, cy + Math.sin(angle) * rr2);
    }
    ctx.closePath();
    ctx.fill();
  }

  _drawCloud(ctx, x, y, s) {
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#e2e8f0';
    const puffs = [[0, 0, 38], [-30, 12, 28], [30, 10, 32], [60, 16, 22], [-55, 16, 20]];
    for (const [px, py, pr] of puffs) {
      ctx.beginPath();
      ctx.arc(x + px * s, y + py * s, pr * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ─── Loop ───
  _loop(ts) {
    const dt = Math.min((ts - (this.lastTs || ts)) / 1000, 0.05);
    this.lastTs = ts;
    this._update(dt);
    this._draw();
    requestAnimationFrame((ts) => this._loop(ts));
  }
}

window.addEventListener('DOMContentLoaded', () => { new WordRunner(); });
