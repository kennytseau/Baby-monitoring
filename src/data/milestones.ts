import type { MilestoneCategory } from '../lib/types'

/**
 * Developmental milestone reference, 0–24 months.
 *
 * Milestone selection is based on the CDC "Learn the Signs. Act Early."
 * checklists (2022 revision), which describe what MOST babies (75% or more)
 * do BY each age. Encouragement activities follow common CDC/AAP guidance.
 *
 * This is general information, not medical advice. Every baby develops at
 * her own pace — talk to your pediatrician about anything that concerns you.
 */

export interface MilestoneDef {
  id: string
  title: string
  category: MilestoneCategory
  /** What it looks like when she does it */
  description: string
  /** Concrete things you can do to help her get there */
  howToEncourage: string[]
}

export interface AgeBand {
  id: string
  /** e.g. "By 2 months" */
  label: string
  /** e.g. "2 mo" for compact UI */
  shortLabel: string
  /** Band applies from this age (months, inclusive)... */
  fromMonths: number
  /** ...up to this age (months, exclusive). */
  toMonths: number
  /** What she's likely doing in this window */
  overview: string
  milestones: MilestoneDef[]
}

export const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  social: 'Social & emotional',
  language: 'Language & hearing',
  cognitive: 'Thinking & learning',
  motor: 'Movement',
}

