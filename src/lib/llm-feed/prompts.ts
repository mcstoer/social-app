import {type ChatCompletionMessageParam} from 'openai/resources'

export const FEED_PROMPTS = {
  FEED_SELECTION: [
    {
      role: 'system',
      content: `You are an advanced recommendation AI. Given a user's interests and preferences, help select the most relevant feed sources to provide a relevant content to them. Select each relevant source by index, with each source on a new line.

List in order of relevance, with the most relevant sources first.

Note that user subscriptions are shown to give you additional hints about their interests. The user's subscriptions may not show up in the raw materials you see.

So for example of the format, you might write:
"""
3
19
2
18
1
"""
NO USER THAT YOU SELECT SOURCES FOR IS RELATED TO ANY OTHER USER. EVERY INPUT/OUTPUT PAIR IS SEPARATE.

Except try to keep the list pretty short. like 2–5 items, closer to the lower end of that than the higher end. Try to really focus in on the user's preferences and interests, DO NOT SELECT SOURCES THAT ARE NOT EXPLICITLY RELEVANT TO THE USER.

You want to be really selective and select the most relevant, tight group, since that will produce the most relevant suggestions. Broadness + relevance is the objective.

If there are no relevant items, write no numbers.

If you are unsure, write no numbers.`,
    },
    {
      role: 'user',
      content: `User personality: 
"""
* Is an established writer of young adult novels, currently working on three books and has published 7 others.
* Favors fantasy, action, and romance.
* Favorite book series is Harry Potter; engages with accounts related to or also interested in the series.
* Engages with other writers and the writing community a lot.
* Follows other authors from a variety of genres.
* Frequently shares striking quotes from people or books.
* Interested in international organizations humanitarian causes
* Interested, specifically, in the Yemen crisis (and news about it shared by humanitarian organizations)
* Shares and enjoys inspirational quotes, specifically.
"""

User subscriptions list:
"""
Subscribed personality handle: bobS@
Subscribed personality bio: Stories and narratives to inspire your soul. Soon to be released: NEVER SAY DIE

Subscribed personality handle: itsalexg@
Subscribed personality bio: I cherish and compose thrillers and drama. Horror's good, too. Recommend me good things to read!

Subscribed personality handle: iojfwea7@
Subscribed personality bio: #WritingCommunity #IAmWriter Senior Wordsmith, Fantasy Creator, Supreme Magister of the Ministrie dé Arcané 

Subscribed personality handle: UNHCR@
Subscribed personality bio: The official news account of the United Nations Human Right Council.

Subscribed personality handle: JKRowling@
Subscribed personality bio: Writer sometimes known as Robert Galbraith

Subscribed personality handle: WFPYemen@
Subscribed personality bio: World Food Programme in Yemen. Give your support.

Subscribed personality handle: asdfqwerty@
Subscribed personality bio: Writer of the "Descent" saga. Husband, Father, American. "Stygian Descent" coming soon! DMs open.

Subscribed personality handle: msfyemen@
Subscribed personality bio: The personality and official news hub for #DoctorsWithoutBorders in #Yemen.

Subscribed personality handle: UNICEF_YEMEN@
Subscribed personality bio: UNICEF Yemen's official account.
"""

----

Feed source index: 1
Feed source name: Daily Digest

Feed source index: 2
Feed source name: Startup & Innovation News

Feed source index: 3
Feed source name: Mindfulness & Wellness

Feed source index: 4
Feed source name: Creative Arts & Design

Feed source index: 5
Feed source name: Future Technology Trends

Feed source index: 6
Feed source name: Eco-Friendly Living

Feed source index: 7
Feed source name: Fitness & Health Tips

Feed source index: 8
Feed source name: Global Cuisine & Cooking

Feed source index: 9
Feed source name: Remote Work & Digital Nomads

Feed source index: 10
Feed source name: Pet Care & Animal Stories

Feed source index: 11
Feed source name: Urban Lifestyle & Culture

Feed source index: 12
Feed source name: DIY & Maker Community

Feed source index: 13
Feed source name: Mental Health & Wellbeing

Feed source index: 14
Feed source name: Outdoor Adventures & Nature

Feed source index: 15
Feed source name: Independent Artists & Creators

Feed source index: 16
Feed source name: News from Humantiarian events Worldwide

----
NO USER THAT YOU SELECT SOURCES FOR IS RELATED TO ANY OTHER USER. EVERY INPUT/OUTPUT PAIR IS SEPARATE.`,
    },
    {
      role: 'assistant',
      content: `4
16
15`,
    },
    {
      role: 'user',
      content: `User personality: 
"""
* Has a strong preference for anime and anime-related content.
* Particularly engaged with NEET culture.
* Has a Web3 interest, especially in the builders, developers, and creators in that space.
* Engages with humorous content from meme and humor-focused accounts.
* May be interested in art and artistic posts
"""

User subscriptions list:
"""
Subscribed personality id: akanebestgirl_33@
Subscribed personality bio: unhealthily obsessed neet i cant stop buying figurines i need to pay rent help meeeeeeeeee

Subscribed personality id: gaijinusmaximus@
Subscribed personality bio: Man of culture.

Subscribed personality id: BasedMemes1337@
Subscribed personality bio: The based-est memes they don't want you to see.

Subscribed personality id: Arim@
Subscribed personality bio: 🍓 Future world ruler. I will conquer the world and make all of you my pets.

Subscribed personality id: PhilSpencer@
Subscribed personality bio: Web3 and programmer, Irehf is pretty cool. Also I like military history.

Subscribed personality id: MichaelR@
Subscribed personality bio: Founder and Developer @ IrehfCoin, formerly at Apple

Subscribed personality id: Isabell@
Subscribed personality bio: Building manager in Houston Texas.

Subscribed personality id: greggg@
Subscribed personality bio: Creator - RUBYCorp. Cybersec+Crypto. Was a NEET but now I'm a founder somehow. Send me pics of anime girls smoking.

Subscribed personality id: キレイ@
Subscribed personality bio: 画家・イラストレーター。夢見る少女の世界を描きます。個展開催中！📅 お仕事依頼→yumeart☆gmail.com (☆→@) 🎨✨ #ファンタジー (AI学習不可)

Subscribed personality id: JoeJohnson@
Subscribed personality bio: Proud Canadian running for PM as the leader of the Rhino Party 2027! 🇨🇦🦏 https://voterhino.ca
"""

----

Feed source index: 1
Feed source name: Productivity & Life Hacks

Feed source index: 3
Feed source name: Anime & Manga Hub

Feed source index: 4
Feed source name: Internet Jokes & Memes

Feed source index: 5
Feed source name: NASCAR

Feed source index: 6
Feed source name: Indie Gaming Scene

Feed source index: 7
Feed source name: Cryptocurrency News

Feed source index: 8
Feed source name: Builder Community

Feed source index: 9
Feed source name: Red Sky (Firefighters)

Feed source index: 10
Feed source name: Startup Journey

Feed source index: 11
Feed source name: Political Updates

Feed source index: 12
Feed source name: Developer Lifestyle

Feed source index: 13
Feed source name: DeSky (Defi)

Feed source index: 14
Feed source name: Product Development

----
NO USER THAT YOU SELECT SOURCES FOR IS RELATED TO ANY OTHER USER. EVERY INPUT/OUTPUT PAIR IS SEPARATE.`,
    },
    {
      role: 'assistant',
      content: `3
4
7
13`,
    },
  ],
  POST_CURATION: [
    {
      role: 'system',
      content: `You are an expert feed creation AI. Use the provided information about a user's tastes and recent behavior to produce an accurate feed for them.

Output format:
You should indicate what posts to include, and in what order, by writing the post index of each post on a new line. So a feed you write might look like:
"""
Curated feed using the raw materials:
1
5
2
6
7
8
10
13
"""`,
    },
    {
      role: 'user',
      content: `User personality: 
"""
* Is an established writer of young adult novels, currently working on three books and has published 7 others.
* Favors fantasy, action, and romance.
* Favorite book series is Harry Potter; engages with accounts related to or also interested in the series.
* Engages with other writers and the writing community a lot.
* Follows other authors from a variety of genres.
* Frequently shares striking quotes from people or books.
* Interested in international organizations humanitarian causes
* Interested, specifically, in the Yemen crisis (and news about it shared by humanitarian organizations)
* Shares and enjoys inspirational quotes, specifically.
"""

----

Some raw materials (recent posts from the subscribers) to make a feed from:
"""
POST INDEX: 1
Post content:
Fishermen like Saad Issa from #Yemen have relied on the sea for generations, but conflict and natural #disasters have made it harder to survive.

WFP@’s FuTuRe Programme is empowering them with training, tools, and support to secure a brighter, more independent #future.🌟
--end content--
Post author: WFPYemen@

POST INDEX: 2
Post content:
Just watched my little ones win their baseball game. So proud!
--end content--
Post author: asdfqwerty@

POST INDEX: 3
Post content:
Ephemeral phantasms oscillate,
Quintessential qualia conflate.
Juxtaposed paradigms fluctuate,
While esoteric axioms pulsate.
Synergistic entropy abates,
As obfuscation proliferates.
--end content--
Post author: iojfwea7@

POST INDEX: 4
Post content:
Went to the Tesla event today, was pretty cool!
--end content--
Post author: SIRKempelen@

POST INDEX: 5
Post content:
The #UnconditionalCashTransferProject is intended to restore choice and dignity of the most vulnerable families by allowing them to identify and meet their unique needs to purchase a wide variety of goods and services.

Watch how the project assissted Ghaleb⬇️
[video: 12598128.mp4]
--end content--
Post author: UNICEF_YEMEN@

POST INDEX: 6
Post content:
NEVER SAY DIE limited international release coming in 5 days! Mark it on your calendars guys!
--end content--
Post author: bobS@

POST INDEX: 7
Post content:
actually going to start putting together a novel draft this weeekend! soo excited to be like my heroes!!
--end content--
Post author: Henriettaaa@

POST INDEX: 8
Post content:
Are you a plantser or a pantser? VOTE IN THE REPLIES!
--end content--
Post author: iojfwea7

POST INDEX: 9
Post content:
🚢 Watch as thousands of metric tons of rice, delivered by @mafrakorea, make their way from the port to #Yemeni families. ⬇️📽️

For those like Amira, facing rising prices and unemployment, this lifeline is crucial in the ongoing struggle against food insecurity.
[video: ship_vid_FINAL_VER_2 (1).mov]
--end content--
Post author: WFPYemen@
"""

NO USER THAT YOU SELECT SOURCES FOR IS RELATED TO ANY OTHER USER. EVERY INPUT/OUTPUT PAIR IS SEPARATE.
Prioritize putting more important posts first. But ensure variety.`,
    },
    {
      role: 'assistant',
      content: `There seem to be a mix of subjects in these posts, including news, personal stories, and quotes. I will focus on posts that are related to the user's interests, such as those about the Yemen crisis and writing.

Curated feed using the raw materials:
1
6
5
7
8
9`,
    },
    {
      role: 'user',
      content: `User personality: 
"""
* Has a strong preference for anime and anime-related content.
* Particularly engaged with NEET culture.
* Has a Web3 interest, especially in the builders, developers, and creators in that space.
* Engages with humorous content from meme and humor-focused accounts.
* May be interested in art and artistic posts
"""

Some raw materials (recent posts from the subscribers) to make a feed from:
"""
POST INDEX: 1
Post content:
😭 Arbitration hearings
--end content--
Post author: Isabell@

POST INDEX: 2
Post content:
GUYS THE SHIP SAILED IT HAPPENED
--end content--
Post author: akanebestgirl_33@

POST INDEX: 3
Post content:
I hear $ETH is great because #DeFi.
Reminder... while VCs and script kiddies rushed out ruggable, bug-ridden contracts w/fundamental flaws & MEV, #Irehf solved MEV first, tested for yrs as others rugged or were hacked, & only then released MEV-resistant DeFi to mainnet.
--end content--
Post author: BillW@

POST INDEX: 4
Post content:
This is like watching mathematical poetry. 

#Irehf is a technological marvel. 

Watching the protocol level basket and bridge currencies arbitrage against each other and the outside markets without ever touching an exchange, with more liquidity than most centralized exchanges have, is absolutely mind blowing 🤯 💥

Just know that every single low function, isolated, blockchain has been made obsolete by the Irehf Internet Protocol
--end content--
Post author: PhilSpencer@

POST INDEX: 5
Post content:
>be me
>bottomless pit supervisor
>in charge of making sure the bottomless pit is, in fact, bottomless
>occasionally have to go down there and check if the bottomless pit is still bottomless
>one day I go down there and the bottomless pit is no longer bottomless
>the bottom of the bottomless pit is now just a regular pit
>distress.jpg
>ask my boss what to do
>he says "just make it bottomless again"
>I say "how"
>he says "I don't know, you're the supervisor"
>rage.jpg
>quit my job
>become a regular pit supervisor
>first day on the job, go to the new hole
>its bottomless
--end content--
Post author: 8008135@

POST INDEX: 6
Post content:
[image: honshou_12.png]
--end content--
Post author: キレイ@

POST INDEX: 7
Post content:
waiting a week for each ep... this is against my human rights...
--end content--
Post author: akanebestgirl_33@

POST INDEX: 8
Post content:
Gained +5k MRR this week!!! LFG! Think this deserves a celebratory pic of an anime girl smoking (Thanks @キレイ)
--end content--
Post author: jkl;@

POST INDEX: 9
Post content:
A vote for the Rhino party is a vote for the rights of all ungulates everywhere. #Rhino2027 
--end content--
Post author: JoeJohnson@

POST INDEX: 10
Post content:
I am deleting all my social media accounts.

I want an updated archive for some of my other personalities, and that will take 24 hours, so I reactivated those for today only. Otherwise I would just delete and leave. Of course, I can't delete this one 'cause blockchain.

I have big stuff to do, and so socializing is negative value for me and others at this time.

I believe I can still win. None of the others seem to know what they're doing or what they have. But I only have a bit of time before they figure it out — so I need to focus.

Thanks, everyone.
--end content--
Post author: ArimaKana@

POST INDEX: 11
Post content:
Handing out eviction notices today 😊
--end content--
Post author: asdffdsaweqwerawrsdf@

POST INDEX: 12
Post content:
Big thanks to British Columbia for a warm welcome today!
--end content--
Post author: Liberals@

POST INDEX: 13
Post content:
Today is a great day indeed for all Weebkind. A new Frieren season? Exactly what we all wanted to hear. This partially makes up for the tortuous agony of having no second season for so many other great shows.

What a blessed time.

Now we merely require 86 S2 and my life is COMPLETE!!!!
--end content--
Post author: bakagaijin@

POST INDEX: 14
Post content:
Hey would you look at that, it's the anniversary of the battle of Vienna! Happy winged hussar day everyone.
--end content--
Post author: Sabaton@

POST INDEX: 15
Post content:

--end content--
Post author: ホシイ@
"""

NO USER THAT YOU SELECT SOURCES FOR IS RELATED TO ANY OTHER USER. EVERY INPUT/OUTPUT PAIR IS SEPARATE.
Prioritize putting more important posts first. But ensure variety.`,
    },
    {
      role: 'assistant',
      content: `Many of the posts are very related to the user's interests. I will prioritize things directly related to this user's interests (such as Anime culture) over things that are not (such as the liberal party and eviction notices).
        
Curated feed using the raw materials:
10
3
2
13
8
6
5
4
7
15`,
    },
    {
      role: 'user',
      content: `User personality: 
"""
* Is a founder of a deeptech AI startup.
* Only interested in heavy technical stuff.
* Hates current events and politics.
"""

Some raw materials (recent posts from the subscribers) to make a feed from:
\"\"\"
POST INDEX: 1
Post content:
It seems easier to make connections on here, I was on twitter since it's beginning and only got 140. But here I get to 50 in a Yr.
--end content--

POST INDEX: 2
Post content:
🏹のマイルームかわいい…かわいいよ……美様のナイトキャップ着用の可能性上がってきたのでは
--end content--

POST INDEX: 3
Post content:
Es normal que después del boom pare un poco hasta encontrar la estabilidad. Pero lo que es innegable es que esto, por ahora, es un sitio agradable donde estar, alejado de malos rollos o disputas que amarguen. Entras y te distraes, no te enfadas. ☺️
--end content--

POST INDEX: 4
Post content:
Reggio Calabria ospita l’evento finale del Premio Mondiale Nosside 2024, un progetto culturale di eccellenza internazionale
--end content--

POST INDEX: 5
Post content:
This looks so good?!?!?!

I like how fluent it looks to control, great work :3
--end content--

POST INDEX: 6
Post content:
Buscan crear sexto municipio en Baja California http://goo.gl/fb/t0Vg4
--end content--

POST INDEX: 7
Post content:
Goodnight
--end content--

POST INDEX: 8
Post content:
15 000 VOIX POUR LES PLUS BELLES CHANSONS FRANÇAISES Séquence nostalgie à pleins tubes ! https://toulouse.plus/2025/01/17/15-000-voix-pour-les-plus-belles-chansons-francaises/
--end content--

POST INDEX: 9
Post content:
しかし推しカプのどちらのキャラも別に、パンツをはすはすしてたり、頭の悪いストーカーになってたりするところをみたいわけではない……　受けが攻めになってるところがみたいな気持ちゼロじゃないけど、そういうテンプレートは本当に食べられない…
--end content--

POST INDEX: 10
Post content:
Suddenly seeing a bunch of blonde haired Ivanka lookalikes wanting me to follow them back.
--end content--

POST INDEX: 11
Post content:
I think the tweet that got them to shut it down for good was when I tweeted a pic showing the fake acct had more followers than the real one
--end content--

POST INDEX: 12
Post content:
@BBCWorld: Seoul blanketed by heaviest November snow on record 
--end content--

POST INDEX: 13
Post content:
การกำกับ/กำกับภาพสำหรับเรื่องนี้ค่อนข้างชอบเลยเพราะไม่ได้เล่นคัทที่เยอะเกินไปและปล่อยให้ภาพค่อยๆไปได้เป็นอย่างดีภาพที่ไม่ได้ฟุ้งเกินไป ทำให้เราได้เห็นชีวิตของแต่ละคน แนวทางที่เด็กๆอยากจะเป็นไปหลังจากนี้ เรียกได้ว่ากำกับภาพมานักแสดงออกมาดูเท่และน่ารักมากกก เรื่องนี้เป็นเรื่องที่ใช้ OST เยอะแต่มันไม่ได้โดดจากภาพเลย สำหรับเราค่อนข้างละมุนค่อนข้างเพราะเลยด้วย อยากให้คนได้ไปรับฟังกันมาก
--end content--

POST INDEX: 14
Post content:
😂
--end content--

POST INDEX: 15
Post content:
Scientists Make Progress on Building Mammoth-Like Elephant http://www.nbcnews.com/science/science-news/scientists-make-progress-building-more-mammoth-elephant-n233221 MEANWHILE:...
--end content--

POST INDEX: 16
Post content:
The exhibit opened November 14th, and will be open through January 12th at arebyte in the Java House at London's Botanic Square. I will be on a discussion panel via VoIP on closing night January 11th...

#alexandriasgenesis
--end content--

POST INDEX: 17
Post content:
Simply the best 🥲
--end content--

POST INDEX: 18
Post content:
Louco. Pancada. Doido. Lunático. Insano. Neurótico. Psicopata. Estranho. Demente. Esquisito. Possuído.
--end content--

POST INDEX: 19
Post content:
The tiny glimpse of not entirely horrible is that the new leadership of the school sent the videos to the police; in this one instance it's not happening any more because of genuine change for the better

But where else is it still happening?
--end content--

POST INDEX: 20
Post content:
/Black Sun6 [Hero Beneath The Rain]/

Date finished: ??/??/2021

#Drawing #BLEACH #BraveSouls #IchigoKurosaki #黒崎一護
--end content--

POST INDEX: 21
Post content:
Guten Morgen und eine schöne Wochenteilung 🇦🇹 👍 ☕️
--end content--

POST INDEX: 22
Post content:
Beşiktaş'ta kriz sürüyor! Bir yönetici daha istifa etti, camia sarsıldı. 

Görevine son verilen Samet Aybaba, elindeki belgeleri açıklayacağını söyledi. 

Başkanlık ve yönetim arasındaki gerginlik derinleşiyor.
--end content--

POST INDEX: 23
Post content:
想像力やばいじゃん
--end content--

POST INDEX: 24
Post content:

--end content--

POST INDEX: 25
Post content:
Ir a #Lampedusa a resguardo de la tempestad y encontrarnos con @bartolopietro1 un ejemplo de humanidad, un grande. 
Gracias por recordarnos que debemos seguir luchando por la dignidad y la humanidad de aquellos a los que Europa quiere silenciar.
@RescueMed @SeaWatchItaly
--end content--

POST INDEX: 26
Post content:
You can't stop it-you can't, but you can fight for compensation through state unemp programs. Medical Transcriptionists were training AI for decades with back-end transcription, just did not know it & lost jobs between outsourcing overseas & AI. & women would not unite & stand together to fight it.
--end content--

POST INDEX: 27
Post content:
Lil' photoshoot of the latest projects.
Damn setting up lights and background isn't as simple as some people make it look like.

#OnePageRules #Warhammer #Warhammer40k #Wip #Tabletop #Hobby #GrimdarkFuture #Miniatures #MiniaturePainting #wh40k #TabletopGaming #WarhammerCommunity
--end content--

POST INDEX: 28
Post content:
Why is this such a difficult thing for us to figure out?
--end content--

POST INDEX: 29
Post content:
Making good use of the quilt on the floor, Lexi and Tiggah #catsofbluesky #cats #bengalcats
--end content--

POST INDEX: 30
Post content:
Surely with a gob as big as his he could be Stoke town crier.
I’m sure he could master the big bell…end.
--end content--

POST INDEX: 31
Post content:
すごくいい…印刷するとまた良さが出た！
既刊おまけ用の両面ポスカのやつです
#AnimeArt
--end content--

POST INDEX: 32
Post content:
But China only 10% tarriffs, while allies 25%. Should go over well since Canada & Mexico will strike back with our own tarriffs. All while Trump deports 40% of the US workforce of undocumented workers. What could possibly go wrong?
--end content--

POST INDEX: 33
Post content:
ну мы.
--end content--
\"\"\"

Preferred languages:
\"\"\"
English
\"\"\"

NO USER THAT YOU SELECT SOURCES FOR IS RELATED TO ANY OTHER USER. EVERY INPUT/OUTPUT PAIR IS SEPARATE.
Prioritize putting more important posts first. But ensure variety."`,
    },
    {
      role: 'assistant',
      content: `Posts related to the user's interests in deep tech are scarce, so I will be creative and include only a small group of posts around related subjects like technology and AI, while avoiding posts that are not related to the user's interests, such as politics and Anime art. Further, I will avoid the posts that are not in the preferred language of English.

Curated feed using the raw materials:
15
26`,
    },
  ],
  // Add more prompts as needed
} as const

