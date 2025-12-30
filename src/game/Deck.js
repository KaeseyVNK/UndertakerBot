const CARDS = {
    NUMBERS: {
        '0': { count: 1, value: 0 },
        '1': { count: 1, value: 1 },
        '2': { count: 2, value: 2 },
        '3': { count: 3, value: 3 },
        '4': { count: 4, value: 4 },
        '5': { count: 5, value: 5 },
        '6': { count: 6, value: 6 },
        '7': { count: 7, value: 7 },
        '8': { count: 8, value: 8 },
        '9': { count: 9, value: 9 },
        '10': { count: 10, value: 10 },
        '11': { count: 11, value: 11 },
        '12': { count: 12, value: 12 },
    },
    ACTIONS: {
        'Freeze': { count: 3 },
        'Flip Three': { count: 3 },
        'Second Chance': { count: 3 },
    },
    MODIFIERS: {
        '+2': { count: 1, value: 2 },
        '+4': { count: 1, value: 4 },
        '+6': { count: 1, value: 6 },
        '+8': { count: 1, value: 8 },
        '+10': { count: 1, value: 10 },
        'x2': { count: 1 },
    }
};

function createDeck() {
    const deck = [];

    // 1. Add number cards based on the CARDS object
    for (const name in CARDS.NUMBERS) {
        const cardInfo = CARDS.NUMBERS[name];
        for (let i = 0; i < cardInfo.count; i++) {
            deck.push({ type: 'number', name: name, value: cardInfo.value });
        }
    }

    // 2. Add modifier cards based on the CARDS object
    for (const name in CARDS.MODIFIERS) {
        const cardInfo = CARDS.MODIFIERS[name];
        for (let i = 0; i < cardInfo.count; i++) {
            // The value for 'x2' is not for adding but for multiplying.
            // Let's assign a non-null value for consistency, though it's not used in score calculation.
            const value = name === 'x2' ? 2 : cardInfo.value;
            deck.push({ type: 'modifier', name: name, value: value });
        }
    }

    // 3. Add action cards based on the CARDS object
    for (const name in CARDS.ACTIONS) {
        const cardInfo = CARDS.ACTIONS[name];
        for (let i = 0; i < cardInfo.count; i++) {
            deck.push({ type: 'action', name: name, value: null });
        }
    }

    return deck;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

module.exports = { createDeck, shuffleDeck }; 