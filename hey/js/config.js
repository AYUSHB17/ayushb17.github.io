// Everything personal lives here: how tiny-you looks, what you say, and the
// conversation script. Edit freely — no build step, just reload.
//
// Script lines are [text, mood]. Moods: happy, excited, laugh, giggle, love,
// shy, blush, surprised, think, cry, puppy, chill, jump, rocket, flowers, wave,
// nod, dance, spin, neutral. Leave the mood out to guess it from the text.
// {name} becomes her name.
window.MEETCUTE = {
  me: {
    name: 'Ayush',
    avatar: {
      skin: '#c98b5f',
      hair: '#1d1512',
      hairStyle: 'spiky',      // short | spiky | side | long | bob | ponytail | bun | curly
      outfit: 'hoodie',        // tee | hoodie | shirt | jacket | kurta | dress
      outfitColor: '#2f3d6b',
      pants: '#25252f',
      glasses: false,
      beard: true,
    },
  },

  // Look of both pages: midnight | cafe | pixel | park | scrapbook | glass.
  // Preview them all at /themes.html.
  theme: 'midnight',
  // How the avatars are drawn: chibi, anime, pixel, game, clay, sketch, storybook
  // (compare them at /hey/avatars.html). ?art=name in a URL overrides it.
  art: 'chibi',

  // Squeaky mini voices: base pitch in Hz. Higher = tinier.
  voices: { me: { pitch: 470 }, her: { pitch: 660 } },

  // The opening lines, typed out one by one before anything else happens.
  intro: [
    'hey you 👋',
    'okay, this is a little unusual…',
    "but I thought you were really cute,",
    'and just saying it felt too easy.',
    'so I made you a tiny website instead ✨',
  ],

  script: {
    start: {
      say: [['oh. hey {name} 👋', 'chill'], ["I'm Ayush. the pocket-sized edition", 'happy'],
        ['the full-size one is right in front of you, pretending to be calm 😅', 'blush']],
      next: 'qr',
    },
    qr: {
      say: [['so be honest… is the QR code thing too much?', 'think']],
      options: [
        { text: 'lol a little 😂', next: 'toomuch' },
        { text: 'no, it’s actually cute', next: 'cute' },
        { text: 'who even does this 💀', next: 'who' },
      ],
    },
    toomuch: { say: [['haha fair 😂', 'laugh'], ['in my defence, my pickup lines are worse', 'shy']], next: 'about' },
    cute: { say: [['oh. cool. cool cool cool', 'chill'], ['(tiny me is screaming internally)', 'rocket']], next: 'about' },
    who: { say: [['apparently… me 😂', 'laugh'], ['a guy who builds things instead of using normal words', 'happy']], next: 'about' },

    about: {
      say: [['quick facts about me:', 'chill'], ['I build software, mostly things that run on servers you never see', 'happy'],
        ['and occasionally websites for strangers I want to talk to. no big deal', 'chill']],
      next: 'her',
    },
    her: {
      say: [['okay your turn — what are you up to today?', 'think']],
      options: [
        { text: 'just out with friends', next: 'friends' },
        { text: 'running errands 🛒', next: 'errands' },
        { text: 'not telling a stranger 😏', next: 'mystery' },
      ],
    },
    friends: { say: [['nice, then I won’t keep you long 🙂', 'happy']], next: 'ask' },
    errands: { say: [['ah the glamorous life 😄', 'laugh']], next: 'ask' },
    mystery: { say: [['respect. mysterious. noted 🕵️', 'laugh']], next: 'ask' },

    ask: {
      say: [['okay. being brave now…', 'blush'], ['I got you something 💐', 'flowers']],
      // Floats mid-screen. "yes" is huge; "no" is tiny, wanders the screen and
      // jumps away `dodges.length` times when caught, then stops and works. Typing "no" or "I'm seeing someone" always ends kindly.
      bigAsk: {
        text: 'would you go on a little coffee date with me? ☕',
        // `louder`: what yes turns into with each attempt at not choosing it (it grows every time too).
        yes: { text: 'yes 💖', next: 'yes',
          // Short words only: at full size a long word is wider than the phone.
          louder: ['YES 💖', 'YESSS 💖💖', 'YES!!! 💖💖💖', 'pls 🥺 yes 💖', 'yes yes yes 💖', 'still yes 😌'] },
        no: { text: 'maybe/no', next: 'maybe', dodges: ['maybe? 🤨', 'nope, too slow 🙈', 'you sure? 🥺', 'yes is getting bigger 👀'],
          giveUp: 'fine… maybe/no 😔' },
        fineprint: 'not your thing? just type no — tiny me will survive 🥲',
      },
    },
    yes: { say: [['WAIT REALLY?! 🥹', 'rocket'], ['…ahem. I mean. cool. 😎', 'chill'],
      ['leave your number or insta and I’ll text you (normally, promise)', 'happy']], contact: true, next: 'thanks' },
    maybe: { say: [['totally fair 🙂 no pressure at all', 'nod'], ['you can type anything here — real me is reading it', 'happy'],
      ['or leave your insta and we can talk later, no pressure', 'shy']], contact: true, next: 'thanks' },
    thanks: { say: [['saved 💌', 'love'], ['real me will text you soon. this was fun, {name}', 'happy']], next: 'chat' },
    chat: { say: [['feel free to keep chatting with me here 👀', 'wave']], end: true },

    taken: { say: [['ahh, lucky them 🙂', 'happy'], ['thanks for playing along anyway — you made my day', 'wave']], end: true, bye: true },
    no: { say: [['no worries at all 🙂', 'nod'], ['thanks for reading this far. have a lovely day ✨', 'wave']], end: true, bye: true },
  },

  // One-tap questions for her friends in whisper mode.
  whisperLines: [
    'okay be honest… what are my chances? 1–10 👀', 'what’s her favourite coffee? ☕', 'any tips for me? 🙏',
    'did the QR thing work or too much? 😅', 'what would make her say yes? 🥺', 'thank you, you’re the best 🫶',
  ],

  // One-tap lines on your /me screen.
  quickLines: [
    'hii 👋', 'haha 😂', 'that’s so cute 🥹', 'tell me more!',
    'want to grab a coffee sometime? ☕', 'can I get your number? 📱', 'you have a really nice smile',
  ],
};
