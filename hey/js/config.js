// Everything personal lives here: how tiny-you looks, what you say, and the
// conversation script. Edit freely — no build step, just reload.
//
// Script lines are [text, mood]. Moods: happy, excited, laugh, love, shy,
// surprised, think, sad, wave, nod, dance, neutral. {name} becomes her name.
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
      say: [['hiii {name}! 👋', 'wave'], ["I'm Ayush. well, a tiny version of him", 'happy'],
        ['the real one is standing right in front of you, probably nervous 😅', 'shy']],
      next: 'qr',
    },
    qr: {
      say: [['so be honest… is the QR code thing too much?', 'think']],
      options: [
        { text: 'lol a little 😂', next: 'toomuch' },
        { text: 'no, it’s actually cute', next: 'cute' },
        { text: 'who even does this 💀', next: 'who' },
      ],
      any: 'cute',
    },
    toomuch: { say: [['haha fair 😂', 'laugh'], ['in my defence, my pickup lines are worse', 'shy']], next: 'about' },
    cute: { say: [['okay that made tiny me blush 🙈', 'shy'], ['real me is doing a little dance inside', 'dance']], next: 'about' },
    who: { say: [['apparently… me 😂', 'laugh'], ['a guy who builds things instead of using normal words', 'happy']], next: 'about' },

    about: {
      say: [['quick facts about me:', 'excited'], ['I build software, mostly things that run on servers you never see', 'happy'],
        ['and occasionally websites for strangers I want to talk to', 'shy']],
      next: 'her',
    },
    her: {
      say: [['okay your turn — what are you up to today?', 'think']],
      options: [
        { text: 'just out with friends', next: 'friends' },
        { text: 'running errands 🛒', next: 'errands' },
        { text: 'not telling a stranger 😏', next: 'mystery' },
      ],
      any: 'heard',
    },
    friends: { say: [['nice, then I won’t keep you long 🙂', 'happy']], next: 'ask' },
    errands: { say: [['ah the glamorous life 😄', 'laugh']], next: 'ask' },
    mystery: { say: [['respect. mysterious. noted 🕵️', 'laugh']], next: 'ask' },
    heard: { say: [['that sounds nice 🙂', 'happy']], next: 'ask' },

    ask: {
      say: [['okay. being brave now…', 'shy'], ['would you want to grab a coffee with me sometime? ☕', 'love']],
      options: [
        { text: 'yes ☕', next: 'yes' },
        { text: 'maybe — talk more first', next: 'maybe' },
        { text: 'I’m seeing someone', next: 'taken' },
        { text: 'not interested, sorry', next: 'no' },
      ],
    },
    yes: { say: [['wait really?! 🥹', 'surprised'], ['okay okay, staying calm', 'dance'],
      ['leave your number or insta and I’ll text you (normally, promise)', 'happy']], contact: true, next: 'thanks' },
    maybe: { say: [['totally fair 🙂', 'nod'], ['you can type anything here — real me is reading it', 'happy'],
      ['or leave your insta and we can talk later, no pressure', 'shy']], contact: true, next: 'thanks' },
    thanks: { say: [['saved 💌', 'love'], ['real me will text you soon. this was fun, {name}', 'happy']], next: 'chat' },
    chat: { say: [['feel free to keep chatting with me here 👀', 'wave']], end: true },

    taken: { say: [['ahh, lucky them 🙂', 'happy'], ['thanks for playing along anyway — you made my day', 'wave']], end: true, bye: true },
    no: { say: [['no worries at all 🙂', 'nod'], ['thanks for reading this far. have a lovely day ✨', 'wave']], end: true, bye: true },
  },

  // Her free-text messages get one of these while you're not typing live.
  replies: {
    laugh: [['haha 😂', 'laugh'], ['okay that got a laugh out of me', 'laugh']],
    love: [['stop, I’m blushing 🙈', 'shy']],
    think: [['hmm good question… real me will answer that one 😄', 'think']],
    sad: [['aw 🥺', 'sad']],
    any: [['noted 😄', 'happy'], ['real me just read that 👀', 'excited'], ['ha, I like that', 'happy']],
  },

  // One-tap lines on your /me screen.
  quickLines: [
    'hii 👋', 'haha 😂', 'that’s so cute 🥹', 'tell me more!',
    'want to grab a coffee sometime? ☕', 'can I get your number? 📱', 'you have a really nice smile',
  ],
};