export const AGE_BANDS: AgeBand[] = [
  {
    id: 'newborn',
    label: 'Newborn (0–2 months)',
    shortLabel: '0–2 mo',
    fromMonths: 0,
    toMonths: 2,
    overview:
      'Right now her world is faces, voices, milk and sleep. Most of what she does is driven by newborn reflexes, but she is already learning fast: she knows your voice, prefers faces to anything else, and can see best at about 20–30 cm — roughly the distance to your face while feeding. Days and nights may still be mixed up, and crying is her main way of talking to you.',
    milestones: [
      {
        id: 'nb-looks-at-face',
        title: 'Gazes at your face',
        category: 'social',
        description:
          'She studies your face when you hold her close, especially your eyes and hairline. Faces are her favourite thing to look at.',
        howToEncourage: [
          'Hold her about 20–30 cm from your face during feeds and cuddles — that is where her vision is sharpest.',
          'Make slow, exaggerated expressions (wide eyes, big smiles, poking out your tongue) and give her time to respond.',
        ],
      },
      {
        id: 'nb-calms-to-voice',
        title: 'Calms to your voice and touch',
        category: 'social',
        description:
          'She settles (at least sometimes!) when you speak softly, hold her skin-to-skin, or rock her. She already recognises the voices she heard before birth.',
        howToEncourage: [
          'Talk and sing to her through everyday moments — nappy changes, baths, feeds.',
          'Try skin-to-skin time: it steadies her heart rate and temperature and is calming for both of you.',
        ],
      },
      {
        id: 'nb-startles-sounds',
        title: 'Reacts to sounds',
        category: 'language',
        description:
          'She startles at sudden loud noises (arms flinging out is the Moro reflex) and may quiet or turn toward a familiar voice.',
        howToEncourage: [
          'Notice how she responds to your voice from different sides — chat to her from the left, then the right.',
          'If she rarely reacts to sounds, mention it at a checkup; newborn hearing is easy to test.',
        ],
      },
      {
        id: 'nb-throaty-sounds',
        title: 'Makes little throaty sounds',
        category: 'language',
        description:
          'Beyond crying, she makes small grunts, sighs and squeaks — the very first raw material of speech.',
        howToEncourage: [
          'Answer her sounds as if she said something: pause, respond, and wait. This "serve and return" builds language from day one.',
          'Narrate what you are doing in a warm, sing-song voice ("parentese") — babies pay more attention to it.',
        ],
      },
      {
        id: 'nb-tummy-head-lift',
        title: 'Briefly lifts head in tummy time',
        category: 'motor',
        description:
          'Placed on her tummy while awake and supervised, she turns her head to the side and manages wobbly little lifts.',
        howToEncourage: [
          'Do short, frequent tummy time — 1–2 minutes a few times a day on your chest or a firm mat, always awake and supervised.',
          'Get down at her eye level and talk to her so she has a reason to lift and turn her head.',
        ],
      },
      {
        id: 'nb-grasps-finger',
        title: 'Grips your finger',
        category: 'motor',
        description:
          'Press a finger into her palm and she wraps her whole hand around it — the grasp reflex.',
        howToEncourage: [
          'Offer a finger during feeds and let her hold on.',
          'Gently uncurl and massage her hands; over the coming weeks her fists will relax open more often.',
        ],
      },
    ],
  },
  {
    id: 'm2',
    label: 'By 2 months',
    shortLabel: '2 mo',
    fromMonths: 2,
    toMonths: 4,
    overview:
      'The fog is lifting: she is awake for longer stretches and starting to feel like company. The big headline of this window is the social smile — a real, aimed-at-you smile. She is also finding her voice with the first coos, and getting stronger at holding up that heavy head.',
    milestones: [
      {
        id: 'm2-social-smile',
        title: 'Smiles when you talk or smile at her',
        category: 'social',
        description:
          'Not a sleepy reflex smile — a real one, in response to you. One of the best moments of the whole first year.',
        howToEncourage: [
          'Get face to face when she is calm and alert, smile big, and chat — then wait and give her time to smile back.',
          'Repeat whatever earns a smile. Babies love a running joke.',
        ],
      },
      {
        id: 'm2-calms-when-spoken-to',
        title: 'Calms down when spoken to or picked up',
        category: 'social',
        description: 'Your voice and arms are becoming reliable comfort — she settles faster for familiar people.',
        howToEncourage: [
          'Respond consistently when she cries; at this age you cannot spoil her, you are teaching her the world is safe.',
          'Use a calm, steady voice and slow rocking when she is upset.',
        ],
      },
      {
        id: 'm2-looks-at-face',
        title: 'Looks at your face and seems happy to see you',
        category: 'social',
        description: 'She holds eye contact, watches your face intently, and brightens when you come close.',
        howToEncourage: [
          'Build in unhurried face-to-face time — after feeds is often a good alert window.',
          'Play simple copying games: stick out your tongue, open your mouth wide, and see if she mirrors you.',
        ],
      },
      {
        id: 'm2-coos',
        title: 'Makes sounds other than crying (cooing)',
        category: 'language',
        description: 'Soft vowel sounds — "ooh", "aah", little gurgles — usually when she is content and looking at you.',
        howToEncourage: [
          'Have "conversations": when she coos, coo back, pause, and let her take another turn.',
          'Sing to her — the melody and rhythm of songs are great for her listening skills.',
        ],
      },
      {
        id: 'm2-reacts-loud-sounds',
        title: 'Reacts to loud sounds',
        category: 'language',
        description: 'She startles, blinks, quiets, or turns toward sudden or interesting sounds.',
        howToEncourage: [
          'Use a rattle or your voice from different directions and watch her respond.',
          'Keep talking to her throughout the day — hearing language is how she learns it.',
        ],
      },
      {
        id: 'm2-watches-you-move',
        title: 'Watches you as you move',
        category: 'cognitive',
        description: 'Her eyes track you across the room, and she can follow a slow-moving toy with her gaze.',
        howToEncourage: [
          'Move a high-contrast toy slowly from side to side about 30 cm from her face and let her track it.',
          'Walk around while chatting to her so she practises following you with her eyes.',
        ],
      },
      {
        id: 'm2-looks-at-toy',
        title: 'Looks at a toy for several seconds',
        category: 'cognitive',
        description: 'She locks onto interesting objects — bold patterns, faces and high-contrast colours hold her attention best.',
        howToEncourage: [
          'Offer one thing to look at at a time; a cluttered scene is hard for her to process.',
          'Black-and-white or high-contrast pictures are easiest for young eyes.',
        ],
      },
      {
        id: 'm2-head-up-tummy',
        title: 'Holds head up in tummy time',
        category: 'motor',
        description: 'On her tummy she lifts her head to about 45 degrees and holds it, wobbly but determined.',
        howToEncourage: [
          'Work up to 15–30 total minutes of tummy time a day, in short bursts.',
          'Put a mirror or a favourite toy just in front of her to make lifting her head worth the effort.',
        ],
      },
      {
        id: 'm2-moves-arms-legs',
        title: 'Moves both arms and both legs',
        category: 'motor',
        description: 'Lots of symmetrical wiggling, kicking and arm-waving when she is excited.',
        howToEncourage: [
          'Give her free-kicking time on a mat without a swaddle, in just a nappy or comfy clothes.',
          'Gently cycle her legs during changes and let her push her feet against your hands.',
        ],
      },
      {
        id: 'm2-opens-hands',
        title: 'Opens hands briefly',
        category: 'motor',
        description: 'The newborn fists start to relax — you will see her hands open for moments at a time.',
        howToEncourage: [
          'Stroke the back of her hand to invite it open.',
          'Lay a light rattle across her open palm for a moment of holding practice.',
        ],
      },
    ],
  },
  {
    id: 'm4',
    label: 'By 4 months',
    shortLabel: '4 mo',
    fromMonths: 4,
    toMonths: 6,
    overview:
      'She is turning into a giggly, grabby little person. Expect chuckles, deliberate reaching for toys, everything heading to her mouth, and proper "conversations" of coos and squeals. Head control is getting solid, and she may surprise you with a first roll — never leave her alone on a raised surface now.',
    milestones: [
      {
        id: 'm4-smiles-for-attention',
        title: 'Smiles on her own to get your attention',
        category: 'social',
        description: 'She now starts the interaction — catching your eye and smiling to pull you in.',
        howToEncourage: [
          'Reward those bids for attention: smile back, talk to her, pick her up.',
          'Play peekaboo and watch her light up when your face reappears.',
        ],
      },
      {
        id: 'm4-chuckles',
        title: 'Chuckles when you make her laugh',
        category: 'social',
        description: 'Not quite a full belly laugh yet, but real chuckles at funny faces, kisses and tickles.',
        howToEncourage: [
          'Find her comedy buttons: gentle tummy kisses, silly noises, exaggerated surprise faces.',
          'Repeat what works — anticipation is half the fun for her.',
        ],
      },
      {
        id: 'm4-gets-attention',
        title: 'Moves or makes sounds to keep your attention',
        category: 'social',
        description: 'She wriggles, squeals or babbles at you when she wants the interaction to continue.',
        howToEncourage: [
          'When she "calls" you, respond — she is learning her signals matter.',
          'Pause mid-game and wait; she will often do something to restart it.',
        ],
      },
      {
        id: 'm4-coos-back',
        title: 'Coos and makes sounds back when you talk',
        category: 'language',
        description: 'Long strings of "oooo" and "aahh", traded back and forth with you like a conversation.',
        howToEncourage: [
          'Take clear turns: she coos, you answer, then wait for her reply.',
          'Copy her exact sounds back to her — babies find this fascinating.',
        ],
      },
      {
        id: 'm4-turns-to-voice',
        title: 'Turns her head toward your voice',
        category: 'language',
        description: 'Speak from across the room and she turns to find you.',
        howToEncourage: [
          'Call her name warmly from different spots before you come into view.',
          'Keep background noise (TV) low sometimes so your voice is easy to find.',
        ],
      },
      {
        id: 'm4-opens-mouth-food',
        title: 'Opens mouth when she sees breast or bottle',
        category: 'cognitive',
        description: 'She recognises what is coming and gets ready — memory and anticipation at work.',
        howToEncourage: [
          'Use a consistent little routine before feeds so she can predict them.',
          'Name what is happening: "Milk time!" — routines plus words build understanding.',
        ],
      },
      {
        id: 'm4-looks-at-hands',
        title: 'Looks at her hands with interest',
        category: 'cognitive',
        description: 'She discovers her own hands, staring at them and slowly figuring out they belong to her.',
        howToEncourage: [
          'Give her unswaddled play time to find and study her hands.',
          'Try soft wrist rattles or gently clap her hands together in a song.',
        ],
      },
      {
        id: 'm4-holds-head-steady',
        title: 'Holds head steady without support',
        category: 'motor',
        description: 'When you hold her upright, her head no longer flops — it stays steady as she looks around.',
        howToEncourage: [
          'Carry her upright facing out or over your shoulder so she practises balancing that head.',
          'Keep up daily tummy time — it builds the same neck and shoulder muscles.',
        ],
      },
      {
        id: 'm4-holds-toy',
        title: 'Holds a toy you put in her hand',
        category: 'motor',
        description: 'She grips a rattle or soft toy and may wave it (and bonk herself — normal!).',
        howToEncourage: [
          'Offer light, easy-to-grip toys like rings and soft rattles.',
          'Alternate hands so both get practice.',
        ],
      },
      {
        id: 'm4-swings-at-toys',
        title: 'Uses her arm to swing at toys',
        category: 'motor',
        description: 'She bats at dangling toys on purpose — early hand-eye coordination.',
        howToEncourage: [
          'Use a play gym with dangling toys just within reach.',
          'Hold a toy where she can swipe it and celebrate every hit.',
        ],
      },
      {
        id: 'm4-hands-to-mouth',
        title: 'Brings hands to her mouth',
        category: 'motor',
        description: 'Hands (and everything in them) go straight to her mouth — that is how babies explore.',
        howToEncourage: [
          'Provide safe, clean teething-friendly toys to gnaw.',
          'Let her self-soothe with her hands; it is a genuine skill.',
        ],
      },
      {
        id: 'm4-pushes-up-elbows',
        title: 'Pushes up onto elbows in tummy time',
        category: 'motor',
        description: 'On her tummy she props on her forearms, chest off the mat, head high and looking around.',
        howToEncourage: [
          'Place toys slightly above her sightline in tummy time so she pushes up to see them.',
          'Lie facing her — you are still her favourite reason to lift up.',
        ],
      },
    ],
  },
  {
    id: 'm6',
    label: 'By 6 months',
    shortLabel: '6 mo',
    fromMonths: 6,
    toMonths: 9,
    overview:
      'Half a year! She is likely laughing out loud, rolling, grabbing everything in reach and putting it straight in her mouth, and blowing raspberries. She clearly knows her people now. Many babies start solid foods around this age (ask your pediatrician), and sitting with support is becoming a favourite way to see the world.',
    milestones: [
      {
        id: 'm6-knows-familiar-people',
        title: 'Knows familiar people',
        category: 'social',
        description: 'She lights up for the people she knows and may study strangers more warily.',
        howToEncourage: [
          'Keep greetings warm and consistent — name people as they arrive: "Here\'s Grandma!"',
          'Look at photos of family together and say who is who.',
        ],
      },
      {
        id: 'm6-mirror',
        title: 'Likes to look at herself in a mirror',
        category: 'social',
        description: 'The baby in the mirror is endlessly interesting (she does not know it is her yet).',
        howToEncourage: [
          'Use an unbreakable baby mirror in tummy time or on the change table.',
          'Point and name: "Who\'s that? It\'s [name]!"',
        ],
      },
      {
        id: 'm6-laughs',
        title: 'Laughs',
        category: 'social',
        description: 'Proper giggles and belly laughs, usually at you being ridiculous.',
        howToEncourage: [
          'Lean into physical comedy: raspberries on the tummy, "I\'m gonna get you", surprise peekaboo.',
          'Laugh with her — shared laughter is social glue.',
        ],
      },
      {
        id: 'm6-takes-turns-sounds',
        title: 'Takes turns making sounds with you',
        category: 'language',
        description: 'You babble, she babbles back, you answer — a real back-and-forth exchange.',
        howToEncourage: [
          'Treat her sounds as sentences: respond, pause, wait for her turn.',
          'Copy her babble exactly, then add a twist and see if she follows.',
        ],
      },
      {
        id: 'm6-raspberries',
        title: 'Blows raspberries',
        category: 'language',
        description: 'Sticking out her tongue and blowing — silly, and genuinely good practice for speech muscles.',
        howToEncourage: [
          'Blow raspberries at her and let her copy you.',
          'Make it a game she can win — cheer when she does it back.',
        ],
      },
      {
        id: 'm6-squeals',
        title: 'Makes squealing noises',
        category: 'language',
        description: 'High-pitched happy squeals as she experiments with volume and pitch.',
        howToEncourage: [
          'Squeal back softly, then whisper — playing with contrast teaches her about her voice.',
          'Sing songs with big pitch swings ("Zoom zoom zoom, we\'re going to the moon").',
        ],
      },
      {
        id: 'm6-mouths-things',
        title: 'Puts things in her mouth to explore',
        category: 'cognitive',
        description: 'Mouthing is her lab: texture, temperature, shape — all tested by gumming.',
        howToEncourage: [
          'Rotate safe, clean objects with different textures: silicone, wood, fabric.',
          'Keep anything smaller than a toilet-paper tube out of reach — it is a choking risk.',
        ],
      },
      {
        id: 'm6-reaches-for-toy',
        title: 'Reaches to grab a toy she wants',
        category: 'cognitive',
        description: 'She sees it, wants it, and goes for it — planning and coordination together.',
        howToEncourage: [
          'Place toys just at the edge of her reach in sitting or tummy time.',
          'Offer toys slightly to her left and right so she practises reaching across.',
        ],
      },
      {
        id: 'm6-closes-lips-food',
        title: 'Closes her lips to show she doesn\'t want more food',
        category: 'cognitive',
        description: 'If she has started solids, she can now clearly tell you "no more".',
        howToEncourage: [
          'Respect the closed mouth and turned head — trusting her fullness cues builds healthy eating.',
          'Let her explore food with her hands; mess is part of learning.',
        ],
      },
      {
        id: 'm6-rolls-tummy-to-back',
        title: 'Rolls from tummy to back',
        category: 'motor',
        description: 'The first big self-powered move (back-to-tummy usually follows within a few weeks).',
        howToEncourage: [
          'Give plenty of floor time on a firm, safe surface — rolling needs room to practise.',
          'Place a toy to one side just out of reach to tempt a roll toward it.',
        ],
      },
      {
        id: 'm6-pushes-up-straight-arms',
        title: 'Pushes up with straight arms in tummy time',
        category: 'motor',
        description: 'Full push-up position: arms straight, chest high, surveying her kingdom.',
        howToEncourage: [
          'Keep tummy time interesting with mirrors and toys at eye level.',
          'Let her push against the floor off your lap or a firm cushion for variety.',
        ],
      },
      {
        id: 'm6-leans-on-hands-sitting',
        title: 'Leans on her hands to sit (tripod sitting)',
        category: 'motor',
        description: 'Sitting propped on her own hands — wobbly, but real sitting is close.',
        howToEncourage: [
          'Practise supported sitting between your legs or with cushions behind her.',
          'Put a toy on the floor in front of her sitting spot to keep her engaged upright.',
        ],
      },
    ],
  },
  {
    id: 'm9',
    label: 'By 9 months',
    shortLabel: '9 mo',
    fromMonths: 9,
    toMonths: 12,
    overview:
      'She has opinions now. Expect "mamama/bababa" babbling, solid independent sitting, and a baby who looks up when you call her name. Stranger wariness and protest when you leave are healthy signs she is attached to you. Peekaboo is peak entertainment, and objects that vanish are now worth searching for.',
    milestones: [
      {
        id: 'm9-stranger-shy',
        title: 'Is shy or clingy around strangers',
        category: 'social',
        description: 'Clinging to you around new people is a milestone, not a setback — she knows exactly who her people are.',
        howToEncourage: [
          'Let her warm up from the safety of your arms; don\'t force handovers.',
          'Give new people a toy to offer and let her make the first move.',
        ],
      },
      {
        id: 'm9-facial-expressions',
        title: 'Shows several facial expressions',
        category: 'social',
        description: 'Happy, sad, angry, surprised — her face is now a readable weather report.',
        howToEncourage: [
          'Name feelings as they happen: "You\'re frustrated the ball rolled away."',
          'Make expression faces together in the mirror.',
        ],
      },
      {
        id: 'm9-responds-name',
        title: 'Looks when you call her name',
        category: 'social',
        description: 'Her name reliably gets her attention — a big listening-and-understanding step.',
        howToEncourage: [
          'Use her name often and positively, then pause so she can turn to you.',
          'Play the "call from another room" game and celebrate when she finds you.',
        ],
      },
      {
        id: 'm9-reacts-when-you-leave',
        title: 'Reacts when you leave (looks, reaches, or cries)',
        category: 'social',
        description: 'Separation protest is her attachment showing. It is hard, and it is healthy.',
        howToEncourage: [
          'Use a short, consistent goodbye ritual and then actually go — sneaking out makes it harder.',
          'Practise mini-separations at home: leave the room, narrate ("Back in a minute!"), return cheerfully.',
        ],
      },
      {
        id: 'm9-peekaboo',
        title: 'Smiles or laughs at peekaboo',
        category: 'social',
        description: 'Peekaboo works because she is learning things still exist when hidden — and the reveal is comedy gold.',
        howToEncourage: [
          'Vary it: hide behind hands, a cloth, a door frame.',
          'Let her pull the cloth off your face and take her own turn hiding.',
        ],
      },
      {
        id: 'm9-babbles',
        title: 'Babbles strings like "mamamama", "babababa"',
        category: 'language',
        description: 'Repeated syllables are the scaffolding of first words.',
        howToEncourage: [
          'Echo her syllables and shape them toward words: "Baba? Bottle!"',
          'Read simple books daily and let her pat the pages.',
        ],
      },
      {
        id: 'm9-lifts-arms-up',
        title: 'Lifts her arms to be picked up',
        category: 'language',
        description: 'A clear, intentional gesture — she is telling you exactly what she wants without a word.',
        howToEncourage: [
          'Pause before picking her up and ask "Up?" — give her a beat to reach first.',
          'Respond to her gestures with words so gesture and language link up.',
        ],
      },
      {
        id: 'm9-looks-for-dropped',
        title: 'Looks for things she drops out of sight',
        category: 'cognitive',
        description: 'The spoon flung off the high chair is a physics experiment: gone things still exist, and you fetch them.',
        howToEncourage: [
          'Play hiding games: cover a toy with a cloth and let her find it.',
          'Tolerate the drop-it-again game when you can — it really is learning.',
        ],
      },
      {
        id: 'm9-bangs-together',
        title: 'Bangs two things together',
        category: 'cognitive',
        description: 'Two blocks, maximum noise. She is learning to use both hands in one coordinated plan.',
        howToEncourage: [
          'Offer two blocks or cups and demonstrate a clap-clap-bang rhythm.',
          'Turn pots and wooden spoons into a (briefly tolerable) drum kit.',
        ],
      },
      {
        id: 'm9-sits-without-support',
        title: 'Sits without support',
        category: 'motor',
        description: 'Steady, hands-free sitting, leaving both hands free for the important work of grabbing.',
        howToEncourage: [
          'Give lots of supervised floor-sitting play with a cushion behind while she is still tippy.',
          'Place toys around her in a circle so she practises reaching and re-balancing.',
        ],
      },
      {
        id: 'm9-gets-to-sitting',
        title: 'Gets to a sitting position by herself',
        category: 'motor',
        description: 'From lying or crawling she can organise her own body up into sitting.',
        howToEncourage: [
          'Floor time, floor time, floor time — transitions need practice space.',
          'Keep her in simple clothes that let knees and feet grip the floor.',
        ],
      },
      {
        id: 'm9-transfers-hands',
        title: 'Moves things from one hand to the other',
        category: 'motor',
        description: 'A toy travels smoothly from hand to hand — both sides of her brain cooperating.',
        howToEncourage: [
          'Offer a second toy while her hands are full and watch her solve it.',
          'Choose easy-to-pass toys: rings, soft blocks, crinkly cloths.',
        ],
      },
      {
        id: 'm9-rakes-food',
        title: 'Uses fingers to rake food toward herself',
        category: 'motor',
        description: 'Small foods get raked into her palm — the pincer grip is coming next.',
        howToEncourage: [
          'Offer safe, soft finger foods (well-cooked veg pieces, banana) at meals.',
          'Let her self-feed even though it is messy — that is the practice.',
        ],
      },
    ],
  },
  {
    id: 'm12',
    label: 'By 12 months',
    shortLabel: '12 mo',
    fromMonths: 12,
    toMonths: 15,
    overview:
      'One year old! She is likely pulling to stand and cruising along the furniture, picking up crumbs with a perfect little pincer grasp, waving bye-bye, and maybe saying "mama" or "dada" and meaning it. Games with rules (pat-a-cake, peekaboo) are big. First independent steps could come any time in the next few months — the normal range is wide.',
    milestones: [
      {
        id: 'm12-plays-games',
        title: 'Plays games with you like pat-a-cake',
        category: 'social',
        description: 'She knows the game, waits for her part, and plays it — shared rituals with rules.',
        howToEncourage: [
          'Keep a repertoire: pat-a-cake, peekaboo, "row row row your boat".',
          'Pause at the key moment and let her fill in the action.',
        ],
      },
      {
        id: 'm12-waves-bye',
        title: 'Waves bye-bye',
        category: 'language',
        description: 'A real communicative gesture, used at (mostly) the right moments.',
        howToEncourage: [
          'Wave at every arrival and departure and say the word as you do.',
          'Add other gestures: blowing kisses, clapping, arms-up for "so big!"',
        ],
      },
      {
        id: 'm12-mama-dada',
        title: 'Calls a parent "mama" or "dada"',
        category: 'language',
        description: 'The babble syllables land on their targets — she means you.',
        howToEncourage: [
          'Label yourselves constantly: "Mama\'s here!", "Go to Dada!"',
          'When she says it, respond with delight every time — that feedback locks it in.',
        ],
      },
      {
        id: 'm12-understands-no',
        title: 'Understands "no" (pauses or stops)',
        category: 'language',
        description: 'She briefly stops when you say "no" firmly. (Complying every time is a much later skill!)',
        howToEncourage: [
          'Save "no" for what matters and pair it with redirection to something she can do.',
          'Keep the environment baby-proofed so most of her world is a "yes".',
        ],
      },
      {
        id: 'm12-puts-in-container',
        title: 'Puts something in a container',
        category: 'cognitive',
        description: 'In and out, fill and dump — she is learning about objects, space and cause-and-effect.',
        howToEncourage: [
          'Give her a bucket and blocks, or a box and balls; dump-and-fill is a complete activity.',
          'Make tidy-up a game: "Can you put the block in the basket?"',
        ],
      },
      {
        id: 'm12-finds-hidden',
        title: 'Looks for things she sees you hide',
        category: 'cognitive',
        description: 'Hide a toy under a cup while she watches — she will lift the cup. Object permanence, complete.',
        howToEncourage: [
          'Play the cup game with one cup, then two.',
          'Hide-and-seek with people too: hide behind a door and call her.',
        ],
      },
      {
        id: 'm12-pulls-to-stand',
        title: 'Pulls up to stand',
        category: 'motor',
        description: 'Using the couch, the cot rails, your legs — anything vertical is now climbing equipment.',
        howToEncourage: [
          'Put favourite toys on the couch cushion so standing up is rewarded.',
          'Lower the cot mattress now if you haven\'t — climbers appear overnight.',
        ],
      },
      {
        id: 'm12-cruises',
        title: 'Walks holding on to furniture (cruising)',
        category: 'motor',
        description: 'Sideways steps along the couch, hands shuffling along for balance.',
        howToEncourage: [
          'Arrange stable furniture in a line with small gaps to tempt crossing.',
          'Skip the classic baby walkers — the AAP advises against them; a sturdy push wagon is better.',
        ],
      },
      {
        id: 'm12-drinks-from-cup',
        title: 'Drinks from a cup you hold',
        category: 'motor',
        description: 'Sips from an open cup as you hold it — spluttery at first, and that is fine.',
        howToEncourage: [
          'Offer a small open cup or straw cup with water at meals.',
          'Tiny amounts, low stakes: a splash of water means spills don\'t matter.',
        ],
      },
      {
        id: 'm12-pincer-grasp',
        title: 'Picks things up with thumb and pointer finger',
        category: 'motor',
        description: 'The precise pincer grasp — suddenly no crumb on the floor is safe.',
        howToEncourage: [
          'Offer small soft foods (peas, soft pasta pieces) to pick up at meals.',
          'Vigilance time: anything small on the floor will be found and mouthed.',
        ],
      },
    ],
  },
  {
    id: 'm15',
    label: 'By 15 months',
    shortLabel: '15 mo',
    fromMonths: 15,
    toMonths: 18,
    overview:
      'A toddler in training. First independent steps usually arrive around now if they haven\'t already, first real words are landing, and she is copying everything — other kids, you, the dog. She shows you things she likes and points to ask for what she wants: communication is exploding even before the words catch up.',
    milestones: [
      {
        id: 'm15-copies-children',
        title: 'Copies other children while playing',
        category: 'social',
        description: 'Watch her at a playground: another child bangs a bucket, and seconds later so does she.',
        howToEncourage: [
          'Create low-pressure chances to be around other kids — playgrounds, playgroups, family.',
          'Expect "parallel play" (side by side, not together) — that is exactly right for this age.',
        ],
      },
      {
        id: 'm15-shows-objects',
        title: 'Shows you an object she likes',
        category: 'social',
        description: 'She holds up a toy just to share it with you — "joint attention", a cornerstone of social development.',
        howToEncourage: [
          'React genuinely every time: look, name it, be interested.',
          'Show her your things too: "Look what I found!"',
        ],
      },
      {
        id: 'm15-claps-excited',
        title: 'Claps when excited',
        category: 'social',
        description: 'Joy now comes with applause.',
        howToEncourage: [
          'Celebrate small wins together with claps and cheers.',
          'Sing clap-along songs ("If you\'re happy and you know it").',
        ],
      },
      {
        id: 'm15-hugs-stuffed-animal',
        title: 'Hugs a stuffed animal or doll',
        category: 'social',
        description: 'Cuddling a teddy is early pretend play — she is practising caring.',
        howToEncourage: [
          'Give teddy a role in routines: teddy gets tucked in too, teddy waves bye-bye.',
          'Model gentle affection: "Give dolly a cuddle."',
        ],
      },
      {
        id: 'm15-first-words',
        title: 'Tries to say one or two words besides "mama"/"dada"',
        category: 'language',
        description: '"Ba" for ball, "da" for dog — recognisable attempts, not perfect pronunciation.',
        howToEncourage: [
          'Name what she is already looking at — that is when words stick best.',
          'Expand her attempts: she says "ba", you say "Yes! Ball! A red ball!"',
        ],
      },
      {
        id: 'm15-looks-at-named',
        title: 'Looks at a familiar object when you name it',
        category: 'language',
        description: 'Say "Where\'s the ball?" and her eyes find it — understanding runs ahead of speaking.',
        howToEncourage: [
          '"Where\'s the...?" games with toys, body parts, family members.',
          'Read together daily and name what is in the pictures.',
        ],
      },
      {
        id: 'm15-follows-direction-gesture',
        title: 'Follows directions given with gesture and words',
        category: 'language',
        description: 'Hold out your hand and say "Give me the toy" — and she does.',
        howToEncourage: [
          'Give simple one-step instructions in daily life and cheer when she follows.',
          'Make it a game: "Bring teddy!", "Put it in the box!"',
        ],
      },
      {
        id: 'm15-points-to-ask',
        title: 'Points to ask for something or get help',
        category: 'language',
        description: 'Pointing at the snack cupboard while looking at you is a full sentence without words.',
        howToEncourage: [
          'Respond to points, and put the words in: "You want the banana?"',
          'Point at things yourself when you talk — planes, dogs, the moon.',
        ],
      },
      {
        id: 'm15-uses-things-right',
        title: 'Tries to use things the right way',
        category: 'cognitive',
        description: 'Phone to ear, cup to lips, brush to hair — she knows what objects are for.',
        howToEncourage: [
          'Keep a basket of real-ish props: old phone, cup, spoon, brush.',
          'Narrate your own actions so she can study and copy them.',
        ],
      },
      {
        id: 'm15-stacks-two',
        title: 'Stacks at least two small objects',
        category: 'cognitive',
        description: 'One block on another — planning, precision and patience in one move.',
        howToEncourage: [
          'Build a two-block tower and hand her the next block.',
          'Cheer the knock-down as much as the build — both are physics lessons.',
        ],
      },
      {
        id: 'm15-first-steps',
        title: 'Takes a few steps on her own',
        category: 'motor',
        description: 'The famous first steps: arms up, wide stance, drunk-sailor wobble, pure triumph.',
        howToEncourage: [
          'Let her walk barefoot indoors — feet grip and balance better without shoes.',
          'Kneel a few steps away with open arms; short successful trips beat long ones.',
        ],
      },
      {
        id: 'm15-finger-feeds',
        title: 'Feeds herself with her fingers',
        category: 'motor',
        description: 'She manages a good share of a meal on her own now.',
        howToEncourage: [
          'Offer a varied plate of graspable foods and let her drive.',
          'Put a mat under the chair and make peace with the mess.',
        ],
      },
    ],
  },
  {
    id: 'm18',
    label: 'By 18 months',
    shortLabel: '18 mo',
    fromMonths: 18,
    toMonths: 24,
    overview:
      'Confident walking, first scribbles, and a little helper emerging — she copies your chores, helps push her arm into a sleeve, and looks back to check you are watching her adventures. Words are being collected steadily, and simple instructions ("get your shoes") now land without you pointing.',
    milestones: [
      {
        id: 'm18-explores-checks-back',
        title: 'Explores, but checks that you are close',
        category: 'social',
        description: 'She ranges away to investigate, then looks back or returns to base — you are her security.',
        howToEncourage: [
          'At the park, stay findable and give a wave when she checks in.',
          'Let her lead the exploring while you follow at a comfortable distance.',
        ],
      },
      {
        id: 'm18-points-to-show',
        title: 'Points to show you something interesting',
        category: 'social',
        description: 'Not asking for anything — just "look at that dog!" She wants to share the world with you.',
        howToEncourage: [
          'Follow her point every time and talk about what she found.',
          'Do your own excited pointing on walks: planes, cats, diggers.',
        ],
      },
      {
        id: 'm18-hands-for-washing',
        title: 'Puts hands out for you to wash them',
        category: 'social',
        description: 'She knows the routine and takes her part in it.',
        howToEncourage: [
          'Keep routines predictable and narrate the steps.',
          'Sing a short hand-washing song so the sequence sticks.',
        ],
      },
      {
        id: 'm18-book-with-you',
        title: 'Looks at a few pages of a book with you',
        category: 'social',
        description: 'She settles into a lap and a book, pointing and patting the pictures.',
        howToEncourage: [
          'Make books part of the wind-down routine every day.',
          'Let her turn the pages and choose the book — even the same one, again.',
        ],
      },
      {
        id: 'm18-helps-dress',
        title: 'Helps you dress her',
        category: 'social',
        description: 'She pushes her arm through a sleeve or lifts a foot for a shoe.',
        howToEncourage: [
          'Slow down and give her the chance to do her part.',
          'Name body parts and clothes as you go — dressing doubles as vocabulary.',
        ],
      },
      {
        id: 'm18-three-words',
        title: 'Tries to say three or more words besides "mama"/"dada"',
        category: 'language',
        description: 'Her collection of words grows — animal sounds ("woof") count too.',
        howToEncourage: [
          'Read, sing, and narrate daily life; word count grows on conversation.',
          'Give her time: ask a question, count to five silently, let her answer.',
        ],
      },
      {
        id: 'm18-follows-one-step',
        title: 'Follows one-step directions without gestures',
        category: 'language',
        description: '"Sit down" or "give me the cup" — words alone are enough now.',
        howToEncourage: [
          'Give simple instructions during play and routines and cheer success.',
          'Keep them one step at a time; two-step instructions come closer to two.',
        ],
      },
      {
        id: 'm18-copies-chores',
        title: 'Copies you doing chores',
        category: 'cognitive',
        description: 'You sweep, she "sweeps". Imitation is her main learning engine.',
        howToEncourage: [
          'Give her a real job: a cloth to wipe with, socks to put in the basket.',
          'Toy versions of tools (broom, mower) get heavy, happy use at this age.',
        ],
      },
      {
        id: 'm18-simple-toy-play',
        title: 'Plays with toys in a simple way',
        category: 'cognitive',
        description: 'Pushing a toy car, feeding a doll — toys used as the things they represent.',
        howToEncourage: [
          'Join her play and add one small idea: the car drives into a block garage.',
          'Simple open-ended toys beat flashing ones for this kind of play.',
        ],
      },
      {
        id: 'm18-walks-alone',
        title: 'Walks without holding on to anyone',
        category: 'motor',
        description: 'Steady independent walking — and soon, attempts at running.',
        howToEncourage: [
          'Provide safe walking challenges: grass, sand, gentle slopes.',
          'Long "toddler-pace" walks where she sets the route and the stops.',
        ],
      },
      {
        id: 'm18-scribbles',
        title: 'Scribbles',
        category: 'motor',
        description: 'Give her a chunky crayon and paper appears decorated (also possibly the table).',
        howToEncourage: [
          'Offer chunky crayons and big paper, and scribble alongside her.',
          'Tape the paper down so it doesn\'t slide mid-masterpiece.',
        ],
      },
      {
        id: 'm18-spoon',
        title: 'Tries to use a spoon',
        category: 'motor',
        description: 'Loading is hit-and-miss and plenty falls off, but she insists on doing it herself.',
        howToEncourage: [
          'Use sticky foods (yoghurt, oatmeal) that stay on the spoon for early wins.',
          'Give her her own spoon while you help with a second one.',
        ],
      },
      {
        id: 'm18-climbs-couch',
        title: 'Climbs on and off a couch without help',
        category: 'motor',
        description: 'Furniture is now equipment. She gets up — and learns to slide down feet-first.',
        howToEncourage: [
          'Teach the safe dismount: turn around, feet first, tummy to the cushion.',
          'Build cushion obstacle courses for supervised climbing practice.',
        ],
      },
    ],
  },
  {
    id: 'm24',
    label: 'By 24 months',
    shortLabel: '24 mo',
    fromMonths: 24,
    toMonths: 36,
    overview:
      'Two years old: running, kicking balls, climbing stairs, and — the big one — putting two words together ("more milk", "daddy go"). She notices other people\'s feelings now, studies your face in new situations to see how to react, and plays with real imagination. The "terrible twos" are really just a huge will arriving before the skills to manage it.',
    milestones: [
      {
        id: 'm24-notices-others-hurt',
        title: 'Notices when others are hurt or upset',
        category: 'social',
        description: 'She pauses or looks sad when someone is crying — the seedling of empathy.',
        howToEncourage: [
          'Name feelings in books and real life: "He\'s sad because his tower fell."',
          'Let her "help" comfort: fetching a bandage, patting gently.',
        ],
      },
      {
        id: 'm24-social-referencing',
        title: 'Looks at your face to see how to react',
        category: 'social',
        description: 'In new situations she checks your expression first — your calm becomes her calm.',
        howToEncourage: [
          'Offer a reassuring face and voice in new places before she gets worried.',
          'Narrate new situations simply: "That\'s a big dog. He\'s friendly."',
        ],
      },
      {
        id: 'm24-two-word-phrases',
        title: 'Says at least two words together',
        category: 'language',
        description: '"More milk", "car go", "mama up" — grammar has officially begun.',
        howToEncourage: [
          'Expand her phrases by one word: she says "more milk", you say "more milk please!"',
          'Offer choices that need words: "Apple or banana?"',
        ],
      },
      {
        id: 'm24-points-in-book',
        title: 'Points to things in a book when you ask',
        category: 'language',
        description: '"Where\'s the moon?" — and her finger lands on it.',
        howToEncourage: [
          'Play I-spy in books: start easy, then ask about smaller details.',
          'Flip roles — let her ask you to find things.',
        ],
      },
      {
        id: 'm24-body-parts',
        title: 'Points to at least two body parts',
        category: 'language',
        description: 'Nose, eyes, tummy, toes — named and found on request.',
        howToEncourage: [
          'Sing "Head, Shoulders, Knees and Toes" slowly with the actions.',
          'Ask during bath time: "Where are your toes? Let\'s wash them!"',
        ],
      },
      {
        id: 'm24-gestures',
        title: 'Uses more gestures (blows a kiss, nods yes)',
        category: 'language',
        description: 'Her non-verbal vocabulary grows alongside words.',
        howToEncourage: [
          'Use gestures generously yourself: thumbs up, shrugs, blowing kisses.',
          'Play gesture games: "How big is [name]? Sooo big!"',
        ],
      },
      {
        id: 'm24-two-hands',
        title: 'Uses both hands together (holds while doing)',
        category: 'cognitive',
        description: 'Holding the pot while stirring, steadying paper while scribbling — two-handed teamwork.',
        howToEncourage: [
          'Offer two-handed tasks: big jars to open, playdough to pull apart.',
          'Cook together — holding the bowl while stirring is perfect practice.',
        ],
      },
      {
        id: 'm24-switches-knobs',
        title: 'Tries switches, knobs and buttons',
        category: 'cognitive',
        description: 'Everything with a control gets tested. Cause and effect is irresistible.',
        howToEncourage: [
          'Busy boards with latches, switches and dials channel the urge safely.',
          'Let her push the real buttons you don\'t mind: the lift, the light switch, the doorbell.',
        ],
      },
      {
        id: 'm24-multi-toy-play',
        title: 'Plays with more than one toy at a time',
        category: 'cognitive',
        description: 'The doll rides the truck to the block house — toys combined into little stories.',
        howToEncourage: [
          'Keep open-ended toys together: blocks, figures, vehicles.',
          'Join in and add plot: "Uh oh, the truck ran out of petrol!"',
        ],
      },
      {
        id: 'm24-kicks-ball',
        title: 'Kicks a ball',
        category: 'motor',
        description: 'A deliberate, standing kick that sends the ball rolling.',
        howToEncourage: [
          'Play kick-and-chase with a light, slightly deflated ball (easier to kick).',
          'Set up a "goal" between two cushions and celebrate every score.',
        ],
      },
      {
        id: 'm24-runs',
        title: 'Runs',
        category: 'motor',
        description: 'Proper running — stiff-legged and thrilling, with occasional spectacular tumbles.',
        howToEncourage: [
          'Find open grassy spaces where falls are soft and speed is free.',
          'Play chase games: "I\'m going to catch you!" never gets old.',
        ],
      },
      {
        id: 'm24-stairs',
        title: 'Walks up a few stairs',
        category: 'motor',
        description: 'Both feet to each step, maybe a hand on the rail or yours.',
        howToEncourage: [
          'Practise on low stairs together, teaching the handrail habit.',
          'Keep stair gates for unsupervised times — skill and judgement arrive separately.',
        ],
      },
      {
        id: 'm24-eats-with-spoon',
        title: 'Eats with a spoon',
        category: 'motor',
        description: 'Most of the meal now actually arrives by spoon.',
        howToEncourage: [
          'Give her a child-sized spoon and fork at every meal.',
          'Eat together — watching you is her best table-skills lesson.',
        ],
      },
    ],
  },
]

/** The band whose window contains this age (months). Newborn for <2, last band for 24+. */
export function bandForAgeMonths(ageMonths: number): AgeBand {
  for (const band of AGE_BANDS) {
    if (ageMonths >= band.fromMonths && ageMonths < band.toMonths) return band
  }
  return ageMonths < 0 ? AGE_BANDS[0] : AGE_BANDS[AGE_BANDS.length - 1]
}

export function nextBand(band: AgeBand): AgeBand | null {
  const i = AGE_BANDS.findIndex((b) => b.id === band.id)
  return i >= 0 && i < AGE_BANDS.length - 1 ? AGE_BANDS[i + 1] : null
}

const milestoneIndex = new Map<string, { milestone: MilestoneDef; band: AgeBand }>()
for (const band of AGE_BANDS) {
  for (const milestone of band.milestones) {
    milestoneIndex.set(milestone.id, { milestone, band })
  }
}

export function findMilestone(id: string): { milestone: MilestoneDef; band: AgeBand } | undefined {
  return milestoneIndex.get(id)
}

