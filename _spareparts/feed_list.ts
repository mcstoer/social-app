// tuples, did, url-end, english name
export const FEED_LIST = [
    ['did:plc:z72i7hdynmk6r22z27h6tvur', 'whats-hot', 'What\'s Hot'], // NOTE does not change, all it was was that what-shot was missing the did: prefix
    // NOTE comment out if not doing datagen
    // ['did:plc:z72i7hdynmk6r22z27h6tvur', 'art-new', 'Art'],
    // ['did:plc:z72i7hdynmk6r22z27h6tvur', 'science-new', 'Science'],
    ['did:plc:cndfx4udwgvpjaakvxvh7wm5', 'flipboard-tech', 'Tech'],
    ['did:plc:kkf4naxqmweop7dv4l2iqqf5', 'verified-news', 'Generic News'],
    // ['did:plc:z72i7hdynmk6r22z27h6tvur', 'music-new', 'Music'],
    // ['did:plc:z72i7hdynmk6r22z27h6tvur', 'gaming-new', 'Gaming'],
    // ['did:plc:z72i7hdynmk6r22z27h6tvur', 'books-new', 'Books'],
    // ['did:plc:z72i7hdynmk6r22z27h6tvur', 'food-new', 'Food'],
    // ['did:plc:xcariuurag22domm7jgn4goj', 'tech-vibes', 'Indie Tech/Tech Vibes'],
    // ['did:plc:z72i7hdynmk6r22z27h6tvur', 'travel-new', 'Travel'],
    ['did:plc:4jb3re5tvklsvhuc3lkerj5q', 'aaak6p5s2f3cu', 'Academic Sky'],
    ['did:plc:66lbtw2porscqpmair6mir37', 'aaabkznpn5x2g', 'Green Sky (Climate)'],
    ['did:plc:tazrmeme4dzahimsykusrwrk', 'anime-en-new', 'Anime'],
    ['did:plc:gkvpokm7ec5j5yxls6xk4e3z', 'formula-one', 'Formula 1'],
    ['did:plc:abv47bjgzjgoh3yrygwoi36x', 'aaai4f7awwzkc', 'Writing Community'],
    ['did:plc:ffkgesg3jsv2j7aagkzrtcvt', 'aaagllxbcbsje', 'Birds'],
    ['did:plc:4jrld6fwpnwqehtce56qshzv', 'game-dev', 'Game Development'],
    ['did:plc:3awqkacz33aitph7ojbzv24l', 'aaacg5mlmmibi', 'Crypto'],
] as [string, string, string][];

// NOTE making a GET to https://api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=firesky.tv where handle is the handle of the user you want to get the feed for will give the DID of the user and so we can expand and fix this list with that. Anything from main bsky has a chance to be broke.
// lack of crypto in the crypto feed may be the result of a bad raw mateiral... we want more crypto feeds as input.
// NOTE making a GET to https://api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=firesky.tv where handle is the handle of the user you want to get the feed for will give the DID of the user and so we can expand and fix this list with that. Anything from main bsky has a chance to be broke.
// lack of crypto in the crypto feed may be the result of a bad raw mateiral... we want more crypto feeds as input.

// public personality is just an edited version of the private one; blank unless they go and create one. Start w/ private and cleanse it to create public. Public profile is explicit action.