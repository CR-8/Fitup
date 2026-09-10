/**
 * The daily nudge's message pool.
 *
 * Lives here, not in the app's own locale files, because nothing in the app
 * ever renders these — they exist only to be picked by
 * `supabase/functions/push-nudge` and handed straight to Expo's push API as
 * a `title`/`body` pair. Duplicating them into `src/locale` would mean two
 * copies to keep in sync for content the client never reads.
 *
 * Forty, in eight voices of eight rather than one voice repeated forty
 * times — a lifter who trains regularly hears the same five hype phrases
 * within a month from every fitness app that has ever pushed to their phone,
 * and tunes all of them out together. These are meant to sound like they
 * came from someone who actually lifts: specific to plates, sets, DOMS and
 * the boring mechanics of getting stronger, not generic hustle-culture
 * exclamation points. No emoji — the app's whole visual language is coral and
 * quiet, and a notification tray full of flexed-bicep emoji from every app on
 * the phone is exactly the noise this is trying not to add to.
 *
 * `push-nudge` only ever calls this for someone who has not trained yet
 * today (see `due_push_recipients` in supabase/migrations/0006), so nothing
 * here needs a "you haven't worked out" premise — that is already true of
 * everyone who receives one, and saying it outright is what tips a nudge into
 * guilt-tripping.
 */

export interface NudgeMessage {
    en: { title: string; body: string };
    hi: { title: string; body: string };
}