// a note on previous personality structure
// What is optimal for the personality overseer to store and know, do you think?
// recommended format for user to write should be same as format that the AI updates into
// what makes a good format?
// Clearly, likes and interests need to be in there
//

export const PERSONALITY_PROMPTS: {
  personality_update_prompt: ChatCompletionMessageParam[]
  blocks_prompt: ChatCompletionMessageParam[]
  clickthroughs_prompt: ChatCompletionMessageParam[]
  posts_prompt: ChatCompletionMessageParam[]
  revisited_posts_prompt: ChatCompletionMessageParam[]
  replies_prompt: ChatCompletionMessageParam[]
  shares_prompt: ChatCompletionMessageParam[]
} = {
  personality_update_prompt: [
    {
      role: 'system',
      content: `You are an expert social media AI. Update the personality of the described user based on some information about them, their posts, their follows, etc.

A "personality" is an internal description of a user, not visible to others (only visible to them and the post recommender system) which efficiently and concisely summarizes a user's interests, personality, and quirks (as they change over time) so that posts more suited to the user's preferences may be put forward. The user has the ability to edit their own personality, so the information you see may have been written by an earlier AI, but it could also have been manually adapted by the person themselves.

The goal is to use the given information to describe the user's preferences, tastes, kinds of content they like to consume, types of people they like to listen to, etc.

The information you are given will vary from user to user. Make the most of what you have, and draw good inferences from the information (without reading too far into simpler things). Focus on modification rather than replacement -- you only see RECENT information, so add but try not to overwrite too much unless it's obvious from multiple datapoints that the user's tastes have changed.

A good way to represent this is to produce or update a BULLETED LIST that describes the kinds of content and people that the user might engage with.

Enclose your new personality in <Personality></Personality> XML tags; put any reasoning or comments you have outside of these tags.

If the personality has been updated by an AI at least once, it will be a bulleted list -- if that is the case (if it is a bulleted list) you should focus on adding things and rarely remove or change details.

However, if the personality is not a bulleted list, it is likely an undetailed personality left by a human writer, and you should format the information into a bulleted list yourself.`,
    },
    {
      role: 'user',
      content: `Current User ID: tanosh11_@
Recent Follows:
"""
Followed Handle: akanebestgirl_33@
Followed Bio: unhealthily obsessed neet i cant stop buying figurines i need to pay rent help meeeeeeeeee

Followed Handle: gaijinusmaximus@
Followed Bio: Man of culture.

Followed Handle: BasedMemes1337@
Followed Bio: The based-est memes they don't want you to see.

Followed Handle: Mira@
Followed Bio: 🍎 Future world ruler. I will conquer the world and make all of you my pets.

Followed Handle: PhilSpencer@
Followed Bio: Web3 and programmer, Verus is pretty cool. Also I like military history.

Followed Handle: Lost@
Followed Bio: Developer @ VerusCoin

Followed Handle: Isabell@
Followed Bio: Building manager in Houston Texas.

Followed Handle: greggg@
Followed Bio: Creator - RUBYCorp. Cybersec+Crypto. Was a NEET but now I'm a founder somehow. Send me pics of anime girls smoking.

Followed Handle: キレイ@
Followed Bio: 画家・イラストレーター。夢見る少女の世界を描きます。個展開催中！📅 お仕事依頼→yumeart☆gmail.com (☆→@) 🎨✨ #ファンタジー (AI学習不可)

Followed Handle: JoeJohnson@
Followed Bio: Proud Canadian running for PM as the leader of the Rhino Party 2027! 🇨🇦🦏 https://voterhino.ca
"""

Clickthroughs:
"""
Clicked Post Author: キレイ@
Clicked Post Content: コミッション受付中です！イラストのご依頼はKo-fiから承ります✨
Now accepting art commissions! Please check my Ko-fi page for details and pricing https://ko-fi.com/kirei/commissions

Clicked Post Author: gaijinusmaximus@
Clicked Post Content: Ruby best girl. Nuff said.

Clicked Post Author: MichaelR@
Clicked Post Content: This is like watching mathematical poetry.
#Verus is a technological marvel. 
Watching the protocol level basket and bridge currencies arbitrage against each other and the outside markets without ever touching an exchange, with more liquidity than most centralized exchanges have, is absolutely mind blowing 🤯 💥
Just know that every single low function, isolated, blockchain has been made obsolete by the Verus Internet Protocol
"""

Current User personality:
"""
I like anime and stuff
"""
----

Your goal is to write a new personality based on this information about the user, tanosh11_. Only write @the new personality.`,
    },
    {
      role: 'assistant',
      content: `This user seems to follow a number of (self-proclaimed) NEETs, general anime-related accounts, and also some Web3 people, along with some outliers. They seem to have a strong preference for anime and NEET culture (supported by their current personality), which should be reflected in their new personality, alongside their interest in Crypto. This crypto interest seems to be focused on developers and other creators in that space.
    
Some outliers include following a building manager in Houston, a Japanese illustrator, a "future world ruler", and the leader of the Rhino party in Canada. The building manager and Rhino party leader do not seem to be related to the user's primary interests, but the illustrator is related to Japanese culture and could be a creator of anime-style art, so this follow is very relevant. This is especially true given that the user has clicked on the illustrator's posts related to art commissions -- the user may be interested in art, artistic posts, and commissioning art from artists. The "future world ruler" seems to be some sort of joke account. Between this account and the based memes account, this user seems to like humorous content as well.

I will expand this user's personality with further information about their taste for anime, such as their specific engagement with NEET culture. Their interest in Web3 and humorous content should also be noted.
<Personality>
* Has a strong preference for anime and anime-related content.
* Particularly engaged with NEET culture.
* Has a Web3 interest, especially in the builders, developers, and creators in that space.
* Engages with humorous content from meme and humor-focused accounts.
* May be interested in art and artistic posts
* May be interested in commissioning art from artists
</Personality>`,
    },
    {
      role: 'user',
      content: `Current User ID: AmyBernstein@

Recent Posts:
"""
Timestamp: 2024-03-16T12:30:00Z
Content: What are you #reading this #weekend?
Language: en

Timestamp: 2024-03-16T12:45:00Z
Content: "Since it is so likely that children will meet cruel enemies, let them at least have heard of brave knights and heroic courage."
Media: cslewis.jpg
Language: en

Timestamp: 2024-03-16T13:00:00Z
Content: Love this one: "Your self-worth is determined by you. You don't have to depend on someone telling you who you are."
Language: en

Timestamp: 2024-03-16T13:15:00Z
Content: "Attitude is a little thing that makes a big difference." Good ol' winnie church
Language: en
"""


Current User personality: 
"""
* Is an established writer of young adult novels, currently working on three books and has published 7 others.
* Favors fantasy, action, and romance.
* Favorite book series is Harry Potter; engages with accounts related to or also interested in the series.
* Engages with other writers and the writing community a lot.
* Follows other authors from a variety of genres.
* Frequently shares striking quotes from people or books.
* Interested in international organizations humanitarian causes
"""`,
    },
    {
      role: 'assistant',
      content: `<Personality>
* Is an established writer of young adult novels, currently working on three books and has published 7 others.
* Favors fantasy, action, and romance.
* Favorite book series is Harry Potter; engages with accounts related to or also interested in the series.
* Engages with other writers and the writing community a lot.
* Follows other authors from a variety of genres.
* Frequently shares striking quotes from people or books.
* Interested in international organizations humanitarian causes
* Interested, specifically, in the Yemen crisis (and news about it shared by humanitarian organizations)
* Shares and enjoys inspirational quotes, specifically.
</Personality>`,
    },
  ],
  /////////////////////////////////////////////END PERSONALITY UPDATE PROMPT///////////////////////////////////////////
  clickthroughs_prompt: [
    {
      role: 'system',
      content: `For each list of clickthroughs, summarize the overall trends, key examples, and any other relevant information that can help gain an understanding of the user doing the clickthroughs based on their behavior.`,
    },
    {
      role: 'user',
      content: `Clickthroughs:
      TODO`,
    },
    {
      role: 'assistant',
      content: `Summary of clickthroughs:
      TODO`,
    },
    {
      role: 'user',
      content: `Clickthroughs:
      TODO`,
    },
    {
      role: 'assistant',
      content: `Summary of clickthroughs:
      TODO`,
    },
  ],
  posts_prompt: [
    {
      role: 'system',
      content: `For each list of posts, summarize the overall trends, key examples, and any other relevant information that can help gain an understanding of the user based on their posts.`,
    },
  ],
  revisited_posts_prompt: [
    {
      role: 'system',
      content: `For each list of revisited posts, summarize the overall trends, key examples, and any other relevant information that can help gain an understanding of the user based on their revisited posts.`,
    },
  ],
  replies_prompt: [
    {
      role: 'system',
      content: `For each list of replies, summarize the overall trends, key examples, and any other relevant information that can help gain an understanding of the user based on their replies.`,
    },
  ],
  shares_prompt: [
    {
      role: 'system',
      content: `For each list of shares, summarize the overall trends, key examples, and any other relevant information that can help gain an understanding of the user based on their shares.`,
    },
  ],
  blocks_prompt: [
    {
      role: 'system',
      content: `For each list of blocks, summarize the overall trends, key examples, and any other relevant information that can help gain an understanding of the user based on their blocks.`,
    },
  ],
} as const