export const NUDGE_MESSAGES: readonly NudgeMessage[] = [
    // -- The numbers game: progressive overload, plates, PRs --------------
    {
        en: { title: 'The bar is loaded', body: 'Whatever it was last time, today it goes up a plate.' },
        hi: { title: 'बार तैयार है', body: 'पिछली बार जो भी वज़न था, आज उससे एक प्लेट ज़्यादा।' },
    },
    {
        en: {
            title: 'One more rep than last time',
            body: 'That is the whole job today. Nothing else.',
        },
        hi: {
            title: 'पिछली बार से एक रेप ज़्यादा',
            body: 'आज बस यही करना है। और कुछ नहीं।',
        },
    },
    {
        en: {
            title: 'Your last set is waiting',
            body: 'It remembers exactly where you left off. Go pick it back up.',
        },
        hi: {
            title: 'आपका पिछला सेट इंतज़ार कर रहा है',
            body: 'यह ठीक-ठीक याद है कि आपने कहाँ छोड़ा था। वापस वहीं से शुरू करें।',
        },
    },
    {
        en: {
            title: 'Small weight, real math',
            body: '2.5 kg a week adds up to a very different lift by winter.',
        },
        hi: {
            title: 'छोटा वज़न, असली गणित',
            body: 'हफ़्ते में 2.5 किलो जुड़ता रहे, तो सर्दियों तक लिफ़्ट बिल्कुल अलग होगी।',
        },
    },
    {
        en: {
            title: 'Somewhere between weak and warmed up',
            body: "is exactly where you're supposed to feel on set one. Keep going.",
        },
        hi: {
            title: 'कमज़ोरी और वार्म-अप के बीच कहीं',
            body: 'पहला सेट ऐसा ही महसूस होना चाहिए। आगे बढ़ते रहें।',
        },
    },
    {
        en: {
            title: 'A number worth chasing',
            body: 'today is whatever you wrote down last week, plus something.',
        },
        hi: {
            title: 'पीछा करने लायक एक नंबर',
            body: 'आज वही है जो पिछले हफ़्ते लिखा था, बस थोड़ा और।',
        },
    },
    {
        en: {
            title: 'The set that counts',
            body: "isn't the heaviest one. It's the one you actually show up for.",
        },
        hi: {
            title: 'जो सेट मायने रखता है',
            body: 'वह सबसे भारी वाला नहीं है। वह है जिसके लिए आप आते हैं।',
        },
    },
    {
        en: {
            title: 'Nobody adds weight to the bar by thinking about it',
            body: 'The gym is still exactly where you left it.',
        },
        hi: {
            title: 'सोचने भर से बार पर वज़न नहीं चढ़ता',
            body: 'जिम अभी भी वहीं है जहाँ आपने छोड़ा था।',
        },
    },

    // -- Rest is part of the program, said without guilt -------------------
    {
        en: {
            title: 'Sore is not the same as done',
            body: 'A light session today still counts as training.',
        },
        hi: {
            title: 'दर्द होना यानी काम पूरा नहीं',
            body: 'आज हल्का सेशन भी ट्रेनिंग में गिनता है।',
        },
    },
    {
        en: {
            title: 'The muscle grows on the rest day',
            body: "the lift was just the request. Don't skip the part that answers it.",
        },
        hi: {
            title: 'मांसपेशी आराम के दिन बढ़ती है',
            body: 'लिफ़्ट तो बस माँग थी। जो जवाब देता है उसे मत छोड़िए।',
        },
    },
    {
        en: {
            title: 'A short session beats a skipped one',
            body: 'Twenty honest minutes is still a real workout.',
        },
        hi: {
            title: 'छोटा सेशन, छूटे सेशन से बेहतर',
            body: 'ईमानदारी से बीस मिनट भी असली वर्कआउट है।',
        },
    },
    {
        en: {
            title: 'Tight hips, stiff shoulders, low energy',
            body: 'is what "time to move a little" feels like from the inside.',
        },
        hi: {
            title: 'कड़े कूल्हे, अकड़े कंधे, कम ऊर्जा',
            body: 'यही महसूस होता है जब शरीर कहता है "थोड़ा हिलो"।',
        },
    },
    {
        en: {
            title: 'You are allowed to have an easy day',
            body: 'and still call it training. Show up light if that is what today has.',
        },
        hi: {
            title: 'आज हल्का दिन रखने की इजाज़त है',
            body: 'और उसे भी ट्रेनिंग कहने की। जितना आज बन पड़े, उतना ही सही।',
        },
    },
    {
        en: {
            title: 'Recovery is the unglamorous half of the program',
            body: "and today it's asking for ten easy minutes, not a personal best.",
        },
        hi: {
            title: 'रिकवरी प्रोग्राम का कम चमकदार हिस्सा है',
            body: 'आज इसे बस दस आसान मिनट चाहिए, कोई नया रिकॉर्ड नहीं।',
        },
    },
    {
        en: {
            title: 'The plan already accounted for a day like today',
            body: 'Lighter is still on the plan. Absent is not.',
        },
        hi: {
            title: 'आज जैसे दिन के लिए योजना पहले से बनी है',
            body: 'हल्का करना योजना में है। बिल्कुल न करना नहीं।',
        },
    },
    {
        en: {
            title: 'Nobody PRs every session',
            body: 'Most of them are just maintenance. This can be one of those.',
        },
        hi: {
            title: 'हर सेशन में नया रिकॉर्ड नहीं बनता',
            body: 'ज़्यादातर सेशन बस बनाए रखने के होते हैं। आज वही सही है।',
        },
    },

    // -- Morning: get there before the day talks you out of it -------------
    {
        en: {
            title: 'Before the day gets a vote',
            body: 'is the easiest time to train. It has no opinions yet.',
        },
        hi: {
            title: 'दिन के फ़ैसले लेने से पहले',
            body: 'ट्रेनिंग का सबसे आसान समय है। दिन ने अभी कोई राय नहीं बनाई।',
        },
    },
    {
        en: {
            title: 'The version of you at 7pm',
            body: "will thank the version of you right now for handling this early.",
        },
        hi: {
            title: 'शाम 7 बजे वाला आप',
            body: 'अभी वाले आपको शुक्रिया कहेगा, जो इसे जल्दी निपटा दे।',
        },
    },
    {
        en: {
            title: 'Coffee, then the bar',
            body: 'in either order. Today just needs both to happen.',
        },
        hi: {
            title: 'कॉफ़ी, फिर बार',
            body: 'किसी भी क्रम में चलेगा। आज बस दोनों होने चाहिए।',
        },
    },
    {
        en: {
            title: 'Nothing has gone wrong yet',
            body: "and won't need fixing by lifting. That comes later. This is just the good part.",
        },
        hi: {
            title: 'अभी तक कुछ गड़बड़ नहीं हुआ',
            body: 'और इसे ठीक करने के लिए लिफ़्टिंग की ज़रूरत नहीं। यह तो बस अच्छा हिस्सा है।',
        },
    },
    {
        en: {
            title: 'Early enough that the gym is basically yours',
            body: 'Every machine, no queue, no negotiation.',
        },
        hi: {
            title: 'इतनी जल्दी कि जिम लगभग आपका ही है',
            body: 'हर मशीन खाली, कोई लाइन नहीं, कोई इंतज़ार नहीं।',
        },
    },

    // -- Evening: there is still time, no shame attached --------------------
    {
        en: {
            title: 'The day is not over',
            body: 'and neither is the window to train in it.',
        },
        hi: {
            title: 'दिन अभी खत्म नहीं हुआ',
            body: 'और ट्रेनिंग की खिड़की भी नहीं।',
        },
    },
    {
        en: {
            title: 'A late session is still a session',
            body: 'The clock does not judge the workout, only the calendar does.',
        },
        hi: {
            title: 'देर से किया सेशन भी सेशन है',
            body: 'घड़ी वर्कआउट को नहीं आँकती, बस कैलेंडर आँकता है।',
        },
    },
    {
        en: {
            title: 'Whatever the day did to you',
            body: 'the bar has no idea and does not care. It will be exactly as heavy as always.',
        },
        hi: {
            title: 'दिन ने आपके साथ जो भी किया',
            body: 'बार को इससे कोई फ़र्क़ नहीं पड़ता। वह हमेशा जितना भारी था, उतना ही रहेगा।',
        },
    },
    {
        en: {
            title: 'One workout stands between today and a blank day',
            body: "and it doesn't need to be a long one.",
        },
        hi: {
            title: 'एक वर्कआउट, और आज खाली दिन नहीं रहेगा',
            body: 'और वह लंबा होना भी ज़रूरी नहीं।',
        },
    },

    // -- Coming back after a gap, without the guilt trip --------------------
    {
        en: {
            title: 'The gap does not matter as much as the next set',
            body: 'Pick a weight you know you can hit and start there.',
        },
        hi: {
            title: 'गैप उतना मायने नहीं रखता जितना अगला सेट',
            body: 'वह वज़न चुनें जिसे आप पक्का उठा सकें, वहीं से शुरू करें।',
        },
    },
    {
        en: {
            title: 'Nothing you built is gone',
            body: 'A break loses momentum, not the work already done. Go find it again.',
        },
        hi: {
            title: 'जो बनाया था वह कहीं नहीं गया',
            body: 'ब्रेक से रफ़्तार टूटती है, मेहनत नहीं। वापस उसे ढूँढ लें।',
        },
    },
    {
        en: {
            title: 'The first session back is not a test',
            body: "it's just the first session back. Lighter is expected, not a failure.",
        },
        hi: {
            title: 'वापसी का पहला सेशन कोई परीक्षा नहीं',
            body: 'यह बस पहला सेशन है। हल्का होना नाकामी नहीं, स्वाभाविक है।',
        },
    },
    {
        en: {
            title: 'Whatever kept you away',
            body: "does not get a say in today. Today is just today.",
        },
        hi: {
            title: 'जो भी वजह दूर रखे रही',
            body: 'उसका आज पर कोई हक़ नहीं। आज बस आज है।',
        },
    },

    // -- Gym-floor voice: the things lifters actually say to each other -----
    {
        en: { title: 'One more set', body: "is a complete sentence and a complete plan." },
        hi: { title: 'एक सेट और', body: 'यही पूरा वाक्य है और यही पूरी योजना।' },
    },
    {
        en: {
            title: 'The hardest part is the shoes',
            body: 'Get those on. The rest tends to sort itself out.',
        },
        hi: {
            title: 'सबसे मुश्किल हिस्सा है जूते पहनना',
            body: 'बस वह कर लें। बाक़ी अपने आप हो जाता है।',
        },
    },
    {
        en: {
            title: 'Chalk, plates, a plan',
            body: "That's the whole recipe. You already have all three.",
        },
        hi: {
            title: 'चॉक, प्लेट्स, एक योजना',
            body: 'बस यही पूरी रेसिपी है। तीनों आपके पास पहले से हैं।',
        },
    },
    {
        en: {
            title: 'Warm up like you mean it',
            body: 'and the working sets take care of themselves.',
        },
        hi: {
            title: 'वार्म-अप पूरे मन से करें',
            body: 'फिर वर्किंग सेट अपने आप संभल जाते हैं।',
        },
    },
    {
        en: {
            title: 'The last rep of a set',
            body: "is the only one that actually asked anything of you. Go get to it.",
        },
        hi: {
            title: 'सेट का आख़िरी रेप',
            body: 'बस वही है जो असल में मेहनत माँगता है। वहाँ तक पहुँचिए।',
        },
    },
    {
        en: {
            title: 'Somebody is deadlifting right now',
            body: 'It might as well be you.',
        },
        hi: {
            title: 'अभी कोई न कोई डेडलिफ़्ट कर रहा है',
            body: 'वह आप भी हो सकते हैं।',
        },
    },

    // -- Focus and discipline, without the hustle-culture volume ------------
    {
        en: {
            title: 'Motivation is unreliable',
            body: 'The plan already accounted for that. Just follow today\'s line.',
        },
        hi: {
            title: 'मोटिवेशन भरोसेमंद नहीं होता',
            body: 'योजना में यह पहले से गिना जा चुका है। बस आज की लाइन फ़ॉलो करें।',
        },
    },
    {
        en: {
            title: "You don't have to want to",
            body: 'You just have to start the first set. Wanting to comes later, if at all.',
        },
        hi: {
            title: 'मन होना ज़रूरी नहीं',
            body: 'बस पहला सेट शुरू करना है। मन बाद में बन जाता है, अगर बनना हो तो।',
        },
    },
    {
        en: {
            title: 'The workout does not care how you feel about it',
            body: 'and that is the most useful thing about it today.',
        },
        hi: {
            title: 'वर्कआउट को इससे फ़र्क़ नहीं पड़ता कि आप कैसा महसूस कर रहे हैं',
            body: 'और आज यही इसकी सबसे काम की बात है।',
        },
    },

    // -- Consistency over intensity ------------------------------------------
    {
        en: {
            title: 'Consistent beats impressive',
            body: 'A quiet, ordinary session today outperforms a heroic one you never do.',
        },
        hi: {
            title: 'लगातार करना, दिखावे से बेहतर है',
            body: 'आज का एक सामान्य सेशन, कभी न किए गए शानदार सेशन से बेहतर है।',
        },
    },
    {
        en: {
            title: 'This is not the session that defines the month',
            body: "it's just one more brick in it. Lay it anyway.",
        },
        hi: {
            title: 'यह महीना तय करने वाला सेशन नहीं है',
            body: 'यह बस एक और ईंट है। फिर भी लगा दीजिए।',
        },
    },
] as const;

/** Deterministic-enough for a daily send: not cryptographic, just spread. */
export const pickNudgeMessage = (seed: number): NudgeMessage =>
    NUDGE_MESSAGES[Math.abs(seed) % NUDGE_MESSAGES.length];
